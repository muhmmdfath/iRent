import { test, expect } from './fixtures';
import { adminSession } from '../admin-fixtures';
import { inventoryItem, inventoryUnits } from '../inventory-fixtures';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/notifications?**', (r) =>
    r.fulfill({ json: { data: [], total: 0, unread: 0, page: 1, limit: 10 } }),
  );
});
for (const width of [360, 390, 768, 1024, 1440]) {
  test(`inventory and maintenance review remain usable at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ json: adminSession }),
    );
    await page.route('**/api/admin/items?**', (route) =>
      route.fulfill({ json: { data: [inventoryItem], total: 1, page: 1 } }),
    );
    await page.route('**/api/admin/items/test-item', (route) =>
      route.fulfill({ json: inventoryItem }),
    );
    await page.route('**/api/admin/items/test-item/units?**', (route) =>
      route.fulfill({ json: { data: inventoryUnits(), total: 3, page: 1 } }),
    );
    await page.goto('/admin/inventory');
    await expect(page.getByText('1 siap fisik')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`admin-inventory-${width}.png`),
      fullPage: true,
    });
    await page.getByRole('link', { name: 'Kelola iPhone Uji' }).click();
    await expect(
      page.getByRole('button', { name: 'Selesaikan persiapan IPH-003' }),
    ).toBeDisabled();
    await page
      .getByRole('button', { name: 'Selesaikan perawatan IPH-002' })
      .click();
    await page
      .getByRole('checkbox', { name: /sudah memeriksa kondisi fisik/ })
      .check();
    await expect(
      page.getByRole('button', { name: 'Konfirmasi perubahan' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`admin-units-${width}.png`),
      fullPage: true,
    });
  });
}
test('photo upload uses multipart and restores the model image after a failed old cover', async ({
  page,
}) => {
  let item = { ...inventoryItem },
    uploaded = false;
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: adminSession }),
  );
  await page.route('**/api/admin/items/test-item', (route) =>
    route.fulfill({ json: item }),
  );
  await page.route('**/api/admin/items/test-item/units?**', (route) =>
    route.fulfill({ json: { data: inventoryUnits(), total: 3, page: 1 } }),
  );
  await page.route('**/media/items/test.webp', (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.route('**/api/admin/items/test-item/photo', async (route) => {
    expect(route.request().headers()['content-type']).toContain(
      'multipart/form-data; boundary=',
    );
    expect(route.request().headers()['x-csrf-token']).toBe('admin-csrf');
    expect(route.request().postDataBuffer()?.toString()).toContain(
      'name="file"',
    );
    uploaded = true;
    item = { ...item, photoPath: '/media/items/uploaded.webp' };
    await route.fulfill({ json: { path: item.photoPath, result: item } });
  });
  await page.route('**/media/items/uploaded.webp', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.goto('/admin/inventory/test-item');
  await expect(page.getByText('Foto belum tersedia')).toBeVisible();
  await page.getByLabel('Tindakan model', { exact: true }).click();
  await page.getByRole('button', { name: 'Ganti foto' }).click();
  await page.getByLabel('Pilih foto').setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByAltText('Preview foto model')).toBeVisible();
  expect(uploaded).toBe(false);
  await page.getByRole('button', { name: 'Konfirmasi perubahan' }).click();
  await expect(page.getByText('Foto model diperbarui.')).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'iPhone Uji', exact: true }),
  ).toHaveAttribute('src', '/media/items/uploaded.webp');
});

test('browser back clears an open unit action when the page changes', async ({
  page,
}) => {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: adminSession }),
  );
  await page.route('**/api/admin/items/test-item', (route) =>
    route.fulfill({ json: inventoryItem }),
  );
  await page.route('**/api/admin/items/test-item/units?**', (route) =>
    route.fulfill({
      json: {
        data: inventoryUnits(),
        total: 21,
        page: Number(new URL(route.request().url()).searchParams.get('page')),
      },
    }),
  );
  await page.goto('/admin/inventory/test-item');
  await page.getByRole('button', { name: 'Berikutnya' }).click();
  await expect(page).toHaveURL(/page=2/);
  await page
    .getByRole('button', { name: 'Selesaikan perawatan IPH-002' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Tambah unit' }),
  ).toBeDisabled();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Tambah unit' })).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Konfirmasi perubahan' }),
  ).toHaveCount(0);
});
