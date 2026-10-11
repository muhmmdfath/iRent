import { Button } from '@/components/ui/button';
export function Pager({
  page,
  total,
  setPage,
  busy = false,
}: {
  page: number;
  total: number;
  setPage: (page: number) => void;
  busy?: boolean;
}) {
  return (
    <div className="form-actions">
      <Button
        variant="outline"
        disabled={busy || page === 1}
        onClick={() => setPage(page - 1)}
      >
        Sebelumnya
      </Button>
      <span>
        Halaman {page} · {total} hasil
      </span>
      <Button
        variant="outline"
        disabled={busy || page * 20 >= total}
        onClick={() => setPage(page + 1)}
      >
        Berikutnya
      </Button>
    </div>
  );
}
