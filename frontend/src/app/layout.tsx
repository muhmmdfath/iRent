import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  HamburgerMenuIcon,
  Cross1Icon,
  HomeIcon,
  PersonIcon,
  ReaderIcon,
  MagnifyingGlassIcon,
  ExitIcon,
} from '@radix-ui/react-icons';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { useSession } from '@/auth/session';
import { logout } from '@/auth/api';
import { roleHome } from '@/auth/navigation';
import { clearSessionData } from '@/services/query-client';
import { errorMessage } from '@/services/api';
import { useUiStore } from '@/stores/ui';
import { useOnline } from '@/hooks/use-online';
export function AppLayout() {
  const session = useSession();
  const location = useLocation();
  const online = useOnline();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const navigationOpen = useUiStore((state) => state.navigationOpen);
  const setNavigationOpen = useUiStore((state) => state.setNavigationOpen);
  const mutation = useMutation({
    mutationFn: logout,
    onSuccess: clearSessionData,
    onError: (error) => setLogoutError(errorMessage(error)),
  });
  const admin = session.data?.user.role === 'admin';
  const home = roleHome(admin ? 'admin' : 'customer');
  useEffect(() => {
    if (!navigationOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavigationOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [navigationOpen, setNavigationOpen]);
  useEffect(() => {
    if (!admin) return;
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/admin/manifest.webmanifest';
    document.head.appendChild(link);
    return () => link.remove();
  }, [admin]);
  const nav = (
    <>
      <NavLink end to={home} onClick={() => setNavigationOpen(false)}>
        <HomeIcon aria-hidden="true" />
        Beranda
      </NavLink>
      {!admin && (
        <>
          <NavLink to="/catalog" onClick={() => setNavigationOpen(false)}>
            <MagnifyingGlassIcon aria-hidden="true" />
            Katalog
          </NavLink>
          <NavLink to="/app/bookings" onClick={() => setNavigationOpen(false)}>
            <ReaderIcon aria-hidden="true" />
            Booking
          </NavLink>
        </>
      )}
      <NavLink to={home + 'account'} onClick={() => setNavigationOpen(false)}>
        <PersonIcon aria-hidden="true" />
        Akun
      </NavLink>
    </>
  );
  return (
    <div
      className={
        admin ? 'workspace admin-workspace' : 'workspace customer-workspace'
      }
    >
      <header className="workspace-header">
        <Brand to={home} />
        <span className="workspace-context">
          {admin ? 'Ruang kerja admin' : 'Akun pelanggan'}
        </span>
        <button
          className="menu-toggle"
          aria-label={navigationOpen ? 'Tutup navigasi' : 'Buka navigasi'}
          aria-expanded={navigationOpen}
          aria-controls="workspace-navigation"
          onClick={() => setNavigationOpen(!navigationOpen)}
        >
          {navigationOpen ? <Cross1Icon /> : <HamburgerMenuIcon />}
        </button>
      </header>
      <aside
        className={'workspace-sidebar ' + (navigationOpen ? 'is-open' : '')}
      >
        <p className="navigation-label">{admin ? 'Admin iRent' : 'Navigasi'}</p>
        <nav aria-label="Navigasi utama" id="workspace-navigation">
          {nav}
        </nav>
        <div className="sidebar-account">
          <span>{session.data?.user.name}</span>
          <span className="muted">{admin ? 'Admin' : 'Pelanggan'}</span>
        </div>
      </aside>
      <div className="workspace-body">
        <div className="account-toolbar">
          <span>
            {location.pathname.endsWith('account')
              ? 'Akun'
              : location.pathname.endsWith('profile')
                ? 'Profil'
                : location.pathname.endsWith('new')
                  ? 'Booking baru'
                  : location.pathname.endsWith('payment')
                    ? 'Pembayaran'
                    : location.pathname.includes('/bookings')
                      ? 'Booking'
                      : 'Beranda'}
          </span>
          <Button
            variant="ghost"
            onClick={() => {
              setLogoutError(null);
              mutation.mutate();
            }}
            disabled={mutation.isPending || !online}
          >
            <ExitIcon aria-hidden="true" />
            {mutation.isPending ? 'Keluar...' : 'Keluar'}
          </Button>
        </div>
        {logoutError && (
          <p className="form-error logout-error" role="alert">
            {logoutError}
          </p>
        )}
        <main id="main-content" className="workspace-main">
          <Outlet />
        </main>
      </div>
      {!admin && (
        <nav className="mobile-navigation" aria-label="Navigasi mobile">
          {nav}
        </nav>
      )}
    </div>
  );
}
