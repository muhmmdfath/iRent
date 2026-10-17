import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAdminRead } from '@/admin/manage/hooks';
import { rupiah, wib } from '@/customer/format';
import type { AdminBooking } from '@/admin/types';
import { ItemPhoto } from '@/customer/components/item-photo';
const labels = {
  menunggu_pembayaran: 'Menunggu bayar',
  menunggu_konfirmasi: 'Perlu verifikasi',
  dikonfirmasi: 'Dikonfirmasi',
  berjalan: 'Berjalan',
  selesai: 'Selesai',
  kedaluwarsa: 'Kedaluwarsa',
  ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan',
};
export function RecentBookings() {
  const query = useAdminRead<AdminBooking[]>(
    'recent-bookings',
    '/admin/bookings',
    { page: 1, limit: 5, sort: 'newest' },
    true,
  );
  return (
    <section
      className="ops-panel ops-recent"
      aria-labelledby="ops-recent-title"
    >
      <header className="ops-panel-header">
        <div>
          <p className="ops-eyebrow">Aktivitas rental</p>
          <h2 id="ops-recent-title">Booking terbaru</h2>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/bookings">Semua booking</Link>
        </Button>
      </header>
      {query.isPending ? (
        <div className="ops-panel-loading" role="status">
          Memuat booking terbaru...
        </div>
      ) : query.isError ? (
        <div className="ops-panel-message" role="alert">
          <p>Booking terbaru belum dapat dimuat.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : !query.data.length ? (
        <p className="ops-recent-empty">
          Belum ada booking. Booking baru akan muncul di sini.
        </p>
      ) : (
        <div className="ops-booking-list">
          <div className="ops-booking-table-head" aria-hidden="true">
            <span>Booking & pelanggan</span>
            <span>Jadwal mulai</span>
            <span>Status</span>
            <span>Total awal</span>
            <span />
          </div>
          {query.data.map((booking) => (
            <article className="ops-booking-row" key={booking.id}>
              <div className="ops-booking-person">
                <ItemPhoto
                  path={booking.items?.[0]?.item?.photoPath || null}
                  name={booking.items?.[0]?.itemNameSnapshot || 'Perangkat'}
                />
                <div>
                  <h3>{booking.customer?.name || 'Pelanggan'}</h3>
                  <p>{booking.code}</p>
                </div>
              </div>
              <div className="ops-booking-date">
                <span className="ops-mobile-label">Mulai sewa</span>
                <time dateTime={booking.initialStartAt}>
                  {wib(booking.initialStartAt)}
                </time>
              </div>
              <span className={'ops-booking-badge ops-badge-' + booking.status}>
                {labels[booking.status]}
              </span>
              <div className="ops-booking-amount">
                <span className="ops-mobile-label">Total awal</span>
                <strong>{rupiah(booking.initialGrandTotal)}</strong>
              </div>
              <Button variant="outline" asChild>
                <Link
                  aria-label={'Buka booking ' + booking.code}
                  to={'/admin/bookings/' + booking.id}
                >
                  Detail
                </Link>
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
