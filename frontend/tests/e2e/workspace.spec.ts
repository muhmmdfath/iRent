import { test, expect } from '@playwright/test';
import { item } from '../customer-fixtures';
for (const width of [360, 390, 768, 1024, 1440]) {
  test(`catalog shell navigation, search and filters work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/session', (r) =>
      r.fulfill({ status: 401, json: {} }),
    );
    await page.route('**/api/items?**', (r) =>
      r.fulfill({ json: { data: [item], total: 1, page: 1 } }),
    );
    await page.goto('/catalog');
    await expect(page.getByRole('heading', { name: item.name })).toBeVisible();
    const nav = page.getByRole('navigation', {
      name: 'Navigasi utama',
      exact: true,
    });
    if (width < 768) {
      await expect(nav).toBeHidden();
      await page.getByRole('button', { name: 'Buka navigasi' }).click();
      await expect(nav).toBeVisible();
      await page.keyboard.press('Tab');
      await expect(
        nav.getByRole('link', { name: 'Beranda', exact: true }),
      ).toBeFocused();
      await nav.getByRole('link', { name: 'Aksesori', exact: true }).click();
      await expect(nav).toBeHidden();
      await expect(page).toHaveURL(/category=accessory/);
      await page.getByRole('button', { name: 'Buka navigasi' }).click();
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', { name: 'Buka navigasi' }),
      ).toBeFocused();
    } else await expect(nav).toBeVisible();
    await page.getByRole('searchbox').fill('iPhone');
    await page.getByRole('button', { name: 'Cari di katalog' }).click();
    await expect(page).toHaveURL(/search=iPhone/);
    await page.getByRole('button', { name: 'iPhone', exact: true }).click();
    await expect(page).toHaveURL(/category=iphone/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/notifications?**', (route) =>
    route.fulfill({
      json: { data: [], total: 0, unread: 0, page: 1, limit: 10 },
    }),
  );
});
