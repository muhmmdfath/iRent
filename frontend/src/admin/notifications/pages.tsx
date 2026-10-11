import { useEffect, useState } from 'react';
import { useSession } from '@/auth/session';
import { useAdminRead } from '@/admin/manage/hooks';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { useOnline } from '@/hooks/use-online';
import { api, errorMessage } from '@/services/api';
import { wib } from '@/customer/format';
import { loadPushClient, disableCurrentPush, type PushClient } from './push';
interface Delivery {
  id: string;
  eventType: string;
  channel: string;
  sourceId: string;
  dueAt: string | null;
  status: string;
  attempts: number;
  retryAt: string | null;
  error: string | null;
}
export function NotificationsPage() {
  const session = useSession().data;
  const online = useOnline();
  const configuration = useAdminRead<{ enabled: boolean; publicKey: string }>(
    'push-configuration',
    '/admin/notifications/configuration',
  );
  const [page, setPage] = useState(1);
  const history = useAdminRead<Delivery[]>(
    'notification-history',
    '/admin/notifications',
    { page, limit: 20 },
    true,
  );
  const [client, setClient] = useState<PushClient | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [permission, setPermission] = useState<string>(() =>
    'Notification' in window ? Notification.permission : 'unsupported',
  );
  useEffect(() => {
    let disposed = false;
    void loadPushClient()
      .then((value) => {
        if (!disposed) setClient(value);
      })
      .catch((cause) => {
        if (!disposed) setError(errorMessage(cause));
      });
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker
        .getRegistration('/admin/')
        .then((registration) => registration?.pushManager.getSubscription())
        .then((subscription) => {
          if (!disposed) setActive(!!subscription);
        })
        .catch(() => {});
    return () => {
      disposed = true;
    };
  }, []);
  async function enable() {
    if (!client || !session || !configuration.data) return;
    setBusy(true);
    setError(null);
    try {
      const promise = client.enableAdminPush({
        apiBase: String(api.defaults.baseURL || '/api').replace(
          /\/api\/?$/,
          '',
        ),
        csrfToken: session.csrfToken,
        publicKey: configuration.data.publicKey,
      });
      await promise;
      setActive(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
      setPermission(
        'Notification' in window ? Notification.permission : 'unsupported',
      );
    }
  }
  async function disable() {
    setBusy(true);
    setError(null);
    try {
      await disableCurrentPush();
      setActive(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-heading">
        <h1>Notifikasi PWA</h1>
        <p>
          Aktifkan pada perangkat yang dipakai bertugas. Riwayat pengiriman
          terpisah dari pekerjaan yang perlu ditangani.
        </p>
      </header>
      <section className="form-section">
        <h2>Perangkat ini</h2>
        <p>{active ? 'Langganan push aktif' : 'Langganan push belum aktif'}</p>
        <p className="muted">
          Izin:{' '}
          {permission === 'granted'
            ? 'Diizinkan'
            : permission === 'denied'
              ? 'Ditolak'
              : permission === 'unsupported'
                ? 'Belum didukung'
                : 'Belum diminta'}
        </p>
        {configuration.isPending ? (
          <LoadingState text="Memuat konfigurasi push..." />
        ) : configuration.isError ? (
          <ErrorState
            error={configuration.error}
            retry={() => void configuration.refetch()}
          />
        ) : (
          !configuration.data.enabled && (
            <p className="info-note">
              Web Push belum diaktifkan di server. Konfigurasi VAPID diperlukan
              untuk mengirim notifikasi nyata.
            </p>
          )
        )}
        <div className="form-actions">
          <Button
            disabled={
              busy || !online || !client || !configuration.data?.enabled
            }
            onClick={() => void enable()}
          >
            {busy ? 'Memproses...' : 'Aktifkan notifikasi'}
          </Button>
          <Button
            variant="outline"
            disabled={busy || !online || !active}
            onClick={() => void disable()}
          >
            Nonaktifkan notifikasi
          </Button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="muted text-sm">
          Install dari menu browser. Pada iPhone, buka aplikasi dari layar
          utama. Push dapat terlambat dan tidak menjamin bunyi pada layar
          terkunci atau mode senyap. Suara dashboard diaktifkan terpisah dari
          beranda admin.
        </p>
      </section>
      <section className="form-section">
        <h2>Riwayat pengiriman</h2>
        {history.isPending ? (
          <LoadingState text="Memuat riwayat..." />
        ) : history.isError ? (
          <ErrorState
            error={history.error}
            retry={() => void history.refetch()}
          />
        ) : (
          <>
            {history.data.length ? (
              history.data.map((row) => (
                <article className="management-row" key={row.id}>
                  <div>
                    <h3>
                      {eventLabels[row.eventType] ||
                        'Pemberitahuan operasional'}
                    </h3>
                    <p>
                      {deliveryLabels[row.status] || row.status} · Percobaan{' '}
                      {row.attempts}
                    </p>
                    {row.dueAt && (
                      <p className="muted">Tenggat {wib(row.dueAt)}</p>
                    )}
                    {row.retryAt && (
                      <p className="muted">Coba ulang {wib(row.retryAt)}</p>
                    )}
                    {row.error && <p className="form-error">{row.error}</p>}
                  </div>
                </article>
              ))
            ) : (
              <p className="muted">
                Belum ada riwayat pengiriman untuk akun ini.
              </p>
            )}
            <div className="form-actions">
              <Button
                variant="outline"
                disabled={page === 1 || history.isFetching}
                onClick={() => setPage(page - 1)}
              >
                Sebelumnya
              </Button>
              <span>Halaman {page}</span>
              <Button
                variant="outline"
                disabled={history.data.length < 20 || history.isFetching}
                onClick={() => setPage(page + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
const eventLabels: Record<string, string> = {
  'payment_proof.uploaded': 'Bukti pembayaran baru',
  'extension_proof.uploaded': 'Bukti perpanjangan baru',
  'extension.quote_requested': 'Quotation ongkir diperlukan',
  'return.reported': 'Laporan pengembalian',
  'booking.unit_at_risk': 'Booking berisiko',
  'booking.confirmation_reminder': 'Pengingat konfirmasi booking',
  'booking.confirmation_overdue': 'Konfirmasi booking terlambat',
  'extension.confirmation_reminder': 'Pengingat perpanjangan',
  'extension.confirmation_overdue': 'Konfirmasi perpanjangan terlambat',
  'booking.pickup_urgent': 'Pengambilan mendekat',
};
const deliveryLabels: Record<string, string> = {
  pending: 'Menunggu pengiriman',
  processing: 'Sedang diproses',
  sent: 'Terkirim',
  failed: 'Gagal',
  skipped: 'Tidak lagi relevan',
};
