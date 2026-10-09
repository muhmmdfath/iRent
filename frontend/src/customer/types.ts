export interface Profile {
  fullName: string;
  address: string;
  phoneActive: string;
  phoneAlt: string | null;
  instagram: string | null;
  emailContact: string | null;
  completedAt: string | null;
}
export interface ProfileInput {
  fullName: string;
  address: string;
  phoneActive: string;
  nik?: string;
  phoneAlt?: string | null;
  instagram?: string | null;
  emailContact?: string | null;
}
export interface Item {
  id: string;
  category: 'iphone' | 'accessory';
  name: string;
  includes: string[];
  price6h: string;
  price12h: string;
  price24h: string;
  photoPath: string | null;
  stock?: { activeUnitCount: number; readyPhysicalCount: number };
}
export interface Catalog {
  data: Item[];
  total: number;
  page: number;
}
export interface Policy {
  termsVersion: string;
  values: {
    open_time: string;
    close_time: string;
    min_lead_minutes: number;
    max_duration_hours: number;
    booking_open_day: number;
    dp_amount: string;
    hold_minutes: number;
    urgent_threshold_minutes: number;
    urgent_hold_minutes: number;
    confirm_sla_hours: number;
    urgent_confirm_minutes: number;
    confirm_before_pickup_minutes: number;
    cancel_refund_cutoff_days: number;
    cancel_refund_percent: number;
    cancel_full_refund_percent: number;
    late_tolerance_minutes: number;
    late_fee_per_hour: string;
    no_show_minutes: number;
    extension_min_lead_minutes: number;
    extension_hold_minutes: number;
  };
}
export interface Zone {
  id: string;
  name: string;
  fee: string;
}
export interface QuoteInput {
  startAt: string;
  durationHours: number;
  items: { itemId: string; quantity: number }[];
  deliveryType: 'pickup' | 'delivery';
  payOption: 'dp' | 'full';
  deliveryZoneId?: string;
}
export interface BookingInput extends QuoteInput {
  deliveryAddress?: string;
  termsVersion: string;
  agreeTerms: boolean;
  prepareIdentity: boolean;
  understandPayment: boolean;
  agreeOperatingHours: boolean;
}
export interface Quote {
  startAt: string;
  endAt: string;
  durationHours: number;
  rentalTotal: string;
  deliveryFee: string;
  grandTotal: string;
  amountDueNow: string;
  mustPayFull: boolean;
  payOption: 'dp' | 'full';
  lines: {
    itemId: string;
    itemName: string;
    quantity: number;
    subtotal: string;
  }[];
}
export interface Availability {
  checkedAt: string;
  available: boolean;
  reservesStock: false;
  items: {
    itemId: string;
    requestedQuantity: number;
    availableQuantity: number;
  }[];
}
export type BookingStatus =
  | 'menunggu_pembayaran'
  | 'menunggu_konfirmasi'
  | 'dikonfirmasi'
  | 'berjalan'
  | 'selesai'
  | 'kedaluwarsa'
  | 'ditolak'
  | 'dibatalkan';
export interface Proof {
  id: string;
  mime: string;
  size: number;
  claimedAmount: string;
  uploadedAt: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectedReason: string | null;
}
export interface Obligation {
  id: string;
  extensionId: string | null;
  purpose: 'initial_dp' | 'initial_full' | 'settlement' | 'extension';
  amountDue: string;
  remainingAmount?: string;
  creditedAmount?: string;
  expiresAt: string | null;
  status: 'open' | 'proof_pending' | 'satisfied' | 'closed';
  pendingProofId: string | null;
  proofs?: Proof[];
}
export interface BookingItem {
  item?: { photoPath: string | null };
  id: string;
  itemId: string;
  itemNameSnapshot: string;
  unitCodeSnapshot: string;
  unitPriceSnapshot: string;
  startAt: string;
  currentEndAt: string;
  useStatus: string;
}
export interface Booking {
  id: string;
  code: string;
  status: BookingStatus;
  initialStartAt: string;
  initialEndAt: string;
  expiresAt: string;
  confirmationDueAt: string | null;
  amountDueNow: string;
  initialGrandTotal: string;
  initialRentalTotal: string;
  deliveryFeeSnapshot: string;
  deliveryType: 'pickup' | 'delivery';
  deliveryZoneNameSnapshot: string | null;
  deliveryAddress: string | null;
  payOption: 'dp' | 'full';
  items?: BookingItem[];
  obligations?: Obligation[];
  statusLogs?: {
    id: string;
    fromStatus: string | null;
    toStatus: BookingStatus;
    createdAt: string;
    reason: string | null;
  }[];
  rulesSnapshot: { rules?: { values?: Policy['values'] } };
  rejectedReason?: string | null;
  cancelReason?: string | null;
}
export interface Financial {
  booking: Booking & {
    obligations: Obligation[];
    refunds?: {
      id: string;
      status: string;
      requestedAmount: string;
      approvedAmount: string | null;
      transferredAt: string | null;
    }[];
  };
  summary: {
    bill: string;
    received: string;
    refunded: string;
    netCash: string;
    applied: string;
    reserved: string;
    remaining: string;
    refundRequested: string;
    refundApproved: string;
    paymentStatus: string;
  };
  confirmationOverdue: boolean;
}
