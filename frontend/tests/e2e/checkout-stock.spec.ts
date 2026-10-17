import { test, expect } from '@playwright/test';
import { customerSession, item, policy } from '../customer-fixtures';
test('stock limits plus/manual quantity, disables unavailable extras and rechecks changed schedules', async ({
  page,
}) => {
  const accessory = { ...item, category: 'accessory', name: 'Tripod Uji' };
  await page.route('**/api/auth/session', (r) =>
    r.fulfill({ json: customerSession }),
  );
  await page.route('**/api/customer/profile', (r) =>
    r.fulfill({
      json: {
        fullName: 'Penyewa Lengkap',
        address: 'Alamat uji',
        phoneActive: '+6281234567890',
        completedAt: '2026-10-01T00:00:00Z',
      },
    }),
  );
  await page.route('**/api/rental-policy', (r) => r.fulfill({ json: policy }));
  await page.route('**/api/items/test-item', (r) =>
    r.fulfill({ json: accessory }),
  );
  await page.route('**/api/items?**', (r) =>
    r.fulfill({
      json: {
        data: [
          accessory,
          { ...accessory, id: 'empty-item', name: 'Stok Kosong' },
        ],
        total: 2,
        page: 1,
      },
    }),
  );
  await page.route('**/api/delivery-zones', (r) => r.fulfill({ json: [] }));
  await page.route('**/media/**', (r) => r.fulfill({ status: 204 }));
  await page.route('**/api/bookings/availability', (r) => {
    const input = r.request().postDataJSON();
    const available =
      input.items[0].itemId === item.id && input.durationHours === 6 ? 2 : 0;
    return r.fulfill({
      json: {
        checkedAt: new Date().toISOString(),
        available: available > 0,
        reservesStock: false,
        items: [
          {
            itemId: input.items[0].itemId,
            requestedQuantity: 1,
            availableQuantity: available,
          },
        ],
      },
    });
  });
  await page.goto('/app/new?itemId=test-item&durationHours=6');
  const plus = page.getByRole('button', {
    name: 'Tambah jumlah Tripod Uji',
    exact: true,
  });
  const minus = page.getByRole('button', {
    name: 'Kurangi jumlah Tripod Uji',
    exact: true,
  });
  const quantity = page.getByRole('spinbutton', {
    name: 'Jumlah Tripod Uji',
    exact: true,
  });
  await expect(plus).toBeEnabled();
  await plus.click();
  await expect(quantity).toHaveValue('2');
  await expect(plus).toBeDisabled();
  await minus.click();
  await quantity.fill('99');
  await expect(quantity).toHaveValue('2');
  await expect(
    page.locator('#add-item option[value="empty-item"]'),
  ).toBeDisabled();
  await page.getByLabel('Durasi sewa', { exact: true }).selectOption('12');
  await expect(
    page.getByText(
      'Tidak tersedia pada jadwal ini. Pilih jadwal lain atau hapus item.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(plus).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Buat booking', exact: true }),
  ).toBeDisabled();
  await minus.click();
  await expect(quantity).toHaveValue('1');
});

test.beforeEach(async ({ page }) => {
  await page.route('**/api/notifications?**', (route) =>
    route.fulfill({
      json: { data: [], total: 0, unread: 0, page: 1, limit: 10 },
    }),
  );
});
