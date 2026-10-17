import { test, expect } from '@playwright/test';
import { item } from '../customer-fixtures';
for (const width of [390, 1440]) {
  test(`pastel landing scroll motion and fixed transparent header work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/session', (r) =>
      r.fulfill({ status: 401, json: {} }),
    );
    await page.route('**/api/items?**', (r) =>
      r.fulfill({ json: { data: [item], total: 1, page: 1 } }),
    );
    await page.route('**/media/**', (r) =>
      r.fulfill({
        path: 'tests/fixtures/inventory-photo.png',
        contentType: 'image/png',
      }),
    );
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /Untuk rencana/ }),
    ).toBeVisible();
    await expect(page.locator('.landing-hero-copy')).toHaveAttribute(
      'data-revealed',
      'true',
    );
    await page.getByRole('button', { name: 'Cara sewa' }).click();
    const heading = page.getByRole('heading', { name: /Dari pilih perangkat/ });
    await expect(heading).toBeInViewport();
    await expect(heading).toHaveCSS('text-align', 'center');
    await expect(page.locator('.landing-steps-heading')).toHaveAttribute(
      'data-revealed',
      'true',
    );
    const navbar = page.locator('.welcome-nav');
    await expect(navbar).toHaveCSS('position', 'fixed');
    expect((await navbar.boundingBox())!.y).toBe(0);
    await expect(page.locator('.landing-pastel')).toHaveAttribute(
      'data-scrolled',
      'true',
    );
    await expect
      .poll(() =>
        page
          .locator('.landing-pastel')
          .evaluate((node) =>
            Number(
              (node as HTMLElement).style.getPropertyValue('--page-progress'),
            ),
          ),
      )
      .toBeGreaterThan(0);
    await expect(navbar).toHaveCSS('backdrop-filter', /blur/);
    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    await expect(page.locator('.site-footer-wordmark')).toHaveCSS(
      'color',
      'rgb(237, 210, 223)',
    );
    await expect(page.locator('.site-footer-links a').first()).toHaveAttribute(
      'data-slot',
      'button',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
  test(`catalog navbar stays fixed while scrolling at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/session', (r) =>
      r.fulfill({ status: 401, json: {} }),
    );
    await page.route('**/api/items?**', (r) =>
      r.fulfill({
        json: {
          data: Array.from({ length: 8 }, (_, i) => ({
            ...item,
            id: 'item-' + i,
          })),
          total: 8,
          page: 1,
        },
      }),
    );
    await page.goto('/catalog');
    await expect(
      page.getByRole('heading', { name: 'Katalog perangkat', exact: true }),
    ).toBeVisible();
    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    const bar = page.locator('.studio-navbar');
    await expect(bar).toHaveCSS('position', 'fixed');
    expect((await bar.boundingBox())!.y).toBe(width < 768 ? 72 : 0);
    await expect(page.getByRole('searchbox')).toBeInViewport();
    await expect(bar).toHaveCSS('backdrop-filter', /blur/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test('reduced motion shows landing content without floating or hidden reveals', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/auth/session', (r) =>
    r.fulfill({ status: 401, json: {} }),
  );
  await page.route('**/api/items?**', (r) =>
    r.fulfill({ json: { data: [item], total: 1, page: 1 } }),
  );
  await page.goto('/');
  await expect(page.locator('.landing-device-float')).toHaveCSS(
    'animation-name',
    'none',
  );
  await expect(page.locator('.landing-orbit-inner')).toHaveCSS(
    'animation-name',
    'none',
  );
  await expect(page.locator('.landing-hero-copy')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Cara sewa' }).click();
  await expect(
    page.getByRole('heading', { name: /Dari pilih perangkat/ }),
  ).toBeInViewport();
  await expect(page.locator('.landing-steps-heading')).toHaveCSS(
    'opacity',
    '1',
  );
});
