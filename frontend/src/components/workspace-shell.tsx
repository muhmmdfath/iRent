import { NotificationBell } from '@/components/notification-bell';
import { useEffect, useRef, type ReactNode, type ComponentType } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ExitIcon,
  MagnifyingGlassIcon,
  HamburgerMenuIcon,
  Cross1Icon,
  HomeIcon,
  CubeIcon,
  ReaderIcon,
  PersonIcon,
  CalendarIcon,
  BellIcon,
  GearIcon,
  BarChartIcon,
  MobileIcon,
  QuestionMarkCircledIcon,
} from '@radix-ui/react-icons';
import { Brand } from '@/components/brand';
import { SiteFooter } from '@/components/site-footer';
import { useUiStore } from '@/stores/ui';
import type { Role } from '@/auth/types';
type Icon = ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;
interface ShellProps {
  children: ReactNode;
  user?: { name: string; role: Role };
  onLogout?: () => void;
  logoutPending?: boolean;
  logoutDisabled?: boolean;
  error?: string | null;
}
export function WorkspaceShell({
  children,
  user,
  onLogout,
  logoutPending,
  logoutDisabled,
  error,
}: ShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const open = useUiStore((s) => s.navigationOpen);
  const setOpen = useUiStore((s) => s.setNavigationOpen);
  const search = useRef<HTMLInputElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const admin = user?.role === 'admin';
  const home = admin ? '/admin/' : user ? '/app/' : '/';
  const category = new URLSearchParams(location.search).get('category');
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        setOpen(false);
        toggle.current?.focus();
      }
      if (
        open &&
        event.key === 'Tab' &&
        window.matchMedia('(max-width: 767px)').matches
      ) {
        const controls = [
          toggle.current,
          ...document.querySelectorAll<HTMLAnchorElement>('#studio-sidebar a'),
        ].filter(
          (node): node is HTMLButtonElement | HTMLAnchorElement =>
            node !== null,
        );
        const index = controls.findIndex(
          (node) => node === document.activeElement,
        );
        event.preventDefault();
        controls[
          (index + (event.shiftKey ? -1 : 1) + controls.length) %
            controls.length
        ]?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [open, setOpen]);
  const link = (
    to: string,
    label: string,
    IconComponent: Icon,
    end = false,
  ) => (
    <NavLink key={to} end={end} to={to} onClick={() => setOpen(false)}>
      <IconComponent aria-hidden={true} />
      <span>{label}</span>
    </NavLink>
  );
  return (
    <div
      className={'studio-shell ' + (admin ? 'studio-admin' : 'studio-customer')}
    >
      <div className="studio-brand">
        <Brand to={home} />
        <button
          ref={toggle}
          type="button"
          className="studio-icon-button studio-menu-toggle"
          aria-label={open ? 'Tutup navigasi' : 'Buka navigasi'}
          aria-expanded={open}
          aria-controls="studio-sidebar"
          onClick={() => setOpen(!open)}
        >
          {open ? <Cross1Icon /> : <HamburgerMenuIcon />}
        </button>
      </div>
      <header className="studio-navbar">
        <div className="studio-history">
          <button
            type="button"
            className="studio-icon-button studio-history-button"
            aria-label="Navigasi mundur"
            title="Kembali"
            onClick={() => {
              if (window.history.state?.idx > 0) void navigate(-1);
              else void navigate('/catalog');
            }}
          >
            <ArrowLeftIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className="studio-icon-button studio-history-button"
            aria-label="Navigasi maju"
            title="Maju"
            onClick={() => void navigate(1)}
          >
            <ArrowRightIcon aria-hidden="true" />
          </button>
        </div>
        <form
          key={location.search}
          className="studio-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const value =
              new FormData(event.currentTarget)
                .get('search')
                ?.toString()
                .trim() || '';
            const params = new URLSearchParams();
            if (value) params.set('search', value);
            void navigate(
              '/catalog' + (params.size ? '?' + params.toString() : ''),
            );
            setOpen(false);
          }}
        >
          <MagnifyingGlassIcon aria-hidden="true" />
          <input
            ref={search}
            name="search"
            type="search"
            aria-label="Cari perangkat"
            placeholder="Cari perangkat..."
            maxLength={150}
            defaultValue={
              new URLSearchParams(location.search).get('search') || ''
            }
          />
          <button
            type="submit"
            aria-label="Cari di katalog"
            className="studio-search-submit"
          >
            <span>Cari</span>
            <kbd>Ctrl K</kbd>
          </button>
        </form>
        <div className="studio-navbar-account">
          {user ? (
            <>
              <NotificationBell />
              <Link
                to={home + 'account'}
                className="studio-user-profile"
                aria-label="Akun saya"
              >
                <span className="studio-avatar" aria-hidden="true">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="studio-user-name">{user.name}</span>
              </Link>
              {onLogout && (
                <button
                  className="studio-icon-button studio-logout-button"
                  type="button"
                  aria-label={logoutPending ? 'Keluar...' : 'Keluar'}
                  title="Keluar"
                  onClick={onLogout}
                  disabled={logoutDisabled}
                >
                  <ExitIcon aria-hidden="true" />
                </button>
              )}
            </>
          ) : (
            <Link to="/login" className="studio-login">
              Masuk
            </Link>
          )}
        </div>
      </header>
      {open && (
        <button
          className="studio-scrim"
          aria-label="Tutup menu navigasi"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="studio-sidebar"
        className={'studio-sidebar ' + (open ? 'is-open' : '')}
      >
        <nav aria-label="Navigasi utama">
          <div className="studio-nav-group">
            <p className="studio-nav-label">
              {admin ? 'Workspace' : 'Eksplorasi'}
            </p>
            {link(home, 'Beranda', HomeIcon, true)}
            {link('/catalog', 'Katalog perangkat', CubeIcon)}
            {!admin && (
              <div className="studio-subnav">
                {[
                  ['iphone', 'iPhone'],
                  ['accessory', 'Aksesori'],
                ].map(([value, label]) => (
                  <Link
                    key={value}
                    className={
                      category === value && location.pathname === '/catalog'
                        ? 'active'
                        : ''
                    }
                    to={'/catalog?category=' + value}
                    onClick={() => setOpen(false)}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="studio-nav-group">
            <p className="studio-nav-label">
              {admin ? 'Operasional' : 'Penyewaan'}
            </p>
            {admin ? (
              <>
                {link('/admin/bookings', 'Booking & pembayaran', ReaderIcon)}
                {link('/admin/inventory', 'Inventaris & unit', MobileIcon)}
                {link('/admin/calendar', 'Jadwal unit', CalendarIcon)}
                {link('/admin/extensions', 'Perpanjangan', CalendarIcon)}
                {link('/admin/refunds', 'Refund', ReaderIcon)}
                {link(
                  '/admin/risks',
                  'Risiko & tindak lanjut',
                  QuestionMarkCircledIcon,
                )}
              </>
            ) : (
              <>
                {link(
                  user ? '/app/bookings' : '/login?returnTo=/app/bookings',
                  'Booking saya',
                  ReaderIcon,
                )}
                {link('/terms', 'Ketentuan sewa', QuestionMarkCircledIcon)}
              </>
            )}
          </div>
          <div className="studio-nav-group">
            <p className="studio-nav-label">
              {admin ? 'Manajemen' : 'Personal'}
            </p>
            {admin && (
              <>
                {link('/admin/customers', 'Data penyewa', PersonIcon)}
                {link('/admin/accounts', 'Akun admin', PersonIcon)}
                {link('/admin/reports', 'Laporan & transaksi', BarChartIcon)}
                {link('/admin/zones', 'Zona ongkir', CubeIcon)}
                {link('/admin/notifications', 'Notifikasi PWA', BellIcon)}
                {link('/admin/settings', 'Pengaturan', GearIcon)}
                {link('/admin/guide', 'Panduan admin', QuestionMarkCircledIcon)}
              </>
            )}
            {link(
              user ? home + 'account' : '/login',
              user ? 'Akun' : 'Masuk ke akun',
              PersonIcon,
            )}
          </div>
        </nav>
        <div className="studio-sidebar-footer">
          {user ? (
            <>
              <span className="studio-avatar" aria-hidden="true">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{user.name}</strong>
                <span>{admin ? 'Administrator' : 'Pelanggan iRent'}</span>
              </div>
            </>
          ) : (
            <>
              <span className="studio-footer-mark">iR</span>
              <div>
                <strong>Sewa, pakai, kembalikan.</strong>
                <span>iPhone & aksesori di Semarang</span>
              </div>
            </>
          )}
        </div>
      </aside>
      <div className="studio-content">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <main id="main-content" className="studio-main">
          {children}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
