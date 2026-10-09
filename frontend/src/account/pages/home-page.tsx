import { CustomerHomePage } from '@/customer/pages/customer-home-page';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import { useSession } from '@/auth/session';
import { roleHome } from '@/auth/navigation';
import { Button } from '@/components/ui/button';
export function HomePage() {
  const user = useSession().data?.user;
  if (!user) return null;
  if (user.role === 'customer') return <CustomerHomePage />;
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">
          {user.role === 'admin' ? 'Ruang kerja iRent' : 'iRent Semarang'}
        </p>
        <h1>Selamat datang, {user.name}.</h1>
        <p>
          {user.role === 'admin'
            ? 'Kamu masuk sebagai admin iRent.'
            : 'Kamu sudah masuk ke akun iRent.'}
        </p>
      </header>
      <section className="session-overview" aria-labelledby="session-title">
        <div>
          <p className="eyebrow">Akun aktif</p>
          <h2 id="session-title">{user.name}</h2>
          <p>{user.email || user.phone}</p>
        </div>
        <Button variant="outline" asChild>
          <Link to={roleHome(user.role) + 'account'}>
            Lihat akun
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </>
  );
}
