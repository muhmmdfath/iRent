import { test, expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { Financial, Booking } from '@/customer/types';
const proofFile = {
  name: 'bukti-fixture.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=',
    'base64',
  ),
};
test('real API: administrator rejects proof, verifies partial DP and records settlement through the UI', async ({
  page,
  playwright,
  baseURL,
}) => {
  test.skip(
    process.env.IRENT_REAL_API !== '1' ||
      !process.env.IRENT_ADMIN_TEST_EMAIL ||
      !process.env.IRENT_ADMIN_TEST_PASSWORD,
    'Requires a disposable PostgreSQL backend and explicit test administrator credentials.',
  );
  test.setTimeout(120_000);
  const admin = await playwright.request.newContext({ baseURL });
  const customer = await playwright.request.newContext({ baseURL });
  const adminLogin = await admin.post('/api/auth/login', {
    headers: { Origin: baseURL! },
    data: {
      identity: process.env.IRENT_ADMIN_TEST_EMAIL,
      password: process.env.IRENT_ADMIN_TEST_PASSWORD,
    },
  });
  expect(adminLogin.status()).toBe(200);
  const adminCsrf = (await adminLogin.json()).csrfToken as string;
  const identity = `admin-flow-${randomUUID()}@example.test`;
  const registration = await customer.post('/api/auth/register', {
    headers: { Origin: baseURL! },
    data: {
      name: 'Penyewa Pengujian Admin',
      email: identity,
      password: 'fixture-' + randomUUID(),
    },
  });
  expect(registration.status()).toBe(201);
  const customerCsrf = (await registration.json()).csrfToken as string;
  const customerHeaders = { Origin: baseURL!, 'X-CSRF-Token': customerCsrf };
  const adminHeaders = { Origin: baseURL!, 'X-CSRF-Token': adminCsrf };
  async function post(
    context: APIRequestContext,
    route: string,
    csrf: string,
    data: unknown,
  ) {
    const response = await context.post('/api' + route, {
      headers: {
        Origin: baseURL!,
        'X-CSRF-Token': csrf,
        'Idempotency-Key': randomUUID(),
      },
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  const profile = await customer.put('/api/customer/profile', {
    headers: customerHeaders,
    data: {
      fullName: 'Penyewa Pengujian Admin',
      address: 'Alamat fixture untuk database pengujian',
      phoneActive: '081299999999',
      nik: '0000000000000000',
    },
  });
  expect(profile.ok()).toBe(true);
  const item = await post(admin, '/admin/items', adminCsrf, {
    category: 'iphone',
    name: 'iPhone Fixture Admin ' + randomUUID(),
    includes: ['Unit fixture'],
    price6h: '60000',
    price12h: '100000',
    price24h: '150000',
  });
  await post(admin, `/admin/items/${item.id}/units`, adminCsrf, {
    codes: ['ADM-' + randomUUID()],
  });
  async function booking(days: number): Promise<Booking> {
    const date = new Date(Date.now() + 7 * 3600000 + days * 86400000)
      .toISOString()
      .slice(0, 10);
    return post(customer, '/bookings', customerCsrf, {
      startAt: date + 'T10:00:00+07:00',
      durationHours: 6,
      items: [{ itemId: item.id, quantity: 1 }],
      deliveryType: 'pickup',
      payOption: 'dp',
      termsVersion: 'irent-phase1-v1',
      agreeTerms: true,
      prepareIdentity: true,
      understandPayment: true,
      agreeOperatingHours: true,
    });
  }
  async function upload(value: Booking, amount: string) {
    const response = await customer.get(`/api/bookings/${value.id}/payments`);
    const money: Financial = await response.json();
    const obligation = money.booking.obligations.find(
      (value) => value.purpose === 'initial_dp',
    )!;
    const proof = await customer.post(
      `/api/bookings/${value.id}/obligations/${obligation.id}/proofs`,
      {
        headers: { ...customerHeaders, 'Idempotency-Key': randomUUID() },
        multipart: { file: proofFile, claimedAmount: amount },
      },
    );
    expect(proof.ok(), await proof.text()).toBe(true);
  }
  const value = await booking(1);
  await upload(value, '20000');
  await page.goto('/login');
  await page
    .getByLabel('Email atau nomor HP')
    .fill(process.env.IRENT_ADMIN_TEST_EMAIL!);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.IRENT_ADMIN_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Ringkasan operasional' }),
  ).toBeVisible();
  await page.goto('/admin/bookings?search=' + encodeURIComponent(value.code));
  await expect(
    page.getByText('Penyewa Pengujian Admin', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Buka booking' }).click();
  await page.getByRole('button', { name: 'Lihat bukti', exact: true }).click();
  await expect(page.getByAltText('Bukti pembayaran pelanggan')).toBeVisible();
  async function verify(amount: string) {
    await page
      .getByRole('button', { name: 'Verifikasi uang masuk', exact: true })
      .click();
    await page.getByLabel('Nominal uang masuk (rupiah)').fill(amount);
    await page.getByRole('checkbox', { name: /memastikan uang/ }).check();
    await page.getByRole('button', { name: 'Periksa pencatatan' }).click();
    await page.getByRole('button', { name: 'Konfirmasi pencatatan' }).click();
    await expect(page.getByRole('status')).toHaveText(/Pembayaran dicatat/);
  }
  await verify('10000');
  let money: Financial = await (
    await customer.get(`/api/bookings/${value.id}/payments`)
  ).json();
  expect(money.booking.status).toBe('menunggu_pembayaran');
  expect(money.summary.received).toBe('10000');
  expect(money.summary.reserved).toBe('10000');
  await upload(value, '10000');
  await page.reload();
  await verify('10000');
  money = await (
    await customer.get(`/api/bookings/${value.id}/payments`)
  ).json();
  expect(money.booking.status).toBe('dikonfirmasi');
  expect(money.summary.remaining).toBe('40000');
  await page.getByRole('button', { name: 'Catat pelunasan' }).click();
  await page.getByRole('checkbox', { name: /memastikan uang/ }).check();
  await page.getByRole('button', { name: 'Periksa pencatatan' }).click();
  await page.getByRole('button', { name: 'Konfirmasi pencatatan' }).click();
  await expect(page.getByRole('status')).toHaveText(/Tagihan sudah lunas/);
  money = await (
    await customer.get(`/api/bookings/${value.id}/payments`)
  ).json();
  expect(money.summary.paymentStatus).toBe('lunas');
  expect(money.summary.received).toBe('60000');
  expect(money.summary.remaining).toBe('0');
  const rejection = await booking(2);
  await upload(rejection, '20000');
  await page.goto('/admin/bookings/' + rejection.id);
  await page.getByRole('button', { name: 'Tolak bukti', exact: true }).click();
  await page
    .getByLabel('Alasan penolakan')
    .fill('Bukti fixture tidak dapat diverifikasi.');
  await page.getByRole('button', { name: 'Periksa penolakan' }).click();
  await page
    .getByRole('button', { name: 'Konfirmasi penolakan bukti' })
    .click();
  await expect(page.getByRole('status')).toHaveText(/Bukti ditolak/);
  const rejected: Financial = await (
    await customer.get(`/api/bookings/${rejection.id}/payments`)
  ).json();
  expect(rejected.booking.status).toBe('menunggu_pembayaran');
  expect(rejected.booking.obligations[0].proofs?.[0].rejectedReason).toBe(
    'Bukti fixture tidak dapat diverifikasi.',
  );
  expect((await customer.get('/api/admin/bookings')).status()).toBe(403);
  await admin.post('/api/auth/logout', { headers: adminHeaders, data: {} });
  await customer.post('/api/auth/logout', {
    headers: customerHeaders,
    data: {},
  });
  await admin.dispose();
  await customer.dispose();
});
