import { test, expect } from './fixtures';
import { item, policy, customerSession } from '../customer-fixtures';
for (const width of [390, 1440]) {
  test(`customer calendar disables unavailable dates at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date('2026-10-25T03:00:00Z') });
    await page.route('**/api/auth/session', (r) =>
      r.fulfill({ json: customerSession }),
    );
    await page.route('**/api/items/test-item', (r) =>
      r.fulfill({ json: item }),
    );
    await page.route('**/api/rental-policy', (r) =>
      r.fulfill({ json: policy }),
    );
    await page.route('**/api/items/test-item/calendar?**', (r) => {
      const query = new URL(r.request().url()).searchParams;
      return r.fulfill({
        json: {
          month: query.get('month'),
          days: Array.from({ length: 31 }, (_, i) => ({
            date: '2026-10-' + String(i + 1).padStart(2, '0'),
            available: i >= 25 && i !== 28,
          })),
        },
      });
    });
    await page.goto('/catalog/test-item');
    await page.getByLabel('Durasi sewa', { exact: true }).selectOption('60');
    await expect(page.locator('.rental-product-price')).toContainText(
      '400.000',
    );
    await page
      .getByRole('button', { name: 'Pilih jadwal', exact: true })
      .click();
    const blocked = page.getByRole('button', {
      name: '29 Oktober 2026',
      exact: true,
    });
    await expect(
      page.getByRole('button', { name: '30 Oktober 2026', exact: true }),
    ).toBeEnabled();
    await expect(blocked).toBeDisabled();
    await expect(
      page.getByRole('button', { name: '24 Oktober 2026', exact: true }),
    ).toBeDisabled();
    await expect(blocked).toHaveCSS('color', 'rgb(170, 166, 173)');
    await page
      .getByRole('button', { name: '30 Oktober 2026', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Mulai sewa (WIB)' }),
    ).toContainText('30 Okt 2026');
    await expect(
      page.getByRole('link', { name: 'Lanjut booking' }),
    ).toHaveAttribute('href', /durationHours=60/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath('calendar-feedback.png'),
      fullPage: true,
    });
  });
}
