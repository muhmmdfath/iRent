import type { Booking } from './types';

// Historical snapshots without the switch keep their original zone tariff.
export function deliveryViaChat(
  booking: Pick<Booking, 'deliveryType' | 'rulesSnapshot'>,
) {
  return (
    booking.deliveryType === 'delivery' &&
    booking.rulesSnapshot?.rules?.values?.delivery_fee_enabled === false
  );
}
