import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminRead } from './hooks';
import { Pager } from './components';
import { Input } from '@/components/ui/input';
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
  const query = useAdminRead<Report>('reports', '/admin/reports', {
    kind,
    period,
    page,
    limit: 20,
  });
  return (
    <>
      <header className="page-heading">
        <h1>Laporan & transaksi berhasil</h1>
        <p>
          Kas berdasarkan uang aktual di waktu transaksi WIB. Refund disetujui
          belum menjadi uang keluar.
        </p>
      </header>
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
            }}
          >
            <option value="day">Harian</option>
            <option value="month">Bulanan</option>
          </select>
        </label>
        <label className="field">
          Periode WIB
          <Input
            type={kind === 'day' ? 'date' : 'month'}
            value={period}
            onChange={(event) => {
              if (event.target.value) {
                setPeriod(event.target.value);
                setPage(1);
              }
            }}
          />
        </label>
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
          <section className="management-metrics" aria-label="Ringkasan kas">
            {[
              ['Uang masuk', query.data.cash.incoming],
              ['Refund ditransfer', query.data.cash.outgoing],
              ['Kas bersih', query.data.cash.net],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="muted">{label}</p>
                <h2>{rupiah(value)}</h2>
              </div>
            ))}
          </section>
          <p className="info-note">
            Refund disetujui belum ditransfer saat ini, semua periode:{' '}
            {rupiah(query.data.pendingRefundsNow)}
          </p>
          <section className="form-section">
            <h2>Mutasi kas</h2>
            {query.data.journal.data.length ? (
              query.data.journal.data.map((row) => (
                <article className="management-row" key={row.id}>
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
                        Pengganti receipt: {row.correctionAsReplacement.reason}
                      </p>
                    )}
                  </div>
                  <strong>
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
              query.data.successfulTransactions.map((row) => (
                <article className="management-row" key={row.id}>
                  <Link className="text-link" to={'/admin/bookings/' + row.id}>
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
          </section>
          <div className="management-grid">
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
              {query.data.popularItems.map((row) => (
                <p key={row.itemId}>
                  {row.name} · {row.quantity} unit
                </p>
              ))}
              {!query.data.popularItems.length && (
                <p className="muted">Belum ada item disewa pada periode ini.</p>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
