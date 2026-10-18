import { dateLabel, shiftDate } from '@/lib/calendar-dates';
import { CalendarFilter } from '@/components/ui/calendar-filter';
import { PAGE_SIZE } from '@/lib/pagination';
import { AdminWorkspace, AdminHeader, AdminHint } from './workspace';
import { CalendarTimeline } from './calendar-timeline';
import { useState } from 'react';
import { useAdminRead, type Page } from './hooks';
import { Pager } from './components';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { useInventory } from '@/admin/inventory/hooks';
export interface CalendarUnit {
  id: string;
  code: string;
  isActive: boolean;
  item: { id: string; name: string; photoPath: string | null };
  physicalStatus: string;
  conditionStatus: string;
  preparationUntil: string | null;
  overdue: boolean;
  allocations: {
    id: string;
    bookingId: string;
    code: string;
    startAt: string;
    endAt: string;
    blockStartAt: string;
    blockEndAt: string;
    kind: string;
    status: string;
  }[];
}
export function CalendarPage() {
  const [filter, setFilter] = useState(() => ({
    start: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10),
    end: new Date(Date.now() + 7 * 86400000 + 7 * 3600000)
      .toISOString()
      .slice(0, 10),
    itemId: '',
  }));
  const [page, setPage] = useState(1);
  const [modelPage, setModelPage] = useState(1);
  const [modelSearch, setModelSearch] = useState('');
  const [activeRange, setActiveRange] = useState(false);
  const [defaultRange] = useState(() => ({
    from: filter.start,
    to: filter.end,
  }));
  const query = useAdminRead<Page<CalendarUnit>>(
    'calendar',
    '/admin/calendar',
    {
      startAt: filter.start + 'T00:00:00+07:00',
      endAt: shiftDate(filter.end, 1) + 'T00:00:00+07:00',
      itemId: filter.itemId || undefined,
      page,
      limit: PAGE_SIZE,
    },
    true,
  );
  const items = useInventory({
    page: modelPage,
    search: modelSearch,
    category: '',
    isActive: '',
  });
  return (
    <AdminWorkspace kind="calendar">
      <AdminHeader
        title="Jadwal per unit"
        description="Lihat alokasi rental dan buffer persiapan di setiap unit dalam satu timeline."
      />
      <AdminHint>
        Siap fisik bukan jaminan tersedia. Timeline menampilkan waktu yang
        diblokir oleh sewa dan persiapan. Rentang mencakup tanggal dari sampai
        tanggal akhir.
      </AdminHint>
      <form
        className="management-filter"
        onSubmit={(event) => {
          event.preventDefault();
          const input = new FormData(event.currentTarget);
          setFilter((previous) => ({
            ...previous,
            itemId: String(input.get('itemId') || ''),
          }));
          setPage(1);
        }}
      >
        <div className="calendar-filter-field">
          <CalendarFilter
            label="Pilih rentang tanggal jadwal"
            value={{ from: filter.start, to: filter.end }}
            maxSpanDays={30}
            active={activeRange}
            description="Pilih maksimal 31 tanggal, termasuk tanggal mulai dan akhir. Semua jadwal menggunakan WIB."
            onChange={(range) => {
              const next = range || defaultRange;
              setFilter((previous) => ({
                ...previous,
                start: next.from,
                end: next.to,
              }));
              setActiveRange(!!range);
              setPage(1);
            }}
          />
          <span className="calendar-filter-caption">
            {dateLabel(filter.start)} - {dateLabel(filter.end)}
          </span>
        </div>
        <label className="field">
          Cari model
          <Input
            maxLength={100}
            value={modelSearch}
            onChange={(event) => {
              setModelSearch(event.target.value);
              setModelPage(1);
            }}
            placeholder="Cari nama perangkat..."
          />
        </label>
        <label className="field">
          Model
          <select name="itemId" className="select-input">
            <option value="">Semua model</option>
            {items.data?.data.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <Button>Tampilkan</Button>
      </form>
      {(modelPage > 1 || (items.data?.total || 0) > PAGE_SIZE) && (
        <div className="form-actions mb-6">
          <Button
            variant="outline"
            disabled={modelPage === 1 || items.isFetching}
            onClick={() => setModelPage(modelPage - 1)}
          >
            Model sebelumnya
          </Button>
          <span className="muted">Kelompok model {modelPage}</span>
          <Button
            variant="outline"
            disabled={
              items.isFetching ||
              !items.data ||
              modelPage * PAGE_SIZE >= items.data.total
            }
            onClick={() => setModelPage(modelPage + 1)}
          >
            Model berikutnya
          </Button>
        </div>
      )}
      {items.isError && (
        <ErrorState error={items.error} retry={() => void items.refetch()} />
      )}
      {query.isPending ? (
        <LoadingState text="Memuat kalender..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <CalendarTimeline
            units={query.data.data}
            start={filter.start}
            end={shiftDate(filter.end, 1)}
          />
          <Pager
            page={page}
            total={query.data.total}
            setPage={setPage}
            busy={query.isFetching}
          />
        </>
      )}
    </AdminWorkspace>
  );
}
