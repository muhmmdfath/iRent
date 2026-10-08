import { Injectable } from '@nestjs/common';
import { Booking, Payment, Prisma } from '../../generated/prisma/client';

@Injectable()
export class PaymentLedgerService {
  async summary(tx: Prisma.TransactionClient, bookingId: string) {
    const charges = await tx.bookingCharge.findMany({
      where: { bookingId, extensionId: null },
    });
    const receipts = await tx.payment.findMany({
      where: { bookingId, extensionId: null },
    });
    const applications = await tx.paymentApplication.findMany({
      where: { bookingId, obligation: { extensionId: null } },
      include: { refundSources: { include: { refund: true } } },
    });
    const refunds = await tx.refundRequest.findMany({
      where: { bookingId, extensionId: null },
    });
    const bill = charges.reduce(
      (total, charge) =>
        total + (charge.direction === 'debit' ? charge.amount : -charge.amount),
      0n,
    );
    const received = receipts
      .filter((receipt) => receipt.direction === 'in')
      .reduce((total, receipt) => total + receipt.amount, 0n);
    const refunded = receipts
      .filter((receipt) => receipt.direction === 'out')
      .reduce((total, receipt) => total + receipt.amount, 0n);
    let applied = 0n,
      reserved = 0n;
    for (const application of applications) {
      const returned = application.refundSources
        .filter((source) => source.refund.status === 'sudah_dikembalikan')
        .reduce((total, source) => total + source.amount, 0n);
      if (application.state === 'applied')
        applied += application.amount - returned;
      if (application.state === 'reserved')
        reserved += application.amount - returned;
    }
    return {
      bill,
      received,
      refunded,
      netCash: received - refunded,
      applied,
      reserved,
      remaining: bill > applied ? bill - applied : 0n,
      unapplied: received - refunded - applied - reserved,
      refundRequested: refunds
        .filter((refund) => refund.status === 'diajukan')
        .reduce((total, refund) => total + refund.requestedAmount, 0n),
      refundApproved: refunds
        .filter((refund) => refund.status === 'disetujui')
        .reduce((total, refund) => total + refund.approvedAmount!, 0n),
    };
  }

  async requestUnusedRefund(
    tx: Prisma.TransactionClient,
    receipt: Payment,
    reason: string,
    now: Date,
  ) {
    const allocations = await tx.paymentApplication.findMany({
      where: {
        incomingPaymentId: receipt.id,
        state: { in: ['reserved', 'applied'] },
      },
    });
    const existing = await tx.refundSource.findMany({
      where: {
        incomingPaymentId: receipt.id,
        refund: { status: { not: 'ditolak' } },
      },
      include: { refund: true },
    });
    const grossHeld = allocations.reduce(
      (sum, allocation) => sum + allocation.amount,
      0n,
    );
    const completedLinked = existing
      .filter(
        (source) =>
          source.refund.status === 'sudah_dikembalikan' &&
          allocations.some(
            (allocation) => allocation.id === source.paymentApplicationId,
          ),
      )
      .reduce((sum, source) => sum + source.amount, 0n);
    const requested = existing
      .filter(
        (source) =>
          source.paymentApplicationId === null ||
          source.refund.status === 'sudah_dikembalikan' ||
          !allocations.some(
            (allocation) => allocation.id === source.paymentApplicationId,
          ),
      )
      .reduce((sum, source) => sum + source.amount, 0n);
    const available =
      receipt.amount - (grossHeld - completedLinked) - requested;
    if (available <= 0n) return;
    const refund = await tx.refundRequest.create({
      data: {
        bookingId: receipt.bookingId,
        reasonCode: reason,
        requestedAmount: available,
        policySnapshot: {
          schemaVersion: 1,
          reason,
          receiptId: receipt.id,
          eligible: available.toString(),
          percent: 100,
        },
        recipientDetails: {},
        createdAt: now,
      },
    });
    await tx.refundSource.create({
      data: {
        refundRequestId: refund.id,
        bookingId: receipt.bookingId,
        incomingPaymentId: receipt.id,
        amount: available,
      },
    });
    await tx.outboxEvent.create({
      data: {
        eventKey: 'refund.requested:' + refund.id,
        aggregateType: 'RefundRequest',
        aggregateId: refund.id,
        eventType: 'refund.requested',
        payload: { refundId: refund.id, bookingId: receipt.bookingId },
        occurredAt: now,
      },
    });
  }

  async closeInitialBooking(
    tx: Prisma.TransactionClient,
    booking: Booking,
    status: 'kedaluwarsa' | 'ditolak',
    now: Date,
    reason: string,
    actorId?: string,
  ) {
    if (['kedaluwarsa', 'ditolak', 'dibatalkan'].includes(booking.status))
      return;
    const charges = await tx.bookingCharge.findMany({
      where: { bookingId: booking.id, extensionId: null, direction: 'debit' },
      include: { adjustments: true },
    });
    for (const charge of charges) {
      const credited = charge.adjustments
        .filter((adjustment) => adjustment.direction === 'credit')
        .reduce((sum, adjustment) => sum + adjustment.amount, 0n);
      if (charge.amount > credited)
        await tx.bookingCharge.create({
          data: {
            bookingId: booking.id,
            bookingItemId: charge.bookingItemId,
            kind: 'adjustment',
            direction: 'credit',
            amount: charge.amount - credited,
            relatedChargeId: charge.id,
            effectiveAt: now,
            reason,
            createdBy: actorId,
            sourceKey: 'initial.close:' + charge.id,
          },
        });
    }
    await tx.paymentObligation.updateMany({
      where: { bookingId: booking.id, extensionId: null },
      data: { status: 'closed', pendingProofId: null },
    });
    await tx.paymentApplication.updateMany({
      where: { bookingId: booking.id, obligation: { extensionId: null } },
      data: { state: 'released' },
    });
    await tx.unitAllocation.updateMany({
      where: { bookingItem: { bookingId: booking.id }, state: 'active' },
      data: { state: 'released', releasedAt: now, releasedReason: reason },
    });
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status,
        ...(status === 'ditolak' ? { rejectedReason: reason } : {}),
      },
    });
    await tx.bookingStatusLog.create({
      data: {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: status,
        actorId,
        note: reason,
        createdAt: now,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'booking.' + status,
        entityType: 'Booking',
        entityId: booking.id,
        changes: { from: booking.status, to: status },
        reason,
        createdAt: now,
      },
    });
    const receipts = await tx.payment.findMany({
      where: { bookingId: booking.id, extensionId: null, direction: 'in' },
    });
    for (const receipt of receipts)
      await this.requestUnusedRefund(
        tx,
        receipt,
        'failed_initial_payment',
        now,
      );
    await tx.outboxEvent.create({
      data: {
        eventKey: 'booking.' + status + ':' + booking.id,
        aggregateType: 'Booking',
        aggregateId: booking.id,
        eventType: 'booking.' + status,
        payload: { bookingId: booking.id },
        occurredAt: now,
      },
    });
  }
}
