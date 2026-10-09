import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  Prisma,
  NotificationChannel,
  NotificationDelivery,
  OutboxEvent,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthContext, AuthService } from '../../auth/auth.service';
import { BusinessClock } from '../../shared/time/business-clock';
import { formatWibDateTime, parseWibDateTime } from '../../shared/time/wib';
import { runBusinessTransaction } from '../../prisma/business-transaction';
import { RisksService } from '../risks/risks.service';
import { DeliveryError, NotificationTransport } from './notification-transport';
import { PageDto } from '../inventory/inventory.dto';

type Context = {
  bookingId: string;
  extensionId?: string;
  proofId?: string;
  bookingItemId?: string;
  deadline?: string;
  reminderMinutes?: number;
  subscriptionId?: string;
  signature?: string;
};
const labels: Record<string, string> = {
  'booking.created': 'Booking baru',
  'payment.proof_uploaded': 'Periksa bukti pembayaran',
  'extension.quote_requested': 'Isi tarif penjemputan',
  'extension.proof_uploaded': 'Periksa pembayaran perpanjangan',
  'return.reported': 'Periksa pengembalian barang',
  'booking.unit_at_risk': 'Booking berisiko: periksa unit',
  'booking.confirmation_reminder': 'Batas konfirmasi booking mendekat',
  'booking.pickup_urgent': 'Pengambilan kurang dari 20 menit',
  'booking.confirmation_overdue': 'Konfirmasi booking melewati batas',
  'extension.confirmation_reminder': 'Batas konfirmasi perpanjangan mendekat',
  'extension.confirmation_overdue': 'Konfirmasi perpanjangan melewati batas',
};
@Injectable()
export class NotificationsService {
  private bookingCursor?: string;
  private extensionCursor?: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly clock: BusinessClock,
    private readonly transport: NotificationTransport,
    private readonly risks: RisksService,
  ) {}
  async list(context: AuthContext, page: PageDto) {
    return runBusinessTransaction(this.prisma, async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      return tx.notificationDelivery.findMany({
        where: { recipientAdminId: context.user.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page.page - 1) * page.limit,
        take: page.limit,
        select: {
          id: true,
          eventType: true,
          channel: true,
          sourceId: true,
          dueAt: true,
          status: true,
          attempts: true,
          retryAt: true,
          error: true,
        },
      });
    });
  }
  private async enqueue(
    tx: Prisma.TransactionClient,
    eventType: string,
    context: Context,
    dueAt: Date,
    version: string,
    event?: OutboxEvent,
  ) {
    const channels: NotificationChannel[] = ['push'];
    const admins = await tx.user.findMany({
      where: { role: 'admin', isActive: true },
      include: { pushSubscriptions: true },
    });
    for (const admin of admins)
      for (const channel of channels) {
        const devices =
          channel === 'push'
            ? admin.pushSubscriptions.map((row) => row.id)
            : [undefined];
        for (const subscriptionId of devices) {
          const key = createHash('sha256')
            .update(
              JSON.stringify([
                eventType,
                context.bookingId,
                context.extensionId ?? context.bookingItemId ?? '',
                version,
                admin.id,
                channel,
                subscriptionId ?? '',
              ]),
            )
            .digest('hex');
          await tx.notificationDelivery.createMany({
            data: [
              {
                outboxEventId: event?.id,
                sourceType: context.extensionId ? 'Extension' : 'Booking',
                sourceId: context.extensionId ?? context.bookingId,
                eventType,
                recipientAdminId: admin.id,
                channel,
                dueAt,
                deduplicationKey: key,
                context: {
                  ...context,
                  ...(subscriptionId ? { subscriptionId } : {}),
                },
              },
            ],
            skipDuplicates: true,
          });
        }
      }
  }
  private payload(event: OutboxEvent): Prisma.JsonObject {
    return event.payload &&
      typeof event.payload === 'object' &&
      !Array.isArray(event.payload)
      ? event.payload
      : {};
  }
  async dispatch(limit = 100) {
    const ids = await this.prisma.outboxEvent.findMany({
      where: { dispatchedAt: null, attempts: { lt: 3 } },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
      take: limit,
    });
    let dispatched = 0,
      failed = 0;
    for (const row of ids) {
      try {
        dispatched += await runBusinessTransaction(this.prisma, async (tx) => {
          const locked = await tx.$queryRaw<
            { id: string }[]
          >`SELECT id FROM outbox_events WHERE id=${row.id}::uuid AND dispatched_at IS NULL FOR UPDATE SKIP LOCKED`;
          if (!locked.length) return 0;
          const event = await tx.outboxEvent.findUniqueOrThrow({
              where: { id: row.id },
            }),
            payload = this.payload(event);
          if (
            labels[event.eventType] &&
            !event.eventType.includes('confirmation_')
          ) {
            const bookingId =
              typeof payload.bookingId === 'string'
                ? payload.bookingId
                : event.aggregateId;
            if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(bookingId))
              throw new Error('invalid_source');
            const context: Context = { bookingId };
            if (typeof payload.extensionId === 'string')
              context.extensionId = payload.extensionId;
            if (typeof payload.bookingItemId === 'string')
              context.bookingItemId = payload.bookingItemId;
            if (typeof payload.proofId === 'string')
              context.proofId = payload.proofId;
            if (
              event.eventType === 'payment.proof_uploaded' &&
              typeof payload.sourceId === 'string'
            )
              context.proofId = payload.sourceId;
            await this.enqueue(
              tx,
              event.eventType,
              context,
              this.clock.now(),
              event.eventKey,
              event,
            );
          }
          await tx.outboxEvent.update({
            where: { id: event.id },
            data: {
              dispatchedAt: this.clock.now(),
              attempts: { increment: 1 },
              error: null,
            },
          });
          return 1;
        });
      } catch {
        failed++;
        await runBusinessTransaction(this.prisma, async (tx) => {
          const locked = await tx.$queryRaw<
            { id: string }[]
          >`SELECT id FROM outbox_events WHERE id=${row.id}::uuid AND dispatched_at IS NULL FOR UPDATE SKIP LOCKED`;
          if (!locked.length) return;
          const event = await tx.outboxEvent.findUniqueOrThrow({
            where: { id: row.id },
          });
          await tx.outboxEvent.update({
            where: { id: row.id },
            data: {
              attempts: { increment: 1 },
              error: 'outbox_dispatch_failed',
              ...(event.attempts >= 2
                ? { dispatchedAt: this.clock.now() }
                : {}),
            },
          });
        });
      }
    }
    return { dispatched, failed };
  }
  /** Direct persisted scheduling avoids reliance on timing of a particular outbox dispatcher. */
  async schedule(limit = 100) {
    const pendingBooking = {
      status: 'menunggu_konfirmasi' as const,
      confirmationDueAt: { not: null },
    };
    const pendingExtension = {
      status: 'menunggu_konfirmasi' as const,
      confirmationDueAt: { not: null },
    };
    let bookings = await this.prisma.booking.findMany({
      where: {
        ...pendingBooking,
        ...(this.bookingCursor ? { id: { gt: this.bookingCursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit,
      select: { id: true },
    });
    if (!bookings.length && this.bookingCursor) {
      this.bookingCursor = undefined;
      bookings = await this.prisma.booking.findMany({
        where: pendingBooking,
        orderBy: { id: 'asc' },
        take: limit,
        select: { id: true },
      });
    }
    let extensions = await this.prisma.extension.findMany({
      where: {
        ...pendingExtension,
        ...(this.extensionCursor ? { id: { gt: this.extensionCursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit,
      select: { id: true },
    });
    if (!extensions.length && this.extensionCursor) {
      this.extensionCursor = undefined;
      extensions = await this.prisma.extension.findMany({
        where: pendingExtension,
        orderBy: { id: 'asc' },
        take: limit,
        select: { id: true },
      });
    }
    let failed = 0;
    for (const row of bookings)
      try {
        await runBusinessTransaction(this.prisma, async (tx) => {
          const booking = await tx.booking.findUnique({
            where: { id: row.id },
          });
          if (
            booking?.status !== 'menunggu_konfirmasi' ||
            !booking.confirmationDueAt
          )
            return;
          const obligation = await tx.paymentObligation.findFirst({
            where: {
              bookingId: booking.id,
              extensionId: null,
              status: 'proof_pending',
              pendingProofId: { not: null },
            },
          });
          if (!obligation?.pendingProofId) return;
          const deadline = formatWibDateTime(booking.confirmationDueAt),
            context: Context = {
              bookingId: booking.id,
              deadline,
              proofId: obligation.pendingProofId,
            },
            version = deadline + ':' + context.proofId;
          for (const minutes of [30, 15, 5])
            await this.enqueue(
              tx,
              'booking.confirmation_reminder',
              { ...context, reminderMinutes: minutes },
              new Date(booking.confirmationDueAt.getTime() - minutes * 60000),
              version + ':' + minutes,
            );
          await this.enqueue(
            tx,
            'booking.pickup_urgent',
            context,
            new Date(booking.initialStartAt.getTime() - 1200000),
            version,
          );
          await this.enqueue(
            tx,
            'booking.confirmation_overdue',
            context,
            new Date(booking.confirmationDueAt.getTime() + 1),
            version,
          );
        });
      } catch {
        failed++;
      }
    for (const row of extensions)
      try {
        await runBusinessTransaction(this.prisma, async (tx) => {
          const extension = await tx.extension.findUnique({
            where: { id: row.id },
          });
          if (
            extension?.status !== 'menunggu_konfirmasi' ||
            !extension.confirmationDueAt
          )
            return;
          const obligation = await tx.paymentObligation.findFirst({
            where: {
              extensionId: extension.id,
              status: 'proof_pending',
              pendingProofId: { not: null },
            },
          });
          if (!obligation?.pendingProofId) return;
          const deadline = formatWibDateTime(extension.confirmationDueAt),
            context: Context = {
              bookingId: extension.bookingId,
              extensionId: extension.id,
              deadline,
              proofId: obligation.pendingProofId,
            },
            version = deadline + ':' + context.proofId;
          for (const minutes of [30, 15, 5])
            await this.enqueue(
              tx,
              'extension.confirmation_reminder',
              { ...context, reminderMinutes: minutes },
              new Date(extension.confirmationDueAt.getTime() - minutes * 60000),
              version + ':' + minutes,
            );
          await this.enqueue(
            tx,
            'extension.confirmation_overdue',
            context,
            new Date(extension.confirmationDueAt.getTime() + 1),
            version,
          );
        });
      } catch {
        failed++;
      }
    this.bookingCursor = bookings.at(-1)?.id;
    this.extensionCursor = extensions.at(-1)?.id;
    return { bookings: bookings.length, extensions: extensions.length, failed };
  }
  private context(delivery: NotificationDelivery): Context | null {
    const value = delivery.context;
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      typeof value.bookingId !== 'string'
    )
      return null;
    const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    for (const key of [
      'bookingId',
      'extensionId',
      'proofId',
      'bookingItemId',
      'subscriptionId',
    ]) {
      const field = value[key];
      if (
        field !== undefined &&
        (typeof field !== 'string' || !uuid.test(field))
      )
        return null;
    }
    if (value.deadline !== undefined) {
      if (typeof value.deadline !== 'string') return null;
      try {
        parseWibDateTime(value.deadline);
      } catch {
        return null;
      }
    }
    if (
      value.reminderMinutes !== undefined &&
      (typeof value.reminderMinutes !== 'number' ||
        ![30, 15, 5].includes(value.reminderMinutes))
    )
      return null;
    return value as Context;
  }
  private async relevant(
    tx: Prisma.TransactionClient,
    delivery: NotificationDelivery,
    context: Context,
  ) {
    const booking = await tx.booking.findUnique({
      where: { id: context.bookingId },
    });
    if (!booking) return null;
    const type = delivery.eventType;
    if (
      type.startsWith('booking.confirmation_') ||
      type === 'booking.pickup_urgent'
    ) {
      if (
        booking.status !== 'menunggu_konfirmasi' ||
        !booking.confirmationDueAt ||
        context.deadline !== formatWibDateTime(booking.confirmationDueAt)
      )
        return null;
      if (
        context.proofId &&
        !(await tx.paymentObligation.count({
          where: {
            bookingId: booking.id,
            extensionId: null,
            status: 'proof_pending',
            pendingProofId: context.proofId,
          },
        }))
      )
        return null;
      if (
        type === 'booking.confirmation_reminder' &&
        this.clock.now().getTime() >=
          booking.confirmationDueAt.getTime() -
            ((context.reminderMinutes ?? 30) === 30
              ? 15
              : context.reminderMinutes === 15
                ? 5
                : 0) *
              60000
      )
        return null;
    } else if (type === 'payment.proof_uploaded') {
      const proof = context.proofId
        ? await tx.paymentProof.findUnique({
            where: { id: context.proofId },
            include: { obligation: true },
          })
        : null;
      if (
        !proof ||
        proof.status !== 'pending' ||
        proof.obligation.pendingProofId !== proof.id ||
        proof.obligation.bookingId !== booking.id ||
        ['dibatalkan', 'ditolak', 'kedaluwarsa', 'selesai'].includes(
          booking.status,
        )
      )
        return null;
    } else if (type.startsWith('extension.')) {
      const extension = context.extensionId
        ? await tx.extension.findUnique({ where: { id: context.extensionId } })
        : null;
      if (!extension || extension.bookingId !== booking.id) return null;
      if (type === 'extension.quote_requested') {
        if (extension.status !== 'draft_quote') return null;
      } else if (extension.status !== 'menunggu_konfirmasi') return null;
      if (
        context.proofId &&
        !(await tx.paymentObligation.count({
          where: {
            extensionId: extension.id,
            status: 'proof_pending',
            pendingProofId: context.proofId,
          },
        }))
      )
        return null;
      if (type === 'extension.proof_uploaded') {
        const proof = context.proofId
          ? await tx.paymentProof.findUnique({
              where: { id: context.proofId },
              include: { obligation: true },
            })
          : null;
        if (
          !proof ||
          proof.status !== 'pending' ||
          proof.obligation.extensionId !== extension.id ||
          proof.obligation.pendingProofId !== proof.id
        )
          return null;
      }
      if (
        context.deadline &&
        (!extension.confirmationDueAt ||
          formatWibDateTime(extension.confirmationDueAt) !== context.deadline)
      )
        return null;
      if (
        type === 'extension.confirmation_reminder' &&
        extension.confirmationDueAt &&
        this.clock.now().getTime() >=
          extension.confirmationDueAt.getTime() -
            ((context.reminderMinutes ?? 30) === 30
              ? 15
              : context.reminderMinutes === 15
                ? 5
                : 0) *
              60000
      )
        return null;
    } else if (type === 'return.reported') {
      if (
        !context.bookingItemId ||
        !(await tx.bookingItem.count({
          where: {
            id: context.bookingItemId,
            bookingId: booking.id,
            useStatus: 'return_pending',
          },
        }))
      )
        return null;
    } else if (type === 'booking.unit_at_risk') {
      const risks = await this.risks.bookingRisks(tx, booking.id);
      if (!risks.some((row) => row.bookingItemId === context.bookingItemId))
        return null;
    } else if (
      type === 'booking.created' &&
      !['menunggu_pembayaran', 'menunggu_konfirmasi'].includes(booking.status)
    )
      return null;
    return booking;
  }
  async sendDue(limit = 100) {
    const now = this.clock.now();
    const admins = await this.prisma.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true },
    });
    const whatsAdmins = admins
      .filter((admin) => this.transport.ready('whatsapp', admin.id))
      .map((admin) => admin.id);
    const channels: Prisma.NotificationDeliveryWhereInput[] = [];
    if (this.transport.ready('push', '')) channels.push({ channel: 'push' });
    if (whatsAdmins.length)
      channels.push({
        channel: 'whatsapp',
        recipientAdminId: { in: whatsAdmins },
      });
    const candidates = channels.length
      ? await this.prisma.notificationDelivery.findMany({
          where: {
            AND: [{ OR: channels }],
            dueAt: { lte: now },
            attempts: { lt: 3 },
            OR: [
              { status: 'queued' },
              { status: 'failed', retryAt: { lte: now } },
              { status: 'sending', leaseExpiresAt: { lte: now } },
            ],
          },
          orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
          take: limit,
        })
      : [];
    let sent = 0,
      failed = 0,
      skipped = 0,
      processed = 0;
    for (let offset = 0; offset < candidates.length; offset += 4) {
      await Promise.all(
        candidates.slice(offset, offset + 4).map(async (row) => {
          if (!this.transport.ready(row.channel, row.recipientAdminId)) return;
          const claim = await runBusinessTransaction(
            this.prisma,
            async (tx) => {
              const locked = await tx.$queryRaw<
                { id: string }[]
              >`SELECT id FROM notification_deliveries WHERE id=${row.id}::uuid FOR UPDATE SKIP LOCKED`;
              if (!locked.length) return null;
              const delivery = await tx.notificationDelivery.findUniqueOrThrow({
                  where: { id: row.id },
                }),
                current = this.clock.now();
              if (
                delivery.attempts >= 3 ||
                !['queued', 'failed', 'sending'].includes(delivery.status) ||
                delivery.dueAt > current ||
                (delivery.status === 'sending' &&
                  (!delivery.leaseExpiresAt ||
                    delivery.leaseExpiresAt > current)) ||
                (delivery.status === 'failed' &&
                  (!delivery.retryAt || delivery.retryAt > current))
              )
                return null;
              const context = this.context(delivery),
                admin = await tx.user.findUnique({
                  where: { id: delivery.recipientAdminId },
                });
              const booking =
                context && admin?.isActive && admin.role === 'admin'
                  ? await this.relevant(tx, delivery, context)
                  : null;
              const subscription = context?.subscriptionId
                ? await tx.pushSubscription.findUnique({
                    where: { id: context.subscriptionId },
                  })
                : null;
              if (
                !context ||
                !booking ||
                (delivery.channel === 'push' &&
                  (!subscription || subscription.userId !== admin?.id))
              ) {
                await tx.notificationDelivery.update({
                  where: { id: row.id },
                  data: {
                    status: 'skipped',
                    retryAt: null,
                    leaseToken: null,
                    leaseExpiresAt: null,
                    error: 'not_relevant',
                  },
                });
                return { skipped: true } as const;
              }
              const token = randomUUID();
              await tx.notificationDelivery.update({
                where: { id: row.id },
                data: {
                  status: 'sending',
                  attempts: { increment: 1 },
                  leaseToken: token,
                  leaseExpiresAt: new Date(current.getTime() + 60000),
                  retryAt: null,
                  error: null,
                },
              });
              return {
                skipped: false,
                token,
                delivery,
                context,
                subscription,
                code: booking.code,
              } as const;
            },
          ).catch(async () => {
            await this.prisma.notificationDelivery.updateMany({
              where: {
                id: row.id,
                status: row.status,
                attempts: row.attempts,
                leaseToken: row.leaseToken,
              },
              data: {
                status: 'failed',
                attempts: { increment: 1 },
                error: 'queue_claim_failed',
                retryAt:
                  row.attempts < 2
                    ? new Date(this.clock.now().getTime() + 60000)
                    : null,
                leaseToken: null,
                leaseExpiresAt: null,
              },
            });
            failed++;
            return null;
          });
          if (!claim) return;
          processed++;
          if (claim.skipped) {
            skipped++;
            return;
          }
          let error: DeliveryError | undefined, reference: string | undefined;
          try {
            const title = labels[claim.delivery.eventType] ?? 'iRent Admin',
              body =
                claim.code +
                (claim.context.deadline
                  ? ' — batas ' + claim.context.deadline
                  : '');
            reference =
              claim.delivery.channel === 'push'
                ? await this.transport.push(claim.subscription!, {
                    title,
                    body,
                    url:
                      '/admin/bookings/' +
                      claim.context.bookingId +
                      (claim.context.extensionId
                        ? '/extensions/' + claim.context.extensionId
                        : ''),
                    tag: claim.delivery.deduplicationKey,
                  })
                : await this.transport.whatsappMessage(
                    claim.delivery.recipientAdminId,
                    title + '\n' + body,
                    claim.delivery.deduplicationKey,
                  );
          } catch (cause) {
            error =
              cause instanceof DeliveryError
                ? cause
                : new DeliveryError('provider_error');
          }
          await runBusinessTransaction(this.prisma, async (tx) => {
            await tx.$queryRaw`SELECT id FROM notification_deliveries WHERE id=${row.id}::uuid FOR UPDATE`;
            const current = await tx.notificationDelivery.findUniqueOrThrow({
              where: { id: row.id },
            });
            if (
              current.leaseToken !== claim.token ||
              current.status !== 'sending'
            )
              return;
            const retry = !error?.permanent && current.attempts < 3;
            await tx.notificationDelivery.updateMany({
              where: { id: row.id, status: 'sending', leaseToken: claim.token },
              data: {
                status: error ? 'failed' : 'sent',
                providerReference: reference?.slice(0, 256),
                error: error?.code,
                retryAt:
                  error && retry
                    ? new Date(
                        this.clock.now().getTime() +
                          (current.attempts === 1 ? 60000 : 300000),
                      )
                    : null,
                leaseToken: null,
                leaseExpiresAt: null,
              },
            });
            if (error?.expired && claim.subscription)
              await tx.pushSubscription.deleteMany({
                where: {
                  id: claim.subscription.id,
                  updatedAt: claim.subscription.updatedAt,
                },
              });
          });
          if (error) failed++;
          else sent++;
        }),
      );
    }
    await this.prisma.notificationDelivery.updateMany({
      where: {
        status: 'sending',
        attempts: { gte: 3 },
        leaseExpiresAt: { lte: this.clock.now() },
      },
      data: {
        status: 'failed',
        error: 'lease_exhausted',
        retryAt: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    return { processed, sent, failed, skipped };
  }
}
