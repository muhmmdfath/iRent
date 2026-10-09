import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthContext } from '../../auth/auth.service';
import { BusinessClock } from '../../shared/time/business-clock';
import { PaymentLedgerService } from './payment-ledger.service';
import { CorrectReceiptDto } from './payments.dto';
import { PaymentsService } from './payments.service';

@Injectable()
export class ReceiptCorrectionsService {
  constructor(
    private readonly payments: PaymentsService,
    private readonly ledger: PaymentLedgerService,
    private readonly clock: BusinessClock,
  ) {}
  async correct(
    context: AuthContext,
    bookingId: string,
    paymentId: string,
    dto: CorrectReceiptDto,
    key?: string,
  ) {
    const input = this.payments.receiptInput(dto),
      reason = dto.reason.trim();
    if (reason.length < 5)
      throw new BadRequestException('Alasan koreksi wajib lengkap.');
    paymentId = paymentId.toLowerCase();
    return this.payments.action(
      context,
      bookingId,
      key,
      'payment.correct',
      {
        paymentId,
        ...input,
        amount: input.amount.toString(),
        occurredAt: input.occurredAt.toISOString(),
        reason,
      },
      'admin',
      async (tx, booking) => {
        await tx.$queryRaw`SELECT id FROM payments WHERE booking_id=${booking.id}::uuid ORDER BY id FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM refund_requests WHERE booking_id=${booking.id}::uuid ORDER BY id FOR UPDATE`;
        const original = await tx.payment.findFirst({
          where: { id: paymentId, bookingId: booking.id },
        });
        if (!original) throw new NotFoundException('Receipt tidak ditemukan.');
        if (
          original.direction !== 'in' ||
          original.supersededAt ||
          !original.paymentObligationId
        )
          throw new ConflictException(
            'Hanya receipt masuk aktif dengan kewajiban yang dapat dikoreksi.',
          );
        if (
          await tx.refundSource.findFirst({
            where: {
              incomingPaymentId: paymentId,
              refund: { status: { not: 'ditolak' } },
            },
          })
        )
          throw new ConflictException(
            'Receipt terkait refund aktif/selesai. Selesaikan pemeriksaan refund terlebih dahulu; refund selesai tidak dibalik lewat koreksi receipt.',
          );
        const now = this.clock.now(),
          obligation = booking.obligations.find(
            (row) => row.id === original.paymentObligationId,
          )!;
        const oldApplications = await tx.paymentApplication.findMany({
          where: {
            incomingPaymentId: paymentId,
            state: { in: ['applied', 'reserved'] },
          },
        });
        // No money was transferred back: this is a reversal of a mistaken accounting entry.
        await tx.payment.update({
          where: { id: paymentId },
          data: { supersededAt: now },
        });
        await tx.paymentApplication.updateMany({
          where: { incomingPaymentId: paymentId },
          data: { state: 'released' },
        });
        const replacement = await this.payments.receipt(
          tx,
          booking,
          obligation.id,
          input,
          context.user.id,
        );
        const correction = await tx.receiptCorrection.create({
          data: {
            bookingId: booking.id,
            originalPaymentId: paymentId,
            replacementPaymentId: replacement.id,
            reversalAmount: original.amount,
            reversalEffectiveAt: original.occurredAt,
            reason,
            createdAt: now,
          },
        });
        if (oldApplications.length && obligation.status !== 'closed') {
          const others = await tx.paymentApplication.findMany({
            where: {
              paymentObligationId: obligation.id,
              state: { in: ['applied', 'reserved'] },
            },
            include: { refundSources: { include: { refund: true } } },
          });
          const occupied = others.reduce(
            (sum, application) =>
              sum +
              application.amount -
              application.refundSources
                .filter(
                  (source) => source.refund.status === 'sudah_dikembalikan',
                )
                .reduce((total, source) => total + source.amount, 0n),
            0n,
          );
          const capacity =
            obligation.amountDue > occupied
              ? obligation.amountDue - occupied
              : 0n;
          const assigned = input.amount < capacity ? input.amount : capacity;
          const appliedBefore = oldApplications.some(
            (row) => row.state === 'applied',
          );
          if (assigned > 0n)
            await tx.paymentApplication.create({
              data: {
                bookingId: booking.id,
                incomingPaymentId: replacement.id,
                paymentObligationId: obligation.id,
                amount: assigned,
                state: appliedBefore ? 'applied' : 'reserved',
              },
            });
          // Settlements may become fully paid; initial/extension approvals remain explicit business actions.
          const completedSettlement =
            obligation.purpose === 'settlement' &&
            occupied + assigned >= obligation.amountDue;
          if (completedSettlement)
            await tx.paymentApplication.updateMany({
              where: { paymentObligationId: obligation.id, state: 'reserved' },
              data: { state: 'applied' },
            });
          await tx.paymentObligation.update({
            where: { id: obligation.id },
            data: {
              status: obligation.pendingProofId
                ? 'proof_pending'
                : (appliedBefore || completedSettlement) &&
                    occupied + assigned >= obligation.amountDue
                  ? 'satisfied'
                  : 'open',
            },
          });
        }
        await this.ledger.requestUnusedRefund(
          tx,
          replacement,
          'receipt_correction_overpayment',
          now,
        );
        await tx.auditLog.create({
          data: {
            actorId: context.user.id,
            action: 'payment.corrected',
            entityType: 'Payment',
            entityId: paymentId,
            reason,
            changes: {
              correctionId: correction.id,
              replacementPaymentId: replacement.id,
              before: {
                amount: original.amount.toString(),
                occurredAt: original.occurredAt.toISOString(),
                method: original.method,
              },
              after: {
                amount: input.amount.toString(),
                occurredAt: input.occurredAt.toISOString(),
                method: input.method,
              },
            },
            createdAt: now,
          },
        });
        return { bookingId: booking.id, decision: correction.id };
      },
    );
  }
}
