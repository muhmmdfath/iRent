import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
export function NotFoundPage() {
  return (
    <main id="main-content" className="state-page">
      <p className="eyebrow">404</p>
      <h1>Halaman tidak ditemukan</h1>
      <p>Periksa alamat halaman atau kembali ke beranda.</p>
      <Button asChild>
        <Link to="/">Kembali ke beranda</Link>
      </Button>
    </main>
  );
}
