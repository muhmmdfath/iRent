import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { Providers } from '@/app/providers';
import { AppRoutes } from '@/app/router';
import { server } from './server';
import { adminSession } from './admin-fixtures';
import { at, policy } from './customer-fixtures';
const base = 'http://localhost:3000/api';
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 15000 });
const account = {
  id: 'customer-id',
  name: 'Penyewa Uji',
  email: 'penyewa@example.test',
  phone: null,
  isActive: true,
  _count: { bookings: 3 },
  profile: { completedAt: at(-60000) },
};
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
beforeEach(() =>
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(adminSession)),
  ),
);
function mount(route: string) {
  render(
    <Providers>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
}
async function confirm(title: string) {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole('checkbox', { name: /sudah memeriksa data/ }),
  );
  await user.click(screen.getByRole('button', { name: 'Periksa ' + title }));
  await user.click(screen.getByRole('button', { name: 'Konfirmasi ' + title }));
}
it('searches customers on the server and keeps NIK out of the listing', async () => {
  let search = '';
  server.use(
    http.get(base + '/admin/customers', ({ request }) => {
      search = new URL(request.url).searchParams.get('search') || '';
      return HttpResponse.json({
        data: [account],
        total: 1,
        page: 1,
        limit: 20,
      });
    }),
  );
  mount('/admin/customers');
  await screen.findByRole('heading', { name: account.name });
  expect(
    screen.queryByRole('button', { name: 'Tampilkan NIK' }),
  ).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText('Cari nama, email atau telepon'),
    'penyewa@example.test',
  );
  await user.click(screen.getByRole('button', { name: 'Cari' }));
  await waitFor(() => expect(search).toBe('penyewa@example.test'));
});
it('masks the reset password review and links booking history using customer ID', async () => {
  let payload: unknown;
  server.use(
    http.get(base + '/admin/customers/customer-id', () =>
      HttpResponse.json({
        ...account,
        profile: {
          fullName: account.name,
          address: 'Semarang',
          phoneActive: '081200000001',
          phoneAlt: null,
          instagram: null,
          emailContact: null,
          nik: '0000000000000001',
          completedAt: at(-60000),
        },
      }),
    ),
    http.post(
      base + '/admin/customers/customer-id/password',
      async ({ request }) => {
        payload = await request.json();
        return new HttpResponse(null, { status: 204 });
      },
    ),
  );
  mount('/admin/customers/customer-id');
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: account.name });
  expect(
    screen.getByRole('link', { name: 'Riwayat booking penyewa' }),
  ).toHaveAttribute('href', '/admin/bookings?customerId=customer-id');
  expect(screen.queryByText(/NIK: 0000/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Tampilkan NIK' }));
  expect(screen.getByText('NIK: 0000000000000001')).toBeVisible();
  await user.click(
    screen.getByRole('button', { name: 'Ganti password pelanggan' }),
  );
  await user.type(
    screen.getByLabelText('Password baru'),
    'Secret test password 123!',
  );
  await user.click(
    screen.getByRole('checkbox', { name: /sudah memeriksa data/ }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Periksa ganti password pelanggan' }),
  );
  expect(
    screen.queryByText('Secret test password 123!'),
  ).not.toBeInTheDocument();
  expect(screen.getByText('Sudah diisi')).toBeVisible();
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi ganti password pelanggan' }),
  );
  await waitFor(() =>
    expect(payload).toEqual({ password: 'Secret test password 123!' }),
  );
});
it('sends zone activation as boolean and preserves a rupiah string beyond Number precision', async () => {
  let payload: unknown;
  server.use(
    http.get(base + '/admin/delivery-zones', () =>
      HttpResponse.json([
        { id: 'zone-id', name: 'Tembalang', fee: '20000', isActive: true },
      ]),
    ),
    http.put(base + '/admin/delivery-zones/zone-id', async ({ request }) => {
      payload = await request.json();
      return HttpResponse.json({});
    }),
  );
  mount('/admin/zones');
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Ubah Tembalang' }),
  );
  await user.clear(screen.getByLabelText('Tarif antar-jemput (rupiah)'));
  await user.type(
    screen.getByLabelText('Tarif antar-jemput (rupiah)'),
    '9007199254740993',
  );
  await user.selectOptions(screen.getByLabelText('Status zona'), 'false');
  await confirm('simpan zona');
  await waitFor(() =>
    expect(payload).toEqual({
      name: 'Tembalang',
      fee: '9007199254740993',
      isActive: false,
    }),
  );
});
it('patches only changed settings and converts numeric configuration without converting rupiah', async () => {
  let payload: unknown;
  server.use(
    http.get(base + '/admin/settings', () =>
      HttpResponse.json({
        revision: 'revision',
        values: {
          ...policy.values,
          confirmation_reminder_minutes: 30,
          pickup_escalation_minutes: 20,
          buffer_minutes: 60,
          extension_confirm_minutes: 60,
          extension_confirm_before_return_minutes: 30,
          qris_image_path: null,
        },
      }),
    ),
    http.patch(base + '/admin/settings', async ({ request }) => {
      payload = await request.json();
      return HttpResponse.json({});
    }),
  );
  mount('/admin/settings');
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Ubah pengaturan' }),
  );
  await user.clear(screen.getByLabelText('Batas bayar reguler (menit)'));
  await user.type(screen.getByLabelText('Batas bayar reguler (menit)'), '150');
  await user.clear(screen.getByLabelText('DP (rupiah)'));
  await user.type(screen.getByLabelText('DP (rupiah)'), '25000');
  await confirm('simpan pengaturan sewa');
  await waitFor(() =>
    expect(payload).toEqual({
      values: { hold_minutes: 150, dp_amount: '25000' },
    }),
  );
});
it('applies only complete date ranges and uses an exclusive WIB upper bound', async () => {
  let reads = 0;
  let params: URLSearchParams;
  server.use(
    http.get(base + '/admin/calendar', ({ request }) => {
      reads++;
      params = new URL(request.url).searchParams;
      return HttpResponse.json({ data: [], total: 0, page: 1, limit: 10 });
    }),
    http.get(base + '/admin/items', () =>
      HttpResponse.json({ data: [], total: 0, page: 1, limit: 10 }),
    ),
  );
  mount('/admin/calendar');
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Jadwal per unit' });
  await waitFor(() => expect(reads).toBe(1));
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const label = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(today + 'T00:00:00Z'));
  await user.click(screen.getByLabelText('Pilih rentang tanggal jadwal'));
  await user.click(screen.getByRole('button', { name: label }));
  expect(reads).toBe(1);
  await user.click(screen.getByRole('button', { name: label }));
  await waitFor(() => expect(reads).toBe(2));
  expect(params!.get('startAt')).toBe(today + 'T00:00:00+07:00');
  expect(
    new Date(params!.get('endAt')!).getTime() -
      new Date(params!.get('startAt')!).getTime(),
  ).toBe(86400000);
  expect(params!.get('limit')).toBe('10');
});
