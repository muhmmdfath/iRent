import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { AuthContext, AuthService } from '../../auth/auth.service';
import { Booking, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { runBusinessTransaction } from '../../prisma/business-transaction';
import { BusinessClock } from '../../shared/time/business-clock';
import { parseWibDateTime } from '../../shared/time/wib';
import { unitAvailable } from '../bookings/bookings.rules';
import { validateSettings } from '../settings/settings.rules';
import { rupiah } from '../settings/settings.rules';
import { PaymentLedgerService } from './payment-ledger.service';
import {
  ReceiptDto,
  ReconcileReceiptDto,
  UploadProofDto,
  VerifyProofDto,
} from './payments.dto';
import { ProofStorageService, ProofUpload } from './proof-storage.service';

const safeProof = {
  id: true,
  paymentObligationId: true,
  mime: true,
  size: true,
  claimedAmount: true,
  uploadedAt: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  rejectedReason: true,
} satisfies Prisma.PaymentProofSelect;
type ActionResult = { bookingId: string; proofId?: string; decision?: string };
export type LockedBooking = Prisma.BookingGetPayload<{
  include: { items: true; obligations: true };
}>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly clock: BusinessClock,
    private readonly storage: ProofStorageService,
    private readonly ledger: PaymentLedgerService,
  ) {}

  rules(booking: Booking) {
    const snapshot = booking.rulesSnapshot;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
      throw new ConflictException('Snapshot aturan booking tidak valid.');
    const rules = snapshot.rules;
    const values =
      rules && typeof rules === 'object' && !Array.isArray(rules)
        ? rules.values
        : snapshot.values;
    if (!values || typeof values !== 'object' || Array.isArray(values))
      throw new ConflictException('Snapshot aturan booking tidak valid.');
    return {
      values: validateSettings(values),
      urgent: snapshot.urgent === true,
    };
  }

  private async lockBooking(
    tx: Prisma.TransactionClient,
    id: string,
    context?: AuthContext,
  ): Promise<LockedBooking> {
    const identity = await tx.booking.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (
      !identity ||
      (context?.user.role === 'customer' && identity.userId !== context.user.id)
    )
      throw new NotFoundException('Booking tidak ditemukan.');
    await tx.$queryRaw`SELECT id FROM users WHERE id=${identity.userId}::uuid FOR UPDATE`;
    const items = await tx.bookingItem.findMany({
      where: { bookingId: id },
      select: { itemId: true, itemUnitId: true },
    });
    const itemIds = [...new Set(items.map((item) => item.itemId))].sort();
    if (itemIds.length) {
      await tx.$queryRaw`SELECT id FROM items WHERE id IN (${Prisma.join(itemIds.map((itemId) => Prisma.sql`${itemId}::uuid`))}) ORDER BY id FOR UPDATE`;
      const unitIds = [...new Set(items.map((item) => item.itemUnitId))].sort();
      await tx.$queryRaw`SELECT id FROM item_units WHERE id IN (${Prisma.join(unitIds.map((unitId) => Prisma.sql`${unitId}::uuid`))}) ORDER BY id FOR UPDATE`;
    }
    await tx.$queryRaw`SELECT id FROM bookings WHERE id=${id}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM payment_obligations WHERE booking_id=${id}::uuid ORDER BY id FOR UPDATE`;
    return tx.booking.findUniqueOrThrow({
      where: { id },
      include: { items: true, obligations: true },
    });
  }

  private key(key: string | undefined) {
    if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new BadRequestException(
        'Idempotency-Key wajib diisi (1–128 karakter).',
      );
    return key;
  }

  /** Shared financial action boundary: actor/customer, inventory and booking locks,
   * authorization, idempotency and a private owner/admin ledger response. */
  async action(
    context: AuthContext,
    bookingId: string,
    key: string | undefined,
    operation: string,
    payload: Record<string, unknown>,
    role: 'customer' | 'admin',
    execute: (
      tx: Prisma.TransactionClient,
      booking: LockedBooking,
    ) => Promise<ActionResult>,
    beforeCommit?: (booking: LockedBooking) => void,
  ) {
    const validatedKey = this.key(key),
      actorId = context.user.id;
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({ bookingId: bookingId.toLowerCase(), ...payload }),
      )
      .digest('hex');
    return runBusinessTransaction(this.prisma, async (tx) => {
      await this.auth.authorizeLocked(tx, context, role);
      const previous = await tx.idempotencyRequest.findUnique({
        where: {
          actorId_operation_key: { actorId, operation, key: validatedKey },
        },
      });
      if (previous) {
        if (previous.requestHash !== requestHash)
          throw new ConflictException(
            'Idempotency-Key sudah digunakan untuk payload berbeda.',
          );
        const ref = previous.resultReference;
        if (
          previous.status !== 'succeeded' ||
          !ref ||
          typeof ref !== 'object' ||
          Array.isArray(ref) ||
          typeof ref.bookingId !== 'string'
        )
          throw new ConflictException('Permintaan belum selesai.');
        const result: ActionResult = {
          bookingId: ref.bookingId,
          ...(typeof ref.proofId === 'string' ? { proofId: ref.proofId } : {}),
          ...(typeof ref.decision === 'string'
            ? { decision: ref.decision }
            : {}),
        };
        await this.lockBooking(tx, ref.bookingId, context);
        return { ...result, ...(await this.view(tx, ref.bookingId)) };
      }
      const booking = await this.lockBooking(tx, bookingId, context);
      const result = await execute(tx, booking);
      await tx.idempotencyRequest.create({
        data: {
          actorId,
          operation,
          key: validatedKey,
          requestHash,
          status: 'succeeded',
          resultReference: result,
        },
      });
      const view = await this.view(tx, bookingId);
      beforeCommit?.(booking);
      return { ...result, ...view };
    });
  }

  private async view(tx: Prisma.TransactionClient, bookingId: string) {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        obligations: {
          include: {
            proofs: { select: safeProof, orderBy: { uploadedAt: 'asc' } },
          },
        },
        refunds: {
          select: {
            id: true,
            status: true,
            reasonCode: true,
            requestedAmount: true,
            approvedAmount: true,
            transferredAt: true,
            recipientDetails: true,
            reasonNote: true,
            rejectedReason: true,
            approvedAt: true,
            policySnapshot: true,
          },
        },
      },
    });
    const summary = await this.ledger.summary(tx, bookingId);
    const paymentStatus = ['kedaluwarsa', 'ditolak', 'dibatalkan'].includes(
      booking.status,
    )
      ? 'ditutup'
      : summary.remaining === 0n
        ? 'lunas'
        : summary.applied >= booking.amountDueNow && booking.payOption === 'dp'
          ? 'dp_terverifikasi'
          : summary.reserved > 0n
            ? 'kurang_bayar'
            : 'belum_terverifikasi';
    return {
      booking,
      summary: { ...summary, paymentStatus },
      confirmationOverdue:
        booking.status === 'menunggu_konfirmasi' &&
        booking.confirmationDueAt !== null &&
        this.clock.now() > booking.confirmationDueAt,
    };
  }

  async detail(context: AuthContext, bookingId: string) {
    return runBusinessTransaction(this.prisma, async (tx) => {
      await this.auth.authorizeLocked(tx, context, context.user.role);
      const booking = await tx.booking.findFirst({
        where: {
          id: bookingId,
          ...(context.user.role === 'customer'
            ? { userId: context.user.id }
            : {}),
        },
      });
      if (!booking) throw new NotFoundException('Booking tidak ditemukan.');
      await tx.$queryRaw`SELECT id FROM users WHERE id=${booking.userId}::uuid FOR UPDATE`;
      return this.view(tx, bookingId);
    });
  }

  async upload(
    context: AuthContext,
    bookingId: string,
    obligationId: string,
    input: UploadProofDto,
    file: ProofUpload | undefined,
    key: string | undefined,
  ) {
    this.key(key);
    const claimedAmount = rupiah(input.claimedAmount);
    // Authorize before writing any private file; reauthorize under locks below.
    await this.detail(context, bookingId);
    const saved = await this.storage.save(file);
    const newProofId = randomUUID();
    let retain = false;
    try {
      const result = await this.action(
        context,
        bookingId,
        key,
        'payment.upload',
        {
          obligationId: obligationId.toLowerCase(),
          claimedAmount: claimedAmount.toString(),
          fileHash: saved.fileHash,
        },
        'customer',
        async (tx, booking) => {
          const obligation = booking.obligations.find(
            (item) => item.id === obligationId.toLowerCase(),
          );
          if (!obligation || obligation.extensionId)
            throw new NotFoundException(
              'Kewajiban pembayaran tidak ditemukan.',
            );
          const now = this.clock.now();
          if (obligation.status !== 'open')
            throw new ConflictException(
              'Kewajiban sudah selesai atau masih memiliki bukti pending.',
            );
          const initial = obligation.purpose !== 'settlement';
          if (
            initial &&
            (booking.status !== 'menunggu_pembayaran' ||
              now > booking.expiresAt)
          )
            throw new ConflictException(
              'Batas pembayaran sudah berakhir atau booking tidak menunggu pembayaran.',
            );
          if (
            !initial &&
            !['dikonfirmasi', 'berjalan', 'selesai'].includes(booking.status)
          )
            throw new ConflictException('Booking belum dapat dilunasi.');
          const proof = await tx.paymentProof.create({
            data: {
              id: newProofId,
              paymentObligationId: obligation.id,
              ...saved,
              claimedAmount,
              uploadedAt: now,
            },
          });
          await tx.paymentObligation.update({
            where: { id: obligation.id },
            data: { status: 'proof_pending', pendingProofId: proof.id },
          });
          if (initial) {
            const rules = this.rules(booking);
            const confirmationDueAt = new Date(
              Math.min(
                now.getTime() +
                  (rules.urgent
                    ? rules.values.urgent_confirm_minutes * 60000
                    : rules.values.confirm_sla_hours * 3600000),
                booking.initialStartAt.getTime() -
                  rules.values.confirm_before_pickup_minutes * 60000,
              ),
            );
            await tx.booking.update({
              where: { id: booking.id },
              data: {
                status: 'menunggu_konfirmasi',
                uploadedAt: now,
                confirmationDueAt,
              },
            });
            await tx.unitAllocation.updateMany({
              where: {
                bookingItem: { bookingId: booking.id },
                state: 'active',
                allocationKind: 'rental',
              },
              data: { holdExpiresAt: null },
            });
            await tx.bookingStatusLog.create({
              data: {
                bookingId: booking.id,
                fromStatus: booking.status,
                toStatus: 'menunggu_konfirmasi',
                actorId: context.user.id,
                createdAt: now,
              },
            });
          }
          await this.event(
            tx,
            booking.id,
            'payment.proof_uploaded',
            proof.id,
            now,
            context.user.id,
          );
          if (initial && this.clock.now() > booking.expiresAt)
            throw new ConflictException(
              'Pencatatan bukti selesai setelah batas pembayaran.',
            );
          return { bookingId: booking.id, proofId: proof.id };
        },
        (booking) => {
          const initial =
            booking.obligations.find(
              (obligation) => obligation.id === obligationId.toLowerCase(),
            )?.purpose !== 'settlement';
          if (initial && this.clock.now() > booking.expiresAt)
            throw new ConflictException(
              'Pencatatan bukti selesai setelah batas pembayaran.',
            );
        },
      );
      retain = result.proofId === newProofId;
      return result;
    } catch (error) {
      try {
        retain =
          (await this.prisma.paymentProof.count({
            where: { id: newProofId },
          })) > 0;
      } catch {
        retain = true;
      }
      throw error;
    } finally {
      if (!retain) await this.storage.remove(saved.proofPath);
    }
  }

  async proof(context: AuthContext, proofId: string) {
    return runBusinessTransaction(this.prisma, async (tx) => {
      await this.auth.authorizeLocked(tx, context, context.user.role);
      const proof = await tx.paymentProof.findFirst({
        where: {
          id: proofId,
          ...(context.user.role === 'customer'
            ? { obligation: { booking: { userId: context.user.id } } }
            : {}),
        },
        select: { proofPath: true, mime: true, size: true, id: true },
      });
      if (!proof) throw new NotFoundException('Bukti tidak ditemukan.');
      return proof;
    });
  }

  settlement(context: AuthContext, bookingId: string, key: string | undefined) {
    return this.action(
      context,
      bookingId,
      key,
      'payment.settlement',
      {},
      'customer',
      async (tx, booking) => {
        if (!['dikonfirmasi', 'berjalan', 'selesai'].includes(booking.status))
          throw new ConflictException('Booking belum dapat dilunasi.');
        const pending = booking.obligations.find(
          (item) =>
            item.purpose === 'settlement' &&
            ['open', 'proof_pending'].includes(item.status),
        );
        if (!pending) {
          const summary = await this.ledger.summary(tx, booking.id);
          if (summary.remaining > 0n) {
            const created = await tx.paymentObligation.create({
              data: {
                bookingId: booking.id,
                purpose: 'settlement',
                amountDue: summary.remaining,
              },
            });
            await this.event(
              tx,
              booking.id,
              'payment.settlement_opened',
              created.id,
              this.clock.now(),
              context.user.id,
            );
          }
        }
        return { bookingId: booking.id };
      },
    );
  }

  private receiptInput(input: ReceiptDto) {
    let occurredAt: Date;
    try {
      occurredAt = parseWibDateTime(input.occurredAt);
    } catch {
      throw new BadRequestException(
        'Waktu transaksi harus datetime WIB yang valid.',
      );
    }
    const amount = rupiah(input.amount);
    if (amount <= 0n || occurredAt > this.clock.now())
      throw new BadRequestException(
        'Nominal harus positif dan waktu transaksi tidak boleh di masa depan.',
      );
    const account = input.receivingAccountReference?.trim().toLowerCase(),
      reference = input.transactionReference?.trim().toUpperCase();
    if (input.method !== 'cash' && (!account || !reference))
      throw new BadRequestException(
        'Rekening penerima dan referensi transaksi wajib diisi.',
      );
    if (input.method === 'cash' && (account || reference))
      throw new BadRequestException(
        'Pembayaran tunai tidak memakai referensi bank.',
      );
    if (input.note.trim().length < 5)
      throw new BadRequestException('Catatan verifikasi wajib diisi.');
    return {
      amount,
      occurredAt,
      method: input.method,
      receivingAccountReference: account ?? null,
      transactionReference: reference ?? null,
      note: input.note.trim(),
    };
  }

  private async receipt(
    tx: Prisma.TransactionClient,
    booking: LockedBooking,
    obligationId: string,
    input: ReturnType<PaymentsService['receiptInput']>,
    actorId: string,
    proofId?: string,
    reconciliation = false,
  ) {
    if (input.receivingAccountReference && input.transactionReference) {
      const bankKey = JSON.stringify([
        input.receivingAccountReference,
        input.transactionReference,
      ]);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${bankKey},1))::text`;
      if (
        await tx.payment.findFirst({
          where: {
            receivingAccountReference: input.receivingAccountReference,
            transactionReference: input.transactionReference,
          },
        })
      )
        throw new ConflictException('Transaksi bank sudah tercatat.');
    }
    if (input.occurredAt > this.clock.now())
      throw new BadRequestException(
        'Waktu transaksi tidak boleh di masa depan.',
      );
    const obligation = booking.obligations.find(
      (item) => item.id === obligationId,
    )!;
    const payment = await tx.payment.create({
      data: {
        ...input,
        bookingId: booking.id,
        paymentObligationId: obligationId,
        proofId,
        direction: 'in',
        type: reconciliation
          ? 'reconciliation'
          : obligation.purpose === 'settlement'
            ? 'settlement'
            : obligation.purpose === 'initial_dp'
              ? 'dp'
              : 'full',
        recordedBy: actorId,
        recordedAt: this.clock.now(),
        sourceKey: 'receipt:' + randomUUID(),
      },
    });
    await this.event(
      tx,
      booking.id,
      'payment.received',
      payment.id,
      this.clock.now(),
      actorId,
    );
    return payment;
  }

  private async canApprove(
    tx: Prisma.TransactionClient,
    booking: LockedBooking,
    now: Date,
  ) {
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
    for (const item of booking.items) {
      const unit = units.find((unit) => unit.id === item.itemUnitId);
      if (
        !unit ||
        !unit.item.isActive ||
        !allocations.some(
          (allocation) =>
            allocation.bookingItemId === item.id &&
            allocation.itemUnitId === item.itemUnitId &&
            allocation.allocationKind === 'rental',
        ) ||
        !unitAvailable(
          unit,
          allocations.filter(
            (allocation) => allocation.bookingItem.bookingId !== booking.id,
          ),
          uses,
          item.startAt,
          item.currentEndAt,
          now,
        )
      )
        return false;
    }
    return booking.items.length > 0;
  }

  private async approveInitial(
    tx: Prisma.TransactionClient,
    booking: LockedBooking,
    actorId: string,
    now: Date,
  ) {
    if (!(await this.canApprove(tx, booking, now))) {
      await this.ledger.closeInitialBooking(
        tx,
        booking,
        'ditolak',
        now,
        'Alokasi atau kondisi unit tidak memenuhi persetujuan.',
        actorId,
      );
      return 'refund_required';
    }
    const initial = booking.obligations.find((item) =>
      ['initial_dp', 'initial_full'].includes(item.purpose),
    )!;
    await tx.paymentApplication.updateMany({
      where: { paymentObligationId: initial.id, state: 'reserved' },
      data: { state: 'applied' },
    });
    await tx.paymentObligation.update({
      where: { id: initial.id },
      data: { status: 'satisfied', pendingProofId: null },
    });
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: 'dikonfirmasi', confirmedBy: actorId, confirmedAt: now },
    });
    await tx.unitAllocation.updateMany({
      where: {
        bookingItem: { bookingId: booking.id },
        state: 'active',
        allocationKind: 'rental',
      },
      data: { holdExpiresAt: null },
    });
    await tx.bookingStatusLog.create({
      data: {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: 'dikonfirmasi',
        actorId,
        createdAt: now,
      },
    });
    await this.event(
      tx,
      booking.id,
      'booking.confirmed',
      booking.id,
      now,
      actorId,
    );
    return 'approved';
  }

  verify(
    context: AuthContext,
    bookingId: string,
    input: VerifyProofDto,
    key: string | undefined,
  ) {
    const receiptInput = this.receiptInput(input);
    return this.action(
      context,
      bookingId,
      key,
      'payment.verify',
      {
        proofId: input.proofId.toLowerCase(),
        ...receiptInput,
        amount: receiptInput.amount.toString(),
        occurredAt: receiptInput.occurredAt.toISOString(),
      },
      'admin',
      async (tx, booking) => {
        const proof = await tx.paymentProof.findUnique({
          where: { id: input.proofId.toLowerCase() },
        });
        const obligation = booking.obligations.find(
          (item) => item.id === proof?.paymentObligationId,
        );
        if (!proof || !obligation || obligation.extensionId)
          throw new NotFoundException('Bukti tidak ditemukan.');
        if (
          proof.status !== 'pending' ||
          obligation.pendingProofId !== proof.id ||
          obligation.status !== 'proof_pending'
        )
          throw new ConflictException('Bukti sudah diputuskan.');
        const initial = obligation.purpose !== 'settlement';
        if (
          initial
            ? booking.status !== 'menunggu_konfirmasi'
            : !['dikonfirmasi', 'berjalan', 'selesai'].includes(booking.status)
        )
          throw new ConflictException(
            'Status booking tidak menerima verifikasi ini.',
          );
        const payment = await this.receipt(
          tx,
          booking,
          obligation.id,
          receiptInput,
          context.user.id,
          proof.id,
        );
        const now = this.clock.now();
        await tx.paymentProof.update({
          where: { id: proof.id },
          data: {
            status: 'verified',
            reviewedBy: context.user.id,
            reviewedAt: now,
          },
        });
        await tx.paymentObligation.update({
          where: { id: obligation.id },
          data: { status: 'open', pendingProofId: null },
        });
        const existing = await tx.paymentApplication.findMany({
          where: {
            paymentObligationId: obligation.id,
            state: { in: ['reserved', 'applied'] },
          },
        });
        const due =
          obligation.amountDue -
          existing.reduce((sum, application) => sum + application.amount, 0n);
        const assigned = receiptInput.amount < due ? receiptInput.amount : due;
        if (assigned > 0n)
          await tx.paymentApplication.create({
            data: {
              incomingPaymentId: payment.id,
              paymentObligationId: obligation.id,
              bookingId: booking.id,
              amount: assigned,
              state: 'reserved',
            },
          });
        await this.ledger.requestUnusedRefund(tx, payment, 'overpayment', now);
        let decision: string;
        if (assigned >= due) {
          if (initial)
            decision = await this.approveInitial(
              tx,
              booking,
              context.user.id,
              now,
            );
          else {
            await tx.paymentApplication.updateMany({
              where: { paymentObligationId: obligation.id, state: 'reserved' },
              data: { state: 'applied' },
            });
            await tx.paymentObligation.update({
              where: { id: obligation.id },
              data: { status: 'satisfied' },
            });
            decision = 'settled';
          }
        } else if (initial && now > booking.expiresAt) {
          await this.ledger.closeInitialBooking(
            tx,
            booking,
            'kedaluwarsa',
            now,
            'Dana awal kurang dan deadline pembayaran telah lewat.',
            context.user.id,
          );
          decision = 'refund_required';
        } else {
          if (initial) {
            await tx.booking.update({
              where: { id: booking.id },
              data: { status: 'menunggu_pembayaran', confirmationDueAt: null },
            });
            await tx.unitAllocation.updateMany({
              where: {
                bookingItem: { bookingId: booking.id },
                state: 'active',
                allocationKind: 'rental',
              },
              data: { holdExpiresAt: booking.expiresAt },
            });
            await tx.bookingStatusLog.create({
              data: {
                bookingId: booking.id,
                fromStatus: booking.status,
                toStatus: 'menunggu_pembayaran',
                actorId: context.user.id,
                note: 'Dana kurang; deadline pembayaran asli tetap berlaku.',
                createdAt: now,
              },
            });
          }
          decision = 'underpaid';
        }
        await this.event(
          tx,
          booking.id,
          'payment.proof_verified',
          proof.id,
          now,
          context.user.id,
        );
        return { bookingId: booking.id, proofId: proof.id, decision };
      },
    );
  }

  reject(
    context: AuthContext,
    bookingId: string,
    proofId: string,
    reason: string,
    key: string | undefined,
  ) {
    if (reason.trim().length < 5)
      throw new BadRequestException('Alasan penolakan wajib diisi.');
    return this.action(
      context,
      bookingId,
      key,
      'payment.reject',
      { proofId: proofId.toLowerCase(), reason: reason.trim() },
      'admin',
      async (tx, booking) => {
        if (['dibatalkan', 'kedaluwarsa', 'ditolak'].includes(booking.status))
          throw new ConflictException(
            'Booking sudah ditutup; gunakan rekonsiliasi dana.',
          );
        const proof = await tx.paymentProof.findUnique({
          where: { id: proofId.toLowerCase() },
        });
        const obligation = booking.obligations.find(
          (item) => item.id === proof?.paymentObligationId,
        );
        if (!proof || !obligation || obligation.extensionId)
          throw new NotFoundException('Bukti tidak ditemukan.');
        if (
          proof.status !== 'pending' ||
          obligation.pendingProofId !== proof.id
        )
          throw new ConflictException('Bukti sudah diputuskan.');
        const now = this.clock.now();
        await tx.paymentProof.update({
          where: { id: proof.id },
          data: {
            status: 'rejected',
            reviewedBy: context.user.id,
            reviewedAt: now,
            rejectedReason: reason.trim(),
          },
        });
        await tx.paymentObligation.update({
          where: { id: obligation.id },
          data: { status: 'open', pendingProofId: null },
        });
        if (obligation.purpose !== 'settlement') {
          if (now > booking.expiresAt)
            await this.ledger.closeInitialBooking(
              tx,
              booking,
              'kedaluwarsa',
              now,
              reason.trim(),
              context.user.id,
            );
          else {
            await tx.booking.update({
              where: { id: booking.id },
              data: { status: 'menunggu_pembayaran', confirmationDueAt: null },
            });
            await tx.unitAllocation.updateMany({
              where: {
                bookingItem: { bookingId: booking.id },
                state: 'active',
                allocationKind: 'rental',
              },
              data: { holdExpiresAt: booking.expiresAt },
            });
            await tx.bookingStatusLog.create({
              data: {
                bookingId: booking.id,
                fromStatus: booking.status,
                toStatus: 'menunggu_pembayaran',
                actorId: context.user.id,
                note: reason.trim(),
                createdAt: now,
              },
            });
          }
        }
        await this.event(
          tx,
          booking.id,
          'payment.proof_rejected',
          proof.id,
          now,
          context.user.id,
        );
        return { bookingId: booking.id, proofId: proof.id };
      },
    );
  }

  reconcile(
    context: AuthContext,
    bookingId: string,
    input: ReconcileReceiptDto,
    key: string | undefined,
  ) {
    const normalized = this.receiptInput(input);
    return this.action(
      context,
      bookingId,
      key,
      'payment.reconcile',
      {
        obligationId: input.obligationId.toLowerCase(),
        proofId: input.proofId?.toLowerCase() ?? null,
        ...normalized,
        amount: normalized.amount.toString(),
        occurredAt: normalized.occurredAt.toISOString(),
      },
      'admin',
      async (tx, booking) => {
        const obligation = booking.obligations.find(
          (item) => item.id === input.obligationId.toLowerCase(),
        );
        if (
          !obligation ||
          obligation.extensionId ||
          obligation.purpose === 'settlement'
        )
          throw new NotFoundException('Kewajiban awal tidak ditemukan.');
        const proof = input.proofId
          ? await tx.paymentProof.findUnique({
              where: { id: input.proofId.toLowerCase() },
            })
          : null;
        const terminal = ['kedaluwarsa', 'ditolak', 'dibatalkan'].includes(
          booking.status,
        );
        if (
          input.proofId &&
          (!proof ||
            proof.paymentObligationId !== obligation.id ||
            (proof.status !== 'rejected' &&
              !(
                terminal &&
                obligation.status === 'closed' &&
                proof.status === 'pending'
              )))
        )
          throw new ConflictException(
            'Gunakan bukti ditolak atau bukti belum diperiksa pada booking yang ditutup.',
          );
        if (
          !['kedaluwarsa', 'ditolak', 'dibatalkan'].includes(booking.status) &&
          !proof
        )
          throw new ConflictException(
            'Gunakan verifikasi bukti untuk booking aktif.',
          );
        const receipt = await this.receipt(
          tx,
          booking,
          obligation.id,
          normalized,
          context.user.id,
          proof?.id,
          true,
        );
        if (proof?.status === 'pending')
          await tx.paymentProof.update({
            where: { id: proof.id },
            data: {
              status: 'verified',
              reviewedBy: context.user.id,
              reviewedAt: this.clock.now(),
            },
          });
        await this.ledger.requestUnusedRefund(
          tx,
          receipt,
          'reconciliation_refund',
          this.clock.now(),
        );
        return { bookingId: booking.id, decision: 'refund_required' };
      },
    );
  }

  approve(context: AuthContext, bookingId: string, key: string | undefined) {
    return this.action(
      context,
      bookingId,
      key,
      'booking.approve',
      {},
      'admin',
      async (tx, booking) => {
        if (booking.status === 'dikonfirmasi')
          return { bookingId: booking.id, decision: 'already_approved' };
        if (
          !['menunggu_pembayaran', 'menunggu_konfirmasi'].includes(
            booking.status,
          )
        )
          throw new ConflictException('Booking tidak dapat disetujui.');
        const obligation = booking.obligations.find((item) =>
          ['initial_dp', 'initial_full'].includes(item.purpose),
        );
        if (!obligation || obligation.status === 'proof_pending')
          throw new ConflictException('Verifikasi bukti terlebih dahulu.');
        const applications = await tx.paymentApplication.findMany({
          where: {
            paymentObligationId: obligation.id,
            state: { in: ['reserved', 'applied'] },
          },
        });
        if (
          applications.reduce(
            (sum, application) => sum + application.amount,
            0n,
          ) < obligation.amountDue
        )
          throw new ConflictException('Dana awal belum memenuhi kewajiban.');
        if (this.clock.now() > booking.expiresAt)
          throw new ConflictException(
            'Booking sudah melewati batas pembayaran.',
          );
        return {
          bookingId: booking.id,
          decision: await this.approveInitial(
            tx,
            booking,
            context.user.id,
            this.clock.now(),
          ),
        };
      },
    );
  }

  async expireDue(limit = 100) {
    const candidates = await this.prisma.booking.findMany({
      where: {
        status: 'menunggu_pembayaran',
        expiresAt: { lt: this.clock.now() },
      },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { id: true },
    });
    let expired = 0,
      failed = 0;
    for (const candidate of candidates) {
      try {
        expired += await runBusinessTransaction(this.prisma, async (tx) => {
          const booking = await this.lockBooking(tx, candidate.id);
          const now = this.clock.now();
          if (
            booking.status !== 'menunggu_pembayaran' ||
            now <= booking.expiresAt ||
            booking.obligations.some(
              (obligation) => obligation.status === 'proof_pending',
            )
          )
            return 0;
          await this.ledger.closeInitialBooking(
            tx,
            booking,
            'kedaluwarsa',
            now,
            'Batas upload bukti pembayaran telah lewat.',
          );
          return 1;
        });
      } catch {
        failed++;
      }
    }
    return { scanned: candidates.length, expired, failed };
  }

  private async event(
    tx: Prisma.TransactionClient,
    bookingId: string,
    type: string,
    sourceId: string,
    now: Date,
    actorId: string,
  ) {
    await tx.outboxEvent.create({
      data: {
        eventKey: type + ':' + sourceId,
        aggregateType: 'Booking',
        aggregateId: bookingId,
        eventType: type,
        payload: { bookingId, sourceId },
        occurredAt: now,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: type,
        entityType: 'Booking',
        entityId: bookingId,
        changes: { sourceId },
        createdAt: now,
      },
    });
  }
}
