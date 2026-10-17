import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarIcon,
  ReaderIcon,
  CubeIcon,
  ClockIcon,
} from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import type { BookingStatus } from '@/customer/types';
export interface Schedule {
  id: string;
  itemNameSnapshot: string;
  unitCodeSnapshot: string;
  startAt: string;
  currentEndAt: string;
  booking: { id: string; code: string };
}
export interface Overview {
  total: number;
  today: number;
  lateUnits: number;
  readyUnits: number;
  counts: { status: BookingStatus; count: number }[];
  pickups: Schedule[];
  returns: Schedule[];
  asOf?: string;
}
export function DashboardMetrics({
  data,
  error = false,
}: {
  data?: Overview;
  error?: boolean;
}) {
  const cards = [
    {
      label: 'Booking hari ini',
      value: data?.today,
      note: 'Jadwal mulai, semua status',
      icon: CalendarIcon,
    },
    {
      label: 'Sedang disewa',
      value: data
        ? data.counts.find((row) => row.status === 'berjalan')?.count || 0
        : undefined,
      note: 'Booking yang sedang berjalan',
      icon: ReaderIcon,
    },
    {
      label: 'Unit siap fisik',
      value: data?.readyUnits,
      note: 'Jadwal tersedia di kalender',
      icon: CubeIcon,
    },
    {
      label: 'Unit terlambat',
      value: data?.lateUnits,
      note: 'Belum selesai dikembalikan',
      icon: ClockIcon,
    },
  ];
  return (
    <section className="ops-metrics" aria-label="Ringkasan operasional">
      {cards.map(({ label, value, note, icon: Icon }) => (
        <article
          className={
            'ops-metric ' +
            (label === 'Unit terlambat' ? 'ops-metric-alert' : '')
          }
          key={label}
        >
          <div className="ops-metric-label">
            <p>{label}</p>
            <span>
              <Icon aria-hidden="true" />
            </span>
          </div>
          {value === undefined && error ? (
            <strong>--</strong>
          ) : value === undefined ? (
            <div className="ops-number-skeleton" aria-label="Memuat angka" />
          ) : (
            <strong>{value.toLocaleString('id-ID')}</strong>
          )}
          <p className="ops-metric-note">{note}</p>
        </article>
      ))}
    </section>
  );
}
export function TodaySchedule({
  data,
  loading,
  error,
  onRetry,
}: {
  data?: Overview;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const [mode, setMode] = useState<'pickup' | 'return'>('pickup');
  const rows = mode === 'pickup' ? data?.pickups || [] : data?.returns || [];
  const [expanded, setExpanded] = useState(false);
  const count = mode === 'pickup' ? data?.pickups.length : data?.returns.length;
  const switchTab = (next: 'pickup' | 'return') => {
    setMode(next);
    setExpanded(false);
  };
  return (
    <section
      className="ops-panel ops-schedule"
      aria-labelledby="ops-schedule-title"
    >
      <header className="ops-panel-header">
        <div>
          <p className="ops-eyebrow">Agenda toko</p>
          <h2 id="ops-schedule-title">Jadwal hari ini</h2>
        </div>
        <span className="ops-soft-label">WIB</span>
      </header>
      <div
        className="ops-schedule-tabs"
        role="tablist"
        aria-label="Jenis jadwal"
      >
        {(['pickup', 'return'] as const).map((tab) => (
          <button
            key={tab}
            id={'ops-tab-' + tab}
            type="button"
            role="tab"
            aria-selected={mode === tab}
            aria-controls="ops-schedule-content"
            tabIndex={mode === tab ? 0 : -1}
            onClick={() => switchTab(tab)}
            onKeyDown={(event) => {
              if (
                ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 'pickup'
                    : event.key === 'End'
                      ? 'return'
                      : mode === 'pickup'
                        ? 'return'
                        : 'pickup';
                switchTab(next);
                document.getElementById('ops-tab-' + next)?.focus();
              }
            }}
          >
            {tab === 'pickup' ? 'Pengambilan' : 'Pengembalian'}
            <span>
              {data
                ? tab === 'pickup'
                  ? data.pickups.length
                  : data.returns.length
                : '--'}
            </span>
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="ops-schedule-content"
        aria-labelledby={'ops-tab-' + mode}
        tabIndex={0}
      >
        {loading && !data ? (
          <div className="ops-panel-loading" role="status">
            Memuat jadwal...
          </div>
        ) : error && !data ? (
          <div className="ops-panel-message" role="alert">
            <p>Jadwal belum dapat dimuat.</p>
            <Button variant="outline" onClick={onRetry}>
              Coba lagi
            </Button>
          </div>
        ) : rows.length ? (
          <div className="ops-schedule-list">
            {(expanded ? rows : rows.slice(0, 5)).map((row) => (
              <article key={row.id} className="ops-schedule-row">
                <time
                  dateTime={mode === 'pickup' ? row.startAt : row.currentEndAt}
                >
                  {new Intl.DateTimeFormat('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    hour: '2-digit',
                    minute: '2-digit',
                    hourCycle: 'h23',
                  }).format(
                    new Date(
                      mode === 'pickup' ? row.startAt : row.currentEndAt,
                    ),
                  )}
                </time>
                <div className="ops-schedule-device">
                  <span className="ops-device-icon">
                    <CubeIcon aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{row.itemNameSnapshot}</h3>
                    <p>
                      {row.unitCodeSnapshot} / {row.booking.code}
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline">
                  <Link
                    aria-label={'Lihat booking ' + row.booking.code}
                    to={'/admin/bookings/' + row.booking.id}
                  >
                    Detail
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <div className="ops-schedule-empty">
            <span>
              <CalendarIcon aria-hidden="true" />
            </span>
            <h3>
              Belum ada {mode === 'pickup' ? 'pengambilan' : 'pengembalian'}{' '}
              hari ini
            </h3>
            <p>
              Jadwal yang perlu ditangani hari ini akan muncul di sini. Lihat
              kalender untuk rencana berikutnya.
            </p>
          </div>
        )}
      </div>
      <footer className="ops-panel-footer">
        <span>
          {count === undefined
            ? 'Menunggu data jadwal'
            : `${count} unit terjadwal`}
        </span>
        {rows.length > 5 && (
          <Button variant="ghost" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Ringkas' : 'Tampilkan semua'}
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to="/admin/calendar">Jadwal lengkap</Link>
        </Button>
      </footer>
    </section>
  );
}
const shortStatus: Record<BookingStatus, string> = {
  menunggu_pembayaran: 'Menunggu bayar',
  menunggu_konfirmasi: 'Perlu verifikasi',
  dikonfirmasi: 'Dikonfirmasi',
  berjalan: 'Berjalan',
  selesai: 'Selesai',
  kedaluwarsa: 'Kedaluwarsa',
  ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan',
};
export function BookingBreakdown({ data }: { data?: Overview }) {
  const rows = data?.counts.filter((row) => row.count > 0) || [];
  return (
    <section
      className="ops-panel ops-breakdown"
      aria-labelledby="ops-breakdown-title"
    >
      <header className="ops-panel-header">
        <div>
          <p className="ops-eyebrow">Seluruh riwayat</p>
          <h2 id="ops-breakdown-title">Status booking</h2>
        </div>
        <strong className="ops-total">
          {data?.total.toLocaleString('id-ID') ?? '--'}
          <span>booking</span>
        </strong>
      </header>
      {!data ? (
        <div className="ops-panel-loading" role="status">
          Memuat status...
        </div>
      ) : !rows.length ? (
        <p className="ops-breakdown-empty">Belum ada booking yang tercatat.</p>
      ) : (
        <>
          <div className="ops-distribution" aria-hidden="true">
            {rows.map((row) => (
              <span
                className={'ops-status-' + row.status}
                key={row.status}
                style={{ flexGrow: row.count }}
              />
            ))}
          </div>
          <dl className="ops-status-legend">
            {rows.map((row) => (
              <div key={row.status}>
                <dt>
                  <span className={'ops-status-dot ops-status-' + row.status} />
                  {shortStatus[row.status]}
                </dt>
                <dd>{row.count.toLocaleString('id-ID')}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
