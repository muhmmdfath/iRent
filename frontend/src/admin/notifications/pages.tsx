import { PAGE_SIZE } from '@/lib/pagination';
import {
  ChevronLeftIcon as PaginationPreviousIcon,
  ChevronRightIcon as PaginationNextIcon,
} from '@radix-ui/react-icons';
import {
  AdminWorkspace,
  AdminHeader,
  AdminBadge,
} from '@/admin/manage/workspace';
import { BellIcon, MobileIcon, DownloadIcon } from '@radix-ui/react-icons';
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
    { page, limit: PAGE_SIZE },
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
    <AdminWorkspace kind="notifications">
      <AdminHeader
        section="Preferensi perangkat"
        title="Notifikasi PWA"
        description="Kelola izin notifikasi perangkat ini dan pantau riwayat pengiriman."
      />
      <div className="am-notification-setup">
        <section className="form-section">
          <div className="am-device-symbol">
            <BellIcon aria-hidden="true" />
          </div>
          <h2>Perangkat ini</h2>
          <AdminBadge tone={active ? 'green' : 'neutral'}>
            {active ? 'Langganan push aktif' : 'Langganan push belum aktif'}
          </AdminBadge>
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
                Pengiriman notifikasi belum tersedia. Pengelola server perlu
                mengaktifkan layanan Web Push.
              </p>
            )
          )}
          <div className="form-actions">
            <Button
              disabled={
                busy ||
                active ||
                permission === 'denied' ||
                permission === 'unsupported' ||
                !online ||
                !client ||
                !configuration.data?.enabled
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
        <aside className="form-section am-pwa-guide">
          <h2>Siapkan perangkat bertugas</h2>
          <ol>
            <li>
              <DownloadIcon aria-hidden="true" />
              <div>
                <h3>Pasang aplikasi</h3>
                <p>
                  Gunakan menu browser untuk menambahkan iRent ke layar utama.
                </p>
              </div>
            </li>
            <li>
              <MobileIcon aria-hidden="true" />
              <div>
                <h3>Buka dari layar utama</h3>
                <p>
                  Pada iPhone, jalankan aplikasi yang sudah dipasang sebelum
                  mengaktifkan push.
                </p>
              </div>
            </li>
            <li>
              <BellIcon aria-hidden="true" />
              <div>
                <h3>Izinkan notifikasi</h3>
                <p>
                  {permission === 'denied'
                    ? 'Izin ditolak. Ubah izin situs dari pengaturan browser sebelum mencoba lagi.'
                    : 'Tekan Aktifkan notifikasi, lalu izinkan permintaan dari browser.'}
                </p>
              </div>
            </li>
          </ol>
          <p className="am-muted-note">
            Riwayat terkirim tidak berarti pekerjaan sudah ditangani. Periksa
            antrean pada beranda admin.
          </p>
        </aside>
      </div>
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
                      <AdminBadge
                        tone={
                          row.status === 'sent'
                            ? 'green'
                            : row.status === 'failed'
                              ? 'red'
                              : 'neutral'
                        }
                      >
                        {deliveryLabels[row.status] || row.status}
                      </AdminBadge>
                      <span className="am-attempt-count">
                        Percobaan {row.attempts}
                      </span>
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
                className="pagination-chevron"
                aria-label="Sebelumnya"
                title="Sebelumnya"
                variant="outline"
                disabled={page === 1 || history.isFetching}
                onClick={() => setPage(page - 1)}
              >
                <PaginationPreviousIcon aria-hidden="true" />
              </Button>
              <span>Halaman {page}</span>
              <Button
                className="pagination-chevron"
                aria-label="Berikutnya"
                title="Berikutnya"
                variant="outline"
                disabled={history.data.length < PAGE_SIZE || history.isFetching}
                onClick={() => setPage(page + 1)}
              >
                <PaginationNextIcon aria-hidden="true" />
              </Button>
            </div>
          </>
        )}
      </section>
    </AdminWorkspace>
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
