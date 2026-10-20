import { test, expect } from './fixtures';
import { customerSession } from '../customer-fixtures';
for (const width of [390, 1440]) {
  test(`inbox read states, dismissal and action feedback work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    let read = false,
      fail = false;
    const profile = {
      fullName: 'Penyewa Lengkap',
      address: 'Alamat pengujian',
      phoneActive: '+6281234567890',
      phoneAlt: null,
      instagram: null,
      emailContact: null,
      completedAt: '2026-10-17T10:00:00+07:00',
    };
    await page.route('**/api/auth/session', (r) =>
      r.fulfill({ json: customerSession }),
    );
    await page.route('**/api/customer/profile', (r) =>
      r.request().method() === 'PUT'
        ? r.fulfill(
            fail
              ? { status: 503, json: { message: 'Gagal' } }
              : { json: profile },
          )
        : r.fulfill({ json: profile }),
    );
    await page.route('**/api/notifications?**', (r) =>
      r.fulfill({
        json: {
          data: [
            {
              id: 'notification-one',
              title: 'Booking dikonfirmasi',
              message: 'IRN-TEST',
              href: '/app/bookings/test-booking',
              createdAt: '2026-10-17T10:00:00+07:00',
              readAt: read ? '2026-10-17T11:00:00+07:00' : null,
            },
          ],
          unread: read ? 0 : 1,
          total: 1,
          page: 1,
          limit: 10,
        },
      }),
    );
    await page.route('**/api/notifications/read-all', (r) => {
      read = true;
      return r.fulfill({ json: { ok: true } });
    });
    await page.goto('/app/profile');
    const toggle = page.getByRole('button', {
      name: 'Notifikasi, 1 belum dibaca',
      exact: true,
    });
    await toggle.click();
    const inbox = page.getByRole('region', {
      name: 'Notifikasi pengguna',
      exact: true,
    });
    await expect(
      inbox.getByText('Booking dikonfirmasi', { exact: true }),
    ).toBeVisible();
    await inbox
      .getByRole('button', { name: 'Tandai semua dibaca', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Notifikasi', exact: true }),
    ).toBeVisible();
    await page.mouse.click(5, 200);
    await expect(inbox).toBeHidden();
    await page
      .getByRole('button', { name: 'Simpan profil', exact: true })
      .click();
    const toasts = page.getByRole('region', {
      name: 'Pemberitahuan tindakan',
      exact: true,
    });
    await expect(
      toasts.getByText('Profil berhasil disimpan', { exact: true }),
    ).toBeVisible();
    await toasts
      .getByRole('button', { name: 'Tutup notifikasi', exact: true })
      .click();
    await expect(
      toasts.getByText('Profil berhasil disimpan', { exact: true }),
    ).toHaveCount(0);
    fail = true;
    await page
      .getByRole('button', { name: 'Simpan profil', exact: true })
      .click();
    await expect(toasts.getByRole('alert')).toContainText(
      'Tindakan belum berhasil',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../docs/frontend/notifications-${width}.png`,
      fullPage: false,
    });
  });
}
