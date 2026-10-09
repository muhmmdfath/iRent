import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthContext } from '../../auth/auth.service';
import { BookingItem, Prisma } from '../../generated/prisma/client';
import { BusinessClock } from '../../shared/time/business-clock';
import { formatWibDateTime, parseWibDateTime } from '../../shared/time/wib';
import { protectsAllocation, unitAvailable } from '../bookings/bookings.rules';
import { PaymentLedgerService } from '../payments/payment-ledger.service';
import { LockedBooking, PaymentsService } from '../payments/payments.service';
import { MAX_RUPIAH, rupiah } from '../settings/settings.rules';
import {
  CorrectReturnDto,
  HandoverDto,
  VerifyReturnDto,
} from './operations.dto';
import { ExtensionDelayService } from '../extensions/extension-delay.service';
import { RisksService } from '../risks/risks.service';
import { ReplaceUnitDto, VerifyLossDto } from './loss.dto';
import {
  Exemption,
  lateCharge,
  PREPARATION_MS,
  withinOperating,
} from './operations.rules';

@Injectable()
export class OperationsService {
  constructor(
    private readonly payments: PaymentsService,
    private readonly ledger: PaymentLedgerService,
    private readonly clock: BusinessClock,
    private readonly delay: ExtensionDelayService,
    private readonly risks: RisksService,
  ) {}

  private async event(
    tx: Prisma.TransactionClient,
    context: AuthContext,
    type: string,
    bookingId: string,
    itemId?: string,
    changes: Prisma.InputJsonObject = {},
    reason?: string,
  ) {
    await tx.auditLog.create({
      data: {
        actorId: context.user.id,
        action: type,
        entityType: itemId ? 'BookingItem' : 'Booking',
        entityId: itemId ?? bookingId,
        changes: { bookingId, ...changes },
        reason,
        createdAt: this.clock.now(),
      },
    });
    await tx.outboxEvent.create({
      data: {
        eventKey: type + ':' + (itemId ?? bookingId) + ':' + randomUUID(),
        aggregateType: 'Booking',
        aggregateId: bookingId,
        eventType: type,
        payload: { bookingId, ...(itemId ? { bookingItemId: itemId } : {}) },
        occurredAt: this.clock.now(),
      },
    });
  }
  private item(booking: LockedBooking, id: string) {
    const item = booking.items.find((row) => row.id === id.toLowerCase());
    if (!item) throw new NotFoundException('Unit booking tidak ditemukan.');
    return item;
  }
  private async status(
    tx: Prisma.TransactionClient,
    booking: LockedBooking,
    status: 'berjalan' | 'selesai',
    actor: string,
  ) {
    if (booking.status === status) return;
    await tx.booking.update({ where: { id: booking.id }, data: { status } });
    await tx.bookingStatusLog.create({
      data: {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: status,
        actorId: actor,
        createdAt: this.clock.now(),
      },
    });
  }

