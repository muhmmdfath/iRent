import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ItemPhoto } from '@/customer/components/item-photo';
import { rupiah, statusLabels, wib } from '@/customer/format';
import type { AdminBooking } from '../types';
export function AdminBookingRows({ bookings }: { bookings: AdminBooking[] }) {
  return (
    <div className="admin-booking-list">
      {bookings.map((booking) => (
        <article key={booking.id} className="admin-booking-row">
          <div className="admin-booking-identity">
            <ItemPhoto
              path={booking.items?.[0]?.item?.photoPath || null}
              name={booking.items?.[0]?.itemNameSnapshot || 'Perangkat'}
              className="item-photo-thumb"
            />
            <div>
              <h2>
                <Link to={'/admin/bookings/' + booking.id}>{booking.code}</Link>
              </h2>
              <p>{booking.customer?.name || 'Pelanggan'}</p>
              <p className="muted text-sm">
                {booking.items?.map((item) => item.itemNameSnapshot).join(', ')}
              </p>
            </div>
          </div>
          <div>
            <p className="status-badge">{statusLabels[booking.status]}</p>
            <p className="muted text-sm">Ambil {wib(booking.initialStartAt)}</p>
          </div>
          <div className="admin-booking-total">
            <span className="muted text-sm">Total awal</span>
            <strong>{rupiah(booking.initialGrandTotal)}</strong>
          </div>
          <Button asChild variant="outline">
            <Link to={'/admin/bookings/' + booking.id}>Buka booking</Link>
          </Button>
        </article>
      ))}
    </div>
  );
}
