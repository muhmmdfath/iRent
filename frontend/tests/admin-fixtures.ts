import type { Session } from '@/auth/types';
import type { AdminBooking } from '@/admin/types';
import { booking, financial, at } from './customer-fixtures';
export const adminSession: Session = {
  user: {
    id: 'admin-user',
    name: 'Admin Uji',
    role: 'admin',
    email: 'admin@example.test',
    phone: null,
    profile: null,
  },
  csrfToken: 'admin-csrf',
};
export const adminBooking: AdminBooking = {
  ...booking,
  status: 'menunggu_konfirmasi',
  confirmationDueAt: at(3600000),
  customer: {
    id: 'customer-user',
    name: 'Penyewa Uji',
    email: 'penyewa@example.test',
    phone: '+6281234567890',
  },
};
export function pendingFinancial() {
  const result = financial();
  result.booking.status = 'menunggu_konfirmasi';
  result.booking.obligations[0].status = 'proof_pending';
  result.booking.obligations[0].pendingProofId = 'pending-proof';
  result.booking.obligations[0].proofs = [
    {
      id: 'pending-proof',
      mime: 'image/png',
      size: 100,
      claimedAmount: '20000',
      uploadedAt: at(-60000),
      status: 'pending',
      rejectedReason: null,
    },
  ];
  return result;
}