  async handover(
    context: AuthContext,
    bookingId: string,
    input: HandoverDto,
    key?: string,
  ) {
    const pickedUpAt = parseWibDateTime(input.pickedUpAt),
      note = input.conditionNote.trim(),
      reason = input.shopDelayReason?.trim();
    if (note.length < 5 || (reason !== undefined && reason.length < 5))
      throw new BadRequestException('Catatan kondisi/alasan wajib lengkap.');
    return this.payments.action(
      context,
      bookingId,
      key,
      'operations.handover',
      {
        pickedUpAt: formatWibDateTime(pickedUpAt),
        note,
        reason: reason ?? null,
      },
      'admin',
      async (tx, booking) => {
        const now = this.clock.now(),
          rules = this.payments.rules(booking).values;
        if (
          booking.status !== 'dikonfirmasi' ||
          !booking.items.length ||
          booking.items.some((item) => item.useStatus !== 'allocated')
        )
          throw new ConflictException(
            'Serah terima hanya untuk booking dikonfirmasi yang belum diserahkan.',
          );
        if (
          !booking.confirmedAt ||
          pickedUpAt < booking.confirmedAt ||
          pickedUpAt > now ||
          booking.items.some(
            (item) =>
              pickedUpAt < item.startAt || pickedUpAt >= item.currentEndAt,
          ) ||
          !withinOperating(pickedUpAt, rules)
        )
          throw new BadRequestException(
            'Waktu serah terima tidak sesuai jadwal, persetujuan, atau jam operasional.',
          );
        const summary = await this.ledger.summary(tx, booking.id);
        if (summary.remaining > 0n || summary.reserved > 0n)
          throw new ConflictException(
            'Sewa dan ongkir harus lunas dengan dana yang telah diterapkan.',
          );
        const delay =
          booking.deliveryType === 'delivery'
            ? Math.max(
                0,
                pickedUpAt.getTime() - booking.items[0].startAt.getTime(),
              )
            : 0;
        if (delay > 0 && !reason)
          throw new BadRequestException(
            'Keterlambatan toko wajib dikonfirmasi dengan alasan sebelum pergeseran jadwal.',
          );
        if (booking.deliveryType === 'pickup' && reason)
          throw new BadRequestException(
            'Kompensasi pengantaran hanya berlaku untuk delivery.',
          );
        const ids = booking.items.map((item) => item.itemUnitId);
        const units = await tx.itemUnit.findMany({
          where: { id: { in: ids } },
          include: { item: true },
        });
        const allocations = await tx.unitAllocation.findMany({
          where: { itemUnitId: { in: ids }, state: 'active' },
          include: {
            bookingItem: { include: { booking: true } },
            extensionItem: { include: { extension: true } },
          },
        });
        const uses = await tx.bookingItem.findMany({
          where: {
            itemUnitId: { in: ids },
            useStatus: { in: ['in_use', 'return_pending'] },
          },
        });
        const previousReturns = await tx.returnRecord.findMany({
          where: {
            bookingItem: { itemUnitId: { in: ids } },
            status: 'verified',
          },
          include: { bookingItem: { select: { itemUnitId: true } } },
        });
        const customerIphones = await tx.unitAllocation.findMany({
          where: {
            bookingItem: {
              booking: { userId: booking.userId },
              item: { category: 'iphone' },
            },
            state: 'active',
          },
          include: {
            bookingItem: { include: { booking: true } },
            extensionItem: { include: { extension: true } },
          },
        });
        if (units.filter((unit) => unit.item.category === 'iphone').length > 1)
          throw new ConflictException(
            'Pelanggan hanya dapat menggunakan satu iPhone bersamaan.',
          );
        for (const item of booking.items) {
          const unit = units.find((row) => row.id === item.itemUnitId)!;
          const start = new Date(item.startAt.getTime() + delay),
            end = new Date(item.currentEndAt.getTime() + delay);
          if (
            !unit ||
            !unit.item.isActive ||
            !unit.isActive ||
            unit.conditionStatus !== 'layak' ||
            unit.physicalStatus !== 'ready' ||
            uses.some((use) => use.itemUnitId === item.itemUnitId) ||
            (unit.preparationUntil !== null &&
              unit.preparationUntil > pickedUpAt) ||
            (unit.maintenanceCompletedAt !== null &&
              unit.maintenanceCompletedAt.getTime() + PREPARATION_MS >
                pickedUpAt.getTime()) ||
            previousReturns.some(
              (record) =>
                record.bookingItem.itemUnitId === item.itemUnitId &&
                record.preparationStartedAt !== null &&
                record.preparationStartedAt.getTime() + PREPARATION_MS >
                  pickedUpAt.getTime(),
            )
          )
            throw new ConflictException('Unit belum siap secara fisik.');
          if (!withinOperating(start, rules) || !withinOperating(end, rules))
            throw new ConflictException('Pergeseran melewati jam operasional.');
          if (
            !allocations.some(
              (row) =>
                row.bookingItemId === item.id &&
                row.allocationKind === 'rental' &&
                row.state === 'active',
            )
          )
            throw new ConflictException('Alokasi sewa tidak lagi aktif.');
          if (
            !unitAvailable(
              unit,
              allocations.filter(
                (row) => row.bookingItem.bookingId !== booking.id,
              ),
              uses,
              start,
              end,
              now,
            )
          )
            throw new ConflictException(
              'Unit atau pergeseran jadwal bertabrakan dengan sewa lain.',
            );
          if (
            unit.item.category === 'iphone' &&
            customerIphones.some(
              (row) =>
                row.bookingItem.bookingId !== booking.id &&
                protectsAllocation(row, now) &&
                ((row.startAt < end && row.endAt > start) ||
                  (['in_use', 'return_pending'].includes(
                    row.bookingItem.useStatus,
                  ) &&
                    row.bookingItem.currentEndAt < now)),
            )
          )
            throw new ConflictException(
              'Pergeseran melanggar batas satu iPhone pelanggan.',
            );
        }
        for (const item of booking.items) {
          const startAt = new Date(item.startAt.getTime() + delay),
            currentEndAt = new Date(item.currentEndAt.getTime() + delay);
          await tx.bookingItem.update({
            where: { id: item.id },
            data: {
              pickedUpAt,
              pickedUpBy: context.user.id,
              handoverNote: note,
              useStatus: 'in_use',
              startAt,
              currentEndAt,
              shopDelaySeconds: Math.ceil(
                (startAt.getTime() - item.initialStartAt.getTime()) / 1000,
              ),
              version: { increment: 1 },
            },
          });
          if (delay > 0)
            await tx.unitAllocation.updateMany({
              where: {
                bookingItemId: item.id,
                allocationKind: 'rental',
                state: 'active',
              },
              data: {
                startAt,
                endAt: currentEndAt,
                blockStartAt: new Date(
                  startAt.getTime() - rules.buffer_minutes * 60000,
                ),
                blockEndAt: new Date(
                  currentEndAt.getTime() + rules.buffer_minutes * 60000,
                ),
              },
            });
          await tx.itemUnit.update({
            where: { id: item.itemUnitId },
            data: { physicalStatus: 'in_use', preparationUntil: null },
          });
        }
        if (delay > 0)
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              shopDelaySeconds: Math.ceil(
                (pickedUpAt.getTime() - booking.initialStartAt.getTime()) /
                  1000,
              ),
              noShowDueAt: new Date(
                pickedUpAt.getTime() + rules.no_show_minutes * 60000,
              ),
            },
          });
        await this.status(tx, booking, 'berjalan', context.user.id);
        await this.event(
          tx,
          context,
          'booking.handed_over',
          booking.id,
          undefined,
          {
            pickedUpAt: formatWibDateTime(pickedUpAt),
            conditionNote: note,
            shopDelayMilliseconds: delay,
          },
          reason,
        );
        return { bookingId: booking.id };
      },
    );
  }

  async report(
    context: AuthContext,
    bookingId: string,
    itemId: string,
    key?: string,
  ) {
    return this.payments.action(
      context,
      bookingId,
      key,
      'operations.return_report',
      { itemId: itemId.toLowerCase() },
      'customer',
      async (tx, booking) => {
        const item = this.item(booking, itemId);
        if (
          booking.status !== 'berjalan' ||
          !['in_use', 'return_pending'].includes(item.useStatus)
        )
          throw new ConflictException('Unit tidak sedang disewa.');
        const previous = await tx.returnRecord.findUnique({
          where: { bookingItemId: item.id },
        });
        if (previous?.status === 'pending')
          return { bookingId: booking.id, decision: item.id };
        await tx.returnRecord.upsert({
          where: { bookingItemId: item.id },
          create: { bookingItemId: item.id, reportedAt: this.clock.now() },
          update: { status: 'pending', reportedAt: this.clock.now() },
        });
        await tx.bookingItem.update({
          where: { id: item.id },
          data: { useStatus: 'return_pending' },
        });
        await this.event(tx, context, 'return.reported', booking.id, item.id);
        return { bookingId: booking.id, decision: item.id };
      },
    );
  }

  async rejectReport(
    context: AuthContext,
    bookingId: string,
    itemId: string,
    reason: string,
    key?: string,
  ) {
    reason = reason.trim();
    if (reason.length < 5)
      throw new BadRequestException('Alasan penolakan wajib diisi.');
    return this.payments.action(
      context,
      bookingId,
      key,
      'operations.return_reject',
      { itemId: itemId.toLowerCase(), reason },
      'admin',
      async (tx, booking) => {
        const item = this.item(booking, itemId);
        const record = await tx.returnRecord.findUnique({
          where: { bookingItemId: item.id },
        });
        if (
          booking.status !== 'berjalan' ||
          item.useStatus !== 'return_pending' ||
          record?.status !== 'pending'
        )
          throw new ConflictException(
            'Tidak ada laporan pengembalian pending.',
          );
        await tx.returnRecord.update({
          where: { id: record.id },
          data: { status: 'rejected' },
        });
        await tx.bookingItem.update({
          where: { id: item.id },
          data: { useStatus: 'in_use' },
        });
        await this.event(
          tx,
          context,
          'return.rejected',
          booking.id,
          item.id,
          {},
          reason,
        );
        return { bookingId: booking.id, decision: item.id };
      },
    );
  }

  private async cancelPendingExtensions(
    tx: Prisma.TransactionClient,
    booking: LockedBooking,
    item: BookingItem,
    context: AuthContext,
    kind: 'return' | 'loss' = 'return',
  ) {
    const pending = await tx.extension.findMany({
      where: {
        bookingId: booking.id,
        status: {
          in: ['draft_quote', 'menunggu_pembayaran', 'menunggu_konfirmasi'],
        },
        items: { some: { bookingItemId: item.id } },
      },
    });
    for (const extension of pending) {
      const reason =
        kind === 'loss'
          ? 'Kehilangan unit telah diverifikasi admin.'
          : 'Unit telah diterima dan pengembalian diverifikasi admin.';
      await tx.extension.update({
        where: { id: extension.id },
        data: { status: 'dibatalkan', cancelReason: reason },
      });
      await tx.unitAllocation.updateMany({
        where: {
          extensionItem: { extensionId: extension.id },
          state: 'active',
        },
        data: {
          state: 'released',
          releasedAt: this.clock.now(),
          releasedReason: reason,
        },
      });
      await tx.paymentObligation.updateMany({
        where: { extensionId: extension.id },
        data: { status: 'closed', pendingProofId: null },
      });
      await tx.paymentApplication.updateMany({
        where: { obligation: { extensionId: extension.id } },
        data: { state: 'released' },
      });
      const charges = await tx.bookingCharge.findMany({
        where: { extensionId: extension.id, direction: 'debit' },
        include: { adjustments: true },
      });
      for (const charge of charges) {
        const remaining =
          charge.amount -
          charge.adjustments
            .filter((row) => row.direction === 'credit')
            .reduce((sum, row) => sum + row.amount, 0n);
        if (remaining > 0n)
          await tx.bookingCharge.create({
            data: {
              bookingId: booking.id,
              extensionId: extension.id,
              bookingItemId: charge.bookingItemId,
              direction: 'credit',
              kind: 'adjustment',
              amount: remaining,
              relatedChargeId: charge.id,
              reason,
              createdBy: context.user.id,
              effectiveAt: this.clock.now(),
              sourceKey: kind + '.extension_cancel:' + charge.id,
            },
          });
      }
      const receipts = await tx.payment.findMany({
        where: {
          extensionId: extension.id,
          direction: 'in',
          supersededAt: null,
        },
      });
      for (const receipt of receipts)
        await this.ledger.requestUnusedRefund(
          tx,
          receipt,
          kind === 'loss'
            ? 'lost_pending_extension'
            : 'returned_pending_extension',
          this.clock.now(),
        );
      await this.event(
        tx,
        context,
        kind === 'loss'
          ? 'extension.cancelled_on_loss'
          : 'extension.cancelled_on_return',
        booking.id,
        item.id,
        { extensionId: extension.id },
        reason,
      );
    }
  }

  async verifyLoss(
    context: AuthContext,
    bookingId: string,
    itemId: string,
    input: VerifyLossDto,
    key?: string,
  ) {
    const lostAt = parseWibDateTime(input.lostAt),
      note = input.lossNote.trim(),
      compensation = rupiah(input.compensationAmount);
    const exemptions: Exemption[] = (input.exemptions ?? []).map((row) => ({
      type: row.type,
      from: parseWibDateTime(row.from),
      to: parseWibDateTime(row.to),
      reason: row.reason.trim(),
    }));
    if (note.length < 5)
      throw new BadRequestException('Catatan kehilangan wajib lengkap.');
    return this.payments.action(
      context,
      bookingId,
      key,
      'operations.loss_verify',
      {
        itemId: itemId.toLowerCase(),
        lostAt: formatWibDateTime(lostAt),
        note,
        compensation: compensation.toString(),
        exemptions: exemptions.map((row) => ({
          ...row,
          from: formatWibDateTime(row.from),
          to: formatWibDateTime(row.to),
        })),
      },
      'admin',
      async (tx, booking) => {
        const item = this.item(booking, itemId),
          now = this.clock.now(),
          rules = this.payments.rules(booking).values;
        if (
          booking.status !== 'berjalan' ||
          !['in_use', 'return_pending'].includes(item.useStatus) ||
          !item.pickedUpAt
        )
          throw new ConflictException(
            'Unit tidak sedang disewa atau sudah ditutup.',
          );
        if (lostAt < item.pickedUpAt || lostAt > now)
          throw new BadRequestException(
            'Waktu kehilangan harus setelah handover dan tidak di masa depan.',
          );
        if (
          exemptions.some(
            (row) =>
              row.from >= row.to ||
              row.to > now ||
              row.reason.length < 5 ||
              (row.type === 'courier' && booking.deliveryType !== 'delivery'),
          )
        )
          throw new BadRequestException('Interval pengecualian tidak valid.');
        if (
          await tx.returnRecord.count({
            where: { bookingItemId: item.id, status: 'verified' },
          })
        )
          throw new ConflictException('Pengembalian unit sudah diverifikasi.');
        const appliedExemptions = [
            ...exemptions,
            ...(await this.delay.exemptions(tx, booking, item.id)),
          ],
          late = lateCharge(
            item.currentEndAt,
            lostAt,
            rules,
            appliedExemptions,
          );
        const summary = await this.ledger.summary(tx, booking.id);
        if (summary.bill + compensation + late.fee > MAX_RUPIAH)
          throw new BadRequestException('Tagihan melampaui rentang rupiah.');
        const policy = {
          scheduledEndAt: formatWibDateTime(item.currentEndAt),
          lostAt: formatWibDateTime(lostAt),
          toleranceMinutes: rules.late_tolerance_minutes,
          tariffPerHour: rules.late_fee_per_hour,
          lateSeconds: late.lateSeconds,
          excludedSeconds: late.excludedSeconds,
          lateFee: late.fee.toString(),
          compensation: compensation.toString(),
          exemptions: appliedExemptions.map((row) => ({
            ...row,
            from: formatWibDateTime(row.from),
            to: formatWibDateTime(row.to),
          })),
        };
        const record = await tx.lossRecord.create({
          data: {
            bookingItemId: item.id,
            lostAt,
            verifiedBy: context.user.id,
            verifiedAt: now,
            lossNote: note,
            compensationAmount: compensation,
            lateFee: late.fee,
            policySnapshot: { schemaVersion: 1, ...policy },
          },
        });
        await this.cancelPendingExtensions(tx, booking, item, context, 'loss');
        await tx.returnRecord.updateMany({
          where: { bookingItemId: item.id, status: 'pending' },
          data: { status: 'rejected' },
        });
        for (const charge of [
          { kind: 'loss' as const, amount: compensation },
          { kind: 'late' as const, amount: late.fee },
        ])
          if (charge.amount > 0n)
            await tx.bookingCharge.create({
              data: {
                bookingId: booking.id,
                bookingItemId: item.id,
                kind: charge.kind,
                direction: 'debit',
                amount: charge.amount,
                effectiveAt: lostAt,
                reason: note,
                createdBy: context.user.id,
                sourceKey: 'loss.' + charge.kind + ':' + record.id,
              },
            });
        await tx.bookingItem.update({
          where: { id: item.id },
          data: { useStatus: 'lost_closed', version: { increment: 1 } },
        });
        await tx.itemUnit.update({
          where: { id: item.itemUnitId },
          data: {
            isActive: false,
            conditionStatus: 'lost',
            physicalStatus: 'lost',
            preparationUntil: null,
            maintenanceCompletedAt: null,
            notes: note,
          },
        });
        await tx.unitAllocation.updateMany({
          where: { bookingItemId: item.id, state: 'active' },
          data: {
            state: 'released',
            releasedAt: now,
            releasedReason: 'Kehilangan unit diverifikasi.',
          },
        });
        if (
          !(await tx.bookingItem.count({
            where: {
              bookingId: booking.id,
              useStatus: { notIn: ['returned', 'lost_closed'] },
            },
          }))
        )
          await this.status(tx, booking, 'selesai', context.user.id);
        await this.event(
          tx,
          context,
          'loss.verified',
          booking.id,
          item.id,
          { recordId: record.id, ...policy },
          note,
        );
        await this.risks.alertUnit(tx, item.itemUnitId);
        return { bookingId: booking.id, decision: record.id };
      },
    );
  }

  replaceUnit(
    context: AuthContext,
    bookingId: string,
    itemId: string,
    input: ReplaceUnitDto,
    key?: string,
  ) {
    const unitId = input.itemUnitId.toLowerCase(),
      reason = input.reason.trim();
    if (reason.length < 5)
      throw new BadRequestException('Alasan penggantian wajib lengkap.');
    return this.payments.action(
      context,
      bookingId,
      key,
      'operations.replace_unit',
      { itemId: itemId.toLowerCase(), unitId, reason },
      'admin',
      async (tx, booking) => {
        const item = this.item(booking, itemId),
          now = this.clock.now(),
          rules = this.payments.rules(booking).values;
        if (
          ![
            'menunggu_pembayaran',
            'menunggu_konfirmasi',
            'dikonfirmasi',
          ].includes(booking.status) ||
          item.useStatus !== 'allocated' ||
          item.pickedUpAt ||
          (booking.status === 'menunggu_pembayaran' && now > booking.expiresAt)
        )
          throw new ConflictException(
            'Penggantian hanya sebelum serah terima pada booking aktif.',
          );
        if (unitId === item.itemUnitId)
          throw new ConflictException('Pilih unit pengganti berbeda.');
        const unit = await tx.itemUnit.findUnique({
          where: { id: unitId },
          include: { item: true },
        });
        if (!unit || unit.itemId !== item.itemId)
          throw new BadRequestException(
            'Unit pengganti harus dari model/item yang sama.',
          );
        const allocations = await tx.unitAllocation.findMany({
          where: { itemUnitId: unit.id, state: 'active' },
          include: {
            bookingItem: { include: { booking: true } },
            extensionItem: { include: { extension: true } },
          },
        });
        const uses = await tx.bookingItem.findMany({
          where: {
            itemUnitId: unit.id,
            useStatus: { in: ['in_use', 'return_pending'] },
          },
        });
        if (
          !unit.item.isActive ||
          !unitAvailable(
            unit,
            allocations,
            uses,
            item.startAt,
            item.currentEndAt,
            now,
          ) ||
          (item.startAt <= now && unit.physicalStatus !== 'ready')
        )
          throw new ConflictException(
            'Unit pengganti tidak tersedia atau belum siap.',
          );
        if (
          !(await tx.unitAllocation.count({
            where: {
              bookingItemId: item.id,
              allocationKind: 'rental',
              state: 'active',
            },
          }))
        )
          throw new ConflictException('Alokasi sewa tidak lagi aktif.');
        await tx.unitAllocation.updateMany({
          where: { bookingItemId: item.id, state: 'active' },
          data: { state: 'released', releasedAt: now, releasedReason: reason },
        });
        await tx.bookingItem.update({
          where: { id: item.id },
          data: {
            itemUnitId: unit.id,
            unitCodeSnapshot: unit.code,
            version: { increment: 1 },
          },
        });
        await tx.unitAllocation.create({
          data: {
            bookingItemId: item.id,
            itemUnitId: unit.id,
            allocationKind: 'rental',
            startAt: item.startAt,
            endAt: item.currentEndAt,
            blockStartAt: new Date(
              item.startAt.getTime() - rules.buffer_minutes * 60000,
            ),
            blockEndAt: new Date(
              item.currentEndAt.getTime() + rules.buffer_minutes * 60000,
            ),
            holdExpiresAt:
              booking.status === 'menunggu_pembayaran'
                ? booking.expiresAt
                : null,
          },
        });
        await this.event(
          tx,
          context,
          'booking.unit_replaced',
          booking.id,
          item.id,
          {
            previousUnitId: item.itemUnitId,
            previousCode: item.unitCodeSnapshot,
            newUnitId: unit.id,
            newCode: unit.code,
          },
          reason,
        );
        await this.risks.alertUnit(tx, unit.id);
        return { bookingId: booking.id, decision: item.id };
      },
      undefined,
      [unitId],
    );
  }

  async correctReturn(
    context: AuthContext,
    bookingId: string,
    itemId: string,
    input: CorrectReturnDto,
    key?: string,
  ) {
    let receivedAtStore: Date,
      courierAt: Date | undefined,
      exemptions: Exemption[];
    try {
      receivedAtStore = parseWibDateTime(input.receivedAtStore);
      courierAt = input.receivedByCourierAt
        ? parseWibDateTime(input.receivedByCourierAt)
        : undefined;
      exemptions = (input.exemptions ?? []).map((row) => ({
        ...row,
        reason: row.reason.trim(),
        from: parseWibDateTime(row.from),
        to: parseWibDateTime(row.to),
      }));
    } catch {
      throw new BadRequestException(
        'Waktu koreksi wajib berupa ISO WIB yang valid.',
      );
    }
    const reason = input.reason.trim(),
      note = input.conditionNote.trim(),
      damage = rupiah(input.damageAmount),
      damageNote = input.damageNote?.trim();
    if (
      reason.length < 5 ||
      note.length < 5 ||
      (damage > 0n && (!damageNote || damageNote.length < 5))
    )
      throw new BadRequestException(
        'Alasan koreksi/catatan kondisi dan kerusakan wajib lengkap.',
      );
    return this.payments.action(
      context,
      bookingId,
      key,
      'operations.return_correct',
      {
        itemId: itemId.toLowerCase(),
        receivedAtStore: formatWibDateTime(receivedAtStore),
        courierAt: courierAt ? formatWibDateTime(courierAt) : null,
        note,
        damage: damage.toString(),
        damageNote: damageNote ?? null,
        reason,
        exemptions: exemptions.map((row) => ({
          ...row,
          from: formatWibDateTime(row.from),
          to: formatWibDateTime(row.to),
        })),
      },
      'admin',
      async (tx, booking) => {
        const item = this.item(booking, itemId),
          now = this.clock.now();
        const record = await tx.returnRecord.findUnique({
          where: { bookingItemId: item.id },
        });
        if (
          item.useStatus !== 'returned' ||
          record?.status !== 'verified' ||
          !item.pickedUpAt
        )
          throw new ConflictException(
            'Koreksi hanya untuk pengembalian terverifikasi.',
          );
        if (input.exemptions === undefined) {
          if (!Array.isArray(record.manualExemptions))
            throw new ConflictException('Snapshot pengecualian tidak valid.');
          try {
            exemptions = record.manualExemptions.map((row) => {
              if (
                !row ||
                typeof row !== 'object' ||
                Array.isArray(row) ||
                !['admin', 'courier'].includes(String(row.type)) ||
                typeof row.from !== 'string' ||
                typeof row.to !== 'string' ||
                typeof row.reason !== 'string'
              )
                throw new Error();
              return {
                type: row.type as Exemption['type'],
                from: parseWibDateTime(row.from),
                to: parseWibDateTime(row.to),
                reason: row.reason,
              };
            });
          } catch {
            throw new ConflictException('Snapshot pengecualian tidak valid.');
          }
        }
        if (
          await tx.refundRequest.findFirst({
            where: {
              bookingId: booking.id,
              extensionId: null,
              status: { in: ['diajukan', 'disetujui'] },
            },
          })
        )
          throw new ConflictException(
            'Periksa refund yang masih aktif sebelum koreksi pengembalian.',
          );
        const feeReturnAt = courierAt ?? receivedAtStore;
        if (
          receivedAtStore > now ||
          feeReturnAt < item.pickedUpAt ||
          (courierAt &&
            (courierAt > receivedAtStore ||
              booking.deliveryType !== 'delivery')) ||
          exemptions.some(
            (row) =>
              row.from >= row.to ||
              row.to > now ||
              row.reason.length < 5 ||
              (row.type === 'courier' && booking.deliveryType !== 'delivery'),
          )
        )
          throw new BadRequestException(
            'Urutan waktu atau interval pengecualian tidak valid.',
          );
        const appliedExemptions = [
          ...exemptions,
          ...(await this.delay.exemptions(tx, booking, item.id)),
        ];
        const late = lateCharge(
          item.currentEndAt,
          feeReturnAt,
          this.payments.rules(booking).values,
          appliedExemptions,
        );
        const charges = await tx.bookingCharge.findMany({
          where: {
            bookingId: booking.id,
            bookingItemId: item.id,
            extensionId: null,
            kind: { in: ['late', 'damage', 'adjustment'] },
          },
        });
        const root = (
          charge: (typeof charges)[number],
        ): 'late' | 'damage' | undefined => {
          const visited = new Set<string>();
          let current: typeof charge | undefined = charge;
          while (current) {
            if (visited.has(current.id))
              throw new ConflictException(
                'Riwayat penyesuaian tagihan tidak valid.',
              );
            visited.add(current.id);
            if (current.kind === 'late' || current.kind === 'damage')
              return current.kind;
            current = charges.find(
              (row) => row.id === current!.relatedChargeId,
            );
          }
          return undefined;
        };
        const current = (kind: 'late' | 'damage') =>
          charges
            .filter((row) => root(row) === kind)
            .reduce(
              (sum, row) =>
                sum + (row.direction === 'debit' ? row.amount : -row.amount),
              0n,
            );
        const oldLate = current('late'),
          oldDamage = current('damage');
        const summary = await this.ledger.summary(tx, booking.id);
        if (summary.bill - oldLate - oldDamage + late.fee + damage > MAX_RUPIAH)
          throw new BadRequestException(
            'Total tagihan melampaui rentang rupiah.',
          );
        const correctionId = randomUUID();
        for (const [kind, amount, prior] of [
          ['late', late.fee, oldLate],
          ['damage', damage, oldDamage],
        ] as const) {
          const difference = amount - prior;
          if (difference === 0n) continue;
          const base = charges.find((row) => row.kind === kind);
          await tx.bookingCharge.create({
            data: {
              bookingId: booking.id,
              bookingItemId: item.id,
              kind: base ? 'adjustment' : kind,
              relatedChargeId: base?.id,
              direction: difference > 0n ? 'debit' : 'credit',
              amount: difference > 0n ? difference : -difference,
              effectiveAt: feeReturnAt,
              reason,
              createdBy: context.user.id,
              sourceKey: base
                ? 'return.correct:' + correctionId + ':' + kind
                : 'return.' + kind + ':' + record.id,
            },
          });
        }
        await tx.returnRecord.update({
          where: { id: record.id },
          data: {
            receivedAtStore,
            receivedByCourierAt: courierAt ?? null,
            feeReturnAt,
            conditionNote: note,
            damageAmount: damage,
            damageNote: damageNote ?? null,
            lateSeconds: late.lateSeconds,
            lateFee: late.fee,
            adminDelayExemptionSeconds: late.adminSeconds,
            courierDelayExemptionSeconds: late.courierSeconds,
            exemptionReason:
              appliedExemptions.map((row) => row.reason).join('; ') || null,
            manualExemptions: exemptions.map((row) => ({
              ...row,
              from: formatWibDateTime(row.from),
              to: formatWibDateTime(row.to),
            })),
          },
        });
        await this.ledger.requestAppliedExcessRefund(
          tx,
          booking.id,
          'return_correction',
          now,
          { recordId: record.id, correctionId },
        );
        await this.event(
          tx,
          context,
          'return.corrected',
          booking.id,
          item.id,
          {
            correctionId,
            recordId: record.id,
            before: {
              receivedAtStore: record.receivedAtStore
                ? formatWibDateTime(record.receivedAtStore)
                : null,
              receivedByCourierAt: record.receivedByCourierAt
                ? formatWibDateTime(record.receivedByCourierAt)
                : null,
              lateFee: record.lateFee.toString(),
              damageAmount: record.damageAmount.toString(),
              conditionNote: record.conditionNote,
              damageNote: record.damageNote,
              exemptionReason: record.exemptionReason,
              manualExemptions: record.manualExemptions,
              adminDelayExemptionSeconds: record.adminDelayExemptionSeconds,
              courierDelayExemptionSeconds: record.courierDelayExemptionSeconds,
            },
            after: {
              receivedAtStore: formatWibDateTime(receivedAtStore),
              receivedByCourierAt: courierAt
                ? formatWibDateTime(courierAt)
                : null,
              lateFee: late.fee.toString(),
              damageAmount: damage.toString(),
              conditionNote: note,
              damageNote: damageNote ?? null,
              exemptions: appliedExemptions.map((row) => ({
                ...row,
                from: formatWibDateTime(row.from),
                to: formatWibDateTime(row.to),
              })),
            },
          },
          reason,
        );
        return { bookingId: booking.id, decision: correctionId };
      },
    );
  }

  async verifyReturn(
    context: AuthContext,
    bookingId: string,
    itemId: string,
    input: VerifyReturnDto,
    key?: string,
  ) {
    const receivedAtStore = parseWibDateTime(input.receivedAtStore),
      courierAt = input.receivedByCourierAt
        ? parseWibDateTime(input.receivedByCourierAt)
        : undefined;
    const damage = rupiah(input.damageAmount),
      note = input.conditionNote.trim(),
      damageNote = input.damageNote?.trim();
    const exemptions: Exemption[] = (input.exemptions ?? []).map((row) => ({
      type: row.type,
      from: parseWibDateTime(row.from),
      to: parseWibDateTime(row.to),
      reason: row.reason.trim(),
    }));
    if (
      note.length < 5 ||
      (damage > 0n && (!damageNote || damageNote.length < 5))
    )
      throw new BadRequestException(
        'Catatan kondisi dan kerusakan wajib lengkap.',
      );
    return this.payments.action(
      context,
      bookingId,
      key,
      'operations.return_verify',
      {
        itemId: itemId.toLowerCase(),
        receivedAtStore: formatWibDateTime(receivedAtStore),
        courierAt: courierAt ? formatWibDateTime(courierAt) : null,
        condition: input.condition,
        note,
        damage: damage.toString(),
        damageNote: damageNote ?? null,
        exemptions: exemptions.map((entry) => ({
          ...entry,
          from: formatWibDateTime(entry.from),
          to: formatWibDateTime(entry.to),
        })),
      },
      'admin',
      async (tx, booking) => {
        const item = this.item(booking, itemId),
          now = this.clock.now(),
          rules = this.payments.rules(booking).values;
        if (
          booking.status !== 'berjalan' ||
          !['in_use', 'return_pending'].includes(item.useStatus) ||
          !item.pickedUpAt
        )
          throw new ConflictException(
            'Unit tidak sedang disewa atau sudah diverifikasi.',
          );
        const feeReturnAt = courierAt ?? receivedAtStore;
        if (
          receivedAtStore > now ||
          feeReturnAt < item.pickedUpAt ||
          (courierAt &&
            (courierAt > receivedAtStore ||
              booking.deliveryType !== 'delivery'))
        )
          throw new BadRequestException(
            'Urutan waktu penerimaan/petugas tidak valid atau di masa depan.',
          );
        if (
          exemptions.some(
            (entry) =>
              entry.from >= entry.to ||
              entry.to > now ||
              entry.reason.length < 5 ||
              (entry.type === 'courier' && booking.deliveryType !== 'delivery'),
          )
        )
          throw new BadRequestException('Interval pengecualian tidak valid.');
        const appliedExemptions = [
          ...exemptions,
          ...(await this.delay.exemptions(tx, booking, item.id)),
        ];
        const late = lateCharge(
          item.currentEndAt,
          feeReturnAt,
          rules,
          appliedExemptions,
        );
        const summary = await this.ledger.summary(tx, booking.id);
        if (summary.bill + late.fee + damage > MAX_RUPIAH)
          throw new BadRequestException(
            'Total tagihan melampaui rentang rupiah.',
          );
        await this.cancelPendingExtensions(tx, booking, item, context);
        const record = await tx.returnRecord.upsert({
          where: { bookingItemId: item.id },
          create: {
            bookingItemId: item.id,
            status: 'verified',
            receivedAtStore,
            receivedByCourierAt: courierAt,
            feeReturnAt,
            verifiedAt: now,
            verifiedBy: context.user.id,
            conditionNote: note,
            damageAmount: damage,
            damageNote,
            lateSeconds: late.lateSeconds,
            lateFee: late.fee,
            adminDelayExemptionSeconds: late.adminSeconds,
            courierDelayExemptionSeconds: late.courierSeconds,
            exemptionReason: appliedExemptions.length
              ? appliedExemptions.map((entry) => entry.reason).join('; ')
              : null,
            manualExemptions: exemptions.map((row) => ({
              ...row,
              from: formatWibDateTime(row.from),
              to: formatWibDateTime(row.to),
            })),
            preparationStartedAt: input.condition === 'layak' ? now : null,
          },
          update: {
            status: 'verified',
            receivedAtStore,
            receivedByCourierAt: courierAt ?? null,
            feeReturnAt,
            verifiedAt: now,
            verifiedBy: context.user.id,
            conditionNote: note,
            damageAmount: damage,
            damageNote: damageNote ?? null,
            lateSeconds: late.lateSeconds,
            lateFee: late.fee,
            adminDelayExemptionSeconds: late.adminSeconds,
            courierDelayExemptionSeconds: late.courierSeconds,
            exemptionReason: appliedExemptions.length
              ? appliedExemptions.map((entry) => entry.reason).join('; ')
              : null,
            manualExemptions: exemptions.map((row) => ({
              ...row,
              from: formatWibDateTime(row.from),
              to: formatWibDateTime(row.to),
            })),
            preparationStartedAt: input.condition === 'layak' ? now : null,
          },
        });
        for (const charge of [
          {
            kind: 'late' as const,
            amount: late.fee,
            reason: 'Denda final pengembalian terverifikasi.',
          },
          {
            kind: 'damage' as const,
            amount: damage,
            reason: damageNote ?? note,
          },
        ])
          if (charge.amount > 0n)
            await tx.bookingCharge.create({
              data: {
                bookingId: booking.id,
                bookingItemId: item.id,
                kind: charge.kind,
                direction: 'debit',
                amount: charge.amount,
                reason: charge.reason,
                createdBy: context.user.id,
                effectiveAt: feeReturnAt,
                sourceKey: 'return.' + charge.kind + ':' + record.id,
              },
            });
        await tx.bookingItem.update({
          where: { id: item.id },
          data: { useStatus: 'returned', version: { increment: 1 } },
        });
        await tx.unitAllocation.updateMany({
          where: { bookingItemId: item.id, state: 'active' },
          data: {
            state: 'released',
            releasedAt: now,
            releasedReason: 'Pengembalian diverifikasi.',
          },
        });
        await tx.itemUnit.update({
          where: { id: item.itemUnitId },
          data: {
            conditionStatus: input.condition,
            physicalStatus:
              input.condition === 'layak' ? 'preparing' : 'awaiting_check',
            notes: note,
            preparationUntil:
              input.condition === 'layak'
                ? new Date(now.getTime() + PREPARATION_MS)
                : null,
            maintenanceCompletedAt: null,
          },
        });
        if (
          !(await tx.bookingItem.count({
            where: {
              bookingId: booking.id,
              useStatus: { notIn: ['returned', 'lost_closed'] },
            },
          }))
        )
          await this.status(tx, booking, 'selesai', context.user.id);
        await this.risks.alertUnit(tx, item.itemUnitId);
        await this.event(tx, context, 'return.verified', booking.id, item.id, {
          recordId: record.id,
          feeReturnAt: formatWibDateTime(feeReturnAt),
          scheduledEndAt: formatWibDateTime(item.currentEndAt),
          toleranceMinutes: rules.late_tolerance_minutes,
          tariffPerHour: rules.late_fee_per_hour,
          lateSeconds: late.lateSeconds,
          excludedSeconds: late.excludedSeconds,
          lateFee: late.fee.toString(),
          damage: damage.toString(),
          condition: input.condition,
          exemptions: appliedExemptions.map((entry) => ({
            ...entry,
            from: formatWibDateTime(entry.from),
            to: formatWibDateTime(entry.to),
          })),
        });
        return { bookingId: booking.id, decision: record.id };
      },
    );
  }
}
