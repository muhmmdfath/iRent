import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useOnline } from '@/hooks/use-online';
import { errorMessage } from '@/services/api';
import type { Proof } from '@/customer/types';
import { adminApi } from '../api';
export function ProofViewer({ proof }: { proof: Proof }) {
  const online = useOnline();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrl = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );
  async function load(download = false) {
    setBusy(true);
    setError(null);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const blob = await adminApi.download(proof.id, abort.signal);
      if (abort.signal.aborted) return;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      const next = URL.createObjectURL(blob);
      objectUrl.current = next;
      if (download || proof.mime === 'application/pdf') {
        const link = document.createElement('a');
        link.href = next;
        link.download = `bukti-${proof.id}.${proof.mime === 'application/pdf' ? 'pdf' : proof.mime === 'image/png' ? 'png' : 'jpg'}`;
        link.click();
        setUrl(null);
      } else setUrl(next);
    } catch (cause) {
      if (!abort.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="admin-proof-viewer">
      <div className="form-actions">
        <Button
          type="button"
          variant="outline"
          disabled={busy || !online}
          onClick={() => void load()}
        >
          {busy
            ? 'Memuat bukti...'
            : proof.mime === 'application/pdf'
              ? 'Unduh PDF bukti'
              : 'Lihat bukti'}
        </Button>
        {proof.mime !== 'application/pdf' && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy || !online}
            onClick={() => void load(true)}
          >
            Unduh bukti
          </Button>
        )}
        {url && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
              objectUrl.current = null;
              setUrl(null);
            }}
          >
            Tutup preview
          </Button>
        )}
      </div>
      {url && (
        <img
          className="admin-proof-image"
          src={url}
          alt="Bukti pembayaran pelanggan"
        />
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
