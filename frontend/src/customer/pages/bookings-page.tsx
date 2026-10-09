import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { useBookings } from '../hooks';
import { wib, statusLabels, rupiah } from '../format';
import { ItemPhoto } from '../components/item-photo';
import type { Booking } from '../types';
export function BookingRows({ bookings }: { bookings: Booking[] }) {
  return (
    <div className="booking-list">
      {bookings.map((booking) => (
        <article className="booking-row" key={booking.id}>
          <ItemPhoto
            path={booking.items?.[0]?.item?.photoPath || null}
            name={booking.items?.[0]?.itemNameSnapshot || 'Perangkat booking'}
            className="item-photo-thumb"
          />
          <div>
            <h2>{booking.items?.[0]?.itemNameSnapshot || booking.code}</h2>
            <p className="muted text-sm">
              {booking.code} - {wib(booking.initialStartAt)}
            </p>
            <p className="status-text">{statusLabels[booking.status]}</p>
          </div>
          <div className="booking-row-action">
            <span>{rupiah(booking.initialGrandTotal)}</span>
            <Button asChild variant="outline">
              <Link
                to={
                  '/app/bookings/' +
                  booking.id +
                  (booking.status === 'menunggu_pembayaran' ? '/payment' : '')
                }
              >
                {booking.status === 'menunggu_pembayaran'
                  ? 'Bayar & upload bukti'
                  : 'Lihat booking'}
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
export function BookingsPage() {
  const [page, setPage] = useState(1);
  const query = useBookings(page);
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Riwayat & jadwal</p>
        <h1>Booking saya</h1>
        <p>Booking terbaru ditampilkan lebih dahulu.</p>
      </header>
      {query.isPending ? (
        <LoadingState text="Memuat booking..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.length ? (
        <>
          <BookingRows bookings={query.data} />
          <div className="pagination">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Sebelumnya
            </Button>
            <span>Halaman {page}</span>
            <Button
              variant="outline"
              disabled={query.data.length < 20}
              onClick={() => setPage(page + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h2>{page === 1 ? 'Belum ada booking' : 'Tidak ada booking lagi'}</h2>
          <p>Pilih perangkat dan jadwal untuk membuat booking.</p>
          <Button asChild>
            <Link to="/catalog">Cari perangkat</Link>
          </Button>
          {page > 1 && (
            <Button variant="outline" onClick={() => setPage(page - 1)}>
              Halaman sebelumnya
            </Button>
          )}
        </div>
      )}
    </>
  );
}
