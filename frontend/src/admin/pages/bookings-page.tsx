import { PAGE_SIZE } from '@/lib/pagination';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  ReloadIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  ClockIcon,
} from '@radix-ui/react-icons';
import './bookings-workspace.css';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/feedback';
import { statusLabels, wib } from '@/customer/format';
import type { BookingStatus } from '@/customer/types';
import { AdminBookingRows } from '../components/booking-rows';
import { useAdminBookings, useAdminTasks } from '../hooks';
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
  const tasks = useAdminTasks();
  const [queueOpen, setQueueOpen] = useState(false);
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    next.delete('page');
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  }
  const tabs = [
    { value: '', label: 'Semua booking' },
    { value: 'menunggu_konfirmasi', label: 'Perlu verifikasi' },
    { value: 'menunggu_pembayaran', label: 'Menunggu bayar' },
    { value: 'dikonfirmasi', label: 'Dikonfirmasi' },
    { value: 'berjalan', label: 'Sedang disewa' },
    { value: 'selesai', label: 'Selesai' },
  ];
  const hasFilters = !!(filters.search || filters.status || filters.customerId);
  return (
    <div className="admin-bookings-workspace">
      <header className="abw-heading">
        <div>
          <p className="abw-kicker">Operasional / Transaksi</p>
          <h1>Booking & pembayaran</h1>
          <p>Kelola penyewaan dan pemeriksaan pembayaran dalam satu tempat.</p>
        </div>
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch();
            void tasks.refetch();
          }}
        >
          <ReloadIcon aria-hidden="true" /> Perbarui
        </Button>
      </header>
      <section className="abw-review-banner" aria-label="Antrean pembayaran">
        <span className="abw-banner-icon">
          <FileTextIcon aria-hidden="true" />
        </span>
        <div>
          <h2>
            {tasks.data
              ? `${tasks.data.total} bukti perlu diperiksa`
              : tasks.isError
                ? 'Antrean belum dapat dimuat'
                : 'Memuat antrean pembayaran...'}
          </h2>
          <p>Pastikan uang masuk sebelum menyetujui bukti pembayaran.</p>
        </div>
        {tasks.isError ? (
          <Button variant="outline" onClick={() => void tasks.refetch()}>
            Coba lagi
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={!tasks.data?.total}
            aria-expanded={queueOpen}
            aria-controls="abw-payment-tasks"
            onClick={() => setQueueOpen(!queueOpen)}
          >
            {queueOpen ? 'Tutup antrean' : 'Lihat antrean'}{' '}
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        )}
      </section>
      {queueOpen && tasks.data && (
        <section
          id="abw-payment-tasks"
          className="abw-task-list"
          aria-label="Bukti paling mendesak"
        >
          {tasks.data.data.map((task) => (
            <Link
              className="admin-inline-link abw-task"
              key={task.id}
              to={'/admin/bookings/' + task.bookingId}
            >
              <FileTextIcon aria-hidden="true" />
              <strong>{task.code}</strong>
              <span>
                {task.dueAt
                  ? `${task.overdue ? 'Lewat batas' : 'Periksa sebelum'} ${wib(task.dueAt)}`
                  : 'Menunggu pemeriksaan'}
              </span>
              <ChevronRightIcon aria-hidden="true" />
            </Link>
          ))}
          {tasks.data.total > tasks.data.data.length && (
            <p>
              Menampilkan {tasks.data.data.length} bukti paling mendesak dari{' '}
              {tasks.data.total}. Antrean diperbarui setelah pemeriksaan.
            </p>
          )}
        </section>
      )}
      <section className="abw-register" aria-label="Daftar booking">
        <div className="abw-tabs" aria-label="Filter cepat status">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.value}
              aria-pressed={filters.status === tab.value}
              onClick={() => update({ status: tab.value })}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <form
          className="abw-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            update({
              search: String(
                new FormData(event.currentTarget).get('search') || '',
              ).trim(),
            });
          }}
        >
          <div className="abw-search">
            <label className="sr-only" htmlFor="booking-search">
              Kode booking atau nama penyewa
            </label>
            <MagnifyingGlassIcon aria-hidden="true" />
            <Input
              id="booking-search"
              name="search"
              key={filters.search}
              defaultValue={filters.search}
              maxLength={100}
              placeholder="Cari kode booking atau penyewa"
            />
          </div>
          <Button type="submit" variant="outline">
            Cari
          </Button>
          <div className="abw-filter-select">
            <label className="sr-only" htmlFor="booking-status">
              Status booking
            </label>
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
          <div className="abw-filter-select">
            <label className="sr-only" htmlFor="booking-sort">
              Urutan
            </label>
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
        </form>
        {hasFilters && (
          <div className="abw-active-filters">
            <span>
              {filters.customerId
                ? 'Riwayat satu pelanggan'
                : filters.search
                  ? `Pencarian: ${filters.search}`
                  : statusLabels[filters.status as BookingStatus]}
            </span>
            <button
              type="button"
              onClick={() => update({ search: '', status: '', customerId: '' })}
            >
              Reset filter
            </button>
          </div>
        )}
        {query.isPending ? (
          <div
            className="abw-skeleton"
            role="status"
            aria-label="Memuat booking"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n}>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : query.data.length ? (
          <AdminBookingRows bookings={query.data} />
        ) : (
          <div className="abw-empty">
            <MagnifyingGlassIcon aria-hidden="true" />
            <h2>Tidak ada booking ditemukan</h2>
            <p>Coba kata kunci lain atau tampilkan semua status.</p>
            {hasFilters && (
              <Button
                variant="outline"
                onClick={() =>
                  update({ search: '', status: '', customerId: '' })
                }
              >
                Reset filter
              </Button>
            )}
          </div>
        )}
        {query.data && !query.isError && (
          <footer className="abw-pagination">
            <span>{query.data.length} booking di halaman ini</span>
            <div>
              <Button
                variant="outline"
                aria-label="Halaman sebelumnya"
                disabled={filters.page === 1}
                onClick={() => update({ page: String(filters.page - 1) })}
              >
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
              <span>Halaman {filters.page}</span>
              <Button
                variant="outline"
                aria-label="Halaman berikutnya"
                disabled={query.data.length < PAGE_SIZE}
                onClick={() => update({ page: String(filters.page + 1) })}
              >
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            </div>
          </footer>
        )}
      </section>
      <p className="abw-footnote">
        <ClockIcon aria-hidden="true" /> Jadwal menggunakan WIB. Data diperbarui
        otomatis setiap 30 detik.{' '}
        <Link className="admin-inline-link" to="/admin/calendar">
          Buka jadwal unit
        </Link>
      </p>
    </div>
  );
}
