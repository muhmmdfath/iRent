import { test, expect } from './fixtures';
import { adminSession } from '../admin-fixtures';
import { customerSession, item, policy } from '../customer-fixtures';

for (const width of [390, 1440]) {
  test(`delivery fee switch is usable at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    let enabled = true;
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ json: adminSession }),
    );
    await page.route('**/api/admin/settings', async (route) => {
      if (route.request().method() === 'PATCH') {
        await new Promise((resolve) => setTimeout(resolve, 650));
        enabled = route.request().postDataJSON().values.delivery_fee_enabled;
      }
      await route.fulfill({
        json: {
          revision: '1',
          values: { ...policy.values, delivery_fee_enabled: enabled },
        },
      });
    });
    await page.route('**/api/admin/delivery-zones', (route) =>
      route.fulfill({ json: [] }),
    );
    await page.goto('/admin/zones');
    const toggle = page.getByRole('switch', { name: 'Ongkir dalam aplikasi' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.hover();
    await expect(toggle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    expect((await toggle.boundingBox())!.width).toBeLessThan(60);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false', {
      timeout: 250,
    });
    await expect(toggle).toBeEnabled();
    await expect(
      page.getByText(/ongkir dibayar dan dicatat di luar aplikasi/),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath('settings.png'),
      fullPage: true,
    });
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
  test(`chat delivery keeps location and omits zones at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ json: customerSession }),
    );
    await page.route('**/api/customer/profile', (route) =>
      route.fulfill({ json: { completedAt: new Date().toISOString() } }),
    );
    await page.route('**/api/rental-policy', (route) =>
      route.fulfill({
        json: {
          ...policy,
          values: { ...policy.values, delivery_fee_enabled: false },
        },
      }),
    );
    await page.route('**/api/items/test-item', (route) =>
      route.fulfill({ json: item }),
    );
    await page.route('**/api/bookings/availability', (route) =>
      route.fulfill({
        json: {
          available: true,
          reservesStock: false,
          items: [
            { itemId: item.id, availableQuantity: 1, requestedQuantity: 1 },
          ],
        },
      }),
    );
    await page.route('**/media/items/test.webp', (route) =>
      route.fulfill({ status: 404 }),
    );
    await page.goto('/app/new?itemId=test-item');
    await page.getByLabel('Cara pengambilan').selectOption('delivery');
    await expect(page.getByLabel('Zona antar-jemput')).toHaveCount(0);
    await page
      .getByLabel('Alamat antar-jemput')
      .fill('https://maps.app.goo.gl/example');
    await expect(
      page.getByText(/Ongkir diinformasikan lewat chat/),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath('delivery.png'),
      fullPage: true,
    });
  });
}
