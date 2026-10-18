import { PAGE_SIZE } from '@/lib/pagination';
import {
  AdminWorkspace,
  AdminHeader,
  AdminBadge,
  AdminHint,
  AdminEmpty,
} from './workspace';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminRead, type Page } from './hooks';
import { Pager } from './components';
import { LoadingState, ErrorState } from '@/components/feedback';
import { wib } from '@/customer/format';
interface Risk {
  bookingId: string;
  bookingItemId: string;
  code: string;
  itemName: string;
  unitCode: string;
  startAt: string;
  reasons: string[];
}
const reasons: Record<string, string> = {
  unit_nonaktif: 'Unit nonaktif',
  unit_hilang: 'Unit hilang',
  unit_perawatan: 'Unit dalam perawatan',
  sewa_sebelumnya_terlambat: 'Sewa sebelumnya terlambat',
  persiapan_melewati_jadwal: 'Persiapan melewati jadwal',
  unit_belum_ready_saat_pengambilan: 'Unit belum siap saat pengambilan',
};
export function RisksPage() {
  const [page, setPage] = useState(1);
  const [followUpPage, setFollowUpPage] = useState(1);
  const query = useAdminRead<Page<Risk>>(
    'risks',
    '/admin/bookings/at-risk',
    { page, limit: PAGE_SIZE },
    true,
  );
  const followUp = useAdminRead<
    { id: string; code: string; initialStartAt: string; noShowDueAt: string }[]
  >('delivery-follow-up', '/admin/bookings/delivery-follow-up', {}, true);
  return (
    <AdminWorkspace kind="risks">
      <AdminHeader
        title="Risiko & tindak lanjut"
        description="Prioritaskan unit yang bermasalah dan pengambilan yang perlu penanganan."
      />
      <AdminHint>
        Booking tetap aktif. Periksa unit pengganti atau hubungi pelanggan
        sebelum mengambil keputusan.
      </AdminHint>
      <section className="form-section">
        <h2>Unit berisiko</h2>
        {query.isPending ? (
          <LoadingState text="Memuat risiko..." />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : (
          <>
            {query.data.data.map((row) => (
              <article
                className="management-row am-risk-row"
                key={row.bookingItemId}
              >
                <div>
                  <h3>
                    {row.code} · {row.unitCode}
                  </h3>
                  <p>
                    {row.itemName} · {wib(row.startAt)}
                  </p>
                  <div className="am-reason-tags">
                    {row.reasons.map((reason) => (
                      <AdminBadge key={reason} tone="red">
                        {reasons[reason] || reason}
                      </AdminBadge>
                    ))}
                  </div>
                </div>
                <Link
                  className="text-link"
                  to={'/admin/bookings/' + row.bookingId}
                >
                  Periksa booking
                </Link>
              </article>
            ))}
            {!query.data.data.length && (
              <AdminEmpty
                title="Tidak ada unit berisiko saat ini."
                description="Risiko baru akan muncul jika kesiapan unit mengancam jadwal booking."
              />
            )}
            <Pager page={page} total={query.data.total} setPage={setPage} />
          </>
        )}
      </section>
      <section className="form-section">
        <h2>Delivery perlu pemeriksaan no-show</h2>
        <p className="muted">
          Pastikan bukti kesiapan petugas dan kegagalan pelanggan sebelum worker
          menutup booking.
        </p>
        {followUp.isPending ? (
          <LoadingState text="Memuat tindak lanjut..." />
        ) : followUp.isError ? (
          <ErrorState
            error={followUp.error}
            retry={() => void followUp.refetch()}
          />
        ) : (
          <>
            {followUp.data
              .slice((followUpPage - 1) * PAGE_SIZE, followUpPage * PAGE_SIZE)
              .map((row) => (
                <article className="management-row" key={row.id}>
                  <div>
                    <h3>{row.code}</h3>
                    <p>
                      Ambil {wib(row.initialStartAt)} · Batas no-show{' '}
                      {wib(row.noShowDueAt)}
                    </p>
                  </div>
                  <Link className="text-link" to={'/admin/bookings/' + row.id}>
                    Periksa delivery
                  </Link>
                </article>
              ))}
            <Pager
              page={followUpPage}
              total={followUp.data.length}
              setPage={setFollowUpPage}
            />
            {!followUp.data.length && (
              <p className="muted">
                Tidak ada delivery yang perlu ditindaklanjuti.
              </p>
            )}
          </>
        )}
      </section>
    </AdminWorkspace>
  );
}
