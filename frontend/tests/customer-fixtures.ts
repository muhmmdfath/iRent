import type { Policy, Item, Booking, Financial } from '@/customer/types';
export const policy: Policy = {
  termsVersion: 'irent-phase1-v1',
  values: {
    open_time: '08:00',
    close_time: '22:00',
    min_lead_minutes: 120,
    max_duration_hours: 168,
    booking_open_day: 25,
    dp_amount: '20000',
    hold_minutes: 120,
    urgent_threshold_minutes: 180,
    urgent_hold_minutes: 30,
    confirm_sla_hours: 24,
    urgent_confirm_minutes: 60,
    confirm_before_pickup_minutes: 60,
    cancel_refund_cutoff_days: 2,
    cancel_refund_percent: 50,
    cancel_full_refund_percent: 75,
    late_tolerance_minutes: 60,
    late_fee_per_hour: '10000',
    no_show_minutes: 180,
    extension_min_lead_minutes: 120,
    extension_hold_minutes: 30,
  },
};
export const item: Item = {
  id: 'test-item',
  name: 'iPhone Uji',
  category: 'iphone',
  includes: ['Kabel pengisian'],
  price6h: '60000',
  price12h: '100000',
  price24h: '150000',
  photoPath: '/media/items/test.webp',
};
export const at = (delta: number) =>
  new Date(Date.now() + delta + 7 * 3600000)
    .toISOString()
    .replace('Z', '+07:00');
export const booking: Booking = {
  id: 'test-booking',
  code: 'IRN-TEST',
  status: 'menunggu_pembayaran',
  initialStartAt: at(86400000),
  initialEndAt: at(108000000),
  expiresAt: at(7200000),
  confirmationDueAt: null,
  amountDueNow: '20000',
  initialGrandTotal: '60000',
  initialRentalTotal: '60000',
  deliveryFeeSnapshot: '0',
  deliveryType: 'pickup',
  deliveryZoneNameSnapshot: null,
  deliveryAddress: null,
  payOption: 'dp',
  rulesSnapshot: { rules: { values: policy.values } },
  items: [
    {
      id: 'test-unit-use',
      itemId: item.id,
      itemNameSnapshot: item.name,
      unitCodeSnapshot: 'IPHONE-TEST',
      unitPriceSnapshot: '60000',
      startAt: at(86400000),
      currentEndAt: at(108000000),
      useStatus: 'allocated',
      item: { photoPath: item.photoPath },
    },
  ],
};
export function financial(): Financial {
  return {
    booking: {
      ...booking,
      obligations: [
        {
          id: 'test-obligation',
          extensionId: null,
          purpose: 'initial_dp',
          amountDue: '20000',
          remainingAmount: '20000',
          creditedAmount: '0',
          expiresAt: booking.expiresAt,
          status: 'open',
          pendingProofId: null,
          proofs: [],
        },
      ],
    },
    summary: {
      bill: '60000',
      received: '0',
      refunded: '0',
      netCash: '0',
      applied: '0',
      reserved: '0',
      remaining: '60000',
      refundRequested: '0',
      refundApproved: '0',
      paymentStatus: 'belum_terverifikasi',
    },
    confirmationOverdue: false,
  };
}
export const customerSession = {
  user: {
    id: 'booking-user',
    name: 'Penyewa Lengkap',
    email: 'booking@example.test',
    phone: null,
    role: 'customer',
    profile: { completedAt: at(-86400000) },
  },
  csrfToken: 'fixture-token',
};
