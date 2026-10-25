import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import {
  render,
  screen,
  waitFor,
  configure,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { AppRoutes } from '@/app/router';
import { Providers } from '@/app/providers';
import type { AdminBooking } from '@/admin/types';
import { server } from './server';
import { adminSession } from './admin-fixtures';
import { operationBooking, operationFinancial } from './operations-fixtures';
const base = 'http://localhost:3000/api';
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 15000 });
beforeAll(async () => {
  await import('@/admin/pages/booking-detail-page');
});

it('records loss for one unit with exact compensation and never uses the physical-return endpoint', async () => {
  let payload: unknown;
  server.use(
    http.post(
      base + '/admin/bookings/test-booking/items/test-unit-use/loss/verify',
      async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json(money);
      },
    ),
  );
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Catat kehilangan IPHONE-TEST' }),
  );
  await user.type(
    screen.getByLabelText('Catatan kehilangan'),
    'Kehilangan sudah diperiksa bersama penyewa.',
  );
  await user.clear(screen.getByLabelText('Ganti rugi kehilangan (rupiah)'));
  await user.type(
    screen.getByLabelText('Ganti rugi kehilangan (rupiah)'),
    '9007199254740993',
  );
  await user.click(
    screen.getByRole('checkbox', { name: /sudah memeriksa barang/ }),
  );
  await user.click(screen.getByRole('button', { name: 'Periksa tindakan' }));
  expect(payload).toBeUndefined();
  await user.click(screen.getByRole('button', { name: 'Konfirmasi tindakan' }));
  await waitFor(() =>
    expect(payload).toMatchObject({
      compensationAmount: '9007199254740993',
      lossNote: 'Kehilangan sudah diperiksa bersama penyewa.',
    }),
  );
  expect(payload).not.toHaveProperty('condition');
  expect(payload).not.toHaveProperty('receivedAtStore');
});

