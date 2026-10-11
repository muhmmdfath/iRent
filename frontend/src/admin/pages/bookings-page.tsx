import { useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { statusLabels } from '@/customer/format';
import type { BookingStatus } from '@/customer/types';
import { AdminBookingRows } from '../components/booking-rows';
import { useAdminBookings } from '../hooks';
import type { BookingFilters } from '../types';
export function AdminBookingsPage() {
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get('status') || '';
  const filters: BookingFilters = {
    customerId: params.get('customerId') || undefined,
    page: Math.max(
      1,
      Math.min(1000000, Math.floor(Number(params.get('page'))) || 1),
    ),
    search: (params.get('search') || '').slice(0, 100),
    status: Object.hasOwn(statusLabels, rawStatus)
      ? (rawStatus as BookingStatus)
      : '',
    sort:
      params.get('sort') === 'oldest'
        ? 'oldest'
        : params.get('sort') === 'deadline'
          ? 'deadline'
          : 'newest',
  };
  const query = useAdminBookings(filters);
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    next.delete('page');
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  }
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Operasional iRent</p>
        <h1>Booking & pembayaran</h1>
        <p>Cari penyewa, periksa jadwal, dan tindak lanjuti pembayaran.</p>
      </header>
      {filters.customerId && (
        <p className="info-note">
          Menampilkan riwayat satu pelanggan.{' '}
          <Button variant="ghost" onClick={() => update({ customerId: '' })}>
            Tampilkan semua pelanggan
          </Button>
        </p>
      )}
      <form
        className="admin-filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          const search = String(
            new FormData(event.currentTarget).get('search') || '',
          ).trim();
          update({ search });
        }}
      >
        <div className="field">
          <label htmlFor="booking-search">Kode booking atau nama penyewa</label>
          <Input
            id="booking-search"
            name="search"
            key={filters.search}
            defaultValue={filters.search}
            maxLength={100}
            placeholder="Cari booking..."
          />
        </div>
        <div className="field">
          <label htmlFor="booking-status">Status booking</label>
          <select
            id="booking-status"
            value={filters.status}
            onChange={(event) => update({ status: event.target.value })}
          >
            <option value="">Semua status</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="booking-sort">Urutan</label>
          <select
            id="booking-sort"
            value={filters.sort}
            onChange={(event) => update({ sort: event.target.value })}
          >
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
            <option value="deadline">Batas pembayaran</option>
          </select>
        </div>
        <Button type="submit">Cari</Button>
      </form>
      {query.isPending ? (
        <LoadingState text="Memuat booking..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {query.data.length ? (
            <AdminBookingRows bookings={query.data} />
          ) : (
            <div className="empty-state">
              <h2>Tidak ada booking ditemukan</h2>
              <p>Coba ubah pencarian atau status booking.</p>
            </div>
          )}
          <div className="pagination">
            <Button
              variant="outline"
              disabled={filters.page === 1}
              onClick={() => update({ page: String(filters.page - 1) })}
            >
              Sebelumnya
            </Button>
            <span>Halaman {filters.page}</span>
            <Button
              variant="outline"
              disabled={query.data.length < 20}
              onClick={() => update({ page: String(filters.page + 1) })}
            >
              Berikutnya
            </Button>
          </div>
        </>
      )}
    </>
  );
}
