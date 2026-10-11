import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminRead, type Page } from '@/admin/manage/hooks';
import { Pager } from '@/admin/manage/components';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
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
  const [kind, setKind] = useState('all');
  const query = useAdminRead<Page<Task>>(
    'all-tasks',
    '/admin/tasks',
    { kind, page, limit: 20 },
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
  return (
    <section className="form-section">
      <div className="section-heading">
        <h2>Semua pekerjaan</h2>
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
      <p className="muted text-sm">
        Suara hanya saat beranda aktif dan tab terlihat. “Saya tangani”
        membisukan versi tugas ini di tab Anda; keputusan bisnis tetap perlu
        disimpan.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <label className="field">
        Jenis pekerjaan
        <select
          className="select-input"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value);
            setPage(1);
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
      {query.isPending ? (
        <LoadingState text="Memuat pekerjaan..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {query.data.data.map((task) => {
            const key = task.kind + ':' + task.id + ':' + task.version;
            return (
              <article
                className={
                  'management-row ' + (task.overdue ? 'task-overdue' : '')
                }
                key={key}
              >
                <div>
                  <h3>
                    {labels[task.kind] || 'Pemeriksaan booking'} ·{' '}
                    {task.code || 'Unit inventaris'}
                  </h3>
                  {task.dueAt && (
                    <p>
                      {task.overdue ? 'Terlambat · ' : ''}
                      {wib(task.dueAt)}
                    </p>
                  )}
                </div>
                <div className="form-actions">
                  <Link
                    className="text-link"
                    to={
                      task.kind === 'extension_quote'
                        ? `/admin/bookings/${task.bookingId}/extensions/${task.id}`
                        : task.kind === 'preparation'
                          ? '/admin/inventory'
                          : task.kind === 'refund'
                            ? `/admin/bookings/${task.bookingId}#refunds`
                            : `/admin/bookings/${task.bookingId}`
                    }
                  >
                    Tangani pekerjaan
                  </Link>
                  <Button
                    variant="outline"
                    disabled={acknowledged.has(key)}
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
              </article>
            );
          })}
          {!query.data.data.length && (
            <p className="muted">Tidak ada pekerjaan pada filter ini.</p>
          )}
          <Pager
            page={page}
            total={query.data.total}
            setPage={setPage}
            busy={query.isFetching}
          />
        </>
      )}
    </section>
  );
}
