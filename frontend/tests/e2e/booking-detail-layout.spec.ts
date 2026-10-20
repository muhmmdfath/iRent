import { test, expect } from './fixtures';
import { customerSession, booking, financial } from '../customer-fixtures';
import { operationBooking, operationFinancial } from '../operations-fixtures';

for (const width of [360, 768, 1440]) {
  test(`rental detail keeps per-unit actions and payment accessible at ${width}px`, async ({
    page,
  }, info) => {
    const record = operationBooking();
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ json: customerSession }),
    );
    await page.route('**/api/bookings/test-booking', (route) =>
      route.fulfill({ json: record }),
    );
    await page.route('**/api/bookings/test-booking/payments', (route) =>
      route.fulfill({ json: operationFinancial(record) }),
    );
    await page.goto('/app/bookings/test-booking');
    await expect(
      page.getByRole('heading', { name: 'Perangkat & jadwal' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Lihat pembayaran' }),
    ).toHaveAttribute('href', '/app/bookings/test-booking/payment');
    await page.getByRole('link', { name: 'Laporkan pengembalian' }).click();
    const returnAction = page.getByRole('button', {
      name: 'Sudah mengembalikan TRIPOD-TEST',
    });
    await expect(returnAction).toHaveCSS(
      'background-color',
      'rgb(255, 64, 129)',
    );
    await returnAction.hover();
    await expect(returnAction).toHaveCSS('background-color', 'rgb(23, 23, 23)');
    await returnAction.click();
    const returnModal = page.getByRole('dialog', {
      name: 'Laporkan pengembalian unit',
    });
    await expect(returnModal).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Laporkan pengembalian unit' }),
    ).toBeVisible();
    await expect(page.getByText(/Unit TRIPOD-TEST: pastikan/)).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`return-modal-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(returnModal).toHaveCount(0);
    await expect(returnAction).toBeFocused();
    const extensionAction = page.getByRole('button', {
      name: 'Ajukan perpanjangan',
      exact: true,
    });
    await expect(extensionAction).toHaveCSS(
      'background-color',
      'rgb(255, 64, 129)',
    );
    await extensionAction.hover();
    await expect(extensionAction).toHaveCSS(
      'background-color',
      'rgb(23, 23, 23)',
    );
    await extensionAction.click();
    const extensionModal = page.getByRole('dialog', {
      name: 'Ajukan perpanjangan',
    });
    await expect(extensionModal).toBeVisible();
    await expect(extensionModal.getByRole('combobox')).toHaveCount(2);
    await extensionModal.getByRole('combobox').nth(1).selectOption('12');
    await extensionModal.getByRole('checkbox').check();
    await extensionModal
      .getByRole('button', { name: 'Periksa ajukan perpanjangan' })
      .click();
    await expect(
      extensionModal.getByRole('button', {
        name: 'Konfirmasi ajukan perpanjangan',
      }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/app/bookings/test-booking');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`booking-detail-${width}.png`),
      fullPage: true,
    });
  });
}

test('payment errors can be retried without losing the booking or cancellation action', async ({
  page,
}) => {
  let failed = true;
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: customerSession }),
  );
  await page.route('**/api/bookings/test-booking', (route) =>
    route.fulfill({ json: booking }),
  );
  await page.route('**/api/bookings/test-booking/payments', (route) =>
    route.fulfill(failed ? { status: 503, json: {} } : { json: financial() }),
  );
  await page.goto('/app/bookings/test-booking');
  const payment = page.getByRole('complementary', {
    name: 'Biaya & pembayaran',
  });
  await expect(payment.getByRole('alert')).toBeVisible();
  await expect(
    payment.getByRole('link', { name: 'Bayar & upload bukti' }),
  ).toHaveAttribute('href', '/app/bookings/test-booking/payment');
  failed = false;
  await payment.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(payment.getByRole('alert')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Batalkan booking', exact: true }),
  ).toBeVisible();
});
