import { expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { Providers } from '@/app/providers';
import { AppRoutes } from '@/app/router';
import { server } from './server';
import { adminSession } from './admin-fixtures';
import {
  booking,
  customerSession,
  financial,
  item,
  policy,
} from './customer-fixtures';
import { deliveryViaChat } from '@/customer/delivery-fee';

const base = 'http://localhost:3000/api';
vi.setConfig({ testTimeout: 15000 });
function mount(path: string) {
  render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
}
it('saves a boolean delivery switch and keeps the saved state after an unsuccessful update', async () => {
  let enabled = true;
  let fail = false;
  const values = { ...policy.values, delivery_fee_enabled: enabled };
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(adminSession)),
    http.get(base + '/admin/settings', () =>
      HttpResponse.json({
        revision: '1',
        values: { ...values, delivery_fee_enabled: enabled },
      }),
    ),
    http.patch(base + '/admin/settings', async ({ request }) => {
      const body = (await request.json()) as {
        values: { delivery_fee_enabled: boolean };
      };
      expect(typeof body.values.delivery_fee_enabled).toBe('boolean');
      if (fail)
        return HttpResponse.json(
          { message: 'Gagal menyimpan ongkir' },
          { status: 409 },
        );
      enabled = body.values.delivery_fee_enabled;
      return HttpResponse.json({});
    }),
  );
  mount('/admin/settings');
  const user = userEvent.setup();
  const control = await screen.findByRole('switch', {
    name: 'Ongkir dalam aplikasi',
  });
  expect(control).toHaveAttribute('aria-checked', 'true');
  await user.click(control);
  await waitFor(() => expect(control).toHaveAttribute('aria-checked', 'false'));
  expect(
    screen.getByText(/ongkir dibayar dan dicatat di luar aplikasi/),
  ).toBeVisible();
  fail = true;
  await user.click(control);
  await screen.findAllByRole('alert');
  expect(control).toHaveAttribute('aria-checked', 'false');
  fail = false;
  await user.click(control);
  await waitFor(() => expect(control).toHaveAttribute('aria-checked', 'true'));
});
it('offers delivery without a zone when fees are handled through chat', async () => {
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(customerSession)),
    http.get(base + '/customer/profile', () =>
      HttpResponse.json({ completedAt: new Date().toISOString() }),
    ),
    http.get(base + '/rental-policy', () =>
      HttpResponse.json({
        ...policy,
        values: { ...policy.values, delivery_fee_enabled: false },
      }),
    ),
    http.get(base + '/items/:id', () => HttpResponse.json(item)),
  );
  mount('/app/new?itemId=test-item');
  const user = userEvent.setup();
  await user.selectOptions(
    await screen.findByLabelText('Cara pengambilan'),
    'delivery',
  );
  expect(screen.queryByLabelText('Zona antar-jemput')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Alamat antar-jemput')).toBeVisible();
  expect(screen.getByText(/Ongkir diinformasikan lewat chat/)).toBeVisible();
});
it('labels chat fees on the booking without displaying a null delivery zone', async () => {
  const chat = {
    ...booking,
    deliveryType: 'delivery' as const,
    rulesSnapshot: {
      rules: { values: { ...policy.values, delivery_fee_enabled: false } },
    },
  };
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(customerSession)),
    http.get(base + '/customer/profile', () =>
      HttpResponse.json({ completedAt: new Date().toISOString() }),
    ),
    http.get(base + '/bookings/:id', () => HttpResponse.json(chat)),
    http.get(base + '/bookings/:id/payments', () =>
      HttpResponse.json({
        ...financial(),
        booking: { ...financial().booking, ...chat },
      }),
    ),
  );
  mount('/app/bookings/test-booking');
  expect(await screen.findByText('Diinfokan lewat chat')).toBeVisible();
  expect(screen.queryByText(/null - antar/)).not.toBeInTheDocument();
});
it('keeps old and pickup bookings on their original fee rules', () => {
  expect(deliveryViaChat({ ...booking, deliveryType: 'delivery' })).toBe(false);
  expect(
    deliveryViaChat({
      ...booking,
      deliveryType: 'delivery',
      rulesSnapshot: {},
    }),
  ).toBe(false);
  expect(
    deliveryViaChat({
      ...booking,
      rulesSnapshot: {
        rules: { values: { ...policy.values, delivery_fee_enabled: false } },
      },
    }),
  ).toBe(false);
});
