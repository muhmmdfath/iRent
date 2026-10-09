import { PaymentPage } from '@/customer/pages/payment-page';
import { BookingsPage } from '@/customer/pages/bookings-page';
import { BookingDetailPage } from '@/customer/pages/booking-detail-page';
import { NewBookingPage } from '@/customer/pages/new-booking-page';
import { PublicLayout } from '@/customer/components/public-layout';
import { CatalogPage } from '@/customer/pages/catalog-page';
import { ItemPage } from '@/customer/pages/item-page';
import { TermsPage } from '@/customer/pages/terms-page';
import { ProfilePage } from '@/customer/pages/profile-page';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { RequireSession } from '@/auth/components/require-session';
import { RegisterPage } from '@/auth/pages/register-page';
import { LoginPage } from '@/auth/pages/login-page';
import { AccountPage } from '@/account/pages/account-page';
import { HomePage } from '@/account/pages/home-page';
import { AppLayout } from './layout';
import { Connectivity } from './connectivity';
import { WelcomePage } from './pages/welcome-page';
import { NotFoundPage } from './pages/not-found-page';
function RouteAccessibility() {
  const location = useLocation();
  const first = useRef(true);
  useEffect(() => {
    const path = location.pathname;
    const title =
      path === '/login'
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
                            : 'iRent Semarang';
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
          <Route path="/catalog/:id" element={<ItemPage />} />
          <Route path="/terms" element={<TermsPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<RequireSession role="customer" />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="new" element={<NewBookingPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="bookings/:id" element={<BookingDetailPage />} />
            <Route path="bookings/:id/payment" element={<PaymentPage />} />
          </Route>
        </Route>
        <Route element={<RequireSession role="admin" />}>
          <Route path="/admin" element={<AppLayout />}>
            <Route index element={<HomePage />} />
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
