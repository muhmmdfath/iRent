import { test, expect } from '@playwright/test';
const account = {
  user: {
    id: 'visual-fixture',
    name: 'Penyewa iRent',
    email: 'penyewa@example.test',
    phone: null,
    role: 'customer',
    profile: null,
  },
  csrfToken: 'fixture-csrf',
};
for (const width of [360, 390, 768, 1024, 1440]) {
  test(`login and workspace stay readable at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    let signedIn = false;
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        status: signedIn ? 200 : 401,
        json: signedIn ? account : { message: 'Silakan login.' },
      }),
    );
    await page.route('**/api/auth/login', (route) => {
      signedIn = true;
      return route.fulfill({ json: account });
    });
    await page.route('**/api/bookings?**', (route) =>
      route.fulfill({ json: [] }),
    );
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: 'Masuk', exact: true }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByLabel('Email atau nomor HP')).toHaveCSS(
      'font-family',
      /Poppins/,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`login-${width}.png`),
      fullPage: true,
    });
    await page.getByLabel('Email atau nomor HP').fill('penyewa@example.test');
    await page
      .getByLabel('Password', { exact: true })
      .fill('password-yang-valid');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page).toHaveURL(/\/app\//);
    await expect(
      page.getByRole('heading', { name: 'Selamat datang, Penyewa iRent.' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`workspace-${width}.png`),
      fullPage: true,
    });
  });
}
test('keyboard login, cookie-session reload and logout', async ({ page }) => {
  let signedIn = false;
  let logoutToken: string | undefined;
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: signedIn ? 200 : 401,
      json: signedIn ? account : {},
    }),
  );
  await page.route('**/api/auth/login', (route) => {
    signedIn = true;
    return route.fulfill({ json: account });
  });
  await page.route('**/api/auth/logout', (route) => {
    logoutToken = route.request().headers()['x-csrf-token'];
    signedIn = false;
    return route.fulfill({ status: 204 });
  });
  await page.goto('/app/account');
  await page.getByLabel('Email atau nomor HP').fill('penyewa@example.test');
  await page
    .getByLabel('Password', { exact: true })
    .fill('password-yang-valid');
  await page.getByLabel('Password', { exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Akun saya' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Akun saya' })).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
  await page.getByRole('button', { name: 'Keluar' }).click();
  await expect(
    page.getByRole('heading', { name: 'Masuk', exact: true }),
  ).toBeVisible();
  expect(logoutToken).toBe('fixture-csrf');
});

for (const width of [390, 1440]) {
  test(`admin shell and navigation work at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        json: {
          ...account,
          user: { ...account.user, name: 'Admin Uji iRent', role: 'admin' },
        },
      }),
    );
    await page.goto('/admin/account');
    await expect(
      page.getByRole('heading', { name: 'Akun saya' }),
    ).toBeVisible();
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/admin/manifest.webmanifest',
    );
    if (width < 1024) {
      const menu = page.getByRole('button', { name: 'Buka navigasi' });
      await menu.click();
      await expect(
        page.getByRole('navigation', { name: 'Navigasi utama' }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`admin-${width}.png`),
      fullPage: true,
    });
  });
}
