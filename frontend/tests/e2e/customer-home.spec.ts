import { test, expect } from '@playwright/test';
import {
  customerSession,
  item,
  booking,
  financial,
} from '../customer-fixtures';
for (const width of [360, 1440]) {
  test(`customer homepage keeps payment actionable and catalog usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/auth/session', (r) =>
      r.fulfill({ json: customerSession }),
    );
    await page.route('**/api/items?**', (r) =>
      r.fulfill({ json: { data: [item], total: 1, page: 1 } }),
    );
    await page.route('**/api/bookings?**', (r) =>
      r.fulfill({ json: [booking] }),
    );
    await page.route('**/api/bookings/test-booking/payments', (r) =>
      r.fulfill({ json: financial() }),
    );
    await page.route('**/media/**', (r) => r.fulfill({ status: 204 }));
    await page.goto('/app/');
    await expect(
      page.getByRole('heading', { name: 'Untuk rencana berikutnya' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Lihat perangkat', exact: true }),
    ).toHaveAttribute('href', '/catalog/test-item');
    const aside = page.getByRole('complementary', {
      name: 'Informasi dan tindakan sewa',
    });
    await expect(
      aside.getByRole('link', { name: 'Bayar & upload bukti' }),
    ).toHaveAttribute('href', '/app/bookings/test-booking/payment');
    await expect(
      aside.getByText(/Rp\s*20\.000/, { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../docs/frontend/customer-home-${width}.png`,
      fullPage: true,
    });
  });
}
test('customer homepage explains empty bookings and permits retrying a failed catalog', async ({
  page,
}) => {
  let failed = true;
  await page.route('**/api/auth/session', (r) =>
    r.fulfill({ json: customerSession }),
  );
  await page.route('**/api/bookings?**', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/items?**', (r) =>
    r.fulfill(
      failed
        ? { status: 503, json: { message: 'Katalog gagal dimuat' } }
        : { json: { data: [item], total: 1, page: 1 } },
    ),
  );
  await page.goto('/app/');
  await expect(
    page.getByRole('heading', { name: 'Tidak ada pembayaran tertunda' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Belum ada booking' }),
  ).toBeVisible();
  await expect(
    page.getByText('Layanan sedang bermasalah. Coba lagi sebentar.'),
  ).toBeVisible();
  failed = false;
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Lihat perangkat', exact: true }),
  ).toBeVisible();
});

test('calendar range checks availability and carries the selected dates', async ({
  page,
}) => {
  await page.route('**/api/auth/session', (r) =>
    r.fulfill({ json: customerSession }),
  );
  await page.route('**/api/bookings?**', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/items?**', (r) =>
    r.fulfill({
      json: {
        data: [
          item,
          { ...item, id: 'unavailable-item', name: 'Perangkat penuh' },
        ],
        total: 2,
        page: 1,
      },
    }),
  );
  await page.route('**/media/**', (r) => r.fulfill({ status: 204 }));
  const tomorrow = new Date(Date.now() + 7 * 3600000 + 86400000)
    .toISOString()
    .slice(0, 10);
  const label = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(tomorrow + 'T00:00:00Z'));
  let checks = 0;
  await page.route('**/api/bookings/availability', async (r) => {
    checks++;
    const input = r.request().postDataJSON();
    expect(input.durationHours).toBe(6);
    expect(input.startAt).toBe(tomorrow + 'T10:00:00+07:00');
    const quantity = input.items[0].itemId === item.id ? 2 : 0;
    await r.fulfill({
      json: {
        checkedAt: new Date().toISOString(),
        available: quantity > 0,
        reservesStock: false,
        items: [
          {
            itemId: input.items[0].itemId,
            requestedQuantity: 1,
            availableQuantity: quantity,
          },
        ],
      },
    });
  });
  await page.goto('/app/');
  const trigger = page.getByLabel('Pilih rentang tanggal sewa', {
    exact: true,
  });
  await trigger.click();
  await page.getByRole('button', { name: label, exact: true }).click();
  expect(checks).toBe(0);
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(
    page.getByText('2 unit tersedia', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Tidak tersedia pada jadwal ini', { exact: true }),
  ).toBeVisible();
  const href = await page
    .getByRole('link', { name: 'Pilih jadwal ini', exact: true })
    .getAttribute('href');
  const params = new URL(href!, 'http://localhost').searchParams;
  expect(params.get('startAt')).toBe(tomorrow + 'T10:00:00+07:00');
  expect(params.get('durationHours')).toBe('6');
  await expect(trigger).toHaveCSS('border-color', 'rgb(255, 64, 129)');
  await expect(trigger).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.route('**/api/bookings/availability', (r) =>
    r.fulfill({ status: 400, json: { message: 'Jadwal terlalu dekat.' } }),
  );
  await page.reload();
  await trigger.click();
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(1);
  await expect(page.getByRole('alert')).toContainText('Jadwal terlalu dekat.');
  await expect(
    page.getByRole('button', { name: 'Coba lagi ketersediaan', exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: 'Pilih jadwal ini', exact: true }),
  ).toHaveCount(0);
  await trigger.click();
  await page.getByRole('button', { name: 'Reset filter', exact: true }).click();
  await expect(page.getByText('2 unit tersedia', { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator('.calendar-filter')).not.toHaveClass(/is-filtered/);
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('heading', { name: 'Pilih rentang tanggal', exact: true }),
  ).toBeHidden();
});

for (const width of [390, 1440]) {
  test(`calendar dismisses outside but stays open for inside interactions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/session', (r) =>
      r.fulfill({ json: customerSession }),
    );
    await page.route('**/api/bookings?**', (r) => r.fulfill({ json: [] }));
    await page.route('**/api/items?**', (r) =>
      r.fulfill({ json: { data: [], total: 0, page: 1 } }),
    );
    await page.goto('/app/');
    const trigger = page.getByLabel('Pilih rentang tanggal sewa', {
      exact: true,
    });
    const heading = page.getByRole('heading', {
      name: 'Pilih rentang tanggal',
      exact: true,
    });
    await trigger.click();
    await page
      .getByRole('button', { name: 'Bulan berikutnya', exact: true })
      .click();
    await expect(heading).toBeVisible();
    await page
      .getByRole('heading', { name: 'Untuk rencana berikutnya', exact: true })
      .click();
    await expect(heading).toBeHidden();
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(heading).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/notifications?**', (route) =>
    route.fulfill({
      json: { data: [], total: 0, unread: 0, page: 1, limit: 10 },
    }),
  );
});
