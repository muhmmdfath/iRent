import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthContext, AuthService } from '../../auth/auth.service';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { runBusinessTransaction } from '../../prisma/business-transaction';
import { BusinessClock } from '../../shared/time/business-clock';
import { PageDto } from '../inventory/inventory.dto';
import { PricingService } from '../pricing/pricing.service';
import { QuoteDto } from '../pricing/pricing.dto';
import { validateSchedule } from '../pricing/pricing.rules';
import { SettingsService } from '../settings/settings.service';
import { CreateBookingDto, TERMS_VERSION } from './bookings.dto';
import {
  bookingRequestHash,
  overdue,
  protectsAllocation,
  unitAvailable,
} from './bookings.rules';

const detailInclude = {
  items: { orderBy: { id: 'asc' as const } },
  obligations: { orderBy: { createdAt: 'asc' as const } },
  statusLogs: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly settings: SettingsService,
    private readonly pricing: PricingService,
    private readonly clock: BusinessClock,
  ) {}

  private async transaction<T>(
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return runBusinessTransaction(this.prisma, action);
  }

  private async calendar(tx: Prisma.TransactionClient, input: QuoteDto) {
    // All inventory writers lock the parent item before its units.
    await this.settings.read(tx);
    const ids = [...new Set(input.items.map((item) => item.itemId))].sort();
    await tx.$queryRaw`SELECT id FROM items WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM item_units WHERE item_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
    const quote = await this.pricing.quoteInTransaction(tx, input);
    const units = await tx.itemUnit.findMany({
      where: { itemId: { in: ids } },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    });
    const allocations = await tx.unitAllocation.findMany({
      where: {
        itemUnitId: { in: units.map((unit) => unit.id) },
        state: 'active',
      },
      include: {
        bookingItem: { include: { booking: true } },
        extensionItem: { include: { extension: true } },
      },
    });
    const uses = await tx.bookingItem.findMany({
      where: {
        itemUnitId: { in: units.map((unit) => unit.id) },
        useStatus: { in: ['in_use', 'return_pending'] },
      },
    });
    const now = this.clock.now();
    validateSchedule(
      input.startAt,
      input.durationHours,
      quote.snapshot.rules.values,
      now,
    );
    const selections = quote.lines.map((line) => ({
      line,
      units: units.filter(
        (unit) =>
          unit.itemId === line.itemId &&
          unitAvailable(
            unit,
            allocations,
            uses,
            quote.startAt,
            quote.endAt,
            now,
          ),
      ),
    }));
    return { quote, now, selections, allocations, uses };
  }

  availability(context: AuthContext, input: QuoteDto) {
    return this.transaction(async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'customer');
      const { quote, now, selections } = await this.calendar(tx, input);
      return {
        checkedAt: now,
        startAt: quote.startAt,
        endAt: quote.endAt,
        reservesStock: false,
        available: selections.every(
          ({ line, units }) => units.length >= line.quantity,
        ),
        items: selections.map(({ line, units }) => ({
          itemId: line.itemId,
          requestedQuantity: line.quantity,
          availableQuantity: units.length,
        })),
      };
    });
  }

  create(
    context: AuthContext,
    input: CreateBookingDto,
    key: string | undefined,
  ) {
    if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new BadRequestException(
        'Idempotency-Key wajib diisi (1–128 karakter).',
      );
    if (
      input.termsVersion !== TERMS_VERSION ||
      ![
        input.agreeTerms,
        input.prepareIdentity,
        input.understandPayment,
        input.agreeOperatingHours,
      ].every((value) => value === true)
    )
      throw new BadRequestException('Seluruh persetujuan wajib diterima.');
    if (
      input.deliveryType === 'delivery' &&
      (!input.deliveryAddress || input.deliveryAddress.trim().length < 5)
    )
      throw new BadRequestException('Alamat antar-jemput wajib diisi.');
    if (input.deliveryType === 'pickup' && input.deliveryAddress !== undefined)
      throw new BadRequestException(
        'Pickup tidak memakai alamat antar-jemput.',
      );
    const requestHash = bookingRequestHash(input),
      actorId = context.user.id,
      operation = 'booking.create';
    return this.transaction(async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'customer');
      const existing = await tx.idempotencyRequest.findUnique({
        where: { actorId_operation_key: { actorId, operation, key } },
      });
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new ConflictException(
            'Idempotency-Key sudah digunakan untuk payload berbeda.',
          );
        const result = existing.resultReference;
        if (
          existing.status !== 'succeeded' ||
          !result ||
          Array.isArray(result) ||
          typeof result !== 'object' ||
          typeof result.bookingId !== 'string'
        )
          throw new ConflictException('Permintaan belum selesai.');
        return tx.booking.findUniqueOrThrow({
          where: { id: result.bookingId, userId: actorId },
          include: detailInclude,
        });
      }
      if (
        !(await tx.customerProfile.findUnique({ where: { userId: actorId } }))
      )
        throw new BadRequestException('Lengkapi profil sebelum booking.');
      const { quote, selections, allocations, uses } = await this.calendar(
        tx,
        input,
      );
      if (selections.some(({ line, units }) => units.length < line.quantity))
        throw new ConflictException('Item sudah dipesan pada waktu itu.');
      let now = this.clock.now();
      const counterKey = 'booking.code.' + now.toISOString().slice(0, 10);
      const counter = await tx.businessCounter.upsert({
        where: { key: counterKey },
        create: { key: counterKey, value: 1n },
        update: { value: { increment: 1 } },
      });
      now = this.clock.now();
      if (counterKey !== 'booking.code.' + now.toISOString().slice(0, 10))
        throw new ServiceUnavailableException(
          'Tanggal server berubah. Ulangi dengan Idempotency-Key yang sama.',
        );
      validateSchedule(
        input.startAt,
        input.durationHours,
        quote.snapshot.rules.values,
        now,
      );
      for (const selection of selections) {
        selection.units = selection.units.filter((unit) =>
          unitAvailable(
            unit,
            allocations,
            uses,
            quote.startAt,
            quote.endAt,
            now,
          ),
        );
        if (selection.units.length < selection.line.quantity)
          throw new ConflictException('Item sudah dipesan pada waktu itu.');
      }
      if (quote.lines.some((line) => line.category === 'iphone')) {
        const prior = await tx.unitAllocation.findMany({
          where: {
            state: 'active',
            bookingItem: {
              booking: { userId: actorId },
              item: { category: 'iphone' },
            },
          },
          include: {
            bookingItem: { include: { booking: true } },
            extensionItem: { include: { extension: true } },
          },
        });
        if (
          prior.some(
            (allocation) =>
              overdue(allocation.bookingItem, now) ||
              (protectsAllocation(allocation, now) &&
                allocation.startAt < quote.endAt &&
                allocation.endAt > quote.startAt),
          )
        )
          throw new ConflictException(
            'Pelanggan hanya dapat menyewa satu iPhone pada waktu yang sama.',
          );
      }
      const rules = quote.snapshot.rules.values;
      const urgent =
        quote.startAt.getTime() - now.getTime() <=
        rules.urgent_threshold_minutes * 60000;
      const expiresAt = new Date(
        now.getTime() +
          (urgent ? rules.urgent_hold_minutes : rules.hold_minutes) * 60000,
      );
      const code =
        'IRN' +
        now.toISOString().slice(2, 10).replaceAll('-', '') +
        counter.value.toString().padStart(3, '0');
      const zone = quote.snapshot.deliveryZone;
      const booking = await tx.booking.create({
        data: {
          code,
          userId: actorId,
          initialStartAt: quote.startAt,
          initialEndAt: quote.endAt,
          deliveryType: input.deliveryType,
          deliveryZoneId: zone?.id,
          deliveryZoneNameSnapshot: zone?.name,
          deliveryAddress: input.deliveryAddress?.trim(),
          deliveryFeeSnapshot: quote.deliveryFee,
          initialRentalTotal: quote.rentalTotal,
          initialGrandTotal: quote.grandTotal,
          dpSnapshot: BigInt(quote.dpSnapshot),
          payOption: quote.payOption,
          amountDueNow: quote.amountDueNow,
          expiresAt,
          noShowDueAt: new Date(
            quote.startAt.getTime() + rules.no_show_minutes * 60000,
          ),
          termsVersion: TERMS_VERSION,
          agreedTermsAt: now,
          createdAt: now,
          rulesSnapshot: {
            ...quote.snapshot,
            rules: { ...quote.snapshot.rules },
            urgent,
            consents: {
              agreeTerms: true,
              prepareIdentity: true,
              understandPayment: true,
              agreeOperatingHours: true,
            },
          },
        },
      });
      for (const { line, units } of selections)
        for (const unit of units.slice(0, line.quantity)) {
          const bookingItem = await tx.bookingItem.create({
            data: {
              bookingId: booking.id,
              itemId: line.itemId,
              itemUnitId: unit.id,
              itemNameSnapshot: line.itemName,
              unitCodeSnapshot: unit.code,
              initialStartAt: quote.startAt,
              startAt: quote.startAt,
              initialEndAt: quote.endAt,
              currentEndAt: quote.endAt,
              unitPriceSnapshot: line.unitPrice,
              tariff6hSnapshot: BigInt(line.tariff6h),
              tariff12hSnapshot: BigInt(line.tariff12h),
              tariff24hSnapshot: BigInt(line.tariff24h),
            },
          });
          await tx.unitAllocation.create({
            data: {
              bookingItemId: bookingItem.id,
              itemUnitId: unit.id,
              allocationKind: 'rental',
              startAt: quote.startAt,
              endAt: quote.endAt,
              blockStartAt: new Date(
                quote.startAt.getTime() - rules.buffer_minutes * 60000,
              ),
              blockEndAt: new Date(
                quote.endAt.getTime() + rules.buffer_minutes * 60000,
              ),
              holdExpiresAt: expiresAt,
            },
          });
          await tx.bookingCharge.create({
            data: {
              bookingId: booking.id,
              bookingItemId: bookingItem.id,
              kind: 'rental',
              direction: 'debit',
              amount: line.unitPrice,
              effectiveAt: now,
              createdBy: actorId,
              sourceKey: 'rental:' + bookingItem.id,
            },
          });
        }
      if (quote.deliveryFee > 0n)
        await tx.bookingCharge.create({
          data: {
            bookingId: booking.id,
            kind: 'delivery',
            direction: 'debit',
            amount: quote.deliveryFee,
            effectiveAt: now,
            createdBy: actorId,
            sourceKey: 'delivery:' + booking.id,
          },
        });
      await tx.paymentObligation.create({
        data: {
          bookingId: booking.id,
          purpose: quote.payOption === 'dp' ? 'initial_dp' : 'initial_full',
          amountDue: quote.amountDueNow,
          expiresAt,
        },
      });
      await tx.bookingStatusLog.create({
        data: {
          bookingId: booking.id,
          toStatus: 'menunggu_pembayaran',
          actorId,
          createdAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'booking.create',
          entityType: 'Booking',
          entityId: booking.id,
          changes: { code, status: booking.status },
          createdAt: now,
        },
      });
      await tx.outboxEvent.create({
        data: {
          eventKey: 'booking.created:' + booking.id,
          aggregateType: 'Booking',
          aggregateId: booking.id,
          eventType: 'booking.created',
          payload: { bookingId: booking.id },
          occurredAt: now,
        },
      });
      await tx.idempotencyRequest.create({
        data: {
          actorId,
          operation,
          key,
          requestHash,
          status: 'succeeded',
          resultReference: { bookingId: booking.id },
        },
      });
      return tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: detailInclude,
      });
    });
  }

  async list(context: AuthContext, page: PageDto, admin = false) {
    if (admin && context.user.role !== 'admin') throw new NotFoundException();
    const owner = admin
      ? Prisma.empty
      : Prisma.sql`WHERE user_id=${context.user.id}::uuid`;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM bookings ${owner}
      ORDER BY created_at, length(code), code
      OFFSET ${(page.page - 1) * page.limit} LIMIT ${page.limit}`;
    const bookings = await this.prisma.booking.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    return rows.map((row) =>
      bookings.find((booking) => booking.id === row.id)!,
    );
  }

  async detail(context: AuthContext, id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id,
        ...(context.user.role === 'admin' ? {} : { userId: context.user.id }),
      },
      include: detailInclude,
    });
    if (!booking) throw new NotFoundException('Booking tidak ditemukan.');
    return booking;
  }
}
