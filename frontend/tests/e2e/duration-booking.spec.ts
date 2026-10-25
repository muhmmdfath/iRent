import { test, expect } from './fixtures';
import {
  item,
  policy,
  customerSession,
  booking,
  financial,
} from '../customer-fixtures';
test('sixty hour checkout uses one consent and submits all required agreements', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.clock.install({ time: new Date('2026-10-25T03:00:00Z') });
  await page.route('**/api/auth/session', (r) =>
    r.fulfill({ json: customerSession }),
  );
  await page.route('**/api/rental-policy', (r) => r.fulfill({ json: policy }));
  await page.route('**/api/items/test-item', (r) =>
    r.fulfill({ json: { ...item, photoPath: null } }),
  );
  await page.route('**/api/customer/profile', (r) =>
    r.fulfill({
      json: {
        fullName: 'Penyewa Uji',
        address: 'Semarang',
        phoneActive: '+6281234567890',
        completedAt: '2026-10-01T10:00:00+07:00',
      },
    }),
  );
  await page.route('**/api/delivery-zones', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/bookings/availability', (r) =>
    r.fulfill({
      json: {
        available: true,
        reservesStock: false,
        items: [
          { itemId: item.id, requestedQuantity: 1, availableQuantity: 1 },
        ],
      },
    }),
  );
  await page.route('**/api/pricing/quote', (r) => {
    const input = r.request().postDataJSON();
    expect(input.durationHours).toBe(60);
    return r.fulfill({
      json: {
        startAt: input.startAt,
        endAt: '2026-10-28T22:00:00+07:00',
        durationHours: 60,
        rentalTotal: '400000',
        deliveryFee: '0',
        grandTotal: '400000',
        amountDueNow: '20000',
        mustPayFull: false,
        payOption: 'dp',
        lines: [
          {
            itemId: item.id,
            itemName: item.name,
            quantity: 1,
            subtotal: '400000',
          },
        ],
      },
    });
  });
  await page.route('**/api/bookings', (r) =>
    r.request().method() === 'POST'
      ? r.fulfill({ json: booking, status: 201 })
      : r.fulfill({ json: [] }),
  );
  await page.route('**/api/bookings/test-booking/payments', (r) =>
    r.fulfill({ json: financial() }),
  );
  await page.route('**/api/payment-options', (r) =>
    r.fulfill({ json: { qrisImagePath: null } }),
  );
  await page.goto(
    '/app/new?itemId=test-item&durationHours=60&startAt=2026-10-26T10%3A00%3A00%2B07%3A00',
  );
  await expect(page.getByLabel('Durasi sewa', { exact: true })).toHaveValue(
    '60',
  );
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await page
    .getByRole('checkbox', { name: /Saya setuju ketentuan sewa/ })
    .check();
  await page
    .getByRole('button', { name: 'Periksa jadwal & biaya', exact: true })
    .click();
  await expect(page.getByText('Jadwal tersedia saat diperiksa')).toBeVisible();
  await expect(page.locator('.checkout-summary-schedule')).toContainText(
    '2 hari + 12 jam',
  );
  const agreement = await page
    .locator('#checkout-consent .check-label')
    .boundingBox();
  const section = await page.locator('#checkout-consent').boundingBox();
  expect(agreement!.width).toBeGreaterThan(section!.width * 0.8);
  expect(agreement!.x + agreement!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('checkout-simple-60-hours-390.png'),
    fullPage: true,
  });
  const [request] = await Promise.all([
    page.waitForRequest(
      (r) => r.url().endsWith('/api/bookings') && r.method() === 'POST',
    ),
    page.getByRole('button', { name: 'Buat booking', exact: true }).click(),
  ]);
  expect(request.postDataJSON()).toMatchObject({
    durationHours: 60,
    agreeTerms: true,
    prepareIdentity: true,
    understandPayment: true,
    agreeOperatingHours: true,
  });
});
