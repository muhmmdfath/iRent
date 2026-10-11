import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
test('real seeded API: all management and customer screens render responsively without API errors', async ({
  page,
  context,
}, info) => {
  test.skip(
    process.env.IRENT_DEMO_AUDIT !== '1',
    'Requires explicitly seeded local simulation database.',
  );
  test.setTimeout(360000);
  const manifest = JSON.parse(
    readFileSync(resolve('../backend/storage/demo/scenarios.json'), 'utf8'),
  ) as {
    runs: Record<
      string,
      {
        scenarios: Record<
          string,
          { id: string; code: string; extensionId?: string; customer: number }
        >;
      }
    >;
  };
  const run = Object.values(manifest.runs).at(-1)!;
  const failures: string[] = [];
  const jsErrors: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400)
      failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on('pageerror', (error) => jsErrors.push(error.message));
  await context.addCookies(JSON.parse(process.env.IRENT_AUDIT_ADMIN_COOKIE!));
  const quote = run.scenarios['quotation-ongkir-terpisah'];
  const pending = run.scenarios['perpanjangan-bukti-pending'];
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [route, title] of [
      ['/admin', 'Selamat datang,'],
      ['/admin/customers', 'Data penyewa'],
      ['/admin/accounts', 'Admin'],
      ['/admin/settings', 'Pengaturan sewa'],
      ['/admin/zones', 'Zona antar-jemput'],
      ['/admin/reports', 'Laporan & transaksi berhasil'],
      ['/admin/calendar', 'Jadwal per unit'],
      ['/admin/risks', 'Risiko & tindak lanjut'],
      ['/admin/notifications', 'Notifikasi PWA'],
      ['/admin/extensions', 'Perpanjangan'],
      ['/admin/refunds', 'Refund'],
      ['/admin/guide', 'Panduan admin'],
      [
        `/admin/bookings/${pending.id}/extensions/${pending.extensionId}`,
        'Detail perpanjangan',
      ],
      [
        `/admin/bookings/${quote.id}/extensions/${quote.extensionId}`,
        'Detail perpanjangan',
      ],
    ]) {
      await page.goto(route);
      await expect(
        page.getByRole('heading', { level: 1 }).filter({ hasText: title }),
        route,
      ).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.workspace-main [role="alert"]')).toHaveCount(
        0,
      );
      await expect(page.locator('.workspace-main [role="status"]')).toHaveCount(
        0,
        { timeout: 15000 },
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + ' at ' + width,
      ).toBe(true);
      if (width === 360 || width === 1440)
        await page.screenshot({
          path: info.outputPath(
            route.split('/').filter(Boolean).join('-') + '-' + width + '.png',
          ),
          fullPage: true,
        });
    }
  }
  await context.clearCookies();
  await context.addCookies(
    JSON.parse(process.env.IRENT_AUDIT_CUSTOMER_COOKIE!),
  );
  const running = run.scenarios['sedang-disewa'];
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/',
      '/catalog',
      '/terms',
      '/app',
      '/app/profile',
      '/app/bookings',
      `/app/bookings/${running.id}`,
      `/app/bookings/${running.id}/extensions/new`,
      `/app/bookings/${running.id}/extensions/${running.extensionId}`,
    ]) {
      await page.goto(route);
      await expect(page.locator('main h1'), route).toBeVisible({
        timeout: 15000,
      });
      await expect(page.locator('main [role="alert"]')).toHaveCount(0);
      await expect(page.locator('main [role="status"]')).toHaveCount(0, {
        timeout: 15000,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + ' at ' + width,
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(
          'customer-' +
            (route.split('/').filter(Boolean).join('-') || 'home') +
            '-' +
            width +
            '.png',
        ),
        fullPage: true,
      });
    }
  }
  expect(failures).toEqual([]);
  expect(jsErrors).toEqual([]);
});
