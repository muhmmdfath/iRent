import './recent-booking-cards.css';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ItemPhoto } from './item-photo';
import { rupiah, statusLabels, wib } from '../format';
import type { Booking } from '../types';

export function RecentBookingCards({
  bookings,
  compact = false,
}: {
  bookings: Booking[];
  compact?: boolean;
}) {
  return (
    <div
      className={
        'recent-rental-list' + (compact ? ' recent-rental-list-compact' : '')
      }
    >
      {bookings.map((booking) => {
        const first = booking.items?.[0];
        const extraCount = Math.max(0, (booking.items?.length || 0) - 1);
        const ends = booking.items?.map((item) => item.currentEndAt) || [];
        const end = ends.length
          ? ends.reduce((latest, value) =>
              Date.parse(value) > Date.parse(latest) ? value : latest,
            )
          : booking.initialEndAt;
        const differentEnds = new Set(ends).size > 1;
        const needsPayment = booking.status === 'menunggu_pembayaran';
        return (
          <article
            className="recent-rental-card"
            key={booking.id}
            aria-label={'Booking ' + booking.code}
          >
            <header className="recent-rental-top">
              <span className="recent-rental-code">{booking.code}</span>
              <span
                className={
                  'recent-rental-status recent-rental-status-' + booking.status
                }
              >
                {statusLabels[booking.status]}
              </span>
            </header>
            <div className="recent-rental-body">
              <ItemPhoto
                path={first?.item?.photoPath || null}
                name={first?.itemNameSnapshot || 'Perangkat booking'}
                className="recent-rental-photo"
              />
              <div className="recent-rental-info">
                <h3>{first?.itemNameSnapshot || 'Booking perangkat'}</h3>
                {extraCount > 0 && (
                  <p className="recent-rental-extra">
                    + {extraCount} unit lainnya
                  </p>
                )}
                <dl className="recent-rental-dates">
                  <div>
                    <dt>
                      {booking.deliveryType === 'delivery'
                        ? 'Mulai sewa'
                        : 'Ambil'}
                    </dt>
                    <dd>{wib(booking.initialStartAt)}</dd>
                  </div>
                  <div>
                    <dt>{differentEnds ? 'Kembali terakhir' : 'Kembali'}</dt>
                    <dd>{wib(end)}</dd>
                  </div>
                </dl>
                {differentEnds && (
                  <p className="recent-rental-extra">
                    Jadwal kembali tiap unit tersedia di detail booking.
                  </p>
                )}
              </div>
            </div>
            <footer className="recent-rental-bottom">
              <div>
                <span>Total awal</span>
                <strong>{rupiah(booking.initialGrandTotal)}</strong>
              </div>
              <Button asChild variant={needsPayment ? 'default' : 'outline'}>
                <Link
                  to={
                    '/app/bookings/' +
                    booking.id +
                    (needsPayment ? '/payment' : '')
                  }
                >
                  {needsPayment ? 'Bayar & upload bukti' : 'Lihat booking'}
                </Link>
              </Button>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
