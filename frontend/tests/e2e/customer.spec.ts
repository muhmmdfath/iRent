import { test, expect } from '@playwright/test';
import { item, financial, policy, customerSession } from '../customer-fixtures';
for (const width of [360, 390, 768, 1024, 1440]) {
  test(`customer catalog and payment fit ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/session', (r) =>
      r.fulfill({ json: customerSession }),
    );
    await page.route('**/api/items?**', (r) =>
      r.fulfill({ json: { data: [item], total: 1, page: 1 } }),
    );
    await page.route('**/api/bookings/test-booking/payments', (r) =>
      r.fulfill({ json: financial() }),
    );
    await page.route('**/api/payment-options', (r) =>
      r.fulfill({ json: { qrisImagePath: null } }),
    );
    await page.route('**/api/items/test-item', (r) =>
      r.fulfill({ json: item }),
    );
    await page.route('**/api/customer/profile', (r) =>
      r.fulfill({
        json: {
          fullName: 'Penyewa Lengkap',
          address: 'Alamat fixture',
          phoneActive: '+6281234567890',
          completedAt: '2026-10-09T10:00:00+07:00',
        },
      }),
    );
    await page.route('**/api/rental-policy', (r) =>
      r.fulfill({ json: policy }),
    );
    await page.route('**/api/delivery-zones', (r) => r.fulfill({ json: [] }));
    await page.goto('/catalog');
    await expect(page.getByRole('heading', { name: item.name })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`catalog-${width}.png`),
      fullPage: true,
    });
    await page.goto('/app/new?itemId=test-item');
    await expect(
      page.getByRole('heading', { name: 'Atur jadwal sewamu.' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`booking-${width}.png`),
      fullPage: true,
    });
    await page.goto('/app/bookings/test-booking/payment');
    await expect(page.getByLabel('Bukti pembayaran')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`payment-${width}.png`),
      fullPage: true,
    });
  });
}
test('real API: customer registers, completes profile, books and uploads without waiting for admin', async ({
  page,
}) => {
  test.skip(
    process.env.IRENT_REAL_API !== '1',
    'Disposable database required.',
  );
  const identity = 'customer-' + crypto.randomUUID() + '@example.test';
  await page.goto('/register');
  await page.getByLabel('Nama', { exact: true }).fill('Penyewa Browser');
  await page.getByLabel('Email', { exact: true }).fill(identity);
  await page
    .getByLabel('Password', { exact: true })
    .fill('browser-test-password');
  await page.getByRole('button', { name: 'Buat akun' }).click();
  await expect(
    page.getByRole('heading', { name: 'Selamat datang, Penyewa Browser.' }),
  ).toBeVisible();
  await page.goto('/app/profile');
  await page.getByLabel('Nama lengkap').fill('Penyewa Browser');
  await page
    .getByLabel('Alamat', { exact: true })
    .fill('Alamat fixture Semarang');
  await page.getByLabel('Nomor HP aktif').fill('081234567890');
  await page.getByLabel('NIK', { exact: true }).fill('0000000000000001');
  await page.getByRole('button', { name: 'Simpan profil' }).click();
  await expect(page.getByRole('status')).toContainText('Profil tersimpan');
  await page.goto('/catalog');
  await page.getByRole('link', { name: 'Lihat perangkat' }).first().click();
  await page.getByRole('link', { name: /Pilih jadwal/ }).click();
  await page.getByRole('button', { name: 'Periksa jadwal & biaya' }).click();
  await expect(page.getByText('Jadwal tersedia saat diperiksa')).toBeVisible();
  for (const label of [
    /Saya menyetujui ketentuan/,
    /Saya menyiapkan KTP/,
    /Saya memahami pembayaran/,
    /Saya menyetujui jam/,
  ])
    await page.getByLabel(label).check();
  await page.getByRole('button', { name: 'Buat booking', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Pembayaran booking' }),
  ).toBeVisible();
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=',
    'base64',
  );
  await page.getByLabel('Bukti pembayaran', { exact: true }).setInputFiles({
    name: 'bukti-uji.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await page
    .getByRole('button', { name: 'Upload bukti pembayaran', exact: true })
    .click();
  await expect(page.getByText(/Bukti sudah diterima/)).toBeVisible();
  await expect(
    page.getByText('Pembayaran telah lunas dan terverifikasi.'),
  ).toHaveCount(0);
  const session = await (await page.request.get('/api/auth/session')).json();
  expect(session.user.email).toBe(identity);
  const bookingId = page.url().split('/bookings/')[1].split('/')[0];
  const response = await page.request.get(
    '/api/bookings/' + bookingId + '/payments',
  );
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.booking.status).toBe('menunggu_konfirmasi');
  expect(data.summary.applied).toBe('0');
  expect(data.booking.obligations[0].proofs).toHaveLength(1);
  await page.reload();
  await expect(page.getByText(/Bukti sudah diterima/)).toBeVisible();
});
