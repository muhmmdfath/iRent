import { test, expect } from '@playwright/test';
import { customerSession, policy, item } from '../customer-fixtures';
test('signed-in customers can log out from public catalog and terms layouts', async ({
  page,
}) => {
  let signedIn = true,
    calls = 0;
  await page.route('**/api/auth/session', (r) =>
    r.fulfill(signedIn ? { json: customerSession } : { status: 401, json: {} }),
  );
  await page.route('**/api/auth/logout', (r) => {
    calls++;
    signedIn = false;
    return r.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/items?**', (r) =>
    r.fulfill({ json: { data: [item], total: 1, page: 1 } }),
  );
  await page.route('**/api/items/test-item', (r) => r.fulfill({ json: item }));
  await page.route('**/api/rental-policy', (r) => r.fulfill({ json: policy }));
  await page.route('**/api/notifications?**', (r) =>
    r.fulfill({ json: { data: [], total: 0, unread: 0, page: 1, limit: 10 } }),
  );
  await page.route('**/media/**', (r) => r.fulfill({ status: 204 }));
  for (const route of ['/catalog', '/catalog/test-item', '/terms']) {
    await page.goto(route);
    await expect(
      page.getByRole('button', { name: 'Keluar', exact: true }),
    ).toBeVisible();
  }
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Keluar', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'Masuk', exact: true }),
  ).toBeVisible();
  expect(calls).toBe(1);
});
