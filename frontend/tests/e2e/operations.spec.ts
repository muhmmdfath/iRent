import { test, expect } from '@playwright/test';
import { adminSession } from '../admin-fixtures';
import { operationBooking, operationFinancial } from '../operations-fixtures';
for (const width of [360, 390, 768, 1024, 1440]) {
  test(`unit return review remains usable at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const booking = operationBooking(),
      money = operationFinancial(booking);
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ json: adminSession }),
    );
    await page.route('**/api/bookings/test-booking', (route) =>
      route.fulfill({ json: booking }),
    );
    await page.route('**/api/bookings/test-booking/payments', (route) =>
      route.fulfill({ json: money }),
    );
    await page.route('**/api/admin/bookings/test-booking/receipts', (route) =>
      route.fulfill({ json: [] }),
    );
    await page.goto('/admin/bookings/test-booking');
    await page
      .getByRole('button', { name: 'Verifikasi pengembalian IPHONE-TEST' })
      .click();
    await page
      .getByLabel('Catatan kondisi')
      .fill('Barang lengkap dan kondisi telah diperiksa.');
    await page
      .getByRole('checkbox', { name: /sudah memeriksa barang/ })
      .check();
    await page.getByRole('button', { name: 'Periksa tindakan' }).click();
    await expect(
      page.getByRole('button', { name: 'Konfirmasi tindakan' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`admin-return-${width}.png`),
      fullPage: true,
    });
  });
}
