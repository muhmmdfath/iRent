import { PAGE_SIZE } from '@/lib/pagination';
import {
  ChevronLeftIcon as PaginationPreviousIcon,
  ChevronRightIcon as PaginationNextIcon,
} from '@radix-ui/react-icons';
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
    <div className="form-actions am-pager">
      <Button
        className="pagination-chevron"
        aria-label="Sebelumnya"
        title="Sebelumnya"
        variant="outline"
        disabled={busy || page === 1}
        onClick={() => setPage(page - 1)}
      >
        <PaginationPreviousIcon aria-hidden="true" />
      </Button>
      <span>
        Halaman {page} · {total} hasil
      </span>
      <Button
        className="pagination-chevron"
        aria-label="Berikutnya"
        title="Berikutnya"
        variant="outline"
        disabled={busy || page * PAGE_SIZE >= total}
        onClick={() => setPage(page + 1)}
      >
        <PaginationNextIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
