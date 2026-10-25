import { beforeEach, expect, it, vi } from 'vitest';
import {
  render,
  screen,
  waitFor,
  configure,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { Providers } from '@/app/providers';
import { AppRoutes } from '@/app/router';
import { server } from './server';
import { customerSession } from './customer-fixtures';
import { adminSession } from './admin-fixtures';
import { extensionFixture } from './extensions-fixtures';
const base = 'http://localhost:3000/api';
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 15000 });
let fixture: ReturnType<typeof extensionFixture>;
beforeEach(() => {
  fixture = extensionFixture();
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(customerSession)),
    http.get(base + '/bookings/test-booking/payments', () =>
      HttpResponse.json(fixture.money),
    ),
    http.get(base + '/bookings/test-booking/extensions/test-extension', () =>
      HttpResponse.json(fixture.detail),
    ),
  );
});
function mount(route = '/app/bookings/test-booking/extensions/test-extension') {
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
  return user;
}
it('uses the extension obligation balance rather than the parent booking balance for an upload', async () => {
  let payload = '';
  server.use(
    http.post(
      base + '/bookings/test-booking/extensions/test-extension/proofs',
      async ({ request }) => {
        payload = await request.text();
        return HttpResponse.json(fixture.money);
      },
    ),
  );
  mount();
  await screen.findByRole('heading', { name: 'Detail perpanjangan' });
  const user = userEvent.setup();
  await user.click(
    screen.getByRole('button', { name: 'Upload bukti perpanjangan' }),
  );
  expect(screen.getByLabelText('Nominal pada bukti (rupiah)')).toHaveValue(
    '55000',
  );
  await user.upload(
    screen.getByLabelText('Bukti privat'),
    new File(['demo'], 'simulasi.png', { type: 'image/png' }),
  );
  await confirm('upload bukti perpanjangan');
  await waitFor(() => expect(payload).toContain('55000'));
  expect(payload).toContain('name="file"');
  expect(payload).toContain('Content-Type: image/png');
});
it('requires explicit consent to the exact delivery quotation before submitting', async () => {
  fixture.detail.extension.status = 'draft_quote';
  let payload: unknown;
  server.use(
    http.post(
      base + '/bookings/test-booking/extensions/test-extension/submit',
      async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json(fixture.money);
      },
    ),
  );
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Setujui ongkir & lanjut bayar',
    }),
  );
  expect(payload).toBeUndefined();
  await confirm('setujui ongkir perpanjangan');
  await waitFor(() =>
    expect(payload).toEqual({
      agreeExtraDelivery: true,
      expectedExtraDeliveryQuote: '15000',
    }),
  );
});
it('does not permit another proof while the previous proof is pending or the deadline has passed', async () => {
  fixture.detail.extension.expiresAt = new Date(
    Date.now() - 60000,
  ).toISOString();
  mount();
  await screen.findByRole('heading', { name: 'Detail perpanjangan' });
  expect(
    screen.queryByRole('button', { name: 'Upload bukti perpanjangan' }),
  ).not.toBeInTheDocument();
});
it('selects extension duration independently per unit and submits numeric hours', async () => {
  fixture.money.booking.extensions = [];
  let payload: unknown;
  server.use(
    http.post(
      base + '/bookings/test-booking/extensions',
      async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json({
          ...fixture.money,
          decision: 'test-extension',
        });
      },
    ),
  );
  mount('/app/bookings/test-booking/extensions/new');
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Perpanjang sewa' });
  const form = screen.getByRole('region', { name: 'Ajukan perpanjangan' });
  const selects = within(form).getAllByRole('combobox');
  await user.selectOptions(selects[1], '12');
  await confirm('ajukan perpanjangan');
  await waitFor(() =>
    expect(payload).toEqual({
      items: [{ bookingItemId: 'second-booking-item', addedHours: 12 }],
    }),
  );
});
it('records verified money with a stable key after an uncertain response and never approves locally', async () => {
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(adminSession)),
  );
  const obligation = fixture.money.booking.obligations[0];
  obligation.pendingProofId = 'pending-proof';
  obligation.proofs = [
    {
      id: 'pending-proof',
      mime: 'image/png',
      size: 10,
      claimedAmount: '55000',
      uploadedAt: new Date().toISOString(),
      status: 'pending',
      rejectedReason: null,
    },
  ];
  const keys: (string | null)[] = [];
  let body: unknown;
  server.use(
    http.post(
      base +
        '/admin/bookings/test-booking/extensions/test-extension/payments/verify',
      async ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        body = await request.json();
        return HttpResponse.json(
          { message: 'Layanan sedang bermasalah' },
          { status: 503 },
        );
      },
    ),
  );
  mount('/admin/bookings/test-booking/extensions/test-extension');
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Verifikasi uang perpanjangan' }),
  );
  await user.selectOptions(screen.getByLabelText('Metode pembayaran'), 'cash');
  await confirm('verifikasi uang perpanjangan');
  await within(screen.getByRole('main')).findByRole('alert');
  await user.click(
    screen.getByRole('button', {
      name: 'Konfirmasi verifikasi uang perpanjangan',
    }),
  );
  await waitFor(() => expect(keys).toHaveLength(2));
  expect(keys[0]).toBe(keys[1]);
  expect(body).toMatchObject({
    amount: '55000',
    method: 'cash',
    proofId: 'pending-proof',
  });
  expect(
    screen.queryByRole('button', { name: 'Setujui seluruh unit' }),
  ).not.toBeInTheDocument();
});
it('an approved extension settlement carries its extension ID rather than reducing initial scope', async () => {
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(adminSession)),
  );
  fixture.detail.extension.status = 'disetujui';
  fixture.detail.summary.remaining = '12345';
  let payload: unknown;
  server.use(
    http.post(
      base + '/admin/bookings/test-booking/settlement',
      async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json(fixture.money);
      },
    ),
  );
  mount('/admin/bookings/test-booking/extensions/test-extension');
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Catat pelunasan perpanjangan' }),
  );
  await user.selectOptions(screen.getByLabelText('Metode pembayaran'), 'cash');
  await confirm('catat pelunasan perpanjangan');
  await waitFor(() =>
    expect(payload).toMatchObject({
      extensionId: 'test-extension',
      amount: '12345',
    }),
  );
});
