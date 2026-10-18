import { PAGE_SIZE } from '@/lib/pagination';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminRead, type Page } from '@/admin/manage/hooks';
import { Pager } from '@/admin/manage/components';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/services/api';
import { wib } from '@/customer/format';
import { loadAlertSound, type AlertSound } from './sound';
interface Task {
  id: string;
  kind: string;
  bookingId: string | null;
  code: string | null;
  dueAt: string | null;
  overdue: boolean;
  version: string;
}
const labels: Record<string, string> = {
  payment: 'Verifikasi pembayaran',
  return: 'Periksa pengembalian',
  extension_quote: 'Quotation perpanjangan',
  refund: 'Proses refund',
  preparation: 'Selesaikan persiapan',
  handover: 'Serah-terima',
};
export function TasksPanel() {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState('all');
  const query = useAdminRead<Page<Task>>(
    'all-tasks',
    '/admin/tasks',
    { kind, page, limit: PAGE_SIZE },
    true,
  );
  const sound = useRef<AlertSound | null>(null);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  useEffect(() => {
    let disposed = false;
    void loadAlertSound()
      .then((module) => {
        if (!disposed) {
          sound.current = module.createAdminAlertSound();
          setReady(true);
        }
      })
      .catch((cause) => {
        if (!disposed) setError(errorMessage(cause));
      });
    return () => {
      disposed = true;
      sound.current?.update([]);
      sound.current?.dispose();
      sound.current = null;
    };
  }, []);
  const tasks = query.data?.data;
  useEffect(() => {
    sound.current?.update(
      query.isError
        ? []
        : (tasks || [])
            .filter(
              (task) =>
                task.dueAt &&
                new Date(task.dueAt).getTime() - Date.now() <= 30 * 60000 &&
                ['payment', 'handover'].includes(task.kind),
            )
            .map((task) => ({
              key: task.kind + ':' + task.id + ':' + task.version,
            })),
    );
  }, [tasks, query.isError, ready]);
  async function enable() {
    setError(null);
    try {
      await sound.current?.enable();
      setEnabled(true);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }
  const actionLabels: Record<string, string> = {
    payment: 'Periksa pembayaran',
    return: 'Periksa barang',
    extension_quote: 'Buat quotation',
    refund: 'Proses refund',
    preparation: 'Buka inventaris',
    handover: 'Serah terima',
  };
  const displayed = expanded
    ? query.data?.data || []
    : (query.data?.data || []).slice(0, 5);
  return (
    <section
      className="ops-panel ops-priorities"
      aria-labelledby="ops-priority-title"
    >
      <header className="ops-panel-header">
        <div>
          <p className="ops-eyebrow">Urut tenggat terdekat</p>
          <h2 id="ops-priority-title">Perlu ditangani</h2>
        </div>
        <span className="ops-soft-label">
          {query.data ? query.data.total + ' pekerjaan' : '--'}
        </span>
      </header>
      <div className="ops-task-toolbar">
        <label>
          Jenis pekerjaan
          <select
            aria-label="Jenis pekerjaan"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setPage(1);
              setExpanded(false);
            }}
          >
            <option value="all">Semua pekerjaan</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          disabled={!ready}
          onClick={() => {
            if (enabled) {
              sound.current?.disable();
              setEnabled(false);
            } else void enable();
          }}
        >
          {enabled ? 'Nonaktifkan suara' : 'Aktifkan suara'}
        </Button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {query.isPending ? (
        <div className="ops-panel-loading" role="status">
          Memuat pekerjaan...
        </div>
      ) : query.isError ? (
        <div className="ops-panel-message" role="alert">
          <p>Pekerjaan belum dapat dimuat.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : (
        <>
          {displayed.map((task) => {
            const key = task.kind + ':' + task.id + ':' + task.version;
            const target =
              task.kind === 'extension_quote'
                ? `/admin/bookings/${task.bookingId}/extensions/${task.id}`
                : task.kind === 'preparation'
                  ? '/admin/inventory'
                  : task.kind === 'refund'
                    ? `/admin/bookings/${task.bookingId}#refunds`
                    : `/admin/bookings/${task.bookingId}`;
            return (
              <article
                className={
                  'ops-task ' + (task.overdue ? 'ops-task-overdue' : '')
                }
                key={key}
              >
                <div className="ops-task-description">
                  <div className="ops-task-title">
                    <h3>{labels[task.kind] || 'Pemeriksaan booking'}</h3>
                    {task.overdue && (
                      <span className="ops-overdue-label">Terlambat</span>
                    )}
                  </div>
                  <p className="ops-task-code">
                    {task.code || 'Unit inventaris'}
                  </p>
                  {task.dueAt && (
                    <p className="ops-task-deadline">
                      {task.overdue ? 'Tenggat: ' : 'Sebelum '}
                      {wib(task.dueAt)}
                    </p>
                  )}
                  <div className="ops-task-actions">
                    <Button variant="outline" asChild>
                      <Link to={target}>
                        {actionLabels[task.kind] || 'Tangani pekerjaan'}
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={acknowledged.has(key)}
                      title="Bisukan pengingat tugas ini di tab ini"
                      onClick={() => {
                        sound.current?.acknowledge(key);
                        setAcknowledged(
                          (previous) => new Set([...previous, key]),
                        );
                      }}
                    >
                      {acknowledged.has(key)
                        ? 'Sudah diakui di tab ini'
                        : 'Saya tangani'}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
          {!query.data.data.length && (
            <div className="ops-task-empty">
              <strong>Tidak ada pekerjaan pada filter ini.</strong>
              <p>Pekerjaan baru akan muncul saat perlu ditangani.</p>
            </div>
          )}
          {query.data.data.length > 5 && (
            <div className="ops-task-more">
              <Button variant="ghost" onClick={() => setExpanded(!expanded)}>
                {expanded
                  ? 'Ringkas daftar'
                  : `Tampilkan ${query.data.data.length - 5} pekerjaan lainnya`}
              </Button>
            </div>
          )}
          {query.data.total > PAGE_SIZE && (
            <Pager
              page={page}
              total={query.data.total}
              setPage={setPage}
              busy={query.isFetching}
            />
          )}
        </>
      )}
      <footer className="ops-task-sound-note">
        <span className={enabled ? 'is-enabled' : ''} aria-hidden="true" />
        <p>
          {enabled ? 'Pengingat suara aktif' : 'Pengingat suara nonaktif'}.
          Suara hanya berbunyi saat beranda ini aktif. "Saya tangani" membisukan
          pengingat, bukan menyelesaikan pekerjaan.
        </p>
      </footer>
    </section>
  );
}
