import type { Booking, BookingStatus } from '@/customer/types';
export interface HandoverInput {
  pickedUpAt: string;
  conditionNote?: string;
  shopDelayReason?: string;
}
export interface ReturnInput {
  receivedAtStore: string;
  receivedByCourierAt?: string;
  condition: 'layak' | 'maintenance';
  conditionNote: string;
  damageAmount: string;
  damageNote?: string;
  exemptions?: {
    type: 'admin' | 'courier';
    from: string;
    to: string;
    reason: string;
  }[];
}
export interface AdminBooking extends Booking {
  customer?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
}
export interface BookingFilters {
  customerId?: string;
  page: number;
  search: string;
  status: BookingStatus | '';
  sort: 'newest' | 'oldest' | 'deadline';
}
export interface PaymentTask {
  id: string;
  bookingId: string;
  code: string;
  dueAt: string | null;
  overdue: boolean;
}
export interface PaymentTasks {
  data: PaymentTask[];
  total: number;
  asOf: string;
}
export interface ReceiptInput {
  amount: string;
  occurredAt: string;
  method: 'transfer' | 'qris' | 'cash';
  receivingAccountReference?: string;
  transactionReference?: string;
  note: string;
}
