import { test, expect } from '@playwright/test';
import {
  adminSession,
  adminBooking,
  pendingFinancial,
} from '../admin-fixtures';
for (const width of [360, 390, 768, 1024, 1440]) {
  test(`admin bookings and receipt review remain usable at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ json: adminSession }),
    );
    await page.route('**/api/admin/bookings?**', (route) =>
      route.fulfill({ json: [adminBooking] }),
    );
    await page.route('**/api/bookings/test-booking', (route) =>
      route.fulfill({ json: adminBooking }),
    );
    await page.route('**/api/bookings/test-booking/payments', (route) =>
      route.fulfill({ json: pendingFinancial() }),
    );
    await page.route('**/api/admin/bookings/test-booking/receipts', (route) =>
      route.fulfill({ json: [] }),
    );
    await page.route('**/api/notifications?**', (r) =>
      r.fulfill({
        json: { data: [], total: 0, unreadCount: 0, page: 1, limit: 10 },
      }),
    );
    await page.route('**/api/admin/tasks?**', (r) =>
      r.fulfill({
        json: { data: [], total: 0, asOf: new Date().toISOString() },
      }),
    );
    await page.goto('/admin/bookings');
    await expect(page.getByText('Penyewa Uji', { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`admin-bookings-${width}.png`),
      fullPage: true,
    });
    await page.getByRole('link', { name: 'Buka booking' }).click();
    await expect(
      page.getByRole('heading', { name: 'Detail booking' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Verifikasi uang masuk', exact: true })
      .click();
    await page.getByLabel('Rekening penerima').fill('rekening-toko');
    await page.getByLabel('Referensi transaksi').fill('BANK-TEST-123');
    await page
      .getByLabel('Catatan pemeriksaan')
      .fill('Uang masuk sudah diperiksa.');
    await page.getByRole('checkbox', { name: /memastikan uang/ }).check();
    await page.getByRole('button', { name: 'Periksa pencatatan' }).click();
    await expect(
      page.getByRole('button', { name: 'Konfirmasi pencatatan' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`admin-receipt-${width}.png`),
      fullPage: true,
    });
  });
}
