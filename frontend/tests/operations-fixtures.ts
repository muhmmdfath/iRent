import type { AdminBooking } from '@/admin/types';
import type { Financial } from '@/customer/types';
import { adminBooking } from './admin-fixtures';
import { financial, at } from './customer-fixtures';
export function operationBooking(
  status: 'dikonfirmasi' | 'berjalan' = 'berjalan',
): AdminBooking {
  const start = at(-3600000),
    end = at(5 * 3600000);
  const first = {
    ...adminBooking.items![0],
    startAt: start,
    currentEndAt: end,
    useStatus: status === 'berjalan' ? 'in_use' : 'allocated',
    pickedUpAt: status === 'berjalan' ? start : null,
  };
  return {
    ...adminBooking,
    status,
    initialStartAt: start,
    initialEndAt: end,
    items: [
      first,
      {
        ...first,
        id: 'second-booking-item',
        itemId: 'accessory',
        itemNameSnapshot: 'Tripod Uji',
        unitCodeSnapshot: 'TRIPOD-TEST',
      },
    ],
  };
}
export function operationFinancial(booking: AdminBooking): Financial {
  const money = financial();
  money.booking = { ...booking, obligations: [] };
  money.summary = {
    ...money.summary,
    received: '60000',
    applied: '60000',
    remaining: '0',
    paymentStatus: 'lunas',
  };
  return money;
}
