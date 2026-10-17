import { Link, useSearchParams } from 'react-router-dom';
import { ReaderIcon, PlusIcon, ResetIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/feedback';
import { useBookings } from '../hooks';
import { RecentBookingCards } from '../components/recent-booking-cards';
import './bookings-page.css';
const filters = [
  ['', 'Semua'],
  ['menunggu_pembayaran', 'Perlu dibayar'],
  ['menunggu_konfirmasi', 'Verifikasi'],
  ['dikonfirmasi', 'Dikonfirmasi'],
  ['berjalan', 'Sedang disewa'],
  ['selesai', 'Selesai'],
  ['dibatalkan', 'Dibatalkan'],
  ['kedaluwarsa', 'Kedaluwarsa'],
  ['ditolak', 'Ditolak'],
];
export function BookingsPage() {
  const [params, setParams] = useSearchParams();
  const status = filters.some(([value]) => value === params.get('status'))
    ? params.get('status') || ''
    : '';
  const page = Math.max(
    1,
    Math.min(1000000, Math.floor(Number(params.get('page'))) || 1),
  );
  const query = useBookings(page, status || undefined);
  const select = (status: string) => {
    const next = new URLSearchParams();
    if (status) next.set('status', status);
    setParams(next);
  };
  const go = (nextPage: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(nextPage));
    setParams(next);
  };
  return (
    <div className="customer-bookings-page">
      <header className="my-bookings-heading">
        <div>
          <p className="eyebrow">Riwayat & jadwal</p>
          <h1>Booking saya</h1>
          <p>Kelola jadwal sewa dan ikuti perkembangan booking kamu.</p>
        </div>
        <Button asChild>
          <Link to="/catalog">
            <PlusIcon aria-hidden="true" />
            Sewa perangkat
          </Link>
        </Button>
      </header>
      <nav className="my-bookings-filters" aria-label="Filter status booking">
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => select(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="my-bookings-list-heading">
        <p>
          {status
            ? filters.find(([value]) => value === status)?.[1]
            : 'Semua booking'}
        </p>
        <span>
          Terbaru lebih dulu <span aria-hidden="true">/</span> Jadwal WIB
        </span>
      </div>
      {query.isPending ? (
        <div
          className="my-bookings-loading"
          role="status"
          aria-label="Memuat booking"
        >
          <div />
          <div />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.length ? (
        <>
          <RecentBookingCards bookings={query.data} />
          <div className="my-bookings-pagination">
            <span>{query.data.length} booking pada halaman ini</span>
            <div>
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => go(page - 1)}
              >
                Sebelumnya
              </Button>
              <span aria-label={'Halaman ' + page}>{page}</span>
              <Button
                variant="outline"
                disabled={query.data.length < 20}
                onClick={() => go(page + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </>
      ) : (
        <section className="my-bookings-empty">
          <span className="my-bookings-empty-icon">
            <ReaderIcon aria-hidden="true" />
          </span>
          <h2>
            {status
              ? 'Belum ada booking pada status ini'
              : page === 1
                ? 'Belum ada booking'
                : 'Tidak ada booking lagi'}
          </h2>
          <p>
            {status
              ? 'Coba status lain untuk menemukan booking kamu.'
              : 'Pilih perangkat dan tentukan jadwal untuk mulai sewa.'}
          </p>
          {status ? (
            <Button variant="outline" onClick={() => select('')}>
              <ResetIcon aria-hidden="true" />
              Lihat semua booking
            </Button>
          ) : page > 1 ? (
            <Button variant="outline" onClick={() => go(page - 1)}>
              Halaman sebelumnya
            </Button>
          ) : (
            <Button asChild>
              <Link to="/catalog">Cari perangkat</Link>
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
