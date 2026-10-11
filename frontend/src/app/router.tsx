import { PaymentPage } from '@/customer/pages/payment-page';
import { LoadingState } from '@/components/feedback';
import { BookingsPage } from '@/customer/pages/bookings-page';
import { BookingDetailPage } from '@/customer/pages/booking-detail-page';
import { NewBookingPage } from '@/customer/pages/new-booking-page';
import { PublicLayout } from '@/customer/components/public-layout';
import { CatalogPage } from '@/customer/pages/catalog-page';
import { ItemPage } from '@/customer/pages/item-page';
import { TermsPage } from '@/customer/pages/terms-page';
import { ProfilePage } from '@/customer/pages/profile-page';
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import { useEffect, useRef, lazy, Suspense, type ComponentType } from 'react';
import { RequireSession } from '@/auth/components/require-session';
import { RegisterPage } from '@/auth/pages/register-page';
import { LoginPage } from '@/auth/pages/login-page';
import { AccountPage } from '@/account/pages/account-page';
import { HomePage } from '@/account/pages/home-page';
import { AppLayout } from './layout';
import { Connectivity } from './connectivity';
import { WelcomePage } from './pages/welcome-page';
import { NotFoundPage } from './pages/not-found-page';
const AdminDashboardPage = lazy(() =>
  import('@/admin/pages/dashboard-page').then((module) => ({
    default: module.AdminDashboardPage,
  })),
);
const GuidePage = lazy(() =>
  import('@/admin/pages/guide-page').then((module) => ({
    default: module.GuidePage,
  })),
);
const RefundQueuePage = lazy(() =>
  import('@/refunds/queue').then((module) => ({
    default: module.RefundQueuePage,
  })),
);
const AccountsPage = lazy(() =>
  import('@/admin/manage/accounts').then((module) => ({
    default: module.AccountsPage,
  })),
);
const RisksPage = lazy(() =>
  import('@/admin/manage/risks').then((module) => ({
    default: module.RisksPage,
  })),
);
const NotificationsPage = lazy(() =>
  import('@/admin/notifications/pages').then((module) => ({
    default: module.NotificationsPage,
  })),
);
const CustomerDetailPage = lazy(() =>
  import('@/admin/manage/accounts').then((module) => ({
    default: module.CustomerDetailPage,
  })),
);
const SettingsPage = lazy(() =>
  import('@/admin/manage/settings').then((module) => ({
    default: module.SettingsPage,
  })),
);
const ZonesPage = lazy(() =>
  import('@/admin/manage/zones').then((module) => ({
    default: module.ZonesPage,
  })),
);
const ReportsPage = lazy(() =>
  import('@/admin/manage/reports').then((module) => ({
    default: module.ReportsPage,
  })),
);
const CalendarPage = lazy(() =>
  import('@/admin/manage/calendar').then((module) => ({
    default: module.CalendarPage,
  })),
);
const ExtensionDetailPage = lazy(() =>
  import('@/extensions/pages').then((module) => ({
    default: module.ExtensionDetailPage,
  })),
);
const NewExtensionPage = lazy(() =>
  import('@/extensions/pages').then((module) => ({
    default: module.NewExtensionPage,
  })),
);
const ExtensionQueuePage = lazy(() =>
  import('@/extensions/pages').then((module) => ({
    default: module.ExtensionQueuePage,
  })),
);
const InventoryPage = lazy(() =>
  import('@/admin/inventory/pages').then((module) => ({
    default: module.InventoryPage,
  })),
);
const InventoryDetailPage = lazy(() =>
  import('@/admin/inventory/pages').then((module) => ({
    default: module.InventoryDetailPage,
  })),
);
const NewInventoryItemPage = lazy(() =>
  import('@/admin/inventory/pages').then((module) => ({
    default: module.NewInventoryItemPage,
  })),
);
const AdminBookingsPage = lazy(() =>
  import('@/admin/pages/bookings-page').then((module) => ({
    default: module.AdminBookingsPage,
  })),
);
const AdminBookingDetailPage = lazy(() =>
  import('@/admin/pages/booking-detail-page').then((module) => ({
    default: module.AdminBookingDetailPage,
  })),
);
function RecordPage({ component: Component }: { component: ComponentType }) {
  const { id, extensionId } = useParams();
  return <Component key={`${id}:${extensionId || ''}`} />;
}
function RouteAccessibility() {
  const location = useLocation();
  const first = useRef(true);
  useEffect(() => {
    const path = location.pathname;
    const adminTitles: Record<string, string> = {
      '/admin': 'Ringkasan operasional',
      '/admin/calendar': 'Kalender unit',
      '/admin/risks': 'Risiko operasional',
      '/admin/notifications': 'Notifikasi admin',
      '/admin/customers': 'Pelanggan',
      '/admin/accounts': 'Akun admin',
      '/admin/guide': 'Panduan admin',
      '/admin/settings': 'Pengaturan sewa',
      '/admin/zones': 'Zona antar',
      '/admin/reports': 'Laporan kas',
      '/admin/extensions': 'Antrean perpanjangan',
      '/admin/bookings': 'Booking & pembayaran',
    };
    const title =
      adminTitles[path] ||
      (path.includes('/extensions/')
        ? 'Perpanjangan'
        : path.startsWith('/admin/customers/')
          ? 'Detail pelanggan'
          : path === '/admin/refunds'
            ? 'Refund'
            : path === '/admin/inventory'
              ? 'Inventaris'
              : path === '/admin/inventory/new'
                ? 'Tambah model'
                : path.startsWith('/admin/inventory/')
                  ? 'Detail inventaris'
                  : path === '/login'
                    ? 'Masuk'
                    : path === '/register'
                      ? 'Buat akun'
                      : path === '/catalog'
                        ? 'Katalog'
                        : path.startsWith('/catalog/')
                          ? 'Detail perangkat'
                          : path === '/terms'
                            ? 'Ketentuan sewa'
                            : path.endsWith('/account')
                              ? 'Akun saya'
                              : path.endsWith('/profile')
                                ? 'Profil pelanggan'
                                : path.endsWith('/new')
                                  ? 'Booking baru'
                                  : path.endsWith('/payment')
                                    ? 'Pembayaran booking'
                                    : path.endsWith('/bookings')
                                      ? 'Booking saya'
                                      : path.includes('/bookings/')
                                        ? 'Detail booking'
                                        : 'iRent Semarang');
    document.title =
      title === 'iRent Semarang' ? title : title + ' - iRent Semarang';
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    const main = document.getElementById('main-content');
    if (main) {
      main.tabIndex = -1;
      main.focus({ preventScroll: true });
    }
  }, [location.pathname]);
  return null;
}
export function AppRoutes() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Lewati ke konten
      </a>
      <Connectivity />
      <RouteAccessibility />
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route element={<PublicLayout />}>
          <Route path="/catalog" element={<CatalogPage />} />
          <Route
            path="/catalog/:id"
            element={<RecordPage component={ItemPage} />}
          />
          <Route path="/terms" element={<TermsPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<RequireSession role="customer" />}>
          <Route path="/app" element={<AppLayout />}>
            <Route
              path="bookings/:id/extensions/new"
              element={
                <Suspense
                  fallback={<LoadingState text="Memuat pengajuan..." />}
                >
                  <RecordPage component={NewExtensionPage} />
                </Suspense>
              }
            />
            <Route
              path="bookings/:id/extensions/:extensionId"
              element={
                <Suspense
                  fallback={<LoadingState text="Memuat perpanjangan..." />}
                >
                  <RecordPage component={ExtensionDetailPage} />
                </Suspense>
              }
            />
            <Route index element={<HomePage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="new" element={<NewBookingPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route
              path="bookings/:id"
              element={<RecordPage component={BookingDetailPage} />}
            />
            <Route
              path="bookings/:id/payment"
              element={<RecordPage component={PaymentPage} />}
            />
          </Route>
        </Route>
        <Route element={<RequireSession role="admin" />}>
          <Route path="/admin" element={<AppLayout />}>
            <Route
              path="guide"
              element={
                <Suspense fallback={<LoadingState />}>
                  <GuidePage />
                </Suspense>
              }
            />
            <Route
              path="risks"
              element={
                <Suspense fallback={<LoadingState />}>
                  <RisksPage />
                </Suspense>
              }
            />
            <Route
              path="notifications"
              element={
                <Suspense fallback={<LoadingState />}>
                  <NotificationsPage />
                </Suspense>
              }
            />
            <Route
              path="customers"
              element={
                <Suspense fallback={<LoadingState />}>
                  <AccountsPage key="customers" />
                </Suspense>
              }
            />
            <Route
              path="customers/:id"
              element={
                <Suspense fallback={<LoadingState />}>
                  <RecordPage component={CustomerDetailPage} />
                </Suspense>
              }
            />
            <Route
              path="accounts"
              element={
                <Suspense fallback={<LoadingState />}>
                  <AccountsPage key="admins" admins />
                </Suspense>
              }
            />
            <Route
              path="settings"
              element={
                <Suspense fallback={<LoadingState />}>
                  <SettingsPage />
                </Suspense>
              }
            />
            <Route
              path="zones"
              element={
                <Suspense fallback={<LoadingState />}>
                  <ZonesPage />
                </Suspense>
              }
            />
            <Route
              path="reports"
              element={
                <Suspense fallback={<LoadingState />}>
                  <ReportsPage />
                </Suspense>
              }
            />
            <Route
              path="calendar"
              element={
                <Suspense fallback={<LoadingState />}>
                  <CalendarPage />
                </Suspense>
              }
            />
            <Route
              path="extensions"
              element={
                <Suspense fallback={<LoadingState />}>
                  <ExtensionQueuePage />
                </Suspense>
              }
            />
            <Route
              path="bookings/:id/extensions/:extensionId"
              element={
                <Suspense fallback={<LoadingState />}>
                  <RecordPage component={ExtensionDetailPage} />
                </Suspense>
              }
            />
            <Route
              path="refunds"
              element={
                <Suspense fallback={<LoadingState text="Memuat refund..." />}>
                  <RefundQueuePage />
                </Suspense>
              }
            />
            <Route
              path="inventory"
              element={
                <Suspense
                  fallback={<LoadingState text="Memuat inventaris..." />}
                >
                  <InventoryPage />
                </Suspense>
              }
            />
            <Route
              path="inventory/new"
              element={
                <Suspense
                  fallback={<LoadingState text="Memuat formulir model..." />}
                >
                  <NewInventoryItemPage />
                </Suspense>
              }
            />
            <Route
              path="inventory/:id"
              element={
                <Suspense
                  fallback={<LoadingState text="Memuat detail inventaris..." />}
                >
                  <RecordPage component={InventoryDetailPage} />
                </Suspense>
              }
            />
            <Route
              index
              element={
                <Suspense
                  fallback={<LoadingState text="Memuat panel admin..." />}
                >
                  <AdminDashboardPage />
                </Suspense>
              }
            />
            <Route
              path="bookings"
              element={
                <Suspense
                  fallback={<LoadingState text="Memuat daftar booking..." />}
                >
                  <AdminBookingsPage />
                </Suspense>
              }
            />
            <Route
              path="bookings/:id"
              element={
                <Suspense
                  fallback={<LoadingState text="Memuat detail booking..." />}
                >
                  <RecordPage component={AdminBookingDetailPage} />
                </Suspense>
              }
            />
            <Route path="account" element={<AccountPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
