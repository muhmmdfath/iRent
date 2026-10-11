import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminRead, type Page } from './hooks';
import { Pager } from './components';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { wib } from '@/customer/format';
import { ItemPhoto } from '@/customer/components/item-photo';
import { useInventory } from '@/admin/inventory/hooks';
interface CalendarUnit {
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
const physical: Record<string, string> = {
  ready: 'Siap fisik',
  in_use: 'Sedang disewa',
  awaiting_check: 'Menunggu pemeriksaan',
  preparing: 'Persiapan',
  maintenance: 'Perawatan',
  in_transit: 'Dalam perjalanan',
  lost: 'Hilang',
};
export function CalendarPage() {
  const [filter, setFilter] = useState(() => ({
    start: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10),
    end: new Date(Date.now() + 8 * 86400000 + 7 * 3600000)
      .toISOString()
      .slice(0, 10),
    itemId: '',
  }));
  const [page, setPage] = useState(1);
  const [modelPage, setModelPage] = useState(1);
  const [modelSearch, setModelSearch] = useState('');
  const [error, setError] = useState('');
  const query = useAdminRead<Page<CalendarUnit>>(
    'calendar',
    '/admin/calendar',
    {
      startAt: filter.start + 'T00:00:00+07:00',
      endAt: filter.end + 'T00:00:00+07:00',
      itemId: filter.itemId || undefined,
      page,
      limit: 20,
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
    <>
      <header className="page-heading">
        <h1>Jadwal per unit</h1>
        <p>
          Rentang kalender mencakup waktu sewa dan buffer persiapan. Siap fisik
          tetap perlu kalender yang tersedia.
        </p>
      </header>
      <form
        className="management-filter"
        onSubmit={(event) => {
          event.preventDefault();
          const input = new FormData(event.currentTarget);
          const start = String(input.get('start'));
          const end = String(input.get('end'));
          const span =
            (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
          if (span <= 0 || span > 31) {
            setError('Pilih rentang positif maksimal 31 hari.');
            return;
          }
          setError('');
          setFilter({ start, end, itemId: String(input.get('itemId') || '') });
          setPage(1);
        }}
      >
        <label className="field">
          Dari tanggal (WIB)
          <Input
            type="date"
            name="start"
            defaultValue={filter.start}
            required
          />
        </label>
        <label className="field">
          Sampai sebelum tanggal (WIB)
          <Input type="date" name="end" defaultValue={filter.end} required />
        </label>
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
            modelPage * 20 >= items.data.total
          }
          onClick={() => setModelPage(modelPage + 1)}
        >
          Model berikutnya
        </Button>
      </div>
      {items.isError && (
        <ErrorState error={items.error} retry={() => void items.refetch()} />
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {query.isPending ? (
        <LoadingState text="Memuat kalender..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <section className="form-section">
            {query.data.data.map((unit) => (
              <article className="calendar-unit" key={unit.id}>
                <header className="management-row">
                  <div className="calendar-model">
                    <ItemPhoto
                      path={unit.item.photoPath}
                      name={unit.item.name}
                      className="item-photo-thumb"
                    />
                    <div>
                      <h2>{unit.code}</h2>
                      <p>{unit.item.name}</p>
                      <p className={unit.overdue ? 'form-error' : 'muted'}>
                        {physical[unit.physicalStatus] || unit.physicalStatus}
                        {unit.overdue ? ' · Pengembalian terlambat' : ''}
                        {!unit.isActive ? ' · Nonaktif' : ''}
                      </p>
                      {unit.preparationUntil && (
                        <p className="muted text-sm">
                          Persiapan hingga {wib(unit.preparationUntil)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link
                    className="text-link"
                    to={'/admin/inventory/' + unit.item.id}
                  >
                    Kelola unit
                  </Link>
                </header>
                {unit.allocations.length ? (
                  unit.allocations.map((allocation) => (
                    <div className="calendar-allocation" key={allocation.id}>
                      <Link
                        className="text-link"
                        to={'/admin/bookings/' + allocation.bookingId}
                      >
                        {allocation.code}
                      </Link>
                      <p>Ambil {wib(allocation.startAt)}</p>
                      <p>Kembali {wib(allocation.endAt)}</p>
                      <p className="muted text-sm">
                        Blok persiapan sampai {wib(allocation.blockEndAt)} ·{' '}
                        {allocation.kind === 'extension_hold'
                          ? 'Hold perpanjangan'
                          : 'Alokasi booking'}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="muted">Tidak ada alokasi pada rentang ini.</p>
                )}
              </article>
            ))}
            {!query.data.data.length && (
              <p className="muted">Belum ada unit untuk filter ini.</p>
            )}
          </section>
          <Pager
            page={page}
            total={query.data.total}
            setPage={setPage}
            busy={query.isFetching}
          />
        </>
      )}
    </>
  );
}
