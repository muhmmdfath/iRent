import { PAGE_SIZE } from '@/lib/pagination';
import {
  ChevronLeftIcon as PaginationPreviousIcon,
  ChevronRightIcon as PaginationNextIcon,
} from '@radix-ui/react-icons';
import { InventoryActionMenu } from './action-menu';
import { useState } from 'react';
import {
  PlusIcon,
  Pencil2Icon,
  ImageIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  ReloadIcon,
  CubeIcon,
  InfoCircledIcon,
} from '@radix-ui/react-icons';
import { InventoryModal } from './inventory-modal';
import './inventory-workspace.css';
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
        className="pagination-chevron"
        aria-label="Sebelumnya"
        title="Sebelumnya"
        variant="outline"
        disabled={disabled || page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <PaginationPreviousIcon aria-hidden="true" />
      </Button>
      <span>
        Halaman {page} · {total} data
      </span>
      <Button
        className="pagination-chevron"
        aria-label="Berikutnya"
        title="Berikutnya"
        variant="outline"
        disabled={disabled || page * PAGE_SIZE >= total}
        onClick={() => onPage(page + 1)}
      >
        <PaginationNextIcon aria-hidden="true" />
      </Button>
    </nav>
  );
}
export function InventoryPage({
  initiallyAdding = false,
}: {
  initiallyAdding?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const online = useOnline();
  const [adding, setAdding] = useState(initiallyAdding);
  const [saving, setSaving] = useState(false);
  const filters: InventoryFilters = {
    page: pageNumber(params.get('page')),
    search: (params.get('search') || '').slice(0, 150),
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
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    next.delete('page');
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  }
  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    update({
      search: String(values.get('search') || '').trim(),
      category: String(values.get('category') || ''),
      isActive: String(values.get('isActive') || ''),
    });
  }
  function closeCreate() {
    if (saving) return;
    setAdding(false);
    if (initiallyAdding)
      navigate(
        '/admin/inventory' + (params.size ? '?' + params.toString() : ''),
        { replace: true },
      );
  }
  const ready = query.data?.data.reduce(
    (sum, item) => sum + (item.stock?.readyPhysicalCount || 0),
    0,
  );
  const activeUnits = query.data?.data.reduce(
    (sum, item) => sum + (item.stock?.activeUnitCount || 0),
    0,
  );
  const filtered = !!(filters.search || filters.category || filters.isActive);
  return (
    <div className="inventory-workspace">
      <header className="inv-heading">
        <div>
          <p className="inv-kicker">Katalog / Manajemen perangkat</p>
          <h1>Inventaris</h1>
          <p>Atur koleksi, tarif sewa, dan kesiapan setiap unit.</p>
        </div>
        <div className="inv-heading-actions">
          <Button
            variant="outline"
            aria-label="Perbarui inventaris"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <ReloadIcon aria-hidden="true" />
          </Button>
          <Button disabled={!online} onClick={() => setAdding(true)}>
            <PlusIcon aria-hidden="true" /> Tambah model
          </Button>
        </div>
      </header>
      <section className="inv-summary" aria-label="Ringkasan inventaris">
        <div>
          <span>
            Model {filtered ? 'sesuai filter' : 'terdaftar'}
            <small>seluruh hasil</small>
          </span>
          <strong>{query.isError ? '-' : (query.data?.total ?? '-')}</strong>
        </div>
        <div>
          <span>
            Unit siap fisik <small>di halaman ini</small>
          </span>
          <strong>{query.isError ? '-' : (ready ?? '-')}</strong>
        </div>
        <div>
          <span>
            Unit aktif & layak <small>di halaman ini</small>
          </span>
          <strong>{query.isError ? '-' : (activeUnits ?? '-')}</strong>
        </div>
        <CubeIcon aria-hidden="true" />
      </section>
      <section className="inv-collection" aria-label="Koleksi perangkat">
        <div className="inv-collection-header">
          <div className="inv-category-tabs" aria-label="Filter cepat kategori">
            {[
              { value: '', label: 'Semua model' },
              { value: 'iphone', label: 'iPhone' },
              { value: 'accessory', label: 'Aksesori' },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                aria-pressed={filters.category === tab.value}
                onClick={() => update({ category: tab.value })}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <form className="inv-toolbar" onSubmit={search} key={params.toString()}>
          <div className="inv-search">
            <label htmlFor="inv-search" className="sr-only">
              Nama model
            </label>
            <MagnifyingGlassIcon aria-hidden="true" />
            <Input
              id="inv-search"
              name="search"
              defaultValue={filters.search}
              maxLength={150}
              placeholder="Cari nama perangkat..."
            />
          </div>
          <Button variant="outline" type="submit">
            Cari
          </Button>
          <label className="sr-only" htmlFor="inv-category">
            Kategori
          </label>
          <select
            id="inv-category"
            name="category"
            defaultValue={filters.category}
          >
            <option value="">Semua kategori</option>
            <option value="iphone">iPhone</option>
            <option value="accessory">Aksesori</option>
          </select>
          <label className="sr-only" htmlFor="inv-active">
            Status katalog
          </label>
          <select
            id="inv-active"
            name="isActive"
            defaultValue={filters.isActive}
          >
            <option value="">Aktif & nonaktif</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
        </form>
        {filtered && (
          <div className="inv-filter-caption">
            <span>
              {query.data && !query.isError
                ? `${query.data.total} model ditemukan`
                : 'Filter diterapkan'}
              {filters.search ? ` untuk "${filters.search}"` : ''}
            </span>
            <button
              type="button"
              onClick={() => update({ search: '', category: '', isActive: '' })}
            >
              Reset filter
            </button>
          </div>
        )}
        {query.isPending ? (
          <div
            className="inv-card-grid inv-skeleton"
            role="status"
            aria-label="Memuat inventaris"
          >
            {[1, 2, 3].map((n) => (
              <div key={n}>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : !query.data.data.length ? (
          <div className="inv-empty">
            <CubeIcon aria-hidden="true" />
            <h2>
              {filtered
                ? 'Tidak ada model yang sesuai'
                : 'Koleksi perangkat masih kosong'}
            </h2>
            <p>
              {filtered
                ? 'Coba kata kunci atau kategori lain.'
                : 'Tambahkan model dan tarif sebelum menyiapkan unit fisik.'}
            </p>
            <Button
              variant="outline"
              onClick={() =>
                filtered
                  ? update({ search: '', category: '', isActive: '' })
                  : setAdding(true)
              }
              disabled={!filtered && !online}
            >
              {filtered ? 'Reset pencarian' : 'Tambah model pertama'}
            </Button>
          </div>
        ) : (
          <>
            <div className="inv-card-grid">
              {query.data.data.map((item) => (
                <article className="inv-product" key={item.id}>
                  <div className="inv-product-image">
                    <ItemPhoto
                      key={item.photoPath}
                      path={item.photoPath}
                      name={item.name}
                    />
                    <span
                      className={
                        'inv-catalog-badge' +
                        (item.isActive ? ' is-active' : '')
                      }
                    >
                      <i />
                      {item.isActive ? 'Katalog aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <div className="inv-product-body">
                    <p className="inv-category">
                      {item.category === 'iphone' ? 'iPhone' : 'Aksesori'}
                    </p>
                    <h2>{item.name}</h2>
                    <div className="inv-main-price">
                      <strong>{rupiah(item.price24h)}</strong>
                      <span>/ 24 jam</span>
                    </div>
                    <div className="inv-other-prices">
                      <span>
                        6 jam <b>{rupiah(item.price6h)}</b>
                      </span>
                      <span>
                        12 jam <b>{rupiah(item.price12h)}</b>
                      </span>
                    </div>
                    <div className="inv-product-footer">
                      <div>
                        <span
                          className={
                            'inv-stock' +
                            ((item.stock?.readyPhysicalCount || 0) > 0
                              ? ' has-stock'
                              : '')
                          }
                        >
                          <i />
                          {item.stock?.readyPhysicalCount || 0} siap fisik
                        </span>
                        <small>
                          {item.stock?.activeUnitCount || 0} unit aktif & layak
                        </small>
                      </div>
                      <Button variant="outline" asChild>
                        <Link
                          aria-label={'Kelola ' + item.name}
                          to={'/admin/inventory/' + item.id}
                        >
                          Kelola
                          <ChevronRightIcon aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <Pagination
              page={filters.page}
              total={query.data.total}
              onPage={(page) => update({ page: String(page) })}
            />
          </>
        )}
      </section>
      <p className="inv-stock-note">
        <InfoCircledIcon aria-hidden="true" /> Stok siap menunjukkan kondisi
        fisik. Ketersediaan pada tanggal sewa diperiksa terpisah.
      </p>
      {adding && (
        <InventoryModal
          title="Tambah model"
          description="Isi informasi dan tarif. Foto dan unit fisik ditambahkan setelah model tersimpan."
          busy={saving}
          onClose={closeCreate}
        >
          <ItemForm
            onBusy={setSaving}
            onCancel={closeCreate}
            onSaved={(item) => navigate('/admin/inventory/' + item.id)}
          />
        </InventoryModal>
      )}
    </div>
  );
}
export function NewInventoryItemPage() {
  return <InventoryPage initiallyAdding />;
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
    [modalBusy, setModalBusy] = useState(false),
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
    <div className="inventory-workspace inv-detail-workspace">
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
          <ReloadIcon aria-hidden="true" /> Perbarui
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
          <div className="inv-model-actions">
            <Button
              variant="outline"
              disabled={!online || busy}
              onClick={() => setAction('edit')}
            >
              <Pencil2Icon aria-hidden="true" /> Edit model
            </Button>
            <InventoryActionMenu
              label="Tindakan model"
              disabled={!online || busy}
            >
              <Button
                variant="ghost"
                disabled={!online || busy}
                onClick={() => setAction('photo')}
              >
                <ImageIcon aria-hidden="true" /> Ganti foto
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
            </InventoryActionMenu>
          </div>
        </section>
        <section className="form-section inventory-unit-section">
          <div className="section-heading">
            <div>
              <h2>Unit fisik</h2>
              <p className="muted text-sm">
                {units.data.total} unit · {PAGE_SIZE} per halaman
              </p>
            </div>
            <Button
              variant="outline"
              disabled={!online || busy}
              onClick={() => setAction('units')}
            >
              <PlusIcon aria-hidden="true" /> Tambah unit
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
        <InventoryModal
          title="Tambah unit"
          description={
            model.name + ' - tambahkan unit fisik yang akan disewakan.'
          }
          busy={modalBusy}
          onClose={() => setAction(null)}
        >
          <AddUnitsForm
            onBusy={setModalBusy}
            item={model}
            onCancel={() => setAction(null)}
            onDone={() => done('Unit baru ditambahkan.')}
          />
        </InventoryModal>
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
    </div>
  );
}
