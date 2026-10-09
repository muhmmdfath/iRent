import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { BusinessClock } from '../../shared/time/business-clock';
import { parseWibDateTime, formatWibDateTime } from '../../shared/time/wib';
import { Exemption, lateCharge } from '../operations/operations.rules';
import { PaymentLedgerService } from '../payments/payment-ledger.service';
import { LockedBooking, PaymentsService } from '../payments/payments.service';

/** Derive administrator delay from timely proofs and verified bank/cash receipts,
 * including later reconciliation of a proposal closed by a verified return. */
@Injectable()
export class ExtensionDelayService {
  constructor(
    private readonly payments: PaymentsService,
    private readonly ledger: PaymentLedgerService,
    private readonly clock: BusinessClock,
  ) {}
  async exemptions(
    tx: Prisma.TransactionClient,
    booking: LockedBooking,
    itemId: string,
  ): Promise<Exemption[]> {
    const proposals = await tx.extension.findMany({
      where: {
        bookingId: booking.id,
        items: { some: { bookingItemId: itemId } },
        expiresAt: { not: null },
      },
      include: {
        items: true,
        obligations: { include: { proofs: true } },
        payments: true,
      },
    });
    const rules = this.payments.rules(booking).values,
      intervals: Exemption[] = [];
    for (const proposal of proposals) {
      const proofs = proposal.obligations
        .flatMap((row) => row.proofs)
        .filter(
          (row) => proposal.expiresAt && row.uploadedAt <= proposal.expiresAt,
        );
      const receipt = proposal.payments.filter(
        (row) =>
          row.direction === 'in' &&
          row.proofId &&
          proofs.some((proof) => proof.id === row.proofId) &&
          proposal.expiresAt &&
          row.occurredAt <= proposal.expiresAt,
      );
      if (
        proposal.amountDue <= 0n ||
        receipt.reduce((sum, row) => sum + row.amount, 0n) < proposal.amountDue
      )
        continue;
      const paidProofs = proofs.filter((proof) =>
        receipt.some((row) => row.proofId === proof.id),
      );
      if (!paidProofs.length) continue;
      const upload = Math.max(
        ...paidProofs.map((proof) => proof.uploadedAt.getTime()),
      );
      const selected = proposal.items.find(
        (row) => row.bookingItemId === itemId,
      )!;
      const from = new Date(
        Math.min(
          upload + rules.extension_confirm_minutes * 60000,
          selected.oldEndAt.getTime() -
            rules.extension_confirm_before_return_minutes * 60000,
        ),
      );
      const decisions = await tx.auditLog.findMany({
        where: {
          OR: [
            {
              entityId: proposal.id,
              action: { in: ['extension.approved', 'extension.closed'] },
            },
            {
              action: {
                in: [
                  'extension.cancelled_on_return',
                  'extension.cancelled_on_loss',
                ],
              },
              changes: { path: ['extensionId'], equals: proposal.id },
            },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 1,
      });
      const to = decisions[0]?.createdAt ?? this.clock.now();
      if (to > from)
        intervals.push({
          type: 'admin',
          from,
          to,
          reason:
            'Pemeriksaan perpanjangan ' +
            proposal.id +
            ' melewati batas konfirmasi.',
        });
    }
    return intervals;
  }
  async correctReturns(
    tx: Prisma.TransactionClient,
    booking: LockedBooking,
    extensionId: string,
    actor: string,
  ) {
    const selected = await tx.extensionItem.findMany({
      where: { extensionId },
    });
    const rules = this.payments.rules(booking).values;
    for (const selection of selected) {
      const returned = await tx.returnRecord.findUnique({
        where: { bookingItemId: selection.bookingItemId },
      });
      const lost = await tx.lossRecord.findUnique({
        where: { bookingItemId: selection.bookingItemId },
      });
      const record = lost ?? returned;
      const closedAt =
        lost?.lostAt ??
        (returned?.status === 'verified' ? returned.feeReturnAt : null);
      if (!record || !closedAt) continue;
      const prefix = lost ? 'loss' : 'return';
      const audit = await tx.auditLog.findFirst({
        where: {
          entityId: selection.bookingItemId,
          action: prefix + '.verified',
        },
        orderBy: { createdAt: 'desc' },
      });
      const changes = audit?.changes;
      if (
        !changes ||
        typeof changes !== 'object' ||
        Array.isArray(changes) ||
        typeof changes.scheduledEndAt !== 'string'
      )
        continue;
      const original: Exemption[] = [];
      if (Array.isArray(changes.exemptions))
        for (const row of changes.exemptions) {
          if (
            row &&
            typeof row === 'object' &&
            !Array.isArray(row) &&
            (row.type === 'admin' || row.type === 'courier') &&
            typeof row.from === 'string' &&
            typeof row.to === 'string' &&
            typeof row.reason === 'string'
          )
            original.push({
              type: row.type,
              from: parseWibDateTime(row.from),
              to: parseWibDateTime(row.to),
              reason: row.reason,
            });
        }
      const exemptions = [
        ...original,
        ...(await this.exemptions(tx, booking, selection.bookingItemId)),
      ];
      const corrected = lateCharge(
        parseWibDateTime(changes.scheduledEndAt),
        closedAt,
        rules,
        exemptions,
      );
      const charge = await tx.bookingCharge.findUnique({
        where: { sourceKey: prefix + '.late:' + record.id },
        include: { adjustments: true },
      });
      if (!charge) continue;
      const current =
        charge.amount +
        charge.adjustments.reduce(
          (sum, row) =>
            sum + (row.direction === 'debit' ? row.amount : -row.amount),
          0n,
        );
      const credit = current - corrected.fee;
      if (credit <= 0n) continue;
      await tx.bookingCharge.create({
        data: {
          bookingId: booking.id,
          bookingItemId: selection.bookingItemId,
          kind: 'adjustment',
          direction: 'credit',
          amount: credit,
          relatedChargeId: charge.id,
          reason: 'Koreksi denda akibat pemeriksaan perpanjangan terlambat.',
          createdBy: actor,
          effectiveAt: this.clock.now(),
          sourceKey:
            'extension.delay:' + record.id + ':' + corrected.fee.toString(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor,
          action: prefix + '.admin_delay_corrected',
          entityType: 'BookingItem',
          entityId: selection.bookingItemId,
          createdAt: this.clock.now(),
          changes: {
            bookingId: booking.id,
            extensionId,
            [prefix + 'Id']: record.id,
            credit: credit.toString(),
            correctedLateFee: corrected.fee.toString(),
            exemptions: exemptions.map((row) => ({
              ...row,
              from: formatWibDateTime(row.from),
              to: formatWibDateTime(row.to),
            })),
          },
        },
      });
    }
    await this.ledger.requestAppliedExcessRefund(
      tx,
      booking.id,
      'admin_delay_correction',
      this.clock.now(),
      { extensionId },
    );
  }
}
