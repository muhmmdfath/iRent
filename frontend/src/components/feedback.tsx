import { Button } from './ui/button';
import { errorMessage } from '@/services/api';
export function LoadingState({ text = 'Memuat sesi...' }: { text?: string }) {
  return (
    <div className="state-page" role="status">
      <span className="loading-mark" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="state-page">
      <h1>Tidak dapat memuat halaman</h1>
      <p role="alert">{errorMessage(error)}</p>
      <Button onClick={retry}>Coba lagi</Button>
    </div>
  );
}
