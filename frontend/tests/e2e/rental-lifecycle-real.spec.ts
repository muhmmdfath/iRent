import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
interface Control {
  adminEmail: string;
  adminPassword: string;
  clockFile: string;
  itemId: string;
  unitId: string;
}
test('real rental lifecycle: registration, DP, settlement, handover, verified return and preparation', async ({
  page,
  browser,
  baseURL,
}, info) => {
  test.skip(
    !process.env.IRENT_QA_CONTROL,
    'Requires an isolated QA backend with a test-only clock.',
  );
  test.setTimeout(180_000);
  const cfg: Control = JSON.parse(
    readFileSync(process.env.IRENT_QA_CONTROL!, 'utf8'),
  );
  const day = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const instant = (hour: number) =>
    `${day}T${String(hour).padStart(2, '0')}:00:00+07:00`;
  const adminContext = await browser.newContext({ baseURL });
  const admin = await adminContext.newPage();
  async function clock(hour: number) {
    const value = instant(hour);
    await page.clock.setFixedTime(new Date(value));
    await admin.clock.setFixedTime(new Date(value));
    writeFileSync(cfg.clockFile + '.tmp', JSON.stringify({ instant: value }));
    renameSync(cfg.clockFile + '.tmp', cfg.clockFile);
    await page.clock.setFixedTime(new Date(value));
    await admin.clock.setFixedTime(new Date(value));
  }
  await clock(6);
  const email = 'rental-' + randomUUID() + '@example.test';
  await test.step('Register and complete the mandatory tenant profile', async () => {
    await page.goto('/register');
    await page.getByLabel('Nama', { exact: true }).fill('Penyewa Simulasi QA');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page
      .getByLabel('Password', { exact: true })
      .fill('qa-password-' + randomUUID());
    await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/?$/);
    await page.goto('/app/profile');
    await page.getByLabel('Nama lengkap').fill('Penyewa Simulasi QA');
    await page
      .getByLabel('Alamat', { exact: true })
      .fill('Alamat simulasi Semarang');
    await page.getByLabel('Nomor HP aktif').fill('081234567890');
    await page.getByLabel('NIK', { exact: true }).fill('0000000000000001');
    await page.getByRole('button', { name: 'Simpan profil' }).click();
    await expect(
      page.getByText('Profil tersimpan. Kamu bisa melanjutkan booking.'),
    ).toBeVisible();
  });
  let id = '';
  await test.step('Create a six-hour booking and upload the DP immediately', async () => {
    await page.goto(
      '/app/new?itemId=' +
        cfg.itemId +
        '&startAt=' +
        encodeURIComponent(instant(10)),
    );
    await page
      .getByRole('button', { name: 'Tanggal dan jam pengambilan (WIB)' })
      .click();
    await page
      .getByRole('button', {
        name: new Intl.DateTimeFormat('id-ID', {
          dateStyle: 'long',
          timeZone: 'UTC',
        }).format(new Date(day + 'T00:00:00Z')),
        exact: true,
      })
      .click();
    await page.getByLabel('Jam', { exact: true }).selectOption('10');
    await page.getByLabel('Menit', { exact: true }).selectOption('00');
    await page.getByRole('button', { name: 'Selesai', exact: true }).click();
    await page
      .getByRole('button', { name: 'Periksa jadwal & biaya', exact: true })
      .click();
    await expect(
      page.getByText('Jadwal tersedia saat diperiksa'),
    ).toBeVisible();
    await page
      .getByRole('checkbox', { name: /Saya setuju ketentuan sewa/ })
      .check();
    await page
      .getByRole('button', { name: 'Buat booking', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Pembayaran booking' }),
    ).toBeVisible();
    id = page.url().split('/bookings/')[1].split('/')[0];
    await page.getByLabel('Bukti pembayaran', { exact: true }).setInputFiles({
      name: 'bukti-SIMULASI.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(
        '%PDF-1.4\n% SIMULASI QA BUKAN TRANSFER BANK\n1 0 obj\n<<>>\nendobj\n%%EOF',
      ),
    });
    await page
      .getByRole('button', { name: 'Upload bukti pembayaran', exact: true })
      .click();
    await expect(page.getByText(/Bukti terkirim/)).toBeVisible();
  });
  const money = async () => {
    const r = await page.request.get('/api/bookings/' + id + '/payments');
    expect(r.status()).toBe(200);
    return r.json();
  };
  let data = await money();
  expect(data.booking.status).toBe('menunggu_konfirmasi');
  expect(data.summary.received).toBe('0');
  expect(data.summary.applied).toBe('0');
  await test.step('Admin verifies actual DP and collects the remaining rental fee', async () => {
    await admin.goto('/login');
    await admin.getByLabel('Email atau nomor HP').fill(cfg.adminEmail);
    await admin.getByLabel('Password', { exact: true }).fill(cfg.adminPassword);
    await admin.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(admin).toHaveURL(/\/admin\/?$/);
    await admin.goto('/admin/bookings/' + id);
    async function receipt(button: string) {
      await admin.getByRole('button', { name: button, exact: true }).click();
      await admin.getByLabel('Metode pembayaran').selectOption('cash');
      await admin.getByRole('checkbox', { name: /memastikan uang/ }).check();
      await admin.getByRole('button', { name: 'Periksa pencatatan' }).click();
      await admin
        .getByRole('button', { name: 'Konfirmasi pencatatan' })
        .click();
      await expect(
        admin.getByRole('status').filter({ hasText: 'Pembayaran dicatat' }),
      ).toHaveText(/dicatat|lunas/);
    }
    await receipt('Verifikasi uang masuk');
    data = await money();
    expect(data.booking.status).toBe('dikonfirmasi');
    expect(data.summary.received).toBe('20000');
    expect(data.summary.remaining).toBe('40000');
    await receipt('Catat pelunasan');
    data = await money();
    expect(data.summary.received).toBe('60000');
    expect(data.summary.remaining).toBe('0');
    expect(data.summary.paymentStatus).toBe('lunas');
  });
  async function operation(button: string, note: string) {
    await admin.getByRole('button', { name: button, exact: true }).click();
    if (button !== 'Catat serah-terima')
      await admin.getByLabel('Catatan kondisi', { exact: true }).fill(note);
    await admin
      .getByRole('checkbox', { name: /sudah memeriksa barang/ })
      .check();
    await admin.getByRole('button', { name: 'Periksa tindakan' }).click();
    await admin.getByRole('button', { name: 'Konfirmasi tindakan' }).click();
    await expect(
      admin.getByRole('status').filter({
        hasText: /Serah-terima tercatat|Pengembalian unit diverifikasi/,
      }),
    ).toHaveText(/tercatat|diverifikasi/);
  }
  await test.step('Handover at the agreed pickup time', async () => {
    await clock(10);
    await admin.reload();
    await operation(
      'Catat serah-terima',
      'Unit SIMULASI lengkap dan layak diserahkan.',
    );
    data = await money();
    expect(data.booking.status).toBe('berjalan');
    expect(data.booking.items[0].useStatus).toBe('in_use');
  });
  await test.step('Customer return report does not release stock before admin verification', async () => {
    await clock(16);
    await page.goto('/app/bookings/' + id);
    await page
      .getByRole('button', { name: 'Sudah mengembalikan QA-IPHONE-1' })
      .click();
    await page.getByRole('checkbox', { name: /sudah memeriksa data/ }).check();
    await page
      .getByRole('button', { name: 'Periksa laporkan pengembalian unit' })
      .click();
    await page
      .getByRole('button', { name: 'Konfirmasi laporkan pengembalian unit' })
      .click();
    await expect(
      page.getByText('Laporan menunggu pemeriksaan admin'),
    ).toBeVisible();
    data = await money();
    expect(data.booking.status).toBe('berjalan');
    expect(data.booking.items[0].useStatus).toBe('return_pending');
    await admin.reload();
    await operation(
      'Verifikasi pengembalian QA-IPHONE-1',
      'Unit SIMULASI kembali lengkap tanpa kerusakan.',
    );
    data = await money();
    expect(data.booking.status).toBe('selesai');
    expect(data.booking.items[0].returnRecord.status).toBe('verified');
    expect(data.booking.items[0].returnRecord.lateFee).toBe('0');
    expect(data.summary.remaining).toBe('0');
  });
  await test.step('Preparation requires one hour and explicit admin completion', async () => {
    const response = await admin.request.get('/api/auth/session');
    const session = await response.json();
    const headers = { Origin: baseURL!, 'X-CSRF-Token': session.csrfToken };
    const route = '/api/admin/units/' + cfg.unitId + '/preparation/complete';
    const early = await admin.request.post(route, { headers, data: {} });
    expect(early.status()).toBe(409);
    await clock(17);
    await admin.goto('/admin/inventory/' + cfg.itemId);
    await admin
      .getByRole('button', {
        name: 'Selesaikan persiapan QA-IPHONE-1',
        exact: true,
      })
      .click();
    await admin
      .getByRole('checkbox', { name: /sudah memeriksa kondisi fisik/ })
      .check();
    await admin
      .getByRole('button', { name: 'Konfirmasi perubahan', exact: true })
      .click();
    await expect(
      admin.getByText('Siap secara fisik', { exact: true }),
    ).toBeVisible();
    const units = await admin.request.get(
      '/api/admin/items/' + cfg.itemId + '/units',
    );
    const result = await units.json();
    expect(
      result.data.find((u: { id: string }) => u.id === cfg.unitId)
        .physicalStatus,
    ).toBe('ready');
  });
  await page.reload();
  await expect(
    page.getByText('Selesai', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Pengembalian sudah diverifikasi', { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await admin.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath('customer-completed.png'),
    fullPage: true,
  });
  await admin.screenshot({
    path: info.outputPath('admin-completed.png'),
    fullPage: true,
  });
  await info.attach('rental-summary', {
    body: JSON.stringify({
      bookingId: id,
      status: data.booking.status,
      total: data.summary.received,
      remaining: data.summary.remaining,
      steps:
        'register-profile-book-upload-verify-settle-handover-report-verify-return-prepare',
    }),
    contentType: 'application/json',
  });
  await adminContext.close();
});
