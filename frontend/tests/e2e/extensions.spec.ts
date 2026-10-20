import { test, expect } from './fixtures';
import { customerSession } from '../customer-fixtures';
import { extensionFixture } from '../extensions-fixtures';
for (const width of [390, 1440]) {
  test(`customer opens an existing extension from their booking at ${width}px`, async ({
    page,
  }) => {
    const fixture = extensionFixture();
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/session', (r) =>
      r.fulfill({ json: customerSession }),
    );
    await page.route('**/api/bookings/test-booking', (r) =>
      r.fulfill({ json: fixture.booking }),
    );
    await page.route('**/api/bookings/test-booking/payments', (r) =>
      r.fulfill({ json: fixture.money }),
    );
    await page.route(
      '**/api/bookings/test-booking/extensions/test-extension',
      (r) => r.fulfill({ json: fixture.detail }),
    );
    await page.route('**/api/payment-options', (r) =>
      r.fulfill({ json: { qrisImagePath: null } }),
    );
    await page.goto('/app/bookings/test-booking');
    await page
      .getByRole('link', { name: 'Detail perpanjangan', exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/app\/bookings\/test-booking\/extensions\/test-extension$/,
    );
    await expect(
      page.getByRole('heading', { name: 'Detail perpanjangan', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Upload bukti perpanjangan' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Detail perpanjangan', exact: true }),
    ).toBeVisible();
  });
}
