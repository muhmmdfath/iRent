import { test, expect } from '@playwright/test';
import {
  adminSession,
  adminBooking,
  pendingFinancial,
} from '../admin-fixtures';
for (const width of [360, 390, 768, 1024, 1440]) {
  test(`operational dashboard priorities and day schedule work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/auth/session', (r) =>
      r.fulfill({ json: adminSession }),
    );
    await page.route('**/api/admin/overview', (r) =>
      r.fulfill({
        json: {
          total: 7,
          today: 2,
          lateUnits: 1,
          readyUnits: 12,
          counts: [
            { status: 'berjalan', count: 3 },
            { status: 'selesai', count: 4 },
          ],
          pickups: [
            {
              id: 'pickup',
              itemNameSnapshot: 'iPhone Jadwal',
              unitCodeSnapshot: 'IPH-001',
              startAt: '2026-10-15T10:00:00+07:00',
              currentEndAt: '2026-10-16T10:00:00+07:00',
              booking: { id: 'pickup-booking', code: 'IRN-PICKUP' },
            },
          ],
          returns: [
            {
              id: 'return',
              itemNameSnapshot: 'AirPods Kembali',
              unitCodeSnapshot: 'AIR-001',
              startAt: '2026-10-14T15:00:00+07:00',
              currentEndAt: '2026-10-15T15:00:00+07:00',
              booking: { id: 'return-booking', code: 'IRN-RETURN' },
            },
          ],
        },
      }),
    );
    await page.route('**/api/admin/bookings?**', (r) =>
      r.fulfill({ json: [adminBooking] }),
    );
    await page.route('**/api/admin/tasks?**', (r) => {
      const kind = new URL(r.request().url()).searchParams.get('kind');
      return r.fulfill({
        json: {
          data:
            kind === 'all' || kind === 'payment'
              ? [
                  {
                    id: 'task',
                    kind: 'payment',
                    bookingId: 'test-booking',
                    code: 'IRN-PRIORITY',
                    dueAt: '2026-10-15T11:00:00+07:00',
                    overdue: true,
                    version: 'v1',
                  },
                ]
              : [],
          total: kind === 'all' || kind === 'payment' ? 1 : 0,
          page: 1,
          limit: 20,
        },
      });
    });
    await page.route('**/api/bookings/test-booking', (r) =>
      r.fulfill({ json: adminBooking }),
    );
    await page.route('**/api/bookings/test-booking/payments', (r) =>
      r.fulfill({ json: pendingFinancial() }),
    );
    await page.route('**/api/admin/bookings/test-booking/receipts', (r) =>
      r.fulfill({ json: [] }),
    );
    await page.goto('/admin/');
    await expect(
      page.getByRole('heading', { name: 'Ringkasan operasional', exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Ringkasan operasional' })
        .getByText('12', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('IRN-PRIORITY', { exact: true })).toHaveCount(
      1,
    );
    await page.getByRole('tab', { name: /Pengembalian/ }).click();
    await expect(
      page.getByText('AirPods Kembali', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Lihat booking IRN-RETURN' }),
    ).toHaveAttribute('href', '/admin/bookings/return-booking');
    await page
      .getByRole('combobox', { name: 'Jenis pekerjaan' })
      .selectOption('refund');
    await expect(
      page.getByText('Tidak ada pekerjaan pada filter ini.'),
    ).toBeVisible();
    await page
      .getByRole('combobox', { name: 'Jenis pekerjaan' })
      .selectOption('all');
    await expect(
      page.getByRole('link', { name: 'Periksa pembayaran' }),
    ).toHaveAttribute('href', '/admin/bookings/test-booking');
    await page
      .getByRole('button', { name: 'Saya tangani', exact: true })
      .click();
    await expect(
      page.getByRole('button', {
        name: 'Sudah diakui di tab ini',
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole('link', { name: 'Buka booking ' + adminBooking.code }),
    ).toHaveAttribute('href', '/admin/bookings/' + adminBooking.id);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole('link', { name: 'Periksa pembayaran' }).click();
    await expect(page).toHaveURL(/\/admin\/bookings\/test-booking$/);
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/notifications?**', (route) =>
    route.fulfill({
      json: { data: [], total: 0, unread: 0, page: 1, limit: 10 },
    }),
  );
});
