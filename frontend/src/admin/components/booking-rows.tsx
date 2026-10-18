import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { ItemPhoto } from '@/customer/components/item-photo';
import { rupiah, statusLabels, wib } from '@/customer/format';
import type { AdminBooking } from '../types';
const labels = {
  menunggu_pembayaran: 'Menunggu bayar',
  menunggu_konfirmasi: 'Perlu verifikasi',
  dikonfirmasi: 'Dikonfirmasi',
  berjalan: 'Sedang disewa',
  selesai: 'Selesai',
  kedaluwarsa: 'Kedaluwarsa',
  ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan',
};
export function AdminBookingRows({ bookings }: { bookings: AdminBooking[] }) {
  return (
    <div className="abw-bookings">
      <div className="abw-table-head" aria-hidden="true">
        <span>Booking / penyewa</span>
        <span>Jadwal pengambilan</span>
        <span>Status booking</span>
        <span>Total awal</span>
        <span />
      </div>
      {bookings.map((booking) => (
        <article
          className="abw-row"
          key={booking.id}
          aria-label={'Booking ' + booking.code}
        >
          <div className="abw-identity">
            <ItemPhoto
              path={booking.items?.[0]?.item?.photoPath || null}
              name={booking.items?.[0]?.itemNameSnapshot || 'Perangkat'}
            />
            <div>
              <h2>{booking.customer?.name || 'Pelanggan'}</h2>
              <p className="abw-code">{booking.code}</p>
              <p
                className="abw-devices"
                title={booking.items
                  ?.map((item) => item.itemNameSnapshot)
                  .join(', ')}
              >
                {booking.items?.[0]?.itemNameSnapshot || 'Perangkat'}
                {(booking.items?.length || 0) > 1
                  ? ` +${booking.items!.length - 1} unit`
                  : ''}
              </p>
            </div>
          </div>
          <div className="abw-schedule">
            <span className="abw-mobile-label">Pengambilan</span>
            <time dateTime={booking.initialStartAt}>
              {wib(booking.initialStartAt)}
            </time>
            <small>
              {booking.deliveryType === 'pickup'
                ? 'Ambil di toko'
                : 'Antar-jemput'}
            </small>
          </div>
          <div>
            <span
              className={'abw-status abw-status-' + booking.status}
              title={statusLabels[booking.status]}
            >
              <i />
              {labels[booking.status]}
            </span>
            {booking.status === 'menunggu_konfirmasi' &&
              booking.confirmationDueAt && (
                <small className="abw-deadline">
                  Batas {wib(booking.confirmationDueAt)}
                </small>
              )}
          </div>
          <div className="abw-amount">
            <span className="abw-mobile-label">Total awal</span>
            <strong>{rupiah(booking.initialGrandTotal)}</strong>
            <small>
              {booking.payOption === 'dp'
                ? 'Pilihan DP'
                : 'Pilihan bayar penuh'}
            </small>
          </div>
          <Button asChild variant="outline" className="abw-open">
            <Link
              to={'/admin/bookings/' + booking.id}
              aria-label="Buka booking"
            >
              <ChevronRightIcon aria-hidden="true" />
              <span className="sr-only">{booking.code}</span>
            </Link>
          </Button>
        </article>
      ))}
    </div>
  );
}
