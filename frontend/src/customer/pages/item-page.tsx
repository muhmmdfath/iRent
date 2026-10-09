import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { customerApi } from '../api';
import { ItemPhoto } from '../components/item-photo';
import { rupiah } from '../format';
export function ItemPage() {
  const { id = '' } = useParams();
  const query = useQuery({
    queryKey: ['item', id],
    queryFn: ({ signal }) => customerApi.item(id, signal),
  });
  if (query.isPending) return <LoadingState text="Memuat perangkat..." />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const item = query.data;
  return (
    <>
      <Link className="back-link" to="/catalog">
        Kembali ke katalog
      </Link>
      <div className="item-detail">
        <ItemPhoto
          key={item.photoPath}
          path={item.photoPath}
          name={item.name}
          className="item-photo-large"
        />
        <section>
          <p className="eyebrow">
            {item.category === 'iphone' ? 'iPhone' : 'Aksesori'}
          </p>
          <h1>{item.name}</h1>
          <p className="muted mt-4">Harga sama untuk weekday dan weekend.</p>
          <dl className="tariff-list">
            {([6, 12, 24] as const).map((hours) => (
              <div key={hours}>
                <dt>{hours} jam</dt>
                <dd>
                  {rupiah(
                    hours === 6
                      ? item.price6h
                      : hours === 12
                        ? item.price12h
                        : item.price24h,
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <Button asChild>
            <Link to={'/app/new?itemId=' + encodeURIComponent(item.id)}>
              Pilih jadwal
            </Link>
          </Button>
          <p className="muted text-sm mt-4">
            Ketersediaan diperiksa sesuai jadwal booking.
          </p>
        </section>
      </div>
      <section className="detail-section mt-8">
        <h2>Isi paket</h2>
        {item.includes.length ? (
          <ul className="package-list">
            {item.includes.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        ) : (
          <p className="muted mt-4">
            Tidak ada aksesori tambahan yang tercantum.
          </p>
        )}
      </section>
    </>
  );
}
