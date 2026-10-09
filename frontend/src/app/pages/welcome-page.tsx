import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';

export function WelcomePage() {
  return (
    <div className="welcome-page">
      <header>
        <Brand />
        <span className="muted">iPhone & aksesori</span>
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
      </main>
      <footer>iRent Semarang</footer>
    </div>
  );
}
