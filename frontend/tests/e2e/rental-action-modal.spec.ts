import { test, expect } from './fixtures';
import { customerSession } from '../customer-fixtures';
import { operationBooking, operationFinancial } from '../operations-fixtures';

test('return modal stays open during submission and closes only after the report succeeds', async ({
  page,
}) => {
  const record = operationBooking();
  let finishRequest: () => void = () => {};
  const completed = new Promise<void>((resolve) => {
    finishRequest = resolve;
  });
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: customerSession }),
  );
  await page.route('**/api/bookings/test-booking', (route) =>
    route.fulfill({ json: record }),
  );
  await page.route('**/api/bookings/test-booking/payments', (route) =>
    route.fulfill({ json: operationFinancial(record) }),
  );
  await page.route(
    '**/api/bookings/test-booking/items/test-unit-use/return-report',
    async (route) => {
      await completed;
      record.items![0].useStatus = 'return_pending';
      await route.fulfill({ json: { bookingId: record.id } });
    },
  );
  await page.goto('/app/bookings/test-booking');
  await page
    .getByRole('button', { name: 'Sudah mengembalikan IPHONE-TEST' })
    .click();
  const modal = page.getByRole('dialog', {
    name: 'Laporkan pengembalian unit',
  });
  await modal.getByRole('checkbox').check();
  await modal
    .getByRole('button', { name: 'Periksa laporkan pengembalian unit' })
    .click();
  await modal
    .getByRole('button', { name: 'Konfirmasi laporkan pengembalian unit' })
    .click();
  await expect(
    modal.getByRole('button', { name: 'Tutup modal', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();
  await page.mouse.click(1, 1);
  await expect(modal).toBeVisible();
  finishRequest();
  await expect(modal).toHaveCount(0);
  await expect(
    page.getByText('Laporan menunggu pemeriksaan admin', { exact: true }),
  ).toBeVisible();
});
