import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
// Opt in only with a local backend connected to a disposable test database.
test('real API: registration fixture, login, session reload, CSRF logout', async ({
  page,
  baseURL,
}) => {
  test.skip(
    process.env.IRENT_REAL_API !== '1',
    'Requires a local backend with a disposable database.',
  );
  const identity = 'frontend-' + randomUUID() + '@example.test';
  const password = 'fixture-' + randomUUID();
  const response = await page.request.post('/api/auth/register', {
    headers: { Origin: baseURL! },
    data: { name: 'Penyewa Uji Frontend', email: identity, password },
  });
  expect(response.status()).toBe(201);
  await page.context().clearCookies();
  await page.goto('/app/account');
  await page.getByLabel('Email atau nomor HP').fill(identity);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Akun saya' })).toBeVisible();
  await expect(page.getByText(identity)).toBeVisible();
  const cookies = await page.context().cookies();
  expect(
    cookies.some(
      (cookie) => cookie.name === 'irent_session' && cookie.httpOnly,
    ),
  ).toBe(true);
  expect((await page.request.get('/api/admin/accounts')).status()).toBe(403);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Akun saya' })).toBeVisible();
  const logoutResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/logout'),
  );
  await page.getByRole('button', { name: 'Keluar' }).click();
  expect((await logoutResponse).status()).toBe(204);
  await expect(
    page.getByRole('heading', { name: 'Masuk', exact: true }),
  ).toBeVisible();
  expect((await page.request.get('/api/auth/session')).status()).toBe(401);
});
