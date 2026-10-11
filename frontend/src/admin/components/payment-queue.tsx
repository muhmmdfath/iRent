import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { wib } from '@/customer/format';
import { useAdminTasks } from '../hooks';
export function PaymentQueue() {
  const query = useAdminTasks();
  return (
    <section className="admin-payment-queue" aria-labelledby="queue-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Tindakan berikutnya</p>
          <h2 id="queue-title">Periksa bukti pembayaran</h2>
        </div>
        {query.data && (
          <span className="status-badge">
            {query.data.total} bukti menunggu
          </span>
        )}
      </div>
      {query.isPending ? (
        <LoadingState text="Memuat antrean pembayaran..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <p className="muted">
          Tidak ada bukti pembayaran yang menunggu pemeriksaan.
        </p>
      ) : (
        <div>
          {query.data.data.map((task) => (
            <div className="admin-task-row" key={task.id}>
              <div>
                <strong>{task.code}</strong>
                <p
                  className={
                    task.overdue ? 'field-error text-sm' : 'muted text-sm'
                  }
                >
                  {task.dueAt
                    ? `${task.overdue ? 'Melewati batas konfirmasi' : 'Konfirmasi sebelum'} ${wib(task.dueAt)}`
                    : 'Menunggu pemeriksaan uang masuk'}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to={'/admin/bookings/' + task.bookingId}>
                  Periksa pembayaran
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}
      {query.data && query.data.total > 5 && (
        <p className="muted text-sm">
          Menampilkan lima bukti paling mendesak. Buka daftar booking untuk
          melihat lainnya.
        </p>
      )}
    </section>
  );
}
