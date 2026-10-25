import { test, expect } from './fixtures';
import { customerSession } from '../customer-fixtures';

for (const width of [360, 1440]) {
  test(`requires saving profile before using home at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let completed = false;
    let failSave = true;
    let attempts = 0;
    const profile = {
      fullName: 'Penyewa Baru',
      address: 'Jalan Semarang 12',
      phoneActive: '081234567890',
      phoneAlt: null,
      instagram: null,
      emailContact: null,
      completedAt: '2026-10-20T00:00:00Z',
    };
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        json: {
          ...customerSession,
          user: {
            ...customerSession.user,
            phone: '+6281234567890',
            profile: completed ? { completedAt: profile.completedAt } : null,
          },
        },
      }),
    );
    await page.route('**/api/customer/profile', async (route) => {
      if (route.request().method() === 'PUT') {
        attempts++;
        if (failSave)
          return route.fulfill({
            status: 503,
            json: { message: 'Profil gagal disimpan. Coba lagi.' },
          });
        completed = true;
        return route.fulfill({ json: profile });
      }
      return route.fulfill({ json: completed ? profile : null });
    });
    await page.goto('/app/');
    const modal = page.getByRole('dialog', { name: 'Lengkapi data diri' });
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel('Nama lengkap')).toBeVisible();
    await expect(modal.getByLabel('Nomor HP aktif')).toHaveValue(
      '+6281234567890',
    );
    await page.screenshot({
      path: `test-results/profile-onboarding-${width}.png`,
    });
    await page.keyboard.press('Escape');
    await page.mouse.click(2, 2);
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Simpan profil' }).click();
    await expect(modal.getByText('Isi alamat.')).toBeVisible();
    expect(attempts).toBe(0);
    await modal.getByLabel('Nama lengkap').fill(profile.fullName);
    await modal.getByLabel('Alamat', { exact: true }).fill(profile.address);
    await modal.getByLabel('Nomor HP aktif').fill(profile.phoneActive);
    await modal.getByLabel('NIK', { exact: true }).fill('3374000000000001');
    const nik = modal.getByLabel('NIK', { exact: true });
    await expect(nik).toHaveAttribute('type', 'password');
    await modal
      .getByRole('button', { name: 'Tampilkan NIK', exact: true })
      .click();
    await expect(nik).toHaveAttribute('type', 'text');
    await expect(nik).toHaveValue('3374000000000001');
    await modal
      .getByRole('button', { name: 'Sembunyikan NIK', exact: true })
      .click();
    await expect(nik).toHaveAttribute('type', 'password');
    await modal.getByRole('button', { name: 'Simpan profil' }).click();
    await expect(modal.getByRole('alert')).toContainText(
      'Layanan sedang bermasalah',
    );
    failSave = false;
    await modal.getByRole('button', { name: 'Simpan profil' }).click();
    await expect(modal).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Pilih perangkat' }),
    ).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

test('saved profile contact takes priority and the eye never reveals a stored NIK', async ({
  page,
}) => {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: {
        ...customerSession,
        user: { ...customerSession.user, phone: '+6281234567890' },
      },
    }),
  );
  await page.route('**/api/customer/profile', (route) =>
    route.fulfill({
      json: {
        fullName: 'Penyewa Lengkap',
        address: 'Semarang',
        phoneActive: '+6281999999999',
        phoneAlt: null,
        instagram: null,
        emailContact: null,
        completedAt: '2026-10-20T00:00:00Z',
      },
    }),
  );
  await page.goto('/app/profile');
  await expect(page.getByLabel('Nomor HP aktif')).toHaveValue('+6281999999999');
  const nik = page.getByLabel('Ganti NIK (opsional)', { exact: true });
  await expect(nik).toHaveValue('');
  await page.getByRole('button', { name: 'Tampilkan NIK' }).click();
  await expect(nik).toHaveAttribute('type', 'text');
  await expect(nik).toHaveValue('');
});
