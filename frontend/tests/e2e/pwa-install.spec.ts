import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { adminSession } from '../admin-fixtures';
import { customerSession } from '../customer-fixtures';

async function openAccount(page: Page, mode: 'admin' | 'customer') {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: mode === 'admin' ? adminSession : customerSession }),
  );
  await page.goto(mode === 'admin' ? '/admin/account' : '/app/account');
  await expect(
    page.getByRole('heading', { name: 'Informasi akun' }),
  ).toBeVisible();
}
async function offerInstall(
  page: Page,
  outcome: 'accepted' | 'dismissed' = 'accepted',
  fail = false,
) {
  await page.evaluate(
    ({ outcome, fail }) => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(event, {
        prompt: async () => {
          Reflect.set(
            window,
            'installCalls',
            Number(Reflect.get(window, 'installCalls') || 0) + 1,
          );
          if (fail) throw new Error('Browser installation unavailable');
        },
        userChoice: Promise.resolve({ outcome }),
      });
      window.dispatchEvent(event);
    },
    { outcome, fail },
  );
}
for (const mode of ['admin', 'customer'] as const) {
  test(`${mode} sees the correct install offer and prompts only after clicking`, async ({
    page,
  }, info) => {
    await page.setViewportSize({
      width: mode === 'admin' ? 1440 : 390,
      height: 900,
    });
    await openAccount(page, mode);
    const notice = page.getByRole('region', { name: /Pasang aplikasi iRent/ });
    await expect(notice).toHaveCount(0);
    const manifest = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href');
    expect(manifest).toBe(
      mode === 'admin'
        ? '/admin/manifest.webmanifest'
        : '/manifest.webmanifest',
    );
    const response = await page.request.get(manifest!);
    const data = await response.json();
    expect(data.scope).toBe(mode === 'admin' ? '/admin/' : '/');
    expect(data.start_url).toBe(mode === 'admin' ? '/admin/' : '/app/');
    const worker = await page.request.get(data.scope + 'sw.js');
    expect(worker.status()).toBe(200);
    await offerInstall(page);
    await expect(notice).toBeVisible();
    expect(
      await page.evaluate(() => Reflect.get(window, 'installCalls') || 0),
    ).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath('install-offer.png'),
      fullPage: true,
    });
    await notice.getByRole('button', { name: 'Pasang aplikasi' }).click();
    await expect(notice).toHaveCount(0);
    expect(await page.evaluate(() => Reflect.get(window, 'installCalls'))).toBe(
      1,
    );
    await offerInstall(page);
    await expect(notice).toHaveCount(0);
  });
}

test('postponing the offer survives reload and expires after seven days', async ({
  page,
}) => {
  await openAccount(page, 'admin');
  await offerInstall(page);
  await page.getByRole('button', { name: 'Nanti saja' }).click();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Informasi akun' }),
  ).toBeVisible();
  await offerInstall(page);
  await expect(
    page.getByRole('region', { name: /Pasang aplikasi iRent/ }),
  ).toHaveCount(0);
  const until = await page.evaluate(() =>
    Number(localStorage.getItem('irent.admin-pwa-install-dismissed-until')),
  );
  expect(until).toBeGreaterThan(Date.now() + 6 * 86400000);
  await page.evaluate(() =>
    localStorage.setItem(
      'irent.admin-pwa-install-dismissed-until',
      String(Date.now() - 1),
    ),
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Informasi akun' }),
  ).toBeVisible();
  await offerInstall(page);
  await expect(
    page.getByRole('button', { name: 'Pasang aplikasi' }),
  ).toBeVisible();
});

test('iPhone customers receive manual installation instructions without a native prompt', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    }),
  );
  await openAccount(page, 'customer');
  await page.getByRole('button', { name: 'Cara pasang' }).click();
  const guide = page.getByRole('dialog', { name: 'Pasang iRent Semarang' });
  await expect(guide).toBeVisible();
  await expect(
    guide.getByText(/Bagikan.*Tambahkan ke Layar Utama/),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('iphone-install-guide.png') });
  await guide.getByRole('button', { name: 'Mengerti' }).click();
  await expect(guide).toHaveCount(0);
  expect(
    await page.evaluate(() => Reflect.get(window, 'installCalls') || 0),
  ).toBe(0);
});

test('an app opened in standalone mode does not show an installation offer', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = original(query);
      if (query === '(display-mode: standalone)')
        Object.defineProperty(result, 'matches', { value: true });
      return result;
    };
  });
  await openAccount(page, 'customer');
  await offerInstall(page);
  await expect(
    page.getByRole('region', { name: /Pasang aplikasi iRent/ }),
  ).toHaveCount(0);
});

test('a failed native installation offers a manual guide and consumes the event', async ({
  page,
}) => {
  await openAccount(page, 'admin');
  await offerInstall(page, 'accepted', true);
  await page.getByRole('button', { name: 'Pasang aplikasi' }).click();
  const notice = page.getByRole('region', { name: /Pasang aplikasi iRent/ });
  await expect(notice.getByRole('alert')).toBeVisible();
  await notice.getByRole('button', { name: 'Cara pasang' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Pasang iRent Admin' }),
  ).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, 'installCalls'))).toBe(
    1,
  );
});

test('installing from browser UI hides the offer', async ({ page }) => {
  await openAccount(page, 'admin');
  await offerInstall(page);
  await expect(
    page.getByRole('button', { name: 'Pasang aplikasi' }),
  ).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(
    page.getByRole('region', { name: /Pasang aplikasi iRent/ }),
  ).toHaveCount(0);
});
