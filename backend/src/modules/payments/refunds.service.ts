import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthContext } from '../../auth/auth.service';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessClock } from '../../shared/time/business-clock';
import { parseWibDateTime } from '../../shared/time/wib';
import { rupiah } from '../settings/settings.rules';
import { PaymentLedgerService } from './payment-ledger.service';
import { LockedBooking, PaymentsService } from './payments.service';
import { ProofStorageService, ProofUpload } from './proof-storage.service';
import { RefundRecipientDto, TransferRefundDto } from './refunds.dto';
import { cancellationPolicy, refundShares } from './refunds.rules';

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly ledger: PaymentLedgerService,
    private readonly storage: ProofStorageService,
    private readonly clock: BusinessClock,
  ) {}

  private async lockMoney(tx: Prisma.TransactionClient, bookingId: string) {
    await tx.$queryRaw`SELECT id FROM payments WHERE booking_id=${bookingId}::uuid ORDER BY id FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM refund_requests WHERE booking_id=${bookingId}::uuid ORDER BY id FOR UPDATE`;
  }

  private async event(
    tx: Prisma.TransactionClient,
    actorId: string,
    type: string,
    id: string,
    bookingId: string,
    reason?: string,
    changes: Prisma.InputJsonObject = {},
  ) {
    const now = this.clock.now();
    await tx.auditLog.create({
      data: {
        actorId,
        action: type,
        entityType: type.startsWith('booking.') ? 'Booking' : 'RefundRequest',
        entityId: id,
        changes: { bookingId, ...changes },
        reason,
        createdAt: now,
      },
    });
    await tx.outboxEvent.create({
      data: {
        eventKey: type + ':' + id + ':' + randomUUID(),
        aggregateType: type.startsWith('booking.')
          ? 'Booking'
          : 'RefundRequest',
        aggregateId: id,
        eventType: type,
        payload: { bookingId, sourceId: id },
        occurredAt: now,
      },
    });
  }

  async cancel(
    context: AuthContext,
    bookingId: string,
    reason: string,
    key: string | undefined,
    shopFailure = false,
  ) {
    reason = reason.trim();
    if (reason.length < 5)
      throw new BadRequestException('Alasan pembatalan wajib diisi.');
    return this.payments.action(
      context,
      bookingId,
      key,
      shopFailure ? 'booking.cancel.shop' : 'booking.cancel.customer',
      { reason },
      shopFailure ? 'admin' : 'customer',
      async (tx, booking) => {
        await this.lockMoney(tx, booking.id);
        if (
          ![
            'menunggu_pembayaran',
            'menunggu_konfirmasi',
            'dikonfirmasi',
          ].includes(booking.status) ||
          booking.items.some(
            (item) =>
              item.useStatus !== 'allocated' || item.pickedUpAt !== null,
          )
        )
          throw new ConflictException(
            'Pembatalan hanya berlaku untuk seluruh booking sebelum serah terima.',
          );
        const now = this.clock.now();
        const summary = await this.ledger.summary(tx, booking.id);
        const applications = await tx.paymentApplication.findMany({
          where: {
            bookingId: booking.id,
            state: 'applied',
            obligation: { extensionId: null },
          },
          include: { refundSources: { include: { refund: true } } },
          orderBy: { id: 'asc' },
        });
        const amounts = applications.map(
          (application) =>
            application.amount -
            application.refundSources
              .filter((source) => source.refund.status === 'sudah_dikembalikan')
              .reduce((sum, source) => sum + source.amount, 0n),
        );
        const policy = cancellationPolicy(
          this.payments.rules(booking).values,
          booking.initialStartAt,
          now,
          summary.applied,
          summary.bill,
          shopFailure,
        );
        const split = refundShares(amounts, policy.percent);
        const retained = split.total - split.refund;
        const sourceBudgets = applications.map((application, index) => ({
          incomingPaymentId: application.incomingPaymentId,
          paymentApplicationId: application.id,
          eligible: amounts[index].toString(),
          amount: split.shares[index].toString(),
        }));
        const policySnapshot = {
          schemaVersion: 1,
          ...policy,
          cause: shopFailure ? 'shop' : 'customer',
          cutoffDays:
            this.payments.rules(booking).values.cancel_refund_cutoff_days,
          appliedBefore: summary.applied.toString(),
          billBefore: summary.bill.toString(),
          retained: retained.toString(),
          refundAmount: split.refund.toString(),
          sourceBudgets,
        };
        if (retained > summary.bill)
          throw new ConflictException(
            'Ledger booking perlu direkonsiliasi sebelum pembatalan.',
          );
        // Preserve snapshots/debits. Credit only the unpaid/refundable amount;
        // retained funds remain applied until linked refunds actually transfer.
        let credit = summary.bill - retained;
        const charges = await tx.bookingCharge.findMany({
          where: {
            bookingId: booking.id,
            extensionId: null,
            direction: 'debit',
          },
          include: { adjustments: true },
          orderBy: { id: 'asc' },
        });
        for (const charge of charges) {
          const available =
            charge.amount -
            charge.adjustments.reduce(
              (sum, adjustment) =>
                sum +
                (adjustment.direction === 'credit'
                  ? adjustment.amount
                  : -adjustment.amount),
              0n,
            );
          const amount = available < credit ? available : credit;
          if (amount > 0n) {
            await tx.bookingCharge.create({
              data: {
                bookingId: booking.id,
                bookingItemId: charge.bookingItemId,
                kind: 'adjustment',
                direction: 'credit',
                amount,
                relatedChargeId: charge.id,
                effectiveAt: now,
                reason,
                createdBy: context.user.id,
                sourceKey: 'booking.cancel:' + charge.id,
              },
            });
            credit -= amount;
          }
        }
        if (credit !== 0n)
          throw new ConflictException(
            'Adjustment pembatalan tidak dapat diseimbangkan.',
          );
        if (split.refund > 0n) {
          const refund = await tx.refundRequest.create({
            data: {
              bookingId: booking.id,
              reasonCode: shopFailure
                ? 'shop_cancellation'
                : 'customer_cancellation',
              reasonNote: reason,
              requestedAmount: split.refund,
              recipientDetails: {},
              createdAt: now,
              policySnapshot,
              sources: {
                create: sourceBudgets
                  .filter((source) => BigInt(source.amount) > 0n)
                  .map((source) => ({
                    incomingPaymentId: source.incomingPaymentId,
                    paymentApplicationId: source.paymentApplicationId,
                    amount: BigInt(source.amount),
                  })),
              },
            },
          });
          await this.event(
            tx,
            context.user.id,
            'refund.requested',
            refund.id,
            booking.id,
            reason,
          );
        }
        // Pending proofs are not receipts. Close them without inferring a bank
        // balance; later reconciliation can record actual money and a full refund.
        // A customer cancellation is not an admin proof review. Pending proofs
        // remain historical, while closing their obligation prevents verification.
        await tx.paymentObligation.updateMany({
          where: { bookingId: booking.id, extensionId: null },
          data: { status: 'closed', pendingProofId: null },
        });
        await tx.paymentApplication.updateMany({
          where: {
            bookingId: booking.id,
            state: 'reserved',
            obligation: { extensionId: null },
          },
          data: { state: 'released' },
        });
        const receipts = await tx.payment.findMany({
          where: { bookingId: booking.id, extensionId: null, direction: 'in' },
        });
        for (const receipt of receipts)
          await this.ledger.requestUnusedRefund(
            tx,
            receipt,
            'unused_cancelled_payment',
            now,
          );
        await tx.unitAllocation.updateMany({
          where: { bookingItem: { bookingId: booking.id }, state: 'active' },
          data: { state: 'released', releasedAt: now, releasedReason: reason },
        });
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'dibatalkan', cancelReason: reason },
        });
        await tx.bookingStatusLog.create({
          data: {
            bookingId: booking.id,
            fromStatus: booking.status,
            toStatus: 'dibatalkan',
            actorId: context.user.id,
            note: reason,
            createdAt: now,
          },
        });
        await this.event(
          tx,
          context.user.id,
          'booking.cancelled',
          booking.id,
          booking.id,
          reason,
          {
            fromStatus: booking.status,
            toStatus: 'dibatalkan',
            policySnapshot,
          },
        );
        return { bookingId: booking.id };
      },
    );
  }

  private async identity(context: AuthContext, refundId: string) {
    const refund = await this.prisma.refundRequest.findUnique({
      where: { id: refundId },
      select: { bookingId: true },
    });
    if (!refund) throw new NotFoundException('Refund tidak ditemukan.');
    await this.payments.detail(context, refund.bookingId);
    return refund.bookingId;
  }

  private async lockedRefund(
    tx: Prisma.TransactionClient,
    booking: LockedBooking,
    refundId: string,
  ) {
    await this.lockMoney(tx, booking.id);
    const refund = await tx.refundRequest.findFirst({
      where: { id: refundId, bookingId: booking.id, extensionId: null },
      include: { sources: true },
    });
    if (!refund) throw new NotFoundException('Refund tidak ditemukan.');
    return refund;
  }

  async recipient(
    context: AuthContext,
    refundId: string,
    input: RefundRecipientDto,
    key: string | undefined,
  ) {
    refundId = refundId.toLowerCase();
    const bookingId = await this.identity(context, refundId);
    const recipient = {
      bankName: input.bankName.trim().toUpperCase(),
      accountNumber: input.accountNumber,
      accountHolder: input.accountHolder.trim(),
    };
    if (
      recipient.bankName.length < 2 ||
      recipient.accountHolder.length < 2 ||
      !/^[0-9]{5,34}$/.test(recipient.accountNumber)
    )
      throw new BadRequestException('Rekening penerima tidak valid.');
    return this.payments.action(
      context,
      bookingId,
      key,
      'refund.recipient',
      { refundId, ...recipient },
      context.user.role,
      async (tx, booking) => {
        const refund = await this.lockedRefund(tx, booking, refundId);
        if (refund.status !== 'diajukan')
          throw new ConflictException(
            'Rekening hanya dapat diubah sebelum keputusan admin.',
          );
        await tx.refundRequest.update({
          where: { id: refund.id },
          data: { recipientDetails: recipient },
        });
        await this.event(
          tx,
          context.user.id,
          'refund.recipient_updated',
          refund.id,
          bookingId,
        );
        return { bookingId, decision: refund.id };
      },
    );
  }

  private recipientAccount(value: Prisma.JsonValue) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      typeof value.bankName !== 'string' ||
      typeof value.accountNumber !== 'string' ||
      typeof value.accountHolder !== 'string' ||
      value.bankName.trim().length < 2 ||
      !/^[0-9]{5,34}$/.test(value.accountNumber) ||
      value.accountHolder.trim().length < 2
    )
      throw new ConflictException(
        'Lengkapi rekening penerima sebelum persetujuan.',
      );
    return value.bankName.toLowerCase() + ':' + value.accountNumber;
  }

  private async assertFunds(
    tx: Prisma.TransactionClient,
    refund: Awaited<ReturnType<RefundsService['lockedRefund']>>,
  ) {
    if (
      !refund.sources.length ||
      refund.sources.reduce((sum, source) => sum + source.amount, 0n) !==
        refund.requestedAmount
    )
      throw new ConflictException(
        'Sumber refund tidak sesuai nominal kebijakan.',
      );
    const others = await tx.refundSource.findMany({
      where: {
        bookingId: refund.bookingId,
        refundRequestId: { not: refund.id },
        refund: { status: { in: ['disetujui', 'sudah_dikembalikan'] } },
      },
    });
    const receiptIds = [
      ...new Set(refund.sources.map((source) => source.incomingPaymentId)),
    ];
    for (const id of receiptIds) {
      const receipt = await tx.payment.findUniqueOrThrow({
        where: { id },
        include: { applications: true },
      });
      const own = refund.sources.filter(
        (source) => source.incomingPaymentId === id,
      );
      const committed = others.filter(
        (source) => source.incomingPaymentId === id,
      );
      if (
        receipt.direction !== 'in' ||
        own.reduce((sum, source) => sum + source.amount, 0n) +
          committed.reduce((sum, source) => sum + source.amount, 0n) >
          receipt.amount
      )
        throw new ConflictException(
          'Dana sudah dicadangkan atau dikembalikan oleh refund lain.',
        );
      const held = receipt.applications.filter((application) =>
        ['applied', 'reserved'].includes(application.state),
      );
      const unused =
        receipt.amount -
        held.reduce((sum, application) => sum + application.amount, 0n);
      if (
        own
          .filter((source) => !source.paymentApplicationId)
          .reduce((sum, source) => sum + source.amount, 0n) +
          committed
            .filter((source) => !source.paymentApplicationId)
            .reduce((sum, source) => sum + source.amount, 0n) >
        unused
      )
        throw new ConflictException(
          'Refund tidak boleh mengambil dana pembayaran yang masih diterapkan.',
        );
      for (const source of own.filter(
        (source) => source.paymentApplicationId,
      )) {
        const snapshot = refund.policySnapshot;
        const budgets =
          snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
            ? snapshot.sourceBudgets
            : null;
        const budget = Array.isArray(budgets)
          ? budgets.find(
              (entry) =>
                entry &&
                typeof entry === 'object' &&
                !Array.isArray(entry) &&
                entry.paymentApplicationId === source.paymentApplicationId &&
                entry.incomingPaymentId === id,
            )
          : null;
        if (
          !budget ||
          typeof budget !== 'object' ||
          Array.isArray(budget) ||
          typeof budget.amount !== 'string'
        )
          throw new ConflictException('Snapshot sumber refund tidak valid.');
        const application = held.find(
          (application) => application.id === source.paymentApplicationId,
        );
        const already = committed
          .filter(
            (other) =>
              other.paymentApplicationId === source.paymentApplicationId,
          )
          .reduce((sum, other) => sum + other.amount, 0n);
        if (
          !application ||
          source.amount + already > rupiah(budget.amount) ||
          source.amount + already > application.amount
        )
          throw new ConflictException(
            'Hak refund pada aplikasi dana sudah digunakan.',
          );
      }
    }
  }

  async approve(
    context: AuthContext,
    refundId: string,
    key: string | undefined,
  ) {
    refundId = refundId.toLowerCase();
    const bookingId = await this.identity(context, refundId);
    return this.payments.action(
      context,
      bookingId,
      key,
      'refund.approve',
      { refundId },
      'admin',
      async (tx, booking) => {
        const refund = await this.lockedRefund(tx, booking, refundId);
        if (refund.status !== 'diajukan')
          throw new ConflictException('Refund sudah diputuskan.');
        this.recipientAccount(refund.recipientDetails);
        await this.assertFunds(tx, refund);
        await tx.refundRequest.update({
          where: { id: refund.id },
          data: {
            status: 'disetujui',
            approvedAmount: refund.requestedAmount,
            approvedBy: context.user.id,
            approvedAt: this.clock.now(),
          },
        });
        await this.event(
          tx,
          context.user.id,
          'refund.approved',
          refund.id,
          bookingId,
        );
        return { bookingId, decision: refund.id };
      },
    );
  }

  async reject(
    context: AuthContext,
    refundId: string,
    reason: string,
    key: string | undefined,
  ) {
    refundId = refundId.toLowerCase();
    const bookingId = await this.identity(context, refundId);
    reason = reason.trim();
    if (reason.length < 5)
      throw new BadRequestException('Alasan penolakan wajib diisi.');
    return this.payments.action(
      context,
      bookingId,
      key,
      'refund.reject',
      { refundId, reason },
      'admin',
      async (tx, booking) => {
        const refund = await this.lockedRefund(tx, booking, refundId);
        if (refund.status !== 'diajukan')
          throw new ConflictException('Refund sudah diputuskan.');
        await tx.refundRequest.update({
          where: { id: refund.id },
          data: { status: 'ditolak', rejectedReason: reason },
        });
        await this.event(
          tx,
          context.user.id,
          'refund.rejected',
          refund.id,
          bookingId,
          reason,
        );
        return { bookingId, decision: refund.id };
      },
    );
  }

  async transfer(
    context: AuthContext,
    refundId: string,
    input: TransferRefundDto,
    file: ProofUpload | undefined,
    key: string | undefined,
  ) {
    refundId = refundId.toLowerCase();
    const bookingId = await this.identity(context, refundId);
    const amount = rupiah(input.amount),
      occurredAt = parseWibDateTime(input.transferredAt);
    const reference = input.transactionReference.trim().toUpperCase(),
      note = input.note.trim();
    if (
      amount === 0n ||
      !reference ||
      note.length < 5 ||
      occurredAt > this.clock.now()
    )
      throw new BadRequestException(
        'Nominal, waktu atau referensi transfer tidak valid.',
      );
    const saved = await this.storage.save(file);
    let keep: boolean;
    try {
      return await this.payments.action(
        context,
        bookingId,
        key,
        'refund.transfer',
        {
          refundId,
          amount: amount.toString(),
          transferredAt: occurredAt.toISOString(),
          reference,
          note,
          fileHash: saved.fileHash,
        },
        'admin',
        async (tx, booking) => {
          const refund = await this.lockedRefund(tx, booking, refundId);
          if (refund.status !== 'disetujui' || refund.approvedAmount !== amount)
            throw new ConflictException(
              'Transfer wajib sesuai nominal refund yang telah disetujui.',
            );
          const account = this.recipientAccount(refund.recipientDetails);
          await this.assertFunds(tx, refund);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([account, reference])}, 1))`;
          if (
            await tx.payment.findFirst({
              where: {
                receivingAccountReference: account,
                transactionReference: reference,
              },
            })
          )
            throw new ConflictException('Referensi transfer sudah dicatat.');
          const now = this.clock.now();
          if (
            occurredAt > now ||
            !refund.approvedAt ||
            occurredAt < refund.approvedAt
          )
            throw new BadRequestException(
              'Waktu transfer harus setelah persetujuan dan tidak di masa depan.',
            );
          await tx.payment.create({
            data: {
              bookingId,
              direction: 'out',
              type: 'refund',
              method: 'transfer',
              amount,
              refundRequestId: refund.id,
              occurredAt,
              recordedAt: now,
              recordedBy: context.user.id,
              receivingAccountReference: account,
              transactionReference: reference,
              attachmentPath: saved.proofPath,
              sourceKey: 'refund.transfer:' + refund.id,
              note,
            },
          });
          await tx.refundRequest.update({
            where: { id: refund.id },
            data: { status: 'sudah_dikembalikan', transferredAt: occurredAt },
          });
          await this.event(
            tx,
            context.user.id,
            'refund.transferred',
            refund.id,
            bookingId,
            note,
          );
          return { bookingId, decision: refund.id };
        },
      );
    } finally {
      // Check durable receipt after transaction/replay/uncertain commit. If the
      // DB cannot answer, retain the file for reconciliation rather than destroy evidence.
      try {
        keep = !!(await this.prisma.payment.findFirst({
          where: { attachmentPath: saved.proofPath },
        }));
      } catch {
        keep = true;
      }
      if (!keep) await this.storage.remove(saved.proofPath);
    }
  }

  async proof(context: AuthContext, refundId: string) {
    refundId = refundId.toLowerCase();
    const bookingId = await this.identity(context, refundId);
    const payment = await this.prisma.payment.findFirst({
      where: { bookingId, refundRequestId: refundId, direction: 'out' },
    });
    if (!payment?.attachmentPath)
      throw new NotFoundException('Bukti transfer belum tersedia.');
    return { path: payment.attachmentPath, id: refundId };
  }
}
