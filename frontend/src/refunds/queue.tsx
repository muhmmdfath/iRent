import { PAGE_SIZE } from '@/lib/pagination';
import {
  AdminWorkspace,
  AdminHeader,
  AdminBadge,
  AdminHint,
  AdminTabs,
  AdminEmpty,
} from '@/admin/manage/workspace';
import { Pager } from '@/admin/manage/components';
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
          params: { status: status || undefined, page, limit: PAGE_SIZE },
        })
      ).data,
  });
  function filter(value: string) {
    setStatus(value);
    setPage(1);
  }
  return (
    <AdminWorkspace kind="refunds">
      <AdminHeader
        section="Keuangan"
        title="Refund"
        description="Tinjau pengajuan, periksa rekening tujuan, dan catat transfer yang telah berhasil."
      />
      <AdminHint>
        Disetujui belum berarti dana dikembalikan. Kas keluar dicatat setelah
        transfer refund berhasil.
      </AdminHint>
      <AdminTabs
        value={status}
        onChange={filter}
        label="Filter cepat refund"
        options={[
          { value: 'diajukan', label: 'Perlu keputusan' },
          { value: 'disetujui', label: 'Menunggu transfer' },
          { value: 'sudah_dikembalikan', label: 'Sudah dikembalikan' },
          { value: '', label: 'Semua refund' },
        ]}
      />
      <div className="am-queue-filter">
        <label className="field-label">
          Status refund
          <select
            className="select-input"
            value={status}
            onChange={(event) => filter(event.target.value)}
          >
            <option value="">Semua status</option>
            {Object.entries(refundLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {query.data && <p>{query.data.total} pengajuan sesuai filter</p>}
      </div>
      {query.isPending ? (
        <LoadingState text="Memuat refund..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <section className="form-section">
            <header className="am-panel-heading">
              <h2>Pengembalian dana</h2>
              <span>Transfer dicatat manual</span>
            </header>
            {query.data.data.map((row) => (
              <article className="am-queue-row" key={row.id}>
                <div>
                  <h2>{row.booking.customer.name}</h2>
                  <p>{row.booking.code}</p>
                  <small>Diajukan {wib(row.createdAt)}</small>
                </div>
                <div>
                  <AdminBadge
                    tone={
                      row.status === 'sudah_dikembalikan'
                        ? 'green'
                        : row.status === 'disetujui'
                          ? 'amber'
                          : row.status === 'diajukan'
                            ? 'pink'
                            : 'neutral'
                    }
                  >
                    {refundLabels[row.status]}
                  </AdminBadge>
                </div>
                <div className="am-queue-amount">
                  <strong>
                    {rupiah(row.approvedAmount ?? row.requestedAmount)}
                  </strong>
                  <small>
                    {row.approvedAmount !== null
                      ? 'Nominal disetujui'
                      : 'Nominal diajukan'}
                  </small>
                </div>
                <Button variant="outline" asChild>
                  <Link to={`/admin/bookings/${row.bookingId}#refunds`}>
                    Periksa refund
                  </Link>
                </Button>
              </article>
            ))}
            {!query.data.data.length && (
              <AdminEmpty
                title="Belum ada refund dengan status ini."
                description="Pilih status lain untuk melihat pengajuan sebelumnya."
              />
            )}
          </section>
          <Pager
            page={page}
            total={query.data.total}
            setPage={setPage}
            busy={query.isFetching}
          />
        </>
      )}
    </AdminWorkspace>
  );
}
