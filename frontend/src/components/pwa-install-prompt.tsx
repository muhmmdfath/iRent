import { useEffect, useState } from 'react';
import { DownloadIcon } from '@radix-ui/react-icons';
import { Button } from './ui/button';
import { ActionDialog } from './action-dialog';
import './pwa-install-prompt.css';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const week = 7 * 24 * 60 * 60 * 1000;
function standalone() {
  return (
    !!window.matchMedia?.('(display-mode: standalone)').matches ||
    !!(navigator as Navigator & { standalone?: boolean }).standalone
  );
}
function dismissed(key: string) {
  try {
    return Number(localStorage.getItem(key)) > Date.now();
  } catch {
    return false;
  }
}
function appleMobile() {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}
export function PwaInstallPrompt({ mode }: { mode: 'admin' | 'customer' }) {
  const admin = mode === 'admin';
  const appName = admin ? 'iRent Admin' : 'iRent Semarang';
  const dismissalKey = `irent.${mode}-pwa-install-dismissed-until`;
  const [installed, setInstalled] = useState(standalone);
  const [postponed, setPostponed] = useState(() => dismissed(dismissalKey));
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );
  const [guideOpen, setGuideOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const ios = appleMobile();
  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      if (!standalone()) {
        setError(false);
        setInstallPrompt(event as InstallPromptEvent);
      }
    };
    const installedApp = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setGuideOpen(false);
    };
    const display = window.matchMedia?.('(display-mode: standalone)');
    const displayChanged = () => setInstalled(standalone());
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installedApp);
    display?.addEventListener?.('change', displayChanged);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installedApp);
      display?.removeEventListener?.('change', displayChanged);
    };
  }, []);
  function postpone() {
    try {
      localStorage.setItem(dismissalKey, String(Date.now() + week));
    } catch {
      /* Dismiss for this visit when storage is unavailable. */
    }
    setPostponed(true);
  }
  async function install() {
    if (!installPrompt) {
      setGuideOpen(true);
      return;
    }
    const event = installPrompt;
    setBusy(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      else postpone();
    } catch {
      setError(true);
    } finally {
      setInstallPrompt(null);
      setBusy(false);
    }
  }
  if (
    !window.isSecureContext ||
    installed ||
    postponed ||
    (!installPrompt && !ios && !error)
  )
    return null;
  return (
    <>
      <section
        className="pwa-install-notice"
        aria-label={'Pasang aplikasi ' + appName}
      >
        <span className="pwa-install-symbol">
          <DownloadIcon aria-hidden="true" />
        </span>
        <div className="pwa-install-copy">
          <h2>Tambahkan iRent ke layar utama</h2>
          <p>
            {admin
              ? 'Buka halaman admin lebih cepat seperti aplikasi.'
              : 'Buka katalog dan pantau booking lebih cepat seperti aplikasi.'}
          </p>
          {error && (
            <p role="alert">
              Pemasangan belum berhasil. Coba melalui menu browser.
            </p>
          )}
        </div>
        <div className="pwa-install-actions">
          <Button
            className="rental-action"
            disabled={busy}
            onClick={() => void install()}
          >
            {busy
              ? 'Membuka...'
              : installPrompt
                ? 'Pasang aplikasi'
                : 'Cara pasang'}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={postpone}>
            Nanti saja
          </Button>
        </div>
      </section>
      {guideOpen && (
        <ActionDialog
          title={'Pasang ' + appName}
          onClose={() => setGuideOpen(false)}
        >
          <ol className="pwa-install-steps">
            {ios ? (
              <>
                <li>
                  Buka halaman {admin ? 'admin' : 'pelanggan'} iRent menggunakan
                  Safari.
                </li>
                <li>
                  Ketuk menu Bagikan, lalu pilih Tambahkan ke Layar Utama.
                </li>
                <li>
                  Aktifkan Buka sebagai Aplikasi jika tersedia, lalu ketuk
                  Tambah.
                </li>
              </>
            ) : (
              <>
                <li>Buka menu browser pada halaman ini.</li>
                <li>
                  Pilih Pasang aplikasi atau Tambahkan ke layar utama jika
                  tersedia.
                </li>
                <li>
                  Konfirmasi pemasangan, lalu buka {appName} dari ikon aplikasi.
                </li>
              </>
            )}
          </ol>
          <p className="pwa-install-footnote">
            {admin
              ? 'Setelah dipasang, izin pemberitahuan diatur melalui halaman Notifikasi PWA.'
              : 'Setelah dipasang, buka iRent melalui ikon di layar utama untuk melihat bookingmu.'}
          </p>
          <Button variant="outline" onClick={() => setGuideOpen(false)}>
            Mengerti
          </Button>
        </ActionDialog>
      )}
    </>
  );
}