it('corrects verified return data with a reason and no new physical condition command', async () => {
  booking.items![0].useStatus = 'returned';
  booking.items![0].returnRecord = {
    status: 'verified',
    reportedAt: null,
    receivedAtStore: booking.initialStartAt,
    receivedByCourierAt: null,
    verifiedAt: booking.initialStartAt,
    conditionNote: 'Barang lengkap dan kondisi baik.',
    damageAmount: '0',
    damageNote: null,
    lateFee: '0',
    preparationStartedAt: booking.initialStartAt,
    manualExemptions: [],
  };
  money = operationFinancial(booking);
  let payload: unknown;
  server.use(
    http.post(
      base + '/admin/bookings/test-booking/items/test-unit-use/return/correct',
      async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json(money);
      },
    ),
  );
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Koreksi pengembalian IPHONE-TEST',
    }),
  );
  expect(screen.queryByLabelText('Kondisi unit')).not.toBeInTheDocument();
  await user.type(
    screen.getByLabelText('Alasan koreksi'),
    'Waktu penerimaan sebelumnya salah dicatat.',
  );
  await user.click(
    screen.getByRole('checkbox', { name: /sudah memeriksa barang/ }),
  );
  await user.click(screen.getByRole('button', { name: 'Periksa tindakan' }));
  await user.click(screen.getByRole('button', { name: 'Konfirmasi tindakan' }));
  await waitFor(() =>
    expect(payload).toMatchObject({
      reason: 'Waktu penerimaan sebelumnya salah dicatat.',
      damageAmount: '0',
      exemptions: [],
    }),
  );
  expect(payload).not.toHaveProperty('condition');
});
let booking: AdminBooking;
let money: ReturnType<typeof operationFinancial>;
beforeEach(() => {
  booking = operationBooking();
  money = operationFinancial(booking);
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(adminSession)),
    http.get(base + '/bookings/test-booking', () => HttpResponse.json(booking)),
    http.get(base + '/bookings/test-booking/payments', () =>
      HttpResponse.json(money),
    ),
  );
});
function mount() {
  render(
    <Providers>
      <MemoryRouter initialEntries={['/admin/bookings/test-booking']}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
}
async function reviewReturn() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Verifikasi pengembalian IPHONE-TEST',
    }),
  );
  await user.type(
    screen.getByLabelText('Catatan kondisi'),
    'Barang lengkap dan fungsi diperiksa.',
  );
  await user.click(
    screen.getByRole('checkbox', { name: /sudah memeriksa barang/ }),
  );
  await user.click(screen.getByRole('button', { name: 'Periksa tindakan' }));
  return user;
}
it('blocks handover while rent is unpaid even with reserved cash', async () => {
  booking = operationBooking('dikonfirmasi');
  money = operationFinancial(booking);
  money.summary.applied = '20000';
  money.summary.reserved = '40000';
  money.summary.remaining = '40000';
  mount();
  expect(
    await screen.findByRole('button', { name: 'Catat serah-terima' }),
  ).toBeDisabled();
  expect(screen.getByText(/Lunasi sewa dan ongkir/)).toBeVisible();
});
it('confirms handover once and refreshes the booking status', async () => {
  booking = operationBooking('dikonfirmasi');
  money = operationFinancial(booking);
  let calls = 0;
  let payload: unknown;
  server.use(
    http.post(
      base + '/admin/bookings/test-booking/handover',
      async ({ request }) => {
        calls++;
        payload = await request.json();
        expect(request.headers.get('x-csrf-token')).toBe('admin-csrf');
        expect(request.headers.get('idempotency-key')).toBeTruthy();
        booking = operationBooking();
        money = operationFinancial(booking);
        return HttpResponse.json(money);
      },
    ),
  );
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Catat serah-terima' }),
  );
  expect(screen.queryByLabelText('Catatan kondisi')).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText('Waktu serah-terima (WIB)'),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('checkbox', { name: /sudah memeriksa barang/ }),
  );
  await user.click(screen.getByRole('button', { name: 'Periksa tindakan' }));
  expect(calls).toBe(0);
  await user.click(screen.getByRole('button', { name: 'Konfirmasi tindakan' }));
  await screen.findByText('Serah-terima tercatat. Booking sedang disewa.');
  expect(calls).toBe(1);
  expect(payload).not.toHaveProperty('conditionNote');
  expect(payload).toHaveProperty('pickedUpAt');
  expect(
    screen.queryByRole('button', { name: 'Catat serah-terima' }),
  ).not.toBeInTheDocument();
});
it('verifies one booking item while another remains rented and exposes the new charge', async () => {
  let payload: unknown;
  server.use(
    http.post(
      base + '/admin/bookings/test-booking/items/test-unit-use/return/verify',
      async ({ request }) => {
        payload = await request.json();
        booking.items![0].useStatus = 'returned';
        booking.items![0].returnRecord = {
          status: 'verified',
          reportedAt: null,
          receivedAtStore: booking.initialStartAt,
          receivedByCourierAt: null,
          verifiedAt: booking.initialStartAt,
          conditionNote: 'Barang lengkap dan fungsi diperiksa.',
          damageAmount: '0',
          damageNote: null,
          lateFee: '10000',
          preparationStartedAt: booking.initialStartAt,
        };
        money = operationFinancial(booking);
        money.summary.bill = '70000';
        money.summary.remaining = '10000';
        money.summary.paymentStatus = 'belum_lunas';
        return HttpResponse.json(money);
      },
    ),
  );
  mount();
  const user = await reviewReturn();
  await user.click(screen.getByRole('button', { name: 'Konfirmasi tindakan' }));
  await screen.findByText(
    'Pengembalian unit diverifikasi. Status dan tagihan diperbarui.',
  );
  expect(payload).toMatchObject({ condition: 'layak', damageAmount: '0' });
  expect(
    screen.queryByRole('button', {
      name: 'Verifikasi pengembalian IPHONE-TEST',
    }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Verifikasi pengembalian TRIPOD-TEST' }),
  ).toBeVisible();
  expect(screen.getByText('Sudah dikembalikan')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Catat pelunasan' })).toBeVisible();
});
it('keeps the same action key when retrying a lost response', async () => {
  const keys: string[] = [];
  server.use(
    http.post(
      base + '/admin/bookings/test-booking/items/test-unit-use/return/verify',
      ({ request }) => {
        keys.push(request.headers.get('idempotency-key')!);
        return keys.length === 1
          ? HttpResponse.json({ message: 'Koneksi terputus.' }, { status: 503 })
          : HttpResponse.json(money);
      },
    ),
  );
  mount();
  const user = await reviewReturn();
  await user.click(screen.getByRole('button', { name: 'Konfirmasi tindakan' }));
  await screen.findAllByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Konfirmasi tindakan' }));
  await waitFor(() => expect(keys).toHaveLength(2));
  expect(keys[0]).toBe(keys[1]);
});
it('rejects a customer report without closing the rental', async () => {
  booking.items![0].useStatus = 'return_pending';
  let body: unknown;
  server.use(
    http.post(
      base +
        '/admin/bookings/test-booking/items/test-unit-use/return-report/reject',
      async ({ request }) => {
        body = await request.json();
        booking.items![0].useStatus = 'in_use';
        money = operationFinancial(booking);
        return HttpResponse.json(money);
      },
    ),
  );
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Tolak laporan IPHONE-TEST' }),
  );
  await user.type(
    screen.getByLabelText('Alasan penolakan'),
    'Barang belum diterima petugas maupun toko.',
  );
  await user.click(
    screen.getByRole('checkbox', { name: /sudah memeriksa barang/ }),
  );
  await user.click(screen.getByRole('button', { name: 'Periksa tindakan' }));
  await user.click(screen.getByRole('button', { name: 'Konfirmasi tindakan' }));
  await screen.findByText('Laporan ditolak. Unit tetap sedang disewa.');
  expect(body).toEqual({
    reason: 'Barang belum diterima petugas maupun toko.',
  });
  expect(
    screen.getByRole('button', { name: 'Verifikasi pengembalian IPHONE-TEST' }),
  ).toBeVisible();
});
it('requires damage notes and physical acknowledgement before review', async () => {
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Verifikasi pengembalian IPHONE-TEST',
    }),
  );
  await user.type(
    screen.getByLabelText('Catatan kondisi'),
    'Layar unit retak.',
  );
  await user.click(screen.getByRole('button', { name: 'Periksa tindakan' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Konfirmasikan');
  await user.click(
    screen.getByRole('checkbox', { name: /sudah memeriksa barang/ }),
  );
  await user.clear(screen.getByLabelText('Biaya kerusakan (rupiah)'));
  await user.type(screen.getByLabelText('Biaya kerusakan (rupiah)'), '20000');
  await user.click(screen.getByRole('button', { name: 'Periksa tindakan' }));
  expect(
    screen.queryByRole('button', { name: 'Konfirmasi tindakan' }),
  ).not.toBeInTheDocument();
  await user.type(
    screen.getByLabelText('Catatan kerusakan'),
    'Retak layar telah diperiksa.',
  );
  await user.selectOptions(
    screen.getByLabelText('Kondisi unit'),
    'maintenance',
  );
  await user.click(screen.getByRole('button', { name: 'Periksa tindakan' }));
  expect(screen.getByText('Perlu perawatan')).toBeVisible();
});
it('validates courier chronology and preserves WIB delivery exceptions', async () => {
  booking.deliveryType = 'delivery';
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Verifikasi pengembalian IPHONE-TEST',
    }),
  );
  await user.type(
    screen.getByLabelText('Catatan kondisi'),
    'Barang diterima dan lengkap.',
  );
  await user.click(
    screen.getByRole('checkbox', { name: /sudah memeriksa barang/ }),
  );
  function local(delta: number) {
    return new Date(Date.now() + 7 * 3600000 + delta)
      .toISOString()
      .slice(0, 16);
  }
  fireEvent.change(screen.getByLabelText('Diterima toko (WIB)'), {
    target: { value: local(-1800000) },
  });
  fireEvent.change(screen.getByLabelText('Diterima petugas (WIB, opsional)'), {
    target: { value: local(-600000) },
  });
  await user.click(screen.getByRole('button', { name: 'Periksa tindakan' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Waktu petugas');
  fireEvent.change(screen.getByLabelText('Diterima petugas (WIB, opsional)'), {
    target: { value: local(-2400000) },
  });
  await user.click(
    screen.getByText('Pengecualian keterlambatan admin/petugas'),
  );
  await user.click(screen.getByRole('button', { name: 'Tambah pengecualian' }));
  await user.selectOptions(screen.getByLabelText('Pihak'), 'courier');
  fireEvent.change(screen.getByLabelText('Awal pengecualian (WIB)'), {
    target: { value: local(-3000000) },
  });
  fireEvent.change(screen.getByLabelText('Akhir pengecualian (WIB)'), {
    target: { value: local(-2400000) },
  });
  await user.type(
    screen.getByLabelText('Alasan pengecualian'),
    'Petugas terlambat menjemput.',
  );
  await user.click(screen.getByRole('button', { name: 'Periksa tindakan' }));
  expect(screen.getByText(/Pengecualian petugas:/)).toBeVisible();
});

it('requires the reason for a late shop delivery and records handover time automatically', async () => {
  booking = operationBooking('dikonfirmasi');
  booking.deliveryType = 'delivery';
  money = operationFinancial(booking);
  let payload: unknown;
  server.use(
    http.post(
      base + '/admin/bookings/test-booking/handover',
      async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json(money);
      },
    ),
  );
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Catat serah-terima' }),
  );

  await user.click(
    screen.getByRole('checkbox', { name: /sudah memeriksa barang/ }),
  );
  await user.click(screen.getByRole('button', { name: 'Periksa tindakan' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Catatan dan alasan',
  );
  await user.type(
    screen.getByLabelText('Alasan keterlambatan toko (wajib jika terlambat)'),
    'Petugas toko terlambat mengantar.',
  );
  await user.click(screen.getByRole('button', { name: 'Periksa tindakan' }));
  expect(screen.getByText(/Alasan keterlambatan toko:/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Konfirmasi tindakan' }));
  await waitFor(() =>
    expect(payload).toMatchObject({
      shopDelayReason: 'Petugas toko terlambat mengantar.',
    }),
  );
});
