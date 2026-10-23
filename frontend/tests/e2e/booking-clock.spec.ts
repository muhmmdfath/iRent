import { test, expect } from './fixtures';
import { customerSession, item, policy } from '../customer-fixtures';

for (const width of [390, 1440]) {
  test(`booking uses 08–22 WIB without AM/PM and submits the selected time at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ json: customerSession }),
    );
    await page.route('**/api/customer/profile', (route) =>
      route.fulfill({
        json: {
          completedAt: new Date().toISOString(),
          fullName: 'Penyewa Lengkap',
        },
      }),
    );
    await page.route('**/api/rental-policy', (route) =>
      route.fulfill({ json: policy }),
    );
    await page.route('**/api/items/test-item', (route) =>
      route.fulfill({ json: item }),
    );
    await page.route('**/api/delivery-zones', (route) =>
      route.fulfill({ json: [] }),
    );
    let startAt = '';
    await page.route('**/api/pricing/quote', async (route) => {
      startAt = route.request().postDataJSON().startAt;
      await route.fulfill({
        status: 400,
        json: { message: 'Pemeriksaan jadwal simulasi.' },
      });
    });
    await page.route('**/api/bookings/availability', (route) =>
      route.fulfill({
        status: 400,
        json: { message: 'Pemeriksaan jadwal simulasi.' },
      }),
    );
    await page.goto('/app/new?itemId=test-item');
    const trigger = page.getByRole('button', {
      name: 'Tanggal dan jam pengambilan (WIB)',
    });
    await expect(trigger).toContainText('10:00 WIB');
    await trigger.click();
    const hours = page.getByRole('combobox', { name: 'Jam', exact: true });
    await expect(hours.locator('option')).toHaveCount(15);
    await hours.selectOption('22');
    await expect(
      page.getByRole('combobox', { name: 'Menit' }).locator('option'),
    ).toHaveCount(1);
    await expect(trigger).toContainText('22:00 WIB');
    await hours.selectOption('08');
    await page.getByRole('button', { name: 'Selesai', exact: true }).click();
    await expect(trigger).toContainText('08:00 WIB');
    await expect(trigger).not.toContainText(/\bAM\b|\bPM\b/);
    await page
      .getByRole('button', { name: 'Periksa jadwal & biaya', exact: true })
      .click();
    await expect.poll(() => startAt).toMatch(/T08:00:00\+07:00$/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await trigger.click();
    await page.locator('.date-time-popover').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `../docs/frontend/booking-clock-${width}.png`,
    });
  });
}
