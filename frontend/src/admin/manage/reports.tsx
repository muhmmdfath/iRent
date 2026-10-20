import { dateLabel, shiftDate } from '@/lib/calendar-dates';
import { CalendarFilter } from '@/components/ui/calendar-filter';
import { DisclosureSummary } from '@/components/ui/disclosure-summary';
import { PAGE_SIZE } from '@/lib/pagination';
import { AdminWorkspace, AdminHeader, AdminHint } from './workspace';
import {
  ArrowBottomLeftIcon,
  ArrowTopRightIcon,
  CardStackIcon,
} from '@radix-ui/react-icons';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminRead } from './hooks';
import { Pager } from './components';
import { DownloadButton } from '@/components/download-button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { rupiah, wib, statusLabels } from '@/customer/format';
interface Report {
  cash: { incoming: string; outgoing: string; net: string };
  pendingRefundsNow: string;
  bookingCounts: { status: string; count: number }[];
  popularItems: { itemId: string; name: string; quantity: number }[];
  successfulTransactions: {
    id: string;
    code: string;
    bill: string;
    applied: string;
    lossClosed: boolean;
  }[];
  journal: {
    total: number;
    data: {
      id: string;
      direction: string;
      type: string;
      method: string;
      amount: string;
      occurredAt: string;
      recordedAt: string;
      note: string;
      booking: { id: string; code: string };
      recordedActor: { name: string } | null;
      supersededAt: string | null;
      correctionAsOriginal: {
        reason: string;
        replacementPaymentId: string;
        reversalAmount: string;
      } | null;
      correctionAsReplacement: {
        reason: string;
        originalPaymentId: string;
      } | null;
    }[];
  };
}
export function ReportsPage() {
  const [today] = useState(() =>
    new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10),
  );
  const [kind, setKind] = useState('day');
  const [period, setPeriod] = useState(today);
  const [page, setPage] = useState(1);
  const [successPage, setSuccessPage] = useState(1);
  const query = useAdminRead<Report>('reports', '/admin/reports', {
    kind,
    period,
    page,
    limit: PAGE_SIZE,
  });
  return (
    <AdminWorkspace kind="reports">
      <AdminHeader
        section="Keuangan"
        title="Laporan & transaksi berhasil"
        description="Pantau kas aktual, pengembalian dana, dan hasil penyewaan per periode WIB."
      />
      <div className="management-filter">
        <label className="field">
          Jenis laporan
          <select
            className="select-input"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setPeriod(
                event.target.value === 'month' ? period.slice(0, 7) : today,
              );
              setPage(1);
              setSuccessPage(1);
            }}
          >
            <option value="day">Harian</option>
            <option value="month">Bulanan</option>
          </select>
        </label>
        <div className="calendar-filter-field">
          <CalendarFilter
            key={kind}
            label="Pilih periode laporan"
            title={
              kind === 'day' ? 'Pilih tanggal laporan' : 'Pilih bulan laporan'
            }
            mode={kind === 'day' ? 'single' : 'month'}
            allowClear={false}
            value={{
              from: kind === 'day' ? period : period + '-01',
              to:
                kind === 'day'
                  ? period
                  : shiftDate(
                      new Date(
                        Date.UTC(
                          Number(period.slice(0, 4)),
                          Number(period.slice(5, 7)),
                          1,
                        ),
                      )
                        .toISOString()
                        .slice(0, 10),
                      -1,
                    ),
            }}
            onChange={(range) => {
              if (range) {
                setPeriod(kind === 'day' ? range.from : range.from.slice(0, 7));
                setPage(1);
                setSuccessPage(1);
              }
            }}
          />
          <span className="calendar-filter-caption">
            {kind === 'day'
              ? dateLabel(period)
              : new Intl.DateTimeFormat('id-ID', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                }).format(new Date(period + '-01T00:00:00Z'))}
          </span>
        </div>
        <DownloadButton
          path="/admin/reports/excel"
          params={{ kind, period }}
          filename={`irent-${kind}-${period}.xlsx`}
          label="Unduh Excel"
        />
      </div>
      {query.isPending ? (
        <LoadingState text="Memuat laporan..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <section
            className="management-metrics am-cash-metrics"
            aria-label="Ringkasan kas"
          >
            {[
              ['Uang masuk', query.data.cash.incoming],
              ['Refund ditransfer', query.data.cash.outgoing],
              ['Kas bersih', query.data.cash.net],
            ].map(([label, value], index) => (
              <div key={label}>
                <span className="am-metric-icon">
                  {index === 0 ? (
                    <ArrowBottomLeftIcon aria-hidden="true" />
                  ) : index === 1 ? (
                    <ArrowTopRightIcon aria-hidden="true" />
                  ) : (
                    <CardStackIcon aria-hidden="true" />
                  )}
                </span>
                <p className="muted">{label}</p>
                <h2>{rupiah(value)}</h2>
              </div>
            ))}
          </section>
          <AdminHint>
            Refund disetujui belum ditransfer saat ini, semua periode:{' '}
            <strong>{rupiah(query.data.pendingRefundsNow)}</strong>. Kas
            mengikuti uang aktual pada waktu transaksi.
          </AdminHint>
          <div className="management-grid am-report-insights">
            <section className="form-section">
              <h2>Status booking</h2>
              <dl className="price-breakdown">
                {query.data.bookingCounts.map((row) => (
                  <div key={row.status}>
                    <dt>
                      {statusLabels[row.status as keyof typeof statusLabels] ||
                        row.status}
                    </dt>
                    <dd>{row.count}</dd>
                  </div>
                ))}
              </dl>
              {!query.data.bookingCounts.length && (
                <p className="muted">
                  Belum ada booking dibuat dalam periode ini.
                </p>
              )}
            </section>
            <section className="form-section">
              <h2>Item populer</h2>
              {query.data.popularItems.map((row, index) => (
                <div className="am-popular-row" key={row.itemId}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{row.name}</h3>
                    <meter
                      min={0}
                      max={Math.max(
                        ...query.data.popularItems.map((item) => item.quantity),
                        1,
                      )}
                      value={row.quantity}
                    >
                      {row.quantity}
                    </meter>
                  </div>
                  <strong>{row.quantity} unit</strong>
                </div>
              ))}
              {!query.data.popularItems.length && (
                <p className="muted">Belum ada item disewa pada periode ini.</p>
              )}
            </section>
          </div>
          <section className="form-section">
            <h2>Mutasi kas</h2>
            {query.data.journal.data.length ? (
              query.data.journal.data.map((row) => (
                <article className="management-row am-journal-row" key={row.id}>
                  <div>
                    <Link
                      className="text-link"
                      to={'/admin/bookings/' + row.booking.id}
                    >
                      {row.booking.code}
                    </Link>
                    <p>
                      {wib(row.occurredAt)} ·{' '}
                      {row.method === 'cash'
                        ? 'Tunai'
                        : row.method === 'qris'
                          ? 'QRIS'
                          : 'Transfer'}
                    </p>
                    <details className="am-journal-details">
                      <DisclosureSummary>
                        Catatan & jejak transaksi
                      </DisclosureSummary>
                      <p className="muted">
                        Dicatat {wib(row.recordedAt)} oleh{' '}
                        {row.recordedActor?.name || 'Sistem'}
                      </p>
                      <p>{row.note}</p>
                      {row.supersededAt && (
                        <p className="info-note">
                          Receipt diganti; dampak kas efektif nol. Alasan:{' '}
                          {row.correctionAsOriginal?.reason}
                        </p>
                      )}
                      {row.correctionAsReplacement && (
                        <p className="muted">
                          Pengganti receipt:{' '}
                          {row.correctionAsReplacement.reason}
                        </p>
                      )}
                    </details>
                  </div>
                  <strong
                    className={
                      row.supersededAt
                        ? 'am-money-superseded'
                        : row.direction === 'out'
                          ? 'am-money-out'
                          : 'am-money-in'
                    }
                  >
                    {row.direction === 'out' ? '−' : '+'}
                    {rupiah(row.amount)}
                  </strong>
                </article>
              ))
            ) : (
              <p className="muted">Belum ada mutasi pada periode ini.</p>
            )}
            <Pager
              page={page}
              total={query.data.journal.total}
              setPage={setPage}
              busy={query.isFetching}
            />
          </section>
          <section className="form-section">
            <h2>Selesai dan lunas</h2>
            {query.data.successfulTransactions.length ? (
              query.data.successfulTransactions
                .slice((successPage - 1) * PAGE_SIZE, successPage * PAGE_SIZE)
                .map((row) => (
                  <article className="management-row" key={row.id}>
                    <Link
                      className="text-link"
                      to={'/admin/bookings/' + row.id}
                    >
                      {row.code}
                      {row.lossClosed ? ' · Ada unit hilang' : ''}
                    </Link>
                    <strong>{rupiah(row.bill)}</strong>
                  </article>
                ))
            ) : (
              <p className="muted">
                Belum ada transaksi selesai dan lunas pada periode ini.
              </p>
            )}
            <Pager
              page={successPage}
              total={query.data.successfulTransactions.length}
              setPage={setSuccessPage}
            />
          </section>
        </>
      )}
    </AdminWorkspace>
  );
}
