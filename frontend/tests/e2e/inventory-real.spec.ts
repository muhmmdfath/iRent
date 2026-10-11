import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('real API: create and edit model, upload photo, add units and finish maintenance through the UI', async ({
  page,
}) => {
  test.skip(
    process.env.IRENT_REAL_API !== '1' ||
      !process.env.IRENT_ADMIN_TEST_EMAIL ||
      !process.env.IRENT_ADMIN_TEST_PASSWORD,
    'Requires a disposable backend and test administrator credentials.',
  );
  test.setTimeout(120000);
  await page.goto('/login');
  await page
    .getByLabel('Email atau nomor HP')
    .fill(process.env.IRENT_ADMIN_TEST_EMAIL!);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.IRENT_ADMIN_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);
  await page.goto('/admin/inventory/new');
  const name = 'Model Pengujian Inventaris ' + randomUUID();
  await page.getByLabel('Nama model').fill(name);
  await page.getByLabel('Kategori', { exact: true }).selectOption('accessory');
  for (const hour of ['6', '12', '24'])
    await page.getByLabel(`Tarif ${hour} jam (rupiah)`).fill('15000');
  await page
    .getByLabel('Isi paket (satu per baris)')
    .fill('Kabel\nTas fixture');
  await page.getByRole('button', { name: 'Periksa model' }).click();
  await page.getByRole('button', { name: 'Konfirmasi perubahan' }).click();
  await expect(page.getByRole('heading', { name: 'Unit fisik' })).toBeVisible();
  const id = page.url().split('/').at(-1)!;
  await page.getByRole('button', { name: 'Edit model' }).click();
  await page.getByLabel('Tarif 6 jam (rupiah)').fill('17000');
  await page.getByRole('button', { name: 'Periksa model' }).click();
  await page.getByRole('button', { name: 'Konfirmasi perubahan' }).click();
  await expect(
    page.getByText(
      'Model diperbarui. Snapshot transaksi lama tetap tersimpan.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ganti foto' }).click();
  await page
    .getByLabel('Pilih foto')
    .setInputFiles('tests/fixtures/inventory-photo.png');
  await page.getByRole('button', { name: 'Konfirmasi perubahan' }).click();
  await expect(page.getByText('Foto model diperbarui.')).toBeVisible();
  await expect(page.getByRole('img', { name, exact: true })).toHaveAttribute(
    'src',
    /\/media\/items\/.+\.webp/,
  );
  await page.getByRole('button', { name: 'Tambah unit' }).click();
  await page.getByLabel('Jumlah unit aksesori').fill('2');
  await page.getByRole('button', { name: 'Periksa unit baru' }).click();
  await page.getByRole('button', { name: 'Konfirmasi perubahan' }).click();
  await expect(page.getByText('Unit baru ditambahkan.')).toBeVisible();
  const units = await (
    await page.request.get(`/api/admin/items/${id}/units`)
  ).json();
  expect(units.total).toBe(2);
  const code = units.data[0].code;
  await page
    .getByRole('button', { name: `Mulai perawatan ${code}`, exact: true })
    .click();
  await page
    .getByLabel('Alasan perawatan')
    .fill('Pemeriksaan fungsi unit fixture.');
  await page.getByRole('button', { name: 'Periksa perawatan' }).click();
  await page
    .getByRole('checkbox', { name: /sudah memeriksa kondisi fisik/ })
    .check();
  await page.getByRole('button', { name: 'Konfirmasi perubahan' }).click();
  await expect(
    page.getByRole('button', {
      name: `Selesaikan perawatan ${code}`,
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: `Selesaikan perawatan ${code}`, exact: true })
    .click();
  await page
    .getByRole('checkbox', { name: /sudah memeriksa kondisi fisik/ })
    .check();
  await page.getByRole('button', { name: 'Konfirmasi perubahan' }).click();
  await expect(
    page.getByRole('button', {
      name: `Selesaikan persiapan ${code}`,
      exact: true,
    }),
  ).toBeDisabled();
  const after = await (
    await page.request.get(`/api/admin/items/${id}/units`)
  ).json();
  const unit = after.data.find(
    (value: { code: string }) => value.code === code,
  );
  expect(unit.physicalStatus).toBe('preparing');
  expect(unit.conditionStatus).toBe('layak');
  expect(new Date(unit.preparationUntil).getTime()).toBeGreaterThan(
    Date.now() + 55 * 60000,
  );
  await page.getByRole('button', { name: 'Nonaktifkan katalog' }).click();
  await page.getByRole('button', { name: 'Konfirmasi perubahan' }).click();
  await expect(
    page.getByRole('button', { name: 'Aktifkan katalog' }),
  ).toBeVisible();
  expect((await page.request.get(`/api/items/${id}`)).status()).toBe(404);
  expect((await page.request.get(`/api/admin/items/${id}`)).status()).toBe(200);
  const detail = await (
    await page.request.get(`/api/admin/items/${id}`)
  ).json();
  expect(detail.price6h).toBe('17000');
});
