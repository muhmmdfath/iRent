import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession } from '@/auth/session';
export function AccountPage() {
  const user = useSession().data?.user;
  if (!user) return null;
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">
          {user.role === 'admin' ? 'Admin iRent' : 'Akun pelanggan'}
        </p>
        <h1>Akun saya</h1>
        <p>Informasi akun yang digunakan untuk masuk.</p>
      </header>
      <section className="detail-section" aria-labelledby="account-details">
        <h2 id="account-details">Informasi akun</h2>
        {user.role === 'customer' && (
          <Button className="mt-4" variant="outline" asChild>
            <Link to="/app/profile">Edit profil penyewa</Link>
          </Button>
        )}
        <dl className="account-details">
          <div>
            <dt>Nama</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email || 'Tidak dicantumkan'}</dd>
          </div>
          <div>
            <dt>Nomor HP</dt>
            <dd>{user.phone || 'Tidak dicantumkan'}</dd>
          </div>
          <div>
            <dt>Akses</dt>
            <dd>{user.role === 'admin' ? 'Admin' : 'Pelanggan'}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
