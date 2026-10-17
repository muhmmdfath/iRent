import { useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState, ErrorState } from '@/components/feedback';
import { ItemPhoto } from '@/customer/components/item-photo';
import { rupiah } from '@/customer/format';
import { useOnline } from '@/hooks/use-online';
import { useInventory, useInventoryDetail } from './hooks';
import { inventoryApi } from './api';
import type { InventoryFilters } from './types';
import { ItemForm } from './item-form';
import { PhotoForm } from './photo-form';
import { InventoryConfirm } from './confirm';
import { AddUnitsForm, UnitRows } from './unit-actions';
function pageNumber(value: string | null) {
  const result = Number(value);
  return Number.isFinite(result)
    ? Math.max(1, Math.min(1000000, Math.floor(result)))
    : 1;
}
function Pagination({
  page,
  total,
  onPage,
  disabled,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
  disabled?: boolean;
}) {
  return (
    <nav
      className="form-actions inventory-pagination"
      aria-label="Halaman inventaris"
    >
      <Button
        variant="outline"
        disabled={disabled || page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Sebelumnya
      </Button>
      <span>
        Halaman {page} · {total} data
      </span>
      <Button
        variant="outline"
        disabled={disabled || page * 20 >= total}
        onClick={() => onPage(page + 1)}
      >
        Berikutnya
      </Button>
    </nav>
  );
}
export function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const filters: InventoryFilters = {
    page: pageNumber(params.get('page')),
    search: params.get('search') || '',
    category:
      params.get('category') === 'iphone'
        ? 'iphone'
        : params.get('category') === 'accessory'
          ? 'accessory'
          : '',
    isActive:
      params.get('isActive') === 'true'
        ? 'true'
        : params.get('isActive') === 'false'
          ? 'false'
          : '',
  };
  const query = useInventory(filters);
  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of ['search', 'category', 'isActive']) {
      const value = String(values.get(key) || '').trim();
      if (value) next.set(key, value);
    }
    setParams(next);
  }
  return (
    <>
      <header className="page-heading admin-detail-heading">
        <div>
          <p className="eyebrow">Katalog & kesiapan fisik</p>
          <h1>Inventaris</h1>
          <p className="muted">
            Kelola model, unit dan persiapan sebelum disewakan.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/inventory/new">Tambah model</Link>
        </Button>
      </header>
      <form
        className="admin-filter inventory-filter"
        onSubmit={search}
        key={params.toString()}
      >
        <label>
          Nama model
          <Input
            name="search"
            defaultValue={filters.search}
            maxLength={150}
            placeholder="Cari model..."
          />
        </label>
        <label>
          Kategori
          <select name="category" defaultValue={filters.category}>
            <option value="">Semua kategori</option>
            <option value="iphone">iPhone</option>
            <option value="accessory">Aksesori</option>
          </select>
        </label>
        <label>
          Status katalog
          <select name="isActive" defaultValue={filters.isActive}>
            <option value="">Aktif & nonaktif</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
        </label>
        <Button type="submit">Cari</Button>
      </form>
      <p className="muted text-sm">
        Stok siap menunjukkan kondisi fisik. Ketersediaan pada tanggal sewa
        diperiksa terpisah.
      </p>
      {query.isPending ? (
        <LoadingState text="Memuat inventaris..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data.data.length && (
            <p className="info-note">Tidak ada model yang sesuai pencarian.</p>
          )}
          <div className="inventory-list">
            {query.data.data.map((item) => (
              <article className="inventory-row" key={item.id}>
                <ItemPhoto
                  key={item.photoPath}
                  path={item.photoPath}
                  name={item.name}
                  className="item-photo-thumb"
                />
                <div>
                  <h2>{item.name}</h2>
                  <p className="muted text-sm">
                    {item.category === 'iphone' ? 'iPhone' : 'Aksesori'} ·
                    Katalog {item.isActive ? 'aktif' : 'nonaktif'}
                  </p>
                </div>
                <div>
                  <strong>
                    {item.stock?.readyPhysicalCount || 0} siap fisik
                  </strong>
                  <p className="muted text-sm">
                    {item.stock?.activeUnitCount || 0} aktif & layak
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="inventory-row-action"
                >
                  <Link to={`/admin/inventory/${item.id}`}>
                    Kelola {item.name}
                  </Link>
                </Button>
              </article>
            ))}
          </div>
          <Pagination
            page={filters.page}
            total={query.data.total}
            onPage={(page) => {
              const next = new URLSearchParams(params);
              next.set('page', String(page));
              setParams(next);
            }}
          />
        </>
      )}
    </>
  );
}
export function NewInventoryItemPage() {
  const navigate = useNavigate();
  return (
    <>
      <Link className="back-link" to="/admin/inventory">
        Inventaris
      </Link>
      <header className="page-heading">
        <p className="eyebrow">Model baru</p>
        <h1>Tambah ke katalog</h1>
        <p className="muted">
          Buat model, lalu tambahkan foto dan unit fisiknya.
        </p>
      </header>
      <ItemForm
        onCancel={() => navigate('/admin/inventory')}
        onSaved={(item) => navigate(`/admin/inventory/${item.id}`)}
      />
    </>
  );
}
export function InventoryDetailPage() {
  const { id = '' } = useParams();
  return <InventoryDetail key={id} id={id} />;
}
function InventoryDetail({ id }: { id: string }) {
  const [params, setParams] = useSearchParams();
  const page = pageNumber(params.get('page'));
  const { item, units } = useInventoryDetail(id, page),
    online = useOnline();
  const [action, setAction] = useState<
      'edit' | 'photo' | 'units' | 'active' | 'remove-photo' | null
    >(null),
    [unitBusy, setUnitBusy] = useState(false),
    [message, setMessage] = useState('');
  function done(text: string) {
    setAction(null);
    setMessage(text);
  }
  if (item.isPending || units.isPending)
    return <LoadingState text="Memuat model dan unit..." />;
  if (item.isError)
    return <ErrorState error={item.error} retry={() => void item.refetch()} />;
  if (units.isError)
    return (
      <ErrorState error={units.error} retry={() => void units.refetch()} />
    );
  const model = item.data,
    busy = !!action || unitBusy;
  return (
    <>
      <Link className="back-link" to="/admin/inventory">
        Inventaris
      </Link>
      <header className="page-heading admin-detail-heading">
        <div>
          <p className="eyebrow">
            {model.category === 'iphone' ? 'iPhone' : 'Aksesori'} · Katalog{' '}
            {model.isActive ? 'aktif' : 'nonaktif'}
          </p>
          <h1>{model.name}</h1>
        </div>
        <Button
          variant="outline"
          disabled={!online || busy || item.isFetching || units.isFetching}
          onClick={() => {
            void item.refetch();
            void units.refetch();
          }}
        >
          Perbarui inventaris
        </Button>
      </header>
      {message && (
        <p role="status" className="success-note">
          {message}
        </p>
      )}
      <div className="inventory-detail-grid">
        <section className="form-section inventory-model">
          <ItemPhoto
            key={model.photoPath}
            path={model.photoPath}
            name={model.name}
            className="inventory-cover"
          />
          <h2>Model & tarif</h2>
          <dl className="price-breakdown">
            {(['6', '12', '24'] as const).map((hours) => (
              <div key={hours}>
                <dt>{hours} jam</dt>
                <dd>{rupiah(model[`price${hours}h`])}</dd>
              </div>
            ))}
          </dl>
          <p>Isi paket: {model.includes.join(', ') || 'Tidak ada tambahan.'}</p>
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={!online || busy}
              onClick={() => setAction('edit')}
            >
              Edit model
            </Button>
            <Button
              variant="outline"
              disabled={!online || busy}
              onClick={() => setAction('photo')}
            >
              Ganti foto
            </Button>
            {model.photoPath && (
              <Button
                variant="ghost"
                disabled={!online || busy}
                onClick={() => setAction('remove-photo')}
              >
                Lepas foto
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={!online || busy}
              onClick={() => setAction('active')}
            >
              {model.isActive ? 'Nonaktifkan katalog' : 'Aktifkan katalog'}
            </Button>
          </div>
        </section>
        <section className="form-section inventory-unit-section">
          <div className="section-heading">
            <div>
              <h2>Unit fisik</h2>
              <p className="muted text-sm">
                {units.data.total} unit · 20 per halaman
              </p>
            </div>
            <Button
              variant="outline"
              disabled={!online || busy}
              onClick={() => setAction('units')}
            >
              Tambah unit
            </Button>
          </div>
          <p className="muted text-sm">
            Selesai perawatan memulai persiapan satu jam. Unit siap tetap
            mengikuti kalender booking.
          </p>
          {!units.data.data.length && (
            <p className="info-note">
              Belum ada unit. Tambahkan unit fisik untuk model ini.
            </p>
          )}
          <UnitRows
            key={page}
            units={units.data.data}
            busy={!!action}
            onBusy={setUnitBusy}
            onDone={(text) => setMessage(text)}
          />
          <Pagination
            page={page}
            total={units.data.total}
            disabled={busy}
            onPage={(value) => {
              const next = new URLSearchParams(params);
              next.set('page', String(value));
              setParams(next);
            }}
          />
        </section>
      </div>
      {action === 'edit' && (
        <ItemForm
          item={model}
          onCancel={() => setAction(null)}
          onSaved={() =>
            done('Model diperbarui. Snapshot transaksi lama tetap tersimpan.')
          }
        />
      )}
      {action === 'photo' && (
        <PhotoForm
          id={id}
          onCancel={() => setAction(null)}
          onDone={() => done('Foto model diperbarui.')}
        />
      )}
      {action === 'units' && (
        <AddUnitsForm
          item={model}
          onCancel={() => setAction(null)}
          onDone={() => done('Unit baru ditambahkan.')}
        />
      )}
      {(action === 'active' || action === 'remove-photo') && (
        <InventoryConfirm
          save={() =>
            inventoryApi.update(
              id,
              action === 'active'
                ? { isActive: !model.isActive }
                : { photoPath: null },
            )
          }
          onSaved={() =>
            done(
              action === 'active'
                ? 'Status katalog diperbarui.'
                : 'Foto dilepas dari katalog.',
            )
          }
          onCancel={() => setAction(null)}
        >
          <h2>
            {action === 'active'
              ? model.isActive
                ? 'Nonaktifkan katalog'
                : 'Aktifkan katalog'
              : 'Lepas foto'}{' '}
            · {model.name}
          </h2>
          <p>
            {action === 'active'
              ? 'Perubahan ini mengatur tampilan model di katalog. Unit dan riwayat booking tetap tersimpan.'
              : 'Foto tidak lagi ditampilkan pada model ini. File lama tetap dipertahankan untuk referensi transaksi.'}
          </p>
        </InventoryConfirm>
      )}
    </>
  );
}
