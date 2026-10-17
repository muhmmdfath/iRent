import { useRef } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { Link } from 'react-router-dom';
import {
  CubeIcon,
  CalendarIcon,
  CheckCircledIcon,
} from '@radix-ui/react-icons';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { customerApi } from '@/customer/api';
import { ItemPhoto } from '@/customer/components/item-photo';
import { rupiah } from '@/customer/format';
import { LoadingState, ErrorState } from '@/components/feedback';
import { useSession } from '@/auth/session';
import { roleHome } from '@/auth/navigation';
import { useLandingMotion } from '@/hooks/use-landing-motion';
export function WelcomePage() {
  const root = useRef<HTMLDivElement>(null);
  const user = useSession().data?.user;
  const query = useQuery({
    queryKey: ['catalog', 1],
    queryFn: ({ signal }) => customerApi.catalog(1, signal),
  });
  const devices = [...(query.data?.data || [])]
    .sort(
      (a, b) =>
        Number(b.category === 'iphone') - Number(a.category === 'iphone'),
    )
    .slice(0, 3);
  const featured = devices[0];
  useLandingMotion(root, query.dataUpdatedAt);
  return (
    <div ref={root} className="welcome-page landing-pastel">
      <header className="welcome-nav">
        <Brand />
        <nav aria-label="Navigasi website">
          <Button variant="outline" asChild>
            <Link to="/catalog">Katalog</Link>
          </Button>
          <Button asChild>
            <Link to={user ? roleHome(user.role) : '/login'}>
              {user ? 'Akun saya' : 'Masuk'}
            </Link>
          </Button>
        </nav>
        <span className="landing-progress" aria-hidden="true" />
      </header>
      <main id="main-content">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy" data-reveal="up">
            <p className="landing-kicker">
              <span />
              Sewa perangkat di Semarang
            </p>
            <h1 id="landing-title">
              Untuk rencana
              <br />
              yang sudah kamu <span>siapkan.</span>
            </h1>
            <p className="welcome-description">
              iPhone dan aksesori untuk kebutuhan harian, perjalanan, dan acara.
              Pilih perangkatnya, nikmati momennya.
            </p>
            <div className="landing-hero-actions">
              <Button asChild>
                <Link to="/catalog">Cari perangkat</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  document.getElementById('welcome-steps')?.scrollIntoView({
                    behavior: window.matchMedia?.(
                      '(prefers-reduced-motion: reduce)',
                    ).matches
                      ? 'auto'
                      : 'smooth',
                  })
                }
              >
                Cara sewa
              </Button>
            </div>
            <p className="landing-hero-note">
              Pilihan durasi 6, 12, dan 24 jam.
            </p>
          </div>
          <div className="landing-hero-visual" data-reveal="scale">
            <div className="landing-orbit" aria-hidden="true" />
            <div
              className="landing-orbit landing-orbit-inner"
              aria-hidden="true"
            />
            <div className="landing-device-stage">
              <div className="landing-device-float">
                {featured ? (
                  <ItemPhoto path={featured.photoPath} name={featured.name} />
                ) : (
                  <div className="landing-device-placeholder">
                    <CubeIcon aria-hidden="true" />
                    <span>iPhone & aksesori</span>
                  </div>
                )}
              </div>
            </div>
            <div className="landing-device-label">
              <span className="landing-label-icon">
                <CubeIcon aria-hidden="true" />
              </span>
              <div>
                <span>Pilihan untuk momenmu</span>
                <strong>{featured?.name || 'Koleksi iRent'}</strong>
              </div>
            </div>
            <span className="landing-duration-badge">
              <CalendarIcon aria-hidden="true" />6 / 12 / 24 jam
            </span>
            <span
              className="landing-spark landing-spark-one"
              aria-hidden="true"
            >
              +
            </span>
            <span
              className="landing-spark landing-spark-two"
              aria-hidden="true"
            >
              +
            </span>
          </div>
        </section>
        <section
          className="welcome-devices"
          aria-labelledby="welcome-devices-title"
        >
          <div className="section-heading" data-reveal="up">
            <div>
              <p className="landing-section-label">Temukan yang cocok</p>
              <h2 id="welcome-devices-title">Perangkat untuk rencanamu.</h2>
            </div>
            <Button variant="outline" asChild>
              <Link to="/catalog">Semua perangkat</Link>
            </Button>
          </div>
          {query.isPending ? (
            <LoadingState text="Memuat perangkat..." />
          ) : query.isError ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : devices.length ? (
            <div className="catalog-grid">
              {devices.map((item, index) => (
                <article
                  key={item.id}
                  className={
                    'catalog-item landing-product landing-product-' + index
                  }
                  data-reveal="up"
                >
                  <Link
                    className="landing-product-image"
                    to={'/catalog/' + item.id}
                    aria-label={'Lihat ' + item.name}
                  >
                    <ItemPhoto path={item.photoPath} name={item.name} />
                  </Link>
                  <div className="catalog-item-body">
                    <span className="landing-product-category">
                      {item.category === 'iphone' ? 'iPhone' : 'Aksesori'}
                    </span>
                    <h3>{item.name}</h3>
                    <div className="landing-product-bottom">
                      <p>
                        {rupiah(item.price6h)} <span>/ 6 jam</span>
                      </p>
                      <Button variant="outline" asChild>
                        <Link to={'/catalog/' + item.id}>Lihat perangkat</Link>
                      </Button>
                    </div>
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
          id="welcome-steps"
          className="welcome-steps"
          aria-labelledby="welcome-steps-title"
        >
          <div className="landing-steps-heading" data-reveal="up">
            <p className="landing-section-label">Tiga langkah, satu rencana</p>
            <h2 id="welcome-steps-title">
              Dari pilih perangkat
              <br />
              sampai siap dipakai.
            </h2>
            <p>Atur sewamu dengan jelas, dari awal sampai kembali.</p>
          </div>
          <ol>
            {[
              {
                number: '01',
                icon: CubeIcon,
                title: 'Pilih & tentukan jadwal',
                text: 'Temukan perangkat yang cocok, lalu cek harga dan ketersediaan sesuai jadwalmu.',
              },
              {
                number: '02',
                icon: CalendarIcon,
                title: 'Booking & bayar',
                text: 'Lengkapi profil, pilih DP atau lunas, lalu unggah bukti pembayaran untuk diperiksa.',
              },
              {
                number: '03',
                icon: CheckCircledIcon,
                title: 'Ambil atau diantar',
                text: 'Setelah konfirmasi, siapkan identitas untuk serah terima. Kembalikan sesuai jadwal.',
              },
            ].map(({ number, icon: Icon, title, text }) => (
              <li key={number} data-reveal="up">
                <span className="landing-step-icon">
                  <Icon aria-hidden="true" />
                </span>
                <span className="landing-step-number">{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <div data-reveal="up">
            <Button variant="outline" asChild>
              <Link to="/terms">Baca ketentuan sewa</Link>
            </Button>
          </div>
        </section>
        <section className="landing-final-cta" data-reveal="up">
          <p className="landing-section-label">
            Siap untuk rencana berikutnya?
          </p>
          <h2>
            Perangkatnya dari kami.
            <br />
            Momennya milikmu.
          </h2>
          <Button asChild>
            <Link to="/catalog">Pilih perangkat sekarang</Link>
          </Button>
          <span aria-hidden="true" className="landing-cta-orbit" />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
