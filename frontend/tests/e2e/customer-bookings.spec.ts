import { test, expect } from '@playwright/test';
import { customerSession, booking } from '../customer-fixtures';
for (const width of [390, 1440]) {
  test(`booking history filters server results and retains navigation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.route('**/api/auth/session', (r) =>
      r.fulfill({ json: customerSession }),
    );
    await page.route('**/api/notifications?**', (r) =>
      r.fulfill({
        json: { data: [], total: 0, unread: 0, page: 1, limit: 10 },
      }),
    );
    await page.route('**/media/**', (r) => r.fulfill({ status: 204 }));
    const rows = [
      booking,
      {
        ...booking,
        id: 'cancelled',
        code: 'IRN-CANCELLED',
        status: 'dibatalkan',
      },
    ];
    await page.route('**/api/bookings?**', (r) => {
      const status = new URL(r.request().url()).searchParams.get('status');
      return r.fulfill({
        json: rows.filter((row) => !status || row.status === status),
      });
    });
    await page.goto('/app/bookings');
    await expect(
      page.getByRole('heading', { name: 'Booking saya', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.recent-rental-card')).toHaveCount(2);
    await page
      .getByRole('button', { name: 'Perlu dibayar', exact: true })
      .click();
    await expect(page).toHaveURL(/status=menunggu_pembayaran/);
    await expect(page.locator('.recent-rental-card')).toHaveCount(1);
    await expect(
      page.getByRole('link', { name: 'Bayar & upload bukti', exact: true }),
    ).toHaveAttribute('href', '/app/bookings/test-booking/payment');
    await page
      .getByRole('button', { name: 'Sedang disewa', exact: true })
      .click();
    await expect(
      page.getByRole('heading', {
        name: 'Belum ada booking pada status ini',
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Lihat semua booking', exact: true })
      .click();
    await expect(page.locator('.recent-rental-card')).toHaveCount(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../docs/frontend/bookings-history-${width}.png`,
      fullPage: true,
    });
  });
}
