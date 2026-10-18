import { test, expect } from '@playwright/test';
import { customerSession } from '../customer-fixtures';
const profile = {
  fullName: 'Penyewa Lengkap',
  address: 'Jalan Uji 12, Semarang',
  phoneActive: '+6281234567890',
  phoneAlt: null,
  instagram: null,
  emailContact: null,
  completedAt: '2026-10-17T10:00:00+07:00',
};
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (r) =>
    r.fulfill({ json: customerSession }),
  );
  await page.route('**/api/notifications?**', (r) =>
    r.fulfill({ json: { data: [], total: 0, unread: 0, page: 1, limit: 10 } }),
  );
});
for (const width of [390, 1440]) {
  test(`account shows real profile/contact cards and useful links at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.route('**/api/customer/profile', (r) =>
      r.fulfill({ json: profile }),
    );
    await page.goto('/app/account');
    await expect(
      page.getByText('Profil lengkap', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(profile.address, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Belum ditambahkan', { exact: true }),
    ).toHaveCount(3);
    await expect(
      page.getByRole('link', { name: 'Kelola kontak', exact: true }),
    ).toHaveAttribute('href', '/app/profile');
    await expect(
      page.getByRole('link', { name: 'Booking saya', exact: true }).last(),
    ).toHaveAttribute('href', '/app/bookings');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test('missing profile prompts completion, and loading errors never claim that data is missing', async ({
  page,
}) => {
  let fail = false;
  await page.route('**/api/customer/profile', (r) =>
    r.fulfill(
      fail ? { status: 503, json: { message: 'Gagal' } } : { json: null },
    ),
  );
  await page.goto('/app/account');
  await expect(
    page.getByText('Profil belum lengkap', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Lengkapi profil penyewa', exact: true }),
  ).toBeVisible();
  fail = true;
  await page.reload();
  await expect(
    page.getByText('Status belum tersedia', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Profil belum lengkap', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Coba lagi', exact: true }),
  ).toBeVisible();
});
test('admin account does not request a customer profile', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/auth/session', (r) =>
    r.fulfill({
      json: {
        ...customerSession,
        user: { ...customerSession.user, role: 'admin' },
      },
    }),
  );
  await page.route('**/api/customer/profile', (r) => {
    calls++;
    return r.fulfill({ status: 403, json: {} });
  });
  await page.goto('/admin/account');
  await expect(
    page.getByRole('heading', { name: 'Informasi akun', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Profil penyewa', exact: true }),
  ).toHaveCount(0);
  expect(calls).toBe(0);
});
