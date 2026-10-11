import { test, expect } from '@playwright/test';
import { adminSession, adminBooking } from '../admin-fixtures';
import { booking, customerSession, financial } from '../customer-fixtures';
for (const width of [360, 390, 768, 1024, 1440]) {
  test(`refund review and bank transfer work at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const money = financial();
    money.booking.status = 'dibatalkan';
    Object.assign(money.summary, {
      bill: '10000',
      received: '20000',
      netCash: '20000',
      applied: '10000',
      remaining: '0',
      refundRequested: '10000',
      paymentStatus: 'ditutup',
    });
    const refund = {
      id: 'refund-test',
      status: 'diajukan',
      requestedAmount: '10000',
      approvedAmount: null as string | null,
      approvedAt: null as string | null,
      transferredAt: null as string | null,
      recipientDetails: {
        bankName: 'Bank Uji',
        accountNumber: '0012345678',
        accountHolder: 'Penyewa Uji',
      },
    };
    money.booking.refunds = [refund];
    let transfers = 0;
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ json: adminSession }),
    );
    await page.route('**/api/bookings/test-booking', (route) =>
      route.fulfill({ json: { ...adminBooking, status: 'dibatalkan' } }),
    );
    await page.route('**/api/bookings/test-booking/payments', (route) =>
      route.fulfill({ json: money }),
    );
    await page.route('**/api/admin/refunds?**', (route) =>
      route.fulfill({
        json: {
          data: [
            {
              ...refund,
              bookingId: 'test-booking',
              createdAt: new Date().toISOString(),
              booking: {
                code: adminBooking.code,
                customer: { name: 'Penyewa Uji' },
              },
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
        },
      }),
    );
    await page.route(
      '**/api/admin/refunds/refund-test/approve',
      async (route) => {
        expect(route.request().postDataJSON()).toEqual({});
        refund.status = 'disetujui';
        refund.approvedAmount = '10000';
        refund.approvedAt = new Date(Date.now() - 3600000).toISOString();
        await route.fulfill({ json: money });
      },
    );
    await page.route(
      '**/api/admin/refunds/refund-test/transfer',
      async (route) => {
        transfers++;
        expect(route.request().headers()['idempotency-key']).toBeTruthy();
        expect(route.request().postDataBuffer()?.toString()).toContain(
          'BANK-REFUND-TEST',
        );
        refund.status = 'sudah_dikembalikan';
        refund.transferredAt = new Date().toISOString();
        Object.assign(money.summary, {
          refunded: '10000',
          netCash: '10000',
          refundRequested: '0',
          refundApproved: '0',
        });
        await route.fulfill({ json: money });
      },
    );
    await page.route('**/api/admin/bookings/test-booking/receipts', (route) =>
      route.fulfill({ json: [] }),
    );
    await page.goto('/admin/refunds');
    await page.getByRole('link', { name: 'Periksa refund' }).click();
    await page
      .getByRole('button', { name: 'Setujui refund', exact: true })
      .click();
    const form = page.getByRole('region', {
      name: 'Setujui refund',
      exact: true,
    });
    await form.getByRole('checkbox').check();
    await form.getByRole('button', { name: 'Periksa setujui refund' }).click();
    await form
      .getByRole('button', { name: 'Konfirmasi setujui refund' })
      .click();
    await page
      .getByRole('button', { name: 'Catat transfer refund', exact: true })
      .click();
    await page
      .getByLabel('Waktu transfer (WIB)')
      .fill(
        new Date(Date.now() - 60000 + 7 * 3600000).toISOString().slice(0, 19),
      );
    await page.getByLabel('Referensi transaksi').fill('BANK-REFUND-TEST');
    await page
      .getByLabel('Catatan transfer')
      .fill('Transfer bank sudah berhasil diperiksa.');
    await page
      .getByLabel('Bukti transfer')
      .setInputFiles('tests/fixtures/inventory-photo.png');
    await page.getByRole('checkbox', { name: /transfer berhasil/ }).check();
    await page
      .getByRole('button', { name: 'Periksa catat transfer refund' })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`refund-transfer-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'Konfirmasi catat transfer refund' })
      .click();
    await expect(
      page.getByRole('button', { name: 'Unduh bukti refund' }),
    ).toBeVisible();
    expect(transfers).toBe(1);
  });
}
test('customer cancels, supplies their bank account and downloads private refund evidence', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const money = financial();
  const refund = {
    id: 'customer-refund',
    status: 'diajukan',
    requestedAmount: '10000',
    approvedAmount: null as string | null,
    transferredAt: null as string | null,
    recipientDetails: {} as {
      bankName?: string;
      accountNumber?: string;
      accountHolder?: string;
    },
  };
  let downloads = 0;
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: customerSession }),
  );
  await page.route('**/api/bookings/test-booking', (route) =>
    route.fulfill({ json: { ...booking, status: money.booking.status } }),
  );
  await page.route('**/api/bookings/test-booking/payments', (route) =>
    route.fulfill({ json: money }),
  );
  await page.route('**/api/bookings/test-booking/cancel', async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      reason: 'Rencana perjalanan berubah.',
    });
    money.booking.status = 'dibatalkan';
    money.booking.refunds = [refund];
    await route.fulfill({ json: money });
  });
  await page.route(
    '**/api/refunds/customer-refund/recipient',
    async (route) => {
      refund.recipientDetails = route.request().postDataJSON();
      expect(refund.recipientDetails.accountNumber).toBe('0012345678');
      await route.fulfill({ json: money });
    },
  );
  await page.route('**/api/refunds/customer-refund/file', async (route) => {
    downloads++;
    await route.fulfill({
      contentType: 'application/pdf',
      body: '%PDF-1.4\nfixture',
    });
  });
  await page.goto('/app/bookings/test-booking');
  await page
    .getByRole('button', { name: 'Batalkan booking', exact: true })
    .click();
  await page.getByLabel('Alasan').fill('Rencana perjalanan berubah.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Periksa batalkan booking' }).click();
  await page
    .getByRole('button', { name: 'Konfirmasi batalkan booking' })
    .click();
  await page.getByRole('button', { name: 'Isi rekening refund' }).click();
  await page.getByLabel('Nama bank').fill('Bank Uji');
  await page.getByLabel('Nomor rekening').fill('0012345678');
  await page.getByLabel('Nama pemilik rekening').fill('Penyewa Uji');
  await page.getByRole('checkbox').check();
  await page
    .getByRole('button', { name: 'Periksa simpan rekening refund' })
    .click();
  await page
    .getByRole('button', { name: 'Konfirmasi simpan rekening refund' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Ubah rekening' }),
  ).toBeVisible();
  // Simulate a later admin decision and successful transfer, then customer reload.
  refund.status = 'sudah_dikembalikan';
  refund.approvedAmount = '10000';
  refund.transferredAt = new Date().toISOString();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Unduh bukti refund' }),
  ).toBeVisible();
  expect(downloads).toBe(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh bukti refund' }).click();
  expect((await download).suggestedFilename()).toBe(
    'refund-customer-refund.pdf',
  );
  expect(downloads).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
