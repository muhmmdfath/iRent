import { Link } from 'react-router-dom';
import { Brand } from './brand';
import { Button } from './ui/button';
import { InstagramLogoIcon, ArrowTopRightIcon } from '@radix-ui/react-icons';
import { site } from '@/seo/site';
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-panel">
        <div className="site-footer-top">
          <div className="site-footer-about">
            <Brand />
            <p>
              Perangkat yang kamu butuhkan, untuk momen yang kamu rencanakan.
              Sewa iPhone dan aksesori di Semarang dengan pilihan durasi yang
              fleksibel.
            </p>
            <span className="site-footer-location">
              <span aria-hidden="true" />
              Semarang, Jawa Tengah
            </span>
            <a
              className="site-instagram-link"
              href={site.instagram}
              target="_blank"
              rel="noopener noreferrer"
            >
              <InstagramLogoIcon aria-hidden="true" />
              @irent_semarang
              <ArrowTopRightIcon aria-hidden="true" />
            </a>
          </div>
          <nav className="site-footer-links" aria-label="Tautan footer">
            <div>
              <h2>Perangkat</h2>
              <Button variant="ghost" className="footer-action" asChild>
                <Link to="/catalog">Semua koleksi</Link>
              </Button>
              <Button variant="ghost" className="footer-action" asChild>
                <Link to="/catalog?category=iphone">iPhone</Link>
              </Button>
              <Button variant="ghost" className="footer-action" asChild>
                <Link to="/catalog?category=accessory">Aksesori</Link>
              </Button>
            </div>
            <div>
              <h2>Penyewaan</h2>
              <Button variant="ghost" className="footer-action" asChild>
                <Link to="/app/new">Buat booking</Link>
              </Button>
              <Button variant="ghost" className="footer-action" asChild>
                <Link to="/app/bookings">Booking saya</Link>
              </Button>
              <Button variant="ghost" className="footer-action" asChild>
                <Link to="/terms">Panduan & ketentuan</Link>
              </Button>
            </div>
            <div>
              <h2>Akun</h2>
              <Button variant="ghost" className="footer-action" asChild>
                <Link to="/login">Masuk</Link>
              </Button>
              <Button variant="ghost" className="footer-action" asChild>
                <Link to="/register">Daftar akun</Link>
              </Button>
              <Button variant="ghost" className="footer-action" asChild>
                <Link to="/app/account">Profil saya</Link>
              </Button>
            </div>
          </nav>
        </div>
        <div className="site-footer-bottom">
          <p>
            <span aria-hidden="true">&copy;</span> {new Date().getFullYear()}{' '}
            iRent Semarang. Seluruh hak dilindungi.
          </p>
          <Link className="footer-terms-link" to="/terms">
            Ketentuan sewa
          </Link>
        </div>
      </div>
      <div className="site-footer-wordmark" aria-hidden="true">
        iRent
      </div>
    </footer>
  );
}
