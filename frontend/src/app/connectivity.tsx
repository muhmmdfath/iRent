import { useOnline } from '@/hooks/use-online';
export function Connectivity() {
  const online = useOnline();
  return online ? null : (
    <div className="connectivity" role="status">
      Koneksi terputus. Sambungkan internet untuk melanjutkan.
    </div>
  );
}
