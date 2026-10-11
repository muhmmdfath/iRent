import type { Financial } from '@/customer/types';
export interface Extension {
  id: string;
  bookingId: string;
  status: string;
  rentalQuoteTotal: string;
  amountDue: string;
  extraDeliveryQuote: string | null;
  deliveryQuoteNote: string | null;
  quotedAt: string | null;
  expiresAt: string | null;
  confirmationDueAt: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  cancelReason: string | null;
  items: {
    id: string;
    bookingItemId: string;
    oldEndAt: string;
    proposedEndAt: string;
    addedHours: number;
  }[];
}
export interface ExtensionDetail {
  extension: Extension;
  summary: Financial['summary'];
  confirmationOverdue: boolean;
}
export const extensionLabels: Record<string, string> = {
  draft_quote: 'Menunggu persetujuan ongkir',
  menunggu_pembayaran: 'Menunggu pembayaran',
  menunggu_konfirmasi: 'Menunggu verifikasi',
  disetujui: 'Disetujui',
  ditolak: 'Ditolak',
  kedaluwarsa: 'Kedaluwarsa',
  dibatalkan: 'Dibatalkan',
};
export const pendingExtension = (status: string) =>
  ['draft_quote', 'menunggu_pembayaran', 'menunggu_konfirmasi'].includes(
    status,
  );
