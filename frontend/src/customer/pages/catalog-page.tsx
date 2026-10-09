import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { customerApi } from '../api';
import { ItemPhoto } from '../components/item-photo';
import { rupiah } from '../format';
export function CatalogPage() {
  const [page, setPage] = useState(1);
  const [duration, setDuration] = useState<6 | 12 | 24>(6);
  const query = useQuery({
    queryKey: ['catalog', page],
    queryFn: ({ signal }) => customerApi.catalog(page, signal),
  });
  return (
    <>
      <header className="page-heading catalog-heading">
        <div>
          <p className="eyebrow">iPhone & aksesori</p>
          <h1>Pilih perangkatmu.</h1>
          <p>Tentukan jadwal untuk memeriksa ketersediaan.</p>
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
      {query.isPending ? (
        <LoadingState text="Memuat katalog..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.data.length ? (
        <div className="empty-state">
          <h2>Katalog belum tersedia</h2>
          <p>Periksa kembali nanti untuk melihat perangkat iRent.</p>
        </div>
      ) : (
        <>
          <div className="catalog-grid">
            {query.data.data.map((item) => (
              <article className="catalog-item" key={item.id}>
                <Link to={'/catalog/' + item.id}>
                  <ItemPhoto path={item.photoPath} name={item.name} />
                </Link>
                <div className="catalog-item-body">
                  <p className="eyebrow">
                    {item.category === 'iphone' ? 'iPhone' : 'Aksesori'}
                  </p>
                  <h2>
                    <Link to={'/catalog/' + item.id}>{item.name}</Link>
                  </h2>
                  <p className="item-price">
                    {rupiah(
                      duration === 6
                        ? item.price6h
                        : duration === 12
                          ? item.price12h
                          : item.price24h,
                    )}
                    <span> / {duration} jam</span>
                  </p>
                  <Button variant="outline" asChild>
                    <Link to={'/catalog/' + item.id}>Lihat perangkat</Link>
                  </Button>
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
