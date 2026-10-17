import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { CubeIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { customerApi } from '../api';
import { ItemPhoto } from '../components/item-photo';
import { rupiah } from '../format';
export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(
    1,
    Math.min(1000000, Math.floor(Number(params.get('page'))) || 1),
  );
  const search = (params.get('search') || '').slice(0, 150);
  const category =
    params.get('category') === 'iphone' ||
    params.get('category') === 'accessory'
      ? params.get('category')!
      : undefined;
  const setPage = (next: number) => {
    const updated = new URLSearchParams(params);
    updated.set('page', String(next));
    setParams(updated);
  };

  const [duration, setDuration] = useState<6 | 12 | 24>(6);
  const query = useQuery({
    queryKey: ['catalog', page, search, category],
    queryFn: ({ signal }) =>
      customerApi.catalog(page, signal, {
        search: search || undefined,
        category,
      }),
  });
  return (
    <>
      <header className="page-heading catalog-heading">
        <div>
          <p className="catalog-breadcrumb">
            <CubeIcon aria-hidden="true" /> Koleksi iRent <span>/</span>{' '}
            {category === 'iphone'
              ? 'iPhone'
              : category === 'accessory'
                ? 'Aksesori'
                : 'Semua perangkat'}
          </p>
          <h1>
            {search
              ? `Hasil untuk "${search}"`
              : category === 'iphone'
                ? 'Koleksi iPhone'
                : category === 'accessory'
                  ? 'Aksesori pilihan'
                  : 'Katalog perangkat'}
          </h1>
          <p>Perangkat untuk setiap rencana. Pilih yang kamu butuhkan.</p>
        </div>
        <div className="duration-tabs" aria-label="Harga berdasarkan durasi">
          {([6, 12, 24] as const).map((hours) => (
            <button
              key={hours}
              aria-pressed={duration === hours}
              onClick={() => setDuration(hours)}
            >
              {hours} jam
            </button>
          ))}
        </div>
      </header>
      <div className="catalog-controls">
        <div className="catalog-categories" aria-label="Kategori perangkat">
          {[
            ['', 'Semua perangkat'],
            ['iphone', 'iPhone'],
            ['accessory', 'Aksesori'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={(category || '') === value}
              onClick={() => {
                const updated = new URLSearchParams(params);
                updated.delete('page');
                if (value) updated.set('category', value);
                else updated.delete('category');
                setParams(updated);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="catalog-count">
          {query.data ? `${query.data.total} perangkat` : 'Memuat koleksi...'}
        </span>
      </div>
      {query.isPending ? (
        <LoadingState text="Memuat katalog..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.data.length ? (
        <div className="empty-state">
          <h2>
            {search || category
              ? 'Perangkat tidak ditemukan'
              : 'Katalog belum tersedia'}
          </h2>
          <p>
            {search || category
              ? 'Coba kata kunci lain atau tampilkan seluruh perangkat.'
              : 'Periksa kembali nanti untuk melihat perangkat iRent.'}
          </p>
          {(search || category) && (
            <Button variant="outline" onClick={() => setParams({})}>
              Tampilkan semua
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="catalog-grid">
            {query.data.data.map((item) => (
              <article className="catalog-item" key={item.id}>
                <Link
                  className="catalog-image-link"
                  aria-label={'Lihat ' + item.name}
                  to={'/catalog/' + item.id}
                >
                  <ItemPhoto path={item.photoPath} name={item.name} />
                </Link>
                <div className="catalog-item-body">
                  <h2>{item.name}</h2>
                  <p className="catalog-item-category">
                    {item.category === 'iphone' ? 'iPhone' : 'Aksesori'}{' '}
                    <span aria-hidden="true">/</span> Sewa {duration} jam
                  </p>
                  <div className="catalog-card-bottom">
                    <p className="item-price">
                      {rupiah(
                        duration === 6
                          ? item.price6h
                          : duration === 12
                            ? item.price12h
                            : item.price24h,
                      )}
                    </p>
                    <Link
                      className="catalog-detail-link"
                      to={'/catalog/' + item.id}
                      aria-label={'Lihat perangkat ' + item.name}
                    >
                      <span>Lihat perangkat</span>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="pagination">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Sebelumnya
            </Button>
            <span>Halaman {page}</span>
            <Button
              variant="outline"
              disabled={page * 12 >= query.data.total}
              onClick={() => setPage(page + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </>
      )}
    </>
  );
}
