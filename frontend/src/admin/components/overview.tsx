import { Link } from 'react-router-dom';
import { useAdminRead } from '@/admin/manage/hooks';
import { LoadingState, ErrorState } from '@/components/feedback';
import { wib } from '@/customer/format';
interface Schedule {
  id: string;
  itemNameSnapshot: string;
  unitCodeSnapshot: string;
  startAt: string;
  currentEndAt: string;
  booking: { id: string; code: string };
}
interface Overview {
  total: number;
  today: number;
  lateUnits: number;
  readyUnits: number;
  counts: { status: string; count: number }[];
  pickups: Schedule[];
  returns: Schedule[];
}
export function AdminOverview() {
  const query = useAdminRead<Overview>('overview', '/admin/overview', {}, true);
  if (query.isPending) return <LoadingState text="Memuat ringkasan..." />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const overview = query.data;
  return (
    <>
      <section
        className="management-metrics"
        aria-label="Ringkasan operasional"
      >
        {[
          ['Booking hari ini', overview.today],
          [
            'Sedang disewa',
            overview.counts.find((row) => row.status === 'berjalan')?.count ||
              0,
          ],
          ['Unit terlambat', overview.lateUnits],
        ].map(([label, count]) => (
          <div key={label}>
            <p className="muted">{label}</p>
            <h2>{count}</h2>
          </div>
        ))}
      </section>
      <p className="muted">
        {overview.total} booking keseluruhan · {overview.readyUnits} unit siap
        fisik · Ketersediaan final mengikuti kalender.
      </p>
      <div className="management-grid">
        {[
          ['Pengambilan hari ini', overview.pickups],
          ['Pengembalian hari ini', overview.returns],
        ].map(([title, rows]) => (
          <section className="form-section" key={String(title)}>
            <h2>{String(title)}</h2>
            {(rows as Schedule[]).map((row) => (
              <article className="management-row" key={row.id}>
                <div>
                  <Link
                    className="text-link"
                    to={'/admin/bookings/' + row.booking.id}
                  >
                    {row.booking.code} · {row.unitCodeSnapshot}
                  </Link>
                  <p>{row.itemNameSnapshot}</p>
                  <p className="muted">
                    {wib(
                      title === 'Pengambilan hari ini'
                        ? row.startAt
                        : row.currentEndAt,
                    )}
                  </p>
                </div>
              </article>
            ))}
            {!(rows as Schedule[]).length && (
              <p className="muted">Belum ada jadwal untuk hari ini.</p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
