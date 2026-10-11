import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/services/api';
import { useOnline } from '@/hooks/use-online';
import { Button } from './ui/button';
export function DownloadButton({
  path,
  filename,
  label,
  params = {},
}: {
  path: string;
  filename: string;
  label: string;
  params?: Record<string, string>;
}) {
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  async function download() {
    setBusy(true);
    setError(null);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const { data } = await api.get<Blob>(path, {
        params,
        responseType: 'blob',
        signal: abort.signal,
      });
      if (abort.signal.aborted) return;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url.current;
      link.download = filename;
      link.click();
    } catch (cause) {
      if (!abort.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        disabled={busy || !online}
        onClick={() => void download()}
      >
        {busy ? 'Mengunduh...' : label}
      </Button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
