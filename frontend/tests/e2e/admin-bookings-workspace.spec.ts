import { test, expect } from './fixtures';
import { adminSession, adminBooking } from '../admin-fixtures';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (r) =>
    r.fulfill({ json: adminSession }),
  );
  await page.route('**/api/notifications?**', (r) =>
    r.fulfill({
      json: { data: [], total: 0, unreadCount: 0, page: 1, limit: 10 },
    }),
  );
  await page.route('**/api/admin/tasks?**', (r) =>
    r.fulfill({
      json: {
        data: [
          {
            id: 'proof-1',
            bookingId: adminBooking.id,
            code: adminBooking.code,
            dueAt: adminBooking.confirmationDueAt,
            overdue: false,
          },
        ],
        total: 1,
        asOf: new Date().toISOString(),
      },
    }),
  );
});
test('quick filters and search reach server; payment queue opens the correct booking', async ({
  page,
}) => {
  const requests: URL[] = [];
  await page.route('**/api/admin/bookings?**', (r) => {
    requests.push(new URL(r.request().url()));
    return r.fulfill({ json: [adminBooking] });
  });
  await page.goto('/admin/bookings?page=3');
  await expect(page.getByText('Penyewa Uji', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Perlu verifikasi', exact: true })
    .click();
  await expect(page).toHaveURL(/status=menunggu_konfirmasi/);
  await expect
    .poll(() => requests.at(-1)?.searchParams.get('status'))
    .toBe('menunggu_konfirmasi');
  expect(new URL(page.url()).searchParams.has('page')).toBe(false);
  await page.getByLabel('Kode booking atau nama penyewa').fill('Penyewa');
  await page.getByRole('button', { name: 'Cari', exact: true }).click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get('search'))
    .toBe('Penyewa');
  await page.getByRole('button', { name: 'Lihat antrean' }).click();
  const queue = page.getByRole('region', { name: 'Bukti paling mendesak' });
  await expect(queue.getByRole('link')).toHaveAttribute(
    'href',
    '/admin/bookings/' + adminBooking.id,
  );
  await page.getByRole('button', { name: 'Tutup antrean' }).click();
  await expect(queue).not.toBeVisible();
  await page.getByRole('button', { name: 'Reset filter' }).click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get('search'))
    .toBe(null);
  await expect
    .poll(() => requests.at(-1)?.searchParams.get('status'))
    .toBe(null);
});
test('empty and failed lists offer recovery without showing fabricated totals', async ({
  page,
}) => {
  let failed = true;
  await page.route('**/api/admin/bookings?**', (r) =>
    r.fulfill(
      failed
        ? { status: 500, json: { message: 'Gagal memuat booking.' } }
        : { json: [] },
    ),
  );
  await page.goto('/admin/bookings?search=tidakada');
  await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible({
    timeout: 15000,
  });
  failed = false;
  await page.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(
    page.getByRole('heading', { name: 'Tidak ada booking ditemukan' }),
  ).toBeVisible();
  await expect(page.getByText('0 booking di halaman ini')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Halaman berikutnya' }),
  ).toBeDisabled();
});
