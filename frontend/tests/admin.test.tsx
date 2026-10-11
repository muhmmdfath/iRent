import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import {
  render,
  screen,
  waitFor,
  within,
  configure,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { AppRoutes } from '@/app/router';
import { Providers } from '@/app/providers';
import { server } from './server';
import { adminSession, adminBooking, pendingFinancial } from './admin-fixtures';
import { financial, customerSession } from './customer-fixtures';
const base = 'http://localhost:3000/api';
// Admin routes load separate chunks; wait for user-visible states rather than a
// one-second cold module/network budget on Windows.
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 15000 });
beforeAll(async () => {
  await Promise.all([
    import('@/admin/pages/bookings-page'),
    import('@/admin/pages/booking-detail-page'),
    import('@/admin/pages/dashboard-page'),
  ]);
});
beforeEach(() =>
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(adminSession)),
    http.get(base + '/bookings/test-booking', () =>
      HttpResponse.json(adminBooking),
    ),
    http.get(base + '/bookings/test-booking/payments', () =>
      HttpResponse.json(pendingFinancial()),
    ),
    http.get(base + '/admin/bookings', () => HttpResponse.json([adminBooking])),
  ),
);
function mount(route = '/admin/bookings/test-booking') {
  render(
    <Providers>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
}
async function fillReceipt(amount = '20000') {
  const user = userEvent.setup();
  const input = await screen.findByLabelText('Nominal uang masuk (rupiah)');
  await user.clear(input);
  await user.type(input, amount);
  await user.selectOptions(screen.getByLabelText('Metode pembayaran'), 'cash');
  await user.type(
    screen.getByLabelText('Catatan pemeriksaan'),
    'Penerimaan uang sudah diperiksa.',
  );
  await user.click(screen.getByRole('checkbox', { name: /memastikan uang/ }));
  await user.click(screen.getByRole('button', { name: 'Periksa pencatatan' }));
  return user;
}
it('searches and filters bookings on the server and shows safe customer details', async () => {
  let parameters = '';
  server.use(
    http.get(base + '/admin/bookings', ({ request }) => {
      parameters = new URL(request.url).search;
      return HttpResponse.json([adminBooking]);
    }),
  );
  mount('/admin/bookings');
  expect(await screen.findByText('Penyewa Uji')).toBeVisible();
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText('Kode booking atau nama penyewa'),
    'Penyewa',
  );
  await user.click(screen.getByRole('button', { name: 'Cari' }));
  await waitFor(() => expect(parameters).toContain('search=Penyewa'));
  await user.selectOptions(
    screen.getByLabelText('Status booking'),
    'menunggu_konfirmasi',
  );
  await waitFor(() =>
    expect(parameters).toContain('status=menunggu_konfirmasi'),
  );
  await user.click(screen.getByRole('link', { name: 'Buka booking' }));
  expect(
    await screen.findByRole('heading', { name: 'Detail booking' }),
  ).toBeVisible();
  expect(screen.getByText('penyewa@example.test')).toBeVisible();
});
it('requires receipt confirmation and keeps an underpaid booking unconfirmed', async () => {
  let requests = 0;
  let payload: unknown;
  let csrf: string | null = null;
  let value = pendingFinancial();
  server.use(
    http.get(base + '/bookings/test-booking/payments', () =>
      HttpResponse.json(value),
    ),
    http.post(
      base + '/admin/bookings/test-booking/payments/verify',
      async ({ request }) => {
        requests++;
        payload = await request.json();
        csrf = request.headers.get('X-CSRF-Token');
        value = pendingFinancial();
        value.booking.status = 'menunggu_pembayaran';
        value.booking.obligations[0].status = 'open';
        value.booking.obligations[0].pendingProofId = null;
        value.booking.obligations[0].proofs![0].status = 'verified';
        value.summary.received = '10000';
        value.summary.reserved = '10000';
        value.summary.remaining = '60000';
        return HttpResponse.json(value);
      },
    ),
  );
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Verifikasi uang masuk',
    }),
  );
  await fillReceipt('10000');
  expect(requests).toBe(0);
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi pencatatan' }),
  );
  expect(await screen.findByRole('status')).toHaveTextContent('Sisa tagihan');
  expect(csrf).toBe('admin-csrf');
  expect(payload).toMatchObject({
    amount: '10000',
    proofId: 'pending-proof',
    method: 'cash',
  });
  expect(payload).not.toHaveProperty('receivingAccountReference');
  expect(
    screen.queryByRole('button', { name: 'Catat pelunasan' }),
  ).not.toBeInTheDocument();
  expect(requests).toBe(1);
});
it('reuses the same idempotency key after an uncertain response without automatic retries', async () => {
  const keys: (string | null)[] = [];
  server.use(
    http.post(
      base + '/admin/bookings/test-booking/payments/verify',
      ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        return HttpResponse.json({ message: 'Unavailable' }, { status: 503 });
      },
    ),
  );
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Verifikasi uang masuk',
    }),
  );
  await fillReceipt();
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi pencatatan' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Layanan sedang bermasalah',
  );
  expect(keys).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Coba simpan lagi' }));
  await waitFor(() => expect(keys).toHaveLength(2));
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});
it('rejects a proof with a reason without invoking booking cancellation', async () => {
  let reason: unknown;
  server.use(
    http.post(
      base + '/admin/bookings/test-booking/proofs/pending-proof/reject',
      async ({ request }) => {
        reason = await request.json();
        return HttpResponse.json(pendingFinancial());
      },
    ),
  );
  mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Tolak bukti' }));
  await user.type(
    screen.getByLabelText('Alasan penolakan'),
    'Nominal tidak terlihat jelas.',
  );
  await user.click(screen.getByRole('button', { name: 'Periksa penolakan' }));
  expect(reason).toBeUndefined();
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi penolakan bukti' }),
  );
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Booking tidak dibatalkan',
  );
  expect(reason).toEqual({ reason: 'Nominal tidak terlihat jelas.' });
});
it('requires transfer reference and actual receipt acknowledgement before review', async () => {
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Verifikasi uang masuk',
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Periksa pencatatan' }));
  expect(await screen.findByText('Isi rekening penerima.')).toBeVisible();
  expect(screen.getByText('Isi referensi transaksi.')).toBeVisible();
  expect(
    screen.getByText('Periksa uang masuk sebelum melanjutkan.'),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Konfirmasi pencatatan' }),
  ).not.toBeInTheDocument();
});
it('preserves rupiah beyond Number precision when recording a cash settlement', async () => {
  const value = financial();
  value.booking.status = 'dikonfirmasi';
  value.summary.remaining = '9007199254740993';
  let payload: unknown;
  server.use(
    http.get(base + '/bookings/test-booking/payments', () =>
      HttpResponse.json(value),
    ),
    http.post(
      base + '/admin/bookings/test-booking/settlement',
      async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json({
          ...value,
          summary: { ...value.summary, remaining: '0', paymentStatus: 'lunas' },
        });
      },
    ),
  );
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Catat pelunasan' }),
  );
  await fillReceipt('9007199254740993');
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi pencatatan' }),
  );
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Tagihan sudah lunas',
  );
  expect(payload).toMatchObject({ amount: '9007199254740993', method: 'cash' });
});
it('blocks settlement entry while a customer settlement proof is pending', async () => {
  const value = pendingFinancial();
  value.booking.status = 'dikonfirmasi';
  value.booking.obligations[0].purpose = 'settlement';
  server.use(
    http.get(base + '/bookings/test-booking/payments', () =>
      HttpResponse.json(value),
    ),
  );
  mount();
  expect(
    await screen.findByText(
      'Periksa bukti pelunasan yang masih menunggu sebelum mencatat penerimaan lain.',
    ),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Catat pelunasan' }),
  ).not.toBeInTheDocument();
});
it('does not expose administrator payment actions to a customer', async () => {
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(customerSession)),
  );
  mount();
  expect(
    await screen.findByRole('heading', { name: /Selamat datang/ }),
  ).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Detail booking' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Verifikasi uang masuk' }),
  ).not.toBeInTheDocument();
});
it('shows the payment queue from current backend tasks', async () => {
  server.use(
    http.get(base + '/admin/tasks', () =>
      HttpResponse.json({
        data: [
          {
            id: 'proof-task',
            bookingId: adminBooking.id,
            code: adminBooking.code,
            dueAt: adminBooking.confirmationDueAt,
            overdue: true,
          },
        ],
        total: 1,
        asOf: adminBooking.initialStartAt,
      }),
    ),
  );
  mount('/admin/');
  const queue = await screen.findByRole('region', {
    name: 'Periksa bukti pembayaran',
  });
  expect(
    await within(queue).findByText(/Melewati batas konfirmasi/),
  ).toBeVisible();
  expect(
    within(queue).getByRole('link', { name: 'Periksa pembayaran' }),
  ).toHaveAttribute('href', '/admin/bookings/test-booking');
});
