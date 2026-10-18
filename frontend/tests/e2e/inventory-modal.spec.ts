import { test, expect } from '@playwright/test';
import { adminSession } from '../admin-fixtures';
import { inventoryItem, inventoryUnits } from '../inventory-fixtures';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (r) =>
    r.fulfill({ json: adminSession }),
  );
  await page.route('**/api/notifications?**', (r) =>
    r.fulfill({ json: { data: [], total: 0, unread: 0 } }),
  );
  await page.route('**/api/admin/items?**', (r) =>
    r.fulfill({ json: { data: [inventoryItem], total: 1, page: 1 } }),
  );
  await page.route('**/api/admin/items/test-item', (r) =>
    r.fulfill({ json: inventoryItem }),
  );
  await page.route('**/api/admin/items/test-item/units?**', (r) =>
    r.fulfill({ json: { data: inventoryUnits(), total: 3, page: 1 } }),
  );
});
for (const width of [360, 768, 1440]) {
  test(`create modal validates, reviews and protects in-flight saves at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let calls = 0;
    let payload: unknown;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/admin/items', async (r) => {
      calls++;
      payload = r.request().postDataJSON();
      await gate;
      await r.fulfill({ status: 201, json: inventoryItem });
    });
    await page.goto('/admin/inventory?category=iphone');
    const add = page.getByRole('button', { name: 'Tambah model', exact: true });
    await add.click();
    const modal = page.getByRole('dialog', { name: 'Tambah model' });
    await expect(modal).toBeVisible();
    await expect(page).toHaveURL(/inventory\?category=iphone$/);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(
      'hidden',
    );
    await modal.getByRole('button', { name: 'Periksa model' }).click();
    await expect(modal.getByRole('alert')).toContainText('Nama wajib diisi');
    expect(calls).toBe(0);
    await modal.getByLabel('Nama model').fill('iPhone Model Baru');
    for (const hour of ['6', '12', '24'])
      await modal
        .getByLabel(`Tarif ${hour} jam (rupiah)`)
        .fill('9007199254740993');
    await modal.getByLabel('Isi paket (satu per baris)').fill('Kabel\nTas');
    await modal.getByRole('button', { name: 'Periksa model' }).click();
    await expect(
      modal.getByRole('button', { name: 'Konfirmasi perubahan' }),
    ).toBeVisible();
    expect(calls).toBe(0);
    await modal.getByRole('button', { name: 'Batal perubahan' }).click();
    await expect(modal.getByLabel('Nama model')).toHaveValue(
      'iPhone Model Baru',
    );
    await modal.getByRole('button', { name: 'Periksa model' }).click();
    await modal.getByRole('button', { name: 'Konfirmasi perubahan' }).click();
    await expect.poll(() => calls).toBe(1);
    await expect(
      modal.getByRole('button', { name: 'Tutup formulir' }),
    ).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(modal).toBeVisible();
    release();
    await expect(page).toHaveURL(/inventory\/test-item$/);
    await expect(modal).not.toBeVisible();
    expect(payload).toMatchObject({
      name: 'iPhone Model Baru',
      category: 'iphone',
      price6h: '9007199254740993',
      includes: ['Kabel', 'Tas'],
    });
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      'hidden',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test('modal supports Escape, outside click, focus containment and returning focus to the trigger', async ({
  page,
}) => {
  await page.goto('/admin/inventory');
  const add = page.getByRole('button', { name: 'Tambah model', exact: true });
  await add.click();
  const modal = page.getByRole('dialog', { name: 'Tambah model' });
  for (let n = 0; n < 12; n++) {
    await page.keyboard.press('Tab');
    expect(
      await modal.evaluate((e) => e.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
  await expect(add).toBeFocused();
  await add.click();
  await page.mouse.click(2, 2);
  await expect(modal).not.toBeVisible();
  await expect(add).toBeFocused();
});
test('direct create URL opens a modal and cancel returns to inventory', async ({
  page,
}) => {
  await page.goto('/admin/inventory/new');
  const modal = page.getByRole('dialog', { name: 'Tambah model' });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Batal', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/inventory$/);
  await expect(
    page.getByRole('heading', { name: 'Inventaris', exact: true }),
  ).toBeVisible();
});
