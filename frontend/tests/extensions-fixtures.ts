import type { Extension, ExtensionDetail } from '@/extensions/types';
import { operationBooking, operationFinancial } from './operations-fixtures';
import { at } from './customer-fixtures';
export function extensionFixture(status = 'menunggu_pembayaran') {
  const booking = operationBooking();
  const proposal: Extension = {
    id: 'test-extension',
    bookingId: booking.id,
    status,
    rentalQuoteTotal: '60000',
    amountDue: '75000',
    extraDeliveryQuote: '15000',
    deliveryQuoteNote: 'Penjemputan terpisah',
    quotedAt: at(-60000),
    expiresAt: at(1800000),
    confirmationDueAt: at(3600000),
    approvedAt: null,
    rejectedReason: null,
    cancelReason: null,
    items: [
      {
        id: 'extension-unit',
        bookingItemId: booking.items![0].id,
        oldEndAt: booking.items![0].currentEndAt,
        proposedEndAt: at(11 * 3600000),
        addedHours: 6,
      },
    ],
  };
  const money = operationFinancial(booking);
  money.booking.extensions = [proposal];
  money.booking.obligations = [
    {
      id: 'extension-obligation',
      extensionId: proposal.id,
      purpose: 'extension',
      amountDue: '75000',
      creditedAmount: '20000',
      expiresAt: proposal.expiresAt,
      status: 'open',
      pendingProofId: null,
      proofs: [],
    },
  ];
  const detail: ExtensionDetail = {
    extension: proposal,
    summary: {
      ...money.summary,
      bill: '75000',
      received: '20000',
      reserved: '20000',
      applied: '0',
      remaining: '75000',
      paymentStatus: 'sebagian',
    },
    confirmationOverdue: false,
  };
  return { money, detail, booking };
}
