import { test, expect } from './fixtures';
import { adminSession } from '../admin-fixtures';
import { inventoryItem } from '../inventory-fixtures';
const label = (date: string) =>
  new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(date + 'T00:00:00Z'));
const shift = (date: string, days: number) => {
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (r) =>
    r.fulfill({ json: adminSession }),
  );
  await page.route('**/api/notifications?**', (r) =>
    r.fulfill({ json: { data: [], total: 0, unread: 0 } }),
  );
});
test('inventory requests ten records and next advances by one server page', async ({
  page,
}) => {
  const records = Array.from({ length: 21 }, (_, i) => ({
    ...inventoryItem,
    id: 'item-' + i,
    name: 'Model ' + String(i + 1).padStart(2, '0'),
    photoPath: null,
  }));
  await page.route('**/api/admin/items?**', (r) => {
    const params = new URL(r.request().url()).searchParams;
    expect(params.get('limit')).toBe('10');
    const page = Number(params.get('page'));
    return r.fulfill({
      json: {
        data: records.slice((page - 1) * 10, page * 10),
        total: 21,
        page,
      },
    });
  });
  await page.goto('/admin/inventory');
  await expect(page.locator('.inv-product')).toHaveCount(10);
  await expect(
    page.getByRole('heading', { name: 'Model 01', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Model 11', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.inv-product')).toHaveCount(10);
  await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  await expect(page.locator('.inv-product')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Berikutnya', exact: true }),
  ).toBeDisabled();
});
test('unpaginated zone endpoint is displayed ten at a time and search resets the page', async ({
  page,
}) => {
  await page.route('**/api/admin/delivery-zones', (r) =>
    r.fulfill({
      json: Array.from({ length: 21 }, (_, i) => ({
        id: 'zone-' + i,
        name: 'Kecamatan ' + String(i + 1).padStart(2, '0'),
        fee: '20000',
        isActive: true,
      })),
    }),
  );
  await page.goto('/admin/zones');
  await expect(page.locator('.am-zone-list .management-row')).toHaveCount(10);
  await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Kecamatan 11', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Cari kecamatan').fill('Kecamatan 21');
  await expect(page.locator('.am-zone-list .management-row')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Sebelumnya', exact: true }),
  ).toBeDisabled();
});
for (const width of [390, 1440])
  test(`shared range calendar caps selection, applies inclusive end dates and dismisses at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const requests: URL[] = [];
    await page.route('**/api/admin/calendar?**', (r) => {
      requests.push(new URL(r.request().url()));
      return r.fulfill({ json: { data: [], total: 0, page: 1, limit: 10 } });
    });
    await page.route('**/api/admin/items?**', (r) =>
      r.fulfill({ json: { data: [], total: 0, page: 1, limit: 10 } }),
    );
    await page.goto('/admin/calendar');
    const trigger = page.getByLabel('Pilih rentang tanggal jadwal', {
      exact: true,
    });
    await expect.poll(() => requests.length).toBe(1);
    await trigger.click();
    const panel = page.getByRole('dialog', {
      name: 'Pilih rentang tanggal',
      exact: true,
    });
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    const first = today.slice(0, 7) + '-01';
    await panel
      .getByRole('button', { name: label(first), exact: true })
      .click();
    expect(requests).toHaveLength(1);
    await panel.getByRole('button', { name: 'Bulan berikutnya' }).click();
    await expect(
      panel.getByRole('button', { name: label(shift(first, 31)), exact: true }),
    ).toBeDisabled();
    await panel.getByRole('button', { name: 'Bulan sebelumnya' }).click();
    await panel
      .getByRole('button', { name: label(shift(first, 2)), exact: true })
      .click();
    await expect(panel).not.toBeVisible();
    await expect
      .poll(() => requests.at(-1)?.searchParams.get('startAt'))
      .toBe(first + 'T00:00:00+07:00');
    expect(requests.at(-1)?.searchParams.get('endAt')).toBe(
      shift(first, 3) + 'T00:00:00+07:00',
    );
    await expect(trigger).toHaveCSS('border-color', 'rgb(255, 64, 129)');
    expect(await trigger.textContent()).toBe('');
    await trigger.click();
    await page.mouse.click(3, 200);
    await expect(panel).not.toBeVisible();
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
