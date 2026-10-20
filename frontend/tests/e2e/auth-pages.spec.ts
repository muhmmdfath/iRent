import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures';
for (const width of [360, 768, 1440]) {
  for (const route of ['/login', '/register']) {
    test(`authentication layout and validation work on ${route} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 950 });
      await page.route('**/api/auth/session', (r) =>
        r.fulfill({ status: 401, json: {} }),
      );
      await page.goto(route);
      const register = route === '/register';
      await expect(
        page.getByRole('heading', {
          level: 2,
          name: register ? 'Buat akun' : 'Masuk',
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator('.auth-pink-link')).toHaveCount(2);
      for (const link of await page.locator('.auth-pink-link').all()) {
        await expect(link).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(link).toHaveCSS('color', 'rgb(255, 64, 129)');
      }
      await page
        .getByRole('button', {
          name: register ? 'Buat akun' : 'Masuk',
          exact: true,
        })
        .click();
      await expect(
        page.getByText(register ? 'Isi nama.' : 'Isi email atau nomor HP.', {
          exact: true,
        }),
      ).toBeVisible();
      if (register) {
        await page
          .getByRole('checkbox', { name: 'Tampilkan password', exact: true })
          .check();
        await expect(page.locator('#register-password')).toHaveAttribute(
          'type',
          'text',
        );
      } else {
        await page
          .getByRole('button', { name: 'Tampilkan password', exact: true })
          .click();
        await expect(page.locator('#password')).toHaveAttribute('type', 'text');
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: fileURLToPath(
          new URL(
            `../../../docs/frontend/auth-${register ? 'register' : 'login'}-${width}.png`,
            import.meta.url,
          ),
        ),
        fullPage: true,
      });
    });
  }
}
