import { expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Providers } from '@/app/providers';
import { RefundForm, RefundPanel } from '@/refunds/panel';
import { queryClient, sessionKey } from '@/services/query-client';
import { server } from './server';
import { booking, financial, customerSession } from './customer-fixtures';
import type { Refund } from '@/refunds/api';
const base = 'http://localhost:3000/api';
const refund: Refund = {
  id: 'refund-test',
  status: 'diajukan',
  requestedAmount: '10000',
  approvedAmount: null,
  transferredAt: null,
  recipientDetails: {
    bankName: 'Bank Uji',
    accountNumber: '0012345678',
    accountHolder: 'Penyewa Uji',
  },
};
function mount(
  kind: 'recipient' | 'cancel' | 'approve' | 'reject' | 'transfer',
  data = refund,
  admin = false,
) {
  queryClient.setQueryData(sessionKey, customerSession);
  const close = vi.fn();
  render(
    <Providers>
      <RefundForm
        kind={kind}
        id={kind === 'cancel' ? booking.id : data.id}
        admin={admin}
        refund={data}
        onClose={close}
      />
    </Providers>,
  );
  return close;
}
async function review(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Periksa ' + name }));
}
it('preserves leading zeros and retries the same recipient with one idempotency key', async () => {
  const keys: string[] = [];
  let body: unknown;
  server.use(
    http.post(base + '/refunds/refund-test/recipient', async ({ request }) => {
      keys.push(request.headers.get('Idempotency-Key')!);
      body = await request.json();
      return keys.length === 1
        ? HttpResponse.json({ message: 'temporary' }, { status: 503 })
        : HttpResponse.json(financial());
    }),
  );
  const close = mount('recipient');
  const user = userEvent.setup();
  await review(user, 'simpan rekening refund');
  const confirm = screen.getByRole('button', {
    name: 'Konfirmasi simpan rekening refund',
  });
  await user.click(confirm);
  await within(
    screen.getByRole('region', { name: 'Simpan rekening refund' }),
  ).findByRole('alert');
  await user.click(confirm);
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(keys[0]).toBe(keys[1]);
  expect(body).toEqual(refund.recipientDetails);
});
it('cancels the whole customer booking only after reviewing a reason', async () => {
  let calls = 0;
  server.use(
    http.post(base + '/bookings/test-booking/cancel', async ({ request }) => {
      calls++;
      expect(await request.json()).toEqual({
        reason: 'Rencana perjalanan berubah.',
      });
      return HttpResponse.json(financial());
    }),
  );
  const close = mount('cancel');
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText('Alasan'),
    'Rencana perjalanan berubah.',
  );
  await review(user, 'batalkan booking');
  expect(calls).toBe(0);
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi batalkan booking' }),
  );
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(calls).toBe(1);
});
it('uses the separate shop failure cancellation endpoint', async () => {
  let called = false;
  server.use(
    http.post(base + '/admin/bookings/test-booking/cancel', () => {
      called = true;
      return HttpResponse.json(financial());
    }),
  );
  mount('cancel', refund, true);
  const user = userEvent.setup();
  expect(screen.getByText(/kendala operasional toko/)).toBeVisible();
  await user.type(screen.getByLabelText('Alasan'), 'Unit toko tidak tersedia.');
  await review(user, 'batalkan booking');
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi batalkan booking' }),
  );
  await waitFor(() => expect(called).toBe(true));
});
it('approves server entitlement without sending a cash amount', async () => {
  let body: unknown;
  server.use(
    http.post(
      base + '/admin/refunds/refund-test/approve',
      async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(financial());
      },
    ),
  );
  const close = mount('approve', refund, true);
  const user = userEvent.setup();
  expect(screen.getByText(/belum mencatat uang keluar/)).toBeVisible();
  await review(user, 'setujui refund');
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi setujui refund' }),
  );
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(body).toEqual({});
});
it('requires a rejection reason and returns the server decision', async () => {
  let body: unknown;
  server.use(
    http.post(
      base + '/admin/refunds/refund-test/reject',
      async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(financial());
      },
    ),
  );
  const close = mount('reject', refund, true);
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText('Alasan'),
    'Pengajuan diperiksa dan ditolak.',
  );
  await review(user, 'tolak refund');
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi tolak refund' }),
  );
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(body).toEqual({ reason: 'Pengajuan diperiksa dan ditolak.' });
});
it('records the exact approved amount with a private multipart proof and WIB seconds', async () => {
  let received = '';
  server.use(
    http.post(
      base + '/admin/refunds/refund-test/transfer',
      async ({ request }) => {
        // Inspect multipart bytes: Node and jsdom use different File realms.
        received = await request.text();
        return HttpResponse.json(financial());
      },
    ),
  );
  const close = mount(
    'transfer',
    {
      ...refund,
      status: 'disetujui',
      approvedAmount: '10000',
      approvedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    true,
  );
  const user = userEvent.setup();
  const time = new Date(Date.now() - 60000 + 7 * 3600000)
    .toISOString()
    .slice(0, 19);
  await user.type(
    screen.getByLabelText('Referensi transaksi'),
    'BANK-REFUND-01',
  );
  await user.type(
    screen.getByLabelText('Catatan transfer'),
    'Transfer berhasil diperiksa.',
  );
  const input = screen.getByLabelText('Waktu transfer (WIB)');
  // datetime-local typing varies by browser; assign the native value through an input event.
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.change(input, { target: { value: time } });
  await user.upload(
    screen.getByLabelText('Bukti transfer'),
    new File(['proof'], 'proof.png', { type: 'image/png' }),
  );
  await review(user, 'catat transfer refund');
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi catat transfer refund' }),
  );
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(received).toMatch(/name="amount"\r\n\r\n10000\r\n/);
  expect(received).toContain(time + '+07:00');
  expect(received).toContain('name="file"; filename=');
  expect(received).toContain('Content-Type: image/png');
});
it('blocks cancellation after handover and locks the approved recipient', () => {
  const money = financial();
  money.booking.status = 'berjalan';
  money.booking.refunds = [
    { ...refund, status: 'disetujui', approvedAmount: '10000' },
  ];
  render(
    <Providers>
      <RefundPanel
        booking={{
          ...booking,
          items: booking.items?.map((item) => ({
            ...item,
            useStatus: 'in_use',
          })),
        }}
        money={money}
      />
    </Providers>,
  );
  expect(
    screen.queryByRole('button', { name: 'Batalkan booking' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Ubah rekening' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Catat transfer refund' }),
  ).not.toBeInTheDocument();
});
