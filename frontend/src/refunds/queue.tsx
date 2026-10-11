import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/auth/session';
import { api } from '@/services/api';
import { LoadingState, ErrorState } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { rupiah, wib } from '@/customer/format';
import { refundLabels, type Refund } from './api';
type Row = Refund & {
  bookingId: string;
  createdAt: string;
  booking: { code: string; customer: { name: string } };
};
export function RefundQueuePage() {
  const user = useSession().data?.user;
  const [status, setStatus] = useState('diajukan');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin', user?.id, 'refunds', status, page],
    enabled: user?.role === 'admin',
    refetchInterval: 30_000,
    queryFn: async ({ signal }) =>
      (
        await api.get<{ data: Row[]; total: number }>('/admin/refunds', {
          signal,
          params: { status: status || undefined, page, limit: 20 },
        })
      ).data,
  });
  return (
    <div className="refund-queue">
      <header className="page-heading">
        <p className="eyebrow">Uang kembali</p>
        <h1>Refund</h1>
        <p>
          Periksa rekening, putuskan pengajuan, lalu catat transfer yang sudah
          berhasil.
        </p>
      </header>
      <label className="field-label">
        Status refund
        <select
          className="select-input"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Semua status</option>
          {Object.entries(refundLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {query.isPending ? (
        <LoadingState text="Memuat refund..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p className="muted">{query.data.total} pengajuan</p>
          <section className="form-section">
            {query.data.data.length ? (
              query.data.data.map((row) => (
                <article className="refund-row" key={row.id}>
                  <div className="section-heading">
                    <h2>{row.booking.code}</h2>
                    <strong>
                      {rupiah(row.approvedAmount ?? row.requestedAmount)}
                    </strong>
                  </div>
                  <p>{row.booking.customer.name}</p>
                  <p className="status-badge">{refundLabels[row.status]}</p>
                  <p className="muted text-sm">Diajukan {wib(row.createdAt)}</p>
                  <Link
                    className="back-link"
                    to={`/admin/bookings/${row.bookingId}#refunds`}
                  >
                    Periksa refund
                  </Link>
                </article>
              ))
            ) : (
              <p className="muted">Belum ada refund dengan status ini.</p>
            )}
          </section>
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={page === 1 || query.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Sebelumnya
            </Button>
            <span>Halaman {page}</span>
            <Button
              variant="outline"
              disabled={page * 20 >= query.data.total || query.isFetching}
              onClick={() => setPage(page + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
