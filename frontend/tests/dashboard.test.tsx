import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { Providers } from '@/app/providers';
import { AppRoutes } from '@/app/router';
import { server } from './server';
import { adminSession, adminBooking } from './admin-fixtures';
vi.mock('@/admin/notifications/sound', () => ({
  loadAlertSound: () =>
    Promise.resolve({
      createAdminAlertSound: () => ({
        enable: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
        acknowledge: vi.fn(),
        disable: vi.fn(),
        dispose: vi.fn(),
      }),
    }),
}));
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 15000 });
const base = 'http://localhost:3000/api';
const overview = {
  total: 9,
  today: 2,
  lateUnits: 1,
  readyUnits: 12,
  counts: [
    { status: 'berjalan', count: 3 },
    { status: 'dikonfirmasi', count: 2 },
    { status: 'selesai', count: 4 },
  ],
  pickups: [
    {
      id: 'pickup',
      itemNameSnapshot: 'iPhone Jadwal',
      unitCodeSnapshot: 'IPH-001',
      startAt: '2026-10-15T10:00:00+07:00',
      currentEndAt: '2026-10-16T10:00:00+07:00',
      booking: { id: 'pickup-booking', code: 'IRN-PICKUP' },
    },
  ],
  returns: [
    {
      id: 'return',
      itemNameSnapshot: 'AirPods Kembali',
      unitCodeSnapshot: 'AIR-001',
      startAt: '2026-10-14T15:00:00+07:00',
      currentEndAt: '2026-10-15T15:00:00+07:00',
      booking: { id: 'return-booking', code: 'IRN-RETURN' },
    },
  ],
};
const payment = {
  id: 'pending-proof',
  kind: 'payment',
  bookingId: 'pay-booking',
  code: 'IRN-PRIORITY',
  dueAt: '2026-10-15T11:00:00+07:00',
  overdue: true,
  version: 'v1',
};
const refund = {
  id: 'refund',
  kind: 'refund',
  bookingId: 'refund-booking',
  code: 'IRN-REFUND',
  dueAt: null,
  overdue: false,
  version: 'v1',
};
beforeEach(() =>
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(adminSession)),
    http.get(base + '/admin/overview', () => HttpResponse.json(overview)),
    http.get(base + '/admin/bookings', ({ request }) => {
      const params = new URL(request.url).searchParams;
      expect(params.get('limit')).toBe('5');
      expect(params.get('sort')).toBe('newest');
      return HttpResponse.json([adminBooking]);
    }),
    http.get(base + '/admin/tasks', ({ request }) => {
      const kind = new URL(request.url).searchParams.get('kind');
      const data = [payment, refund].filter(
        (task) => kind === 'all' || task.kind === kind,
      );
      return HttpResponse.json({
        data,
        total: data.length,
        page: 1,
        limit: 20,
      });
    }),
  ),
);
function mount() {
  render(
    <Providers>
      <MemoryRouter initialEntries={['/admin/']}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
}
it('shows real operational counts and a single priority queue with recent booking navigation', async () => {
  mount();
  expect(
    await screen.findByRole('heading', { name: 'Ringkasan operasional' }),
  ).toBeVisible();
  const metrics = screen.getByRole('region', { name: 'Ringkasan operasional' });
  expect(await within(metrics).findByText('12')).toBeVisible();
  expect(within(metrics).getByText('3')).toBeVisible();
  const priority = screen.getByRole('region', { name: 'Perlu ditangani' });
  expect(await within(priority).findByText('IRN-PRIORITY')).toBeVisible();
  expect(screen.getAllByText('IRN-PRIORITY')).toHaveLength(1);
  expect(
    screen.queryByRole('region', { name: 'Periksa bukti pembayaran' }),
  ).not.toBeInTheDocument();
  expect(
    within(priority).getByRole('link', { name: 'Periksa pembayaran' }),
  ).toHaveAttribute('href', '/admin/bookings/pay-booking');
  expect(
    await screen.findByRole('link', {
      name: 'Buka booking ' + adminBooking.code,
    }),
  ).toHaveAttribute('href', '/admin/bookings/' + adminBooking.id);
});
it('switches the WIB schedule with tabs and filters the unified work queue', async () => {
  mount();
  const user = userEvent.setup();
  expect(await screen.findByText('iPhone Jadwal')).toBeVisible();
  expect(screen.getByText('10.00')).toBeVisible();
  await user.click(screen.getByRole('tab', { name: /Pengembalian/ }));
  expect(await screen.findByText('AirPods Kembali')).toBeVisible();
  expect(screen.queryByText('iPhone Jadwal')).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Lihat booking IRN-RETURN' }),
  ).toHaveAttribute('href', '/admin/bookings/return-booking');
  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('tab', { name: /Pengambilan/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Jenis pekerjaan' }),
    'refund',
  );
  expect(await screen.findByText('IRN-REFUND')).toBeVisible();
  expect(screen.queryByText('IRN-PRIORITY')).not.toBeInTheDocument();
});
it('does not present failed overview data as zero counts or leave endless status loading', async () => {
  server.use(
    http.get(base + '/admin/overview', () =>
      HttpResponse.json(
        { message: 'Data sementara tidak tersedia' },
        { status: 503 },
      ),
    ),
  );
  mount();
  expect(
    await screen.findByText(/Ringkasan belum dapat diperbarui/),
  ).toBeVisible();
  const metrics = screen.getByRole('region', { name: 'Ringkasan operasional' });
  expect(within(metrics).getAllByText('--')).toHaveLength(4);
  expect(within(metrics).queryByText('0')).not.toBeInTheDocument();
  expect(screen.queryByText('Memuat status...')).not.toBeInTheDocument();
});
