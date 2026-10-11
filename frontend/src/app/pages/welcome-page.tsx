import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { customerApi } from '@/customer/api';
import { ItemPhoto } from '@/customer/components/item-photo';
import { rupiah } from '@/customer/format';
import { LoadingState, ErrorState } from '@/components/feedback';
import { useSession } from '@/auth/session';
import { roleHome } from '@/auth/navigation';

export function WelcomePage() {
  const user = useSession().data?.user;
  const query = useQuery({
    queryKey: ['catalog', 1],
    queryFn: ({ signal }) => customerApi.catalog(1, signal),
  });
  return (
    <div className="welcome-page">
      <header>
        <Brand />
        <nav aria-label="Navigasi website">
          <Link to="/catalog">Katalog</Link>
          <Button variant="outline" asChild>
            <Link to={user ? roleHome(user.role) : '/login'}>
              {user ? 'Akun saya' : 'Masuk'}
            </Link>
          </Button>
        </nav>
      </header>
      <main id="main-content">
        <p className="eyebrow">Sewa perangkat di Semarang</p>
        <h1>
          Untuk rencana
          <br />
          yang sudah kamu siapkan.
        </h1>
        <p className="welcome-description">
          iPhone dan aksesori untuk kebutuhan harian, perjalanan, dan acara.
        </p>
        <Button asChild>
          <Link to="/catalog">
            Cari perangkat
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
        <section
          className="welcome-devices"
          aria-labelledby="welcome-devices-title"
        >
          <div className="section-heading">
            <h2 id="welcome-devices-title">Perangkat untuk rencanamu.</h2>
            <Link className="text-link" to="/catalog">
              Semua perangkat
            </Link>
          </div>
          {query.isPending ? (
            <LoadingState text="Memuat perangkat..." />
          ) : query.isError ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : query.data.data.length ? (
            <div className="catalog-grid">
              {[...query.data.data]
                .sort(
                  (a, b) =>
                    Number(b.category === 'iphone') -
                    Number(a.category === 'iphone'),
                )
                .slice(0, 3)
                .map((item) => (
                  <article key={item.id} className="catalog-item">
                    <Link to={'/catalog/' + item.id}>
                      <ItemPhoto path={item.photoPath} name={item.name} />
                    </Link>
                    <div className="catalog-item-body">
                      <h3>
                        <Link to={'/catalog/' + item.id}>{item.name}</Link>
                      </h3>
                      <p>
                        {rupiah(item.price6h)}{' '}
                        <span className="muted">/ 6 jam</span>
                      </p>
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <p className="muted">
              Katalog sedang disiapkan. Periksa kembali nanti.
            </p>
          )}
        </section>
        <section
          className="welcome-steps"
          aria-labelledby="welcome-steps-title"
        >
          <h2 id="welcome-steps-title">
            Dari pilih perangkat sampai siap dipakai.
          </h2>
          <ol>
            <li>
              <strong>01 · Pilih & tentukan jadwal</strong>
              <p>Cek harga dan ketersediaan untuk kebutuhanmu.</p>
            </li>
            <li>
              <strong>02 · Booking & bayar</strong>
              <p>
                Lengkapi profil, pilih DP atau lunas, lalu unggah bukti
                pembayaran.
              </p>
            </li>
            <li>
              <strong>03 · Ambil atau diantar</strong>
              <p>
                Setelah konfirmasi, siapkan identitas untuk serah terima.
                Kembalikan sesuai jadwal.
              </p>
            </li>
          </ol>
          <Link className="text-link" to="/terms">
            Baca ketentuan sewa
          </Link>
        </section>
      </main>
      <footer>
        <span>iRent Semarang · iPhone & aksesori</span>
        <Link to="/terms">Ketentuan sewa</Link>
      </footer>
    </div>
  );
}
