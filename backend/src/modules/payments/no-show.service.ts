import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AuthContext } from '../../auth/auth.service';
import { AuthService } from '../../auth/auth.service';
import { Prisma } from '../../generated/prisma/client';
import { runBusinessTransaction } from '../../prisma/business-transaction';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessClock } from '../../shared/time/business-clock';
import { formatWibDateTime, parseWibDateTime } from '../../shared/time/wib';
import { DeliveryFailureDto } from './no-show.dto';
import { PaymentsService } from './payments.service';
import { RefundsService } from './refunds.service';

@Injectable()
export class NoShowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly refunds: RefundsService,
    private readonly clock: BusinessClock,
    private readonly auth: AuthService,
  ) {}

  async deliveryFailure(
    context: AuthContext,
    bookingId: string,
    input: DeliveryFailureDto,
    key?: string,
  ) {
    const readyAt = parseWibDateTime(input.readyAt),
      failureAt = parseWibDateTime(input.customerFailureAt),
      reason = input.reason.trim();
    if (reason.length < 5)
      throw new BadRequestException('Alasan kegagalan penyerahan wajib diisi.');
    return this.payments.action(
      context,
      bookingId,
      key,
      'delivery.customer_failure',
      {
        readyAt: formatWibDateTime(readyAt),
        customerFailureAt: formatWibDateTime(failureAt),
        reason,
      },
      'admin',
      async (tx, booking) => {
        if (
          booking.deliveryType !== 'delivery' ||
          booking.status !== 'dikonfirmasi' ||
          !booking.items.length ||
          booking.items.some(
            (item) =>
              item.useStatus !== 'allocated' || item.pickedUpAt !== null,
          )
        )
          throw new ConflictException(
            'Catatan delivery hanya untuk booking dikonfirmasi sebelum serah terima.',
          );
        if (
          readyAt > failureAt ||
          (booking.confirmedAt !== null && readyAt < booking.confirmedAt) ||
          failureAt > this.clock.now() ||
          failureAt < booking.initialStartAt
        )
          throw new BadRequestException(
            'Waktu petugas siap dan kegagalan pelanggan tidak berurutan atau di masa depan.',
          );
        // Preserve the verified evidence. Corrections require their own audited
        // workflow; a second request must not rewrite a deadline already in use.
        if (booking.deliveryReadyAt || booking.customerFailureConfirmedAt)
          throw new ConflictException(
            'Catatan kegagalan delivery sudah tersimpan.',
          );
        const delaySeconds = Math.max(
          0,
          Math.ceil(
            (readyAt.getTime() - booking.initialStartAt.getTime()) / 1000,
          ),
        );
        if (delaySeconds > 2147483647)
          throw new BadRequestException('Durasi keterlambatan tidak valid.');
        const dueAt = new Date(
          booking.initialStartAt.getTime() +
            this.payments.rules(booking).values.no_show_minutes * 60000 +
            delaySeconds * 1000,
        );
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            deliveryReadyAt: readyAt,
            customerFailureConfirmedAt: failureAt,
            deliveryFailureReason: reason,
            shopDelaySeconds: delaySeconds,
            noShowDueAt: dueAt,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: context.user.id,
            action: 'delivery.customer_failure',
            entityType: 'Booking',
            entityId: booking.id,
            reason,
            createdAt: this.clock.now(),
            changes: {
              readyAt: formatWibDateTime(readyAt),
              customerFailureAt: formatWibDateTime(failureAt),
              previousDueAt: formatWibDateTime(booking.noShowDueAt),
              noShowDueAt: formatWibDateTime(dueAt),
              shopDelaySeconds: delaySeconds,
            },
          },
        });
        await tx.outboxEvent.create({
          data: {
            eventKey: 'delivery.customer_failure:' + booking.id,
            aggregateType: 'Booking',
            aggregateId: booking.id,
            eventType: 'delivery.customer_failure',
            payload: { bookingId: booking.id },
            occurredAt: this.clock.now(),
          },
        });
        return { bookingId: booking.id };
      },
    );
  }

  private missingDeliveryEvidence: Prisma.BookingWhereInput = {
    deliveryType: 'delivery',
    OR: [
      { deliveryReadyAt: null },
      { customerFailureConfirmedAt: null },
      { deliveryFailureReason: null },
    ],
  };

  private eligible: Prisma.BookingWhereInput = {
    OR: [
      { deliveryType: 'pickup' },
      {
        deliveryType: 'delivery',
        deliveryReadyAt: { not: null },
        customerFailureConfirmedAt: { not: null },
        deliveryFailureReason: { not: null },
      },
    ],
  };

  private candidates(filter: Prisma.BookingWhereInput, limit: number) {
    return this.prisma.booking.findMany({
      where: {
        status: 'dikonfirmasi',
        noShowDueAt: { lt: this.clock.now() },
        AND: [filter],
        items: {
          some: {},
          none: {
            OR: [
              { useStatus: { not: 'allocated' } },
              { pickedUpAt: { not: null } },
            ],
          },
        },
      },
      orderBy: [{ noShowDueAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { id: true },
    });
  }

  private reviewCandidates(limit: number) {
    // Already flagged deliveries must not occupy every subsequent review batch.
    return this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT b.id FROM bookings b
      WHERE b.status='dikonfirmasi' AND b.delivery_type='delivery'
        AND b.no_show_due_at < ${this.clock.now()}::timestamp
        AND (b.delivery_ready_at IS NULL OR b.customer_failure_confirmed_at IS NULL OR b.delivery_failure_reason IS NULL)
        AND EXISTS (SELECT 1 FROM booking_items i WHERE i.booking_id=b.id)
        AND NOT EXISTS (SELECT 1 FROM booking_items i WHERE i.booking_id=b.id AND (i.use_status <> 'allocated' OR i.picked_up_at IS NOT NULL))
        AND NOT EXISTS (SELECT 1 FROM outbox_events e WHERE e.event_key=
          'delivery.no_show_review:' || b.id::text || ':' || to_char(b.no_show_due_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') || '+07:00')
      ORDER BY b.no_show_due_at, b.id LIMIT ${limit}`;
  }

  async followUp(context: AuthContext) {
    // Live queue rather than historical alerts; served only through admin guard.
    return runBusinessTransaction(this.prisma, async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      return tx.booking.findMany({
        where: {
          status: 'dikonfirmasi',
          noShowDueAt: { lt: this.clock.now() },
          AND: [this.missingDeliveryEvidence],
          items: { some: {}, none: { pickedUpAt: { not: null } } },
        },
        orderBy: [{ noShowDueAt: 'asc' }, { id: 'asc' }],
        take: 100,
        select: {
          id: true,
          code: true,
          initialStartAt: true,
          noShowDueAt: true,
          deliveryReadyAt: true,
          customerFailureConfirmedAt: true,
        },
      });
    });
  }

  async processDue(limit = 100) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
      throw new BadRequestException('Batas batch harus 1–1000.');
    // Separate batches ensure old unverified deliveries cannot starve pickups.
    const candidates = await this.candidates(this.eligible, limit);
    const reviews = await this.reviewCandidates(limit);
    let cancelled = 0,
      flagged = 0,
      failed = 0;
    for (const candidate of [...candidates, ...reviews]) {
      try {
        const result = await runBusinessTransaction(this.prisma, async (tx) => {
          const booking = await this.payments.lockBooking(tx, candidate.id);
          if (
            booking.status !== 'dikonfirmasi' ||
            this.clock.now() <= booking.noShowDueAt ||
            !booking.items.length ||
            booking.items.some(
              (item) =>
                item.useStatus !== 'allocated' || item.pickedUpAt !== null,
            )
          )
            return 'skipped';
          if (
            booking.deliveryType === 'delivery' &&
            (!booking.deliveryReadyAt ||
              !booking.customerFailureConfirmedAt ||
              !booking.deliveryFailureReason)
          ) {
            const eventKey =
              'delivery.no_show_review:' +
              booking.id +
              ':' +
              formatWibDateTime(booking.noShowDueAt);
            if (await tx.outboxEvent.findUnique({ where: { eventKey } }))
              return 'skipped';
            await tx.outboxEvent.create({
              data: {
                eventKey,
                aggregateType: 'Booking',
                aggregateId: booking.id,
                eventType: 'delivery.no_show_review',
                payload: { bookingId: booking.id },
                occurredAt: this.clock.now(),
              },
            });
            await tx.auditLog.create({
              data: {
                action: 'delivery.no_show_review',
                entityType: 'Booking',
                entityId: booking.id,
                changes: {
                  status: booking.status,
                  reason: 'missing_delivery_evidence',
                },
                createdAt: this.clock.now(),
              },
            });
            return 'flagged';
          }
          await this.refunds.noShow(tx, booking);
          return 'cancelled';
        });
        if (result === 'cancelled') cancelled++;
        if (result === 'flagged') flagged++;
      } catch {
        failed++;
      }
    }
    return {
      scanned: candidates.length + reviews.length,
      cancelled,
      flagged,
      failed,
    };
  }
}
