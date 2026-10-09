import { Link, Outlet } from 'react-router-dom';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { useSession } from '@/auth/session';
import { roleHome } from '@/auth/navigation';
export function PublicLayout() {
  const user = useSession().data?.user;
  return (
    <div className="public-workspace">
      <header className="public-header">
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
      <main id="main-content" className="public-main">
        <Outlet />
      </main>
      <footer className="public-footer">
        <span>iRent Semarang</span>
        <Link to="/terms">Ketentuan sewa</Link>
      </footer>
    </div>
  );
}
