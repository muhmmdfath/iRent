import { test, expect } from '@playwright/test';
import { adminSession } from '../admin-fixtures';
import { policy } from '../customer-fixtures';
const date = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const at = (hour: string) => `${date}T${hour}:00+07:00`;
const person = {
  id: 'person-1',
  name: 'Penyewa Pengujian',
  email: 'penyewa@example.test',
  phone: null,
  isActive: true,
  profile: { completedAt: at('08:00') },
  _count: { bookings: 3 },
};
const values = {
  ...policy.values,
  confirmation_reminder_minutes: 30,
  pickup_escalation_minutes: 20,
  buffer_minutes: 60,
  extension_confirm_minutes: 60,
  extension_confirm_before_return_minutes: 30,
  qris_image_path: null,
};
const paged = (data: unknown[]) => ({
  data,
  total: data.length,
  page: 1,
  limit: 20,
});
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (r) =>
    r.fulfill({ json: adminSession }),
  );
  await page.route('**/api/notifications?**', (r) =>
    r.fulfill({ json: { data: [], total: 0, unread: 0 } }),
  );
  await page.route('**/api/admin/**', (r) => {
    const path = new URL(r.request().url()).pathname.replace('/api/admin/', '');
    const responses: Record<string, unknown> = {
      calendar: paged([
        {
          id: 'unit-1',
          code: 'IPH-001',
          isActive: true,
          physicalStatus: 'ready',
          conditionStatus: 'layak',
          preparationUntil: null,
          overdue: false,
          item: { id: 'model-1', name: 'iPhone Pengujian', photoPath: null },
          allocations: [
            {
              id: 'alloc-1',
              bookingId: 'booking-1',
              code: 'IRN-UJI',
              startAt: at('10:00'),
              endAt: at('16:00'),
              blockStartAt: at('10:00'),
              blockEndAt: at('17:00'),
              kind: 'rental',
              status: 'dikonfirmasi',
            },
          ],
        },
      ]),
      items: paged([{ id: 'model-1', name: 'iPhone Pengujian' }]),
      extensions: paged([
        {
          id: 'extension-1',
          bookingId: 'booking-1',
          status: 'menunggu_konfirmasi',
          amountDue: '50000',
          confirmationDueAt: at('11:00'),
          items: [{ id: 'ext-unit' }],
          booking: { code: 'IRN-UJI', customer: { name: person.name } },
        },
      ]),
      refunds: paged([
        {
          id: 'refund-1',
          bookingId: 'booking-1',
          createdAt: at('08:00'),
          status: 'diajukan',
          requestedAmount: '20000',
          approvedAmount: null,
          booking: { code: 'IRN-UJI', customer: { name: person.name } },
        },
      ]),
      'bookings/at-risk': paged([
        {
          bookingId: 'booking-1',
          bookingItemId: 'unit-1',
          code: 'IRN-UJI',
          unitCode: 'IPH-001',
          itemName: 'iPhone Pengujian',
          startAt: at('10:00'),
          reasons: ['unit_perawatan'],
        },
      ]),
      'bookings/delivery-follow-up': [],
      customers: paged([person]),
      accounts: paged([person]),
      'delivery-zones': [
        { id: 'zone-1', name: 'Tembalang', fee: '20000', isActive: true },
      ],
      settings: { revision: '1', values },
      reports: {
        cash: { incoming: '125000', outgoing: '20000', net: '105000' },
        pendingRefundsNow: '10000',
        bookingCounts: [{ status: 'selesai', count: 2 }],
        popularItems: [
          { itemId: 'item-1', name: 'iPhone Pengujian', quantity: 2 },
        ],
        successfulTransactions: [
          {
            id: 'booking-1',
            code: 'IRN-UJI',
            bill: '125000',
            applied: '125000',
            lossClosed: false,
          },
        ],
        journal: {
          total: 1,
          data: [
            {
              id: 'payment-1',
              direction: 'in',
              type: 'full',
              method: 'qris',
              amount: '125000',
              occurredAt: at('09:00'),
              recordedAt: at('09:00'),
              note: 'Catatan aktual',
              booking: { id: 'booking-1', code: 'IRN-UJI' },
              recordedActor: { name: 'Admin Pengujian' },
              supersededAt: null,
              correctionAsOriginal: null,
              correctionAsReplacement: null,
            },
          ],
        },
      },
      'notifications/configuration': { enabled: false, publicKey: '' },
      notifications: [
        {
          id: 'notice-1',
          eventType: 'payment_proof.uploaded',
          channel: 'push',
          status: 'sent',
          attempts: 1,
          dueAt: at('09:00'),
          retryAt: null,
          error: null,
        },
      ],
    };
    if (r.request().method() !== 'GET' || !(path in responses))
      return r.fulfill({
        status: 404,
        json: { message: 'Unexpected test request' },
      });
    return r.fulfill({ json: responses[path] });
  });
});
const routes = [
  ['calendar', 'Jadwal per unit'],
  ['extensions', 'Perpanjangan'],
  ['refunds', 'Refund'],
  ['risks', 'Risiko & tindak lanjut'],
  ['customers', 'Data penyewa'],
  ['accounts', 'Admin'],
  ['reports', 'Laporan & transaksi berhasil'],
  ['zones', 'Zona antar-jemput'],
  ['notifications', 'Notifikasi PWA'],
  ['settings', 'Pengaturan sewa'],
];
for (const width of [390, 1440]) {
  test(`all ten management pages show data and remain usable at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (
        url.pathname.startsWith('/api/admin/') &&
        url.searchParams.has('limit') &&
        url.searchParams.get('limit') !== '10'
      )
        errors.push('Unexpected page size: ' + url.pathname);
    });
    await page.setViewportSize({ width, height: 950 });
    for (const [route, title] of routes) {
      await page.goto('/admin/' + route);
      await expect(
        page.getByRole('heading', { name: title, exact: true }),
      ).toBeVisible();
      await expect(page.locator('main')).not.toContainText('Memuat');
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (route === 'calendar') {
        await expect(
          page.getByRole('link', { name: /IRN-UJI, ambil/ }),
        ).toHaveAttribute('href', '/admin/bookings/booking-1');
        await page
          .getByRole('button', { name: 'Detail jadwal IPH-001' })
          .click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(
          page.getByRole('dialog').getByText('Pengambilan', { exact: true }),
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }
      if (route === 'customers')
        await expect(
          page.getByRole('link', { name: 'Detail penyewa' }),
        ).toHaveAttribute('href', '/admin/customers/person-1');
      if (route === 'reports') {
        await page.getByText('Catatan & jejak transaksi').click();
        await expect(
          page.getByText('Catatan aktual', { exact: true }),
        ).toBeVisible();
      }
      if (route === 'notifications')
        await expect(
          page.getByRole('button', {
            name: 'Aktifkan notifikasi',
            exact: true,
          }),
        ).toBeDisabled();
    }
    expect(errors).toEqual([]);
  });
}
test('queue tabs reset pagination and filter on server, with a distinct non-filled hover', async ({
  page,
}) => {
  await page.goto('/admin/refunds');
  const request = page.waitForRequest(
    (r) =>
      r.url().includes('/api/admin/refunds') &&
      new URL(r.url()).searchParams.get('status') === 'disetujui',
  );
  await page
    .getByRole('button', { name: 'Menunggu transfer', exact: true })
    .click();
  expect(new URL((await request).url()).searchParams.get('page')).toBe('1');
  const tab = page.getByRole('button', { name: 'Semua refund' });
  await tab.hover();
  expect(await tab.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)',
  );
  await page.goto('/admin/extensions');
  const ext = page.waitForRequest(
    (r) =>
      r.url().includes('/api/admin/extensions') &&
      new URL(r.url()).searchParams.get('status') === 'draft_quote',
  );
  await page.getByRole('button', { name: 'Perlu ongkir' }).click();
  await ext;
});
test('zone modal saves boolean state and exact rupiah only after review', async ({
  page,
}) => {
  let body: unknown;
  await page.route('**/api/admin/delivery-zones/zone-1', async (r) => {
    body = r.request().postDataJSON();
    await r.fulfill({ json: {} });
  });
  await page.goto('/admin/zones');
  await page.getByRole('button', { name: 'Ubah Tembalang' }).click();
  const modal = page.getByRole('dialog', { name: 'Ubah zona' });
  await modal
    .getByLabel('Tarif antar-jemput (rupiah)')
    .fill('9007199254740993');
  await modal.getByLabel('Status zona').selectOption('false');
  await modal.getByRole('checkbox').check();
  await modal.getByRole('button', { name: 'Periksa simpan zona' }).click();
  expect(body).toBeUndefined();
  await modal.getByRole('button', { name: 'Konfirmasi simpan zona' }).click();
  await expect(modal).not.toBeVisible();
  expect(body).toEqual({
    name: 'Tembalang',
    fee: '9007199254740993',
    isActive: false,
  });
});
test('settings groups retain actual values and submit only changed fields', async ({
  page,
}) => {
  let body: unknown;
  await page.route('**/api/admin/settings', async (r) =>
    r.request().method() === 'PATCH'
      ? ((body = r.request().postDataJSON()), r.fulfill({ json: {} }))
      : r.fulfill({ json: { revision: '1', values } }),
  );
  await page.goto('/admin/settings');
  await page.getByRole('button', { name: 'Jadwal & jam layanan' }).click();
  await expect(page.getByText('Jam buka (WIB)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pembayaran & konfirmasi' }).click();
  await page.getByRole('button', { name: 'Ubah pengaturan' }).click();
  const modal = page.getByRole('dialog', { name: 'Ubah pengaturan' });
  await modal.getByLabel('DP (rupiah)', { exact: true }).fill('25000');
  await modal.getByRole('checkbox').check();
  await modal
    .getByRole('button', { name: 'Periksa simpan pengaturan sewa' })
    .click();
  await modal
    .getByRole('button', { name: 'Konfirmasi simpan pengaturan sewa' })
    .click();
  await expect(modal).not.toBeVisible();
  expect(body).toEqual({ values: { dp_amount: '25000' } });
  await page.getByRole('button', { name: 'QRIS toko', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Upload QRIS' })).toBeVisible();
});
test('admin create opens a dismissible modal and keeps the typed password out of review text', async ({
  page,
}) => {
  await page.goto('/admin/accounts');
  await page.getByRole('button', { name: 'Tambah admin' }).click();
  const modal = page.getByRole('dialog', { name: 'Tambah admin' });
  await modal.getByLabel('Nama', { exact: true }).fill('Petugas Pengujian');
  await modal.getByLabel('Email', { exact: true }).fill('petugas@example.test');
  await modal.getByLabel('Password baru').fill('Password test panjang 123');
  await modal.getByRole('checkbox').check();
  await modal.getByRole('button', { name: 'Periksa buat akun admin' }).click();
  await expect(modal.getByText('Sudah diisi', { exact: true })).toBeVisible();
  await expect(modal).not.toContainText('Password test panjang 123');
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
});
