import { test, expect } from './fixtures';
import { adminSession } from '../admin-fixtures';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: adminSession }),
  );
});
for (const width of [360, 390, 768, 1024, 1440]) {
  test(`guide navigation and compact typography remain usable at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin/guide');
    const article = page.getByRole('article');
    await expect(
      article.getByRole('heading', { name: 'Mulai bertugas', exact: true }),
    ).toBeVisible();
    expect(
      await page
        .getByRole('heading', { name: 'Panduan admin' })
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
    ).toBeLessThanOrEqual(24);
    if (width < 768) {
      await expect(page.getByLabel('Pilih topik panduan')).toBeVisible();
      await page.getByLabel('Pilih topik panduan').selectOption('refund');
    } else {
      const navigation = page.getByRole('navigation', {
        name: 'Topik panduan',
      });
      await expect(navigation.getByRole('link')).toHaveCount(9);
      await navigation
        .getByRole('link', { name: 'Refund manual', exact: true })
        .click();
      await expect(
        navigation.getByRole('link', { name: 'Refund manual', exact: true }),
      ).toHaveAttribute('aria-current', 'page');
    }
    await expect(page).toHaveURL(/topik=refund/);
    await expect(
      article.getByRole('heading', { name: 'Refund manual', exact: true }),
    ).toBeVisible();
    await expect(
      article.getByRole('link', { name: 'Buka antrean refund' }),
    ).toHaveAttribute('href', '/admin/refunds');
    await expect(
      article.getByText(/Sistem tidak menjalankan transfer otomatis/),
    ).toBeVisible();
    await page.reload();
    await expect(
      article.getByRole('heading', { name: 'Refund manual', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath('guide.png'),
      fullPage: true,
    });
  });
}
test('topic links support keyboard, history, operating rules and matching action styles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/guide');
  const navigation = page.getByRole('navigation', { name: 'Topik panduan' });
  const payment = navigation.getByRole('link', {
    name: 'Verifikasi pembayaran',
    exact: true,
  });
  await payment.focus();
  await page.keyboard.press('Enter');
  await expect(
    page
      .getByRole('article')
      .getByRole('heading', { name: 'Verifikasi pembayaran', exact: true }),
  ).toBeVisible();
  await navigation
    .getByRole('link', { name: 'Persiapan & perawatan', exact: true })
    .click();
  await expect(
    page
      .getByRole('article')
      .getByText('Waktu habis tidak otomatis membuat unit siap'),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page
      .getByRole('article')
      .getByRole('heading', { name: 'Verifikasi pembayaran', exact: true }),
  ).toBeVisible();
  const action = page
    .getByRole('article')
    .getByRole('link', { name: 'Buka booking & pembayaran' });
  await expect(action).toHaveCSS('background-color', 'rgb(255, 64, 129)');
  await action.hover();
  await expect(action).toHaveCSS('background-color', 'rgb(23, 23, 23)');
  await navigation
    .getByRole('link', { name: 'Password & akses akun', exact: true })
    .click();
  await expect(
    page.getByRole('article').getByRole('link', { name: 'Buka keamanan akun' }),
  ).toHaveAttribute('href', '/admin/account');
});
