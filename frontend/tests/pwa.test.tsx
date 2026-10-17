import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { Providers } from '@/app/providers';
import { AppRoutes } from '@/app/router';
import { server } from './server';
import { adminSession } from './admin-fixtures';
import { at } from './customer-fixtures';
const clients = vi.hoisted(() => ({
  push: vi.fn().mockResolvedValue({}),
  sound: {
    enable: vi.fn().mockResolvedValue(undefined),
    update: vi.fn(),
    acknowledge: vi.fn(),
    disable: vi.fn(),
    dispose: vi.fn(),
  },
}));
vi.mock('@/admin/notifications/push', () => ({
  loadPushClient: () => Promise.resolve({ enableAdminPush: clients.push }),
  disableCurrentPush: vi.fn(),
}));
vi.mock('@/admin/notifications/sound', () => ({
  loadAlertSound: () =>
    Promise.resolve({ createAdminAlertSound: () => clients.sound }),
}));
const base = 'http://localhost:3000/api';
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 15000 });
beforeEach(() => {
  vi.clearAllMocks();
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(adminSession)),
  );
});
function mount(route: string) {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
}
it('never requests push permission on page load and enables only on an explicit click', async () => {
  server.use(
    http.get(base + '/admin/notifications/configuration', () =>
      HttpResponse.json({ enabled: true, publicKey: 'test-key' }),
    ),
    http.get(base + '/admin/notifications', () => HttpResponse.json([])),
  );
  mount('/admin/notifications');
  const user = userEvent.setup();
  const button = await screen.findByRole('button', {
    name: 'Aktifkan notifikasi',
  });
  await waitFor(() => expect(button).toBeEnabled());
  expect(clients.push).not.toHaveBeenCalled();
  await user.click(button);
  await waitFor(() =>
    expect(clients.push).toHaveBeenCalledWith({
      apiBase: 'http://localhost:3000',
      csrfToken: 'admin-csrf',
      publicKey: 'test-key',
    }),
  );
});
it('acknowledges only the exact task version locally and disposes sound when leaving the dashboard', async () => {
  const task = {
    id: 'proof-id',
    kind: 'payment',
    bookingId: 'test-booking',
    code: 'IRN-TEST',
    dueAt: at(60000),
    overdue: false,
    version: 'v1',
  };
  server.use(
    http.get(base + '/admin/tasks', () =>
      HttpResponse.json({ data: [task], total: 1, page: 1, limit: 20 }),
    ),
    http.get(base + '/admin/bookings', () => HttpResponse.json([])),
  );
  const view = mount('/admin');
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Perlu ditangani' });
  expect(clients.sound.enable).not.toHaveBeenCalled();
  await user.click(await screen.findByRole('button', { name: 'Saya tangani' }));
  expect(clients.sound.acknowledge).toHaveBeenCalledWith('payment:proof-id:v1');
  expect(
    screen.getByRole('button', { name: 'Sudah diakui di tab ini' }),
  ).toBeDisabled();
  view.unmount();
  expect(clients.sound.dispose).toHaveBeenCalled();
  expect(clients.sound.update).toHaveBeenLastCalledWith([]);
});
