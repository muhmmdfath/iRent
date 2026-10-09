import {
  policy,
  item,
  booking,
  financial,
  customerSession,
} from './customer-fixtures';
import { beforeEach, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { Providers } from '@/app/providers';
import { AppRoutes } from '@/app/router';
import { server } from './server';
const base = 'http://localhost:3000/api';
beforeEach(() =>
  server.use(
    http.get(base + '/auth/session', () =>
      HttpResponse.json({}, { status: 401 }),
    ),
  ),
);
it('registers a customer with email and opens their account without storing credentials', async () => {
  let received: unknown;
  server.use(
    http.post(base + '/auth/register', async ({ request }) => {
      received = await request.json();
      return HttpResponse.json(
        {
          user: {
            id: 'new-customer',
            name: 'Penyewa Baru',
            email: 'baru@example.test',
            phone: null,
            role: 'customer',
            profile: null,
          },
          csrfToken: 'fixture-token',
        },
        { status: 201 },
      );
    }),
    http.get(base + '/bookings', () => HttpResponse.json([])),
  );
  render(
    <Providers>
      <MemoryRouter initialEntries={['/register']}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Nama'), 'Penyewa Baru');
  await user.type(screen.getByLabelText('Email'), 'baru@example.test');
  await user.type(
    screen.getByLabelText('Password', { exact: true }),
    'password-panjang',
  );
  await user.click(screen.getByRole('button', { name: 'Buat akun' }));
  expect(
    await screen.findByRole('heading', {
      name: 'Selamat datang, Penyewa Baru.',
    }),
  ).toBeVisible();
  expect(received).toEqual({
    name: 'Penyewa Baru',
    email: 'baru@example.test',
    password: 'password-panjang',
  });
  expect(localStorage.length + sessionStorage.length).toBe(0);
});

it('completes the profile without exposing the stored NIK after saving', async () => {
  const session = {
    user: {
      id: 'profile-user',
      name: 'Penyewa Baru',
      email: 'baru@example.test',
      phone: null,
      role: 'customer',
      profile: null,
    },
    csrfToken: 'fixture-token',
  };
  let saved: Record<string, unknown> | undefined;
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(session)),
    http.get(base + '/customer/profile', () => HttpResponse.json(null)),
    http.put(base + '/customer/profile', async ({ request }) => {
      saved = (await request.json()) as Record<string, unknown>;
      session.user.name = 'Penyewa Lengkap';
      return HttpResponse.json({
        fullName: 'Penyewa Lengkap',
        address: 'Alamat uji Semarang',
        phoneActive: '+6281234567890',
        completedAt: '2026-10-09T10:00:00+07:00',
        phoneAlt: null,
        instagram: null,
        emailContact: null,
      });
    }),
  );
  render(
    <Providers>
      <MemoryRouter initialEntries={['/app/profile']}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText('Nama lengkap'),
    'Penyewa Lengkap',
  );
  await user.type(screen.getByLabelText('Alamat'), 'Alamat uji Semarang');
  await user.type(screen.getByLabelText('Nomor HP aktif'), '081234567890');
  await user.type(screen.getByLabelText('NIK'), '0000000000000001');
  await user.click(screen.getByRole('button', { name: 'Simpan profil' }));
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Profil tersimpan',
  );
  expect(saved?.nik).toBe('0000000000000001');
  expect(
    screen.queryByDisplayValue('0000000000000001'),
  ).not.toBeInTheDocument();
});

it('shows the catalog photograph and package price without claiming calendar availability', async () => {
  server.use(
    http.get(base + '/items', () =>
      HttpResponse.json({
        page: 1,
        total: 1,
        data: [
          {
            id: 'test-item',
            name: 'iPhone Uji',
            category: 'iphone',
            includes: [],
            price6h: '60000',
            price12h: '100000',
            price24h: '150000',
            photoPath: '/media/items/test.webp',
            stock: { activeUnitCount: 1, readyPhysicalCount: 1 },
          },
        ],
      }),
    ),
  );
  render(
    <Providers>
      <MemoryRouter initialEntries={['/catalog']}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  expect(
    await screen.findByRole('img', { name: 'iPhone Uji' }),
  ).toHaveAttribute('src', 'http://localhost:3000/media/items/test.webp');
  expect(screen.getByText(/60.000/)).toBeVisible();
  expect(screen.queryByText('Tersedia sekarang')).not.toBeInTheDocument();
});

it('checks price and availability then retries booking with the same action key', async () => {
  const keys: (string | null)[] = [];
  let attempts = 0;
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(customerSession)),
    http.get(base + '/customer/profile', () =>
      HttpResponse.json({
        fullName: 'Penyewa Lengkap',
        address: 'Alamat uji',
        phoneActive: '+6281234567890',
        completedAt: '2026-10-09T10:00:00+07:00',
      }),
    ),
    http.get(base + '/rental-policy', () => HttpResponse.json(policy)),
    http.get(base + '/items/test-item', () => HttpResponse.json(item)),
    http.get(base + '/items', () =>
      HttpResponse.json({ page: 1, total: 1, data: [item] }),
    ),
    http.get(base + '/delivery-zones', () => HttpResponse.json([])),
    http.post(base + '/pricing/quote', () =>
      HttpResponse.json({
        startAt: booking.initialStartAt,
        endAt: booking.initialEndAt,
        durationHours: 6,
        rentalTotal: '60000',
        deliveryFee: '0',
        grandTotal: '60000',
        amountDueNow: '20000',
        mustPayFull: false,
        payOption: 'dp',
        lines: [
          {
            itemId: item.id,
            itemName: item.name,
            quantity: 1,
            subtotal: '60000',
          },
        ],
      }),
    ),
    http.post(base + '/bookings/availability', () =>
      HttpResponse.json({
        available: true,
        reservesStock: false,
        items: [
          { itemId: item.id, requestedQuantity: 1, availableQuantity: 1 },
        ],
      }),
    ),
    http.post(base + '/bookings', ({ request }) => {
      keys.push(request.headers.get('Idempotency-Key'));
      attempts++;
      return attempts === 1
        ? HttpResponse.json({ message: 'Coba lagi.' }, { status: 503 })
        : HttpResponse.json(booking, { status: 201 });
    }),
    http.get(base + '/bookings/test-booking', () => HttpResponse.json(booking)),
    http.get(base + '/bookings/test-booking/payments', () =>
      HttpResponse.json(financial()),
    ),
    http.get(base + '/payment-options', () =>
      HttpResponse.json({ qrisImagePath: null }),
    ),
  );
  render(
    <Providers>
      <MemoryRouter initialEntries={['/app/new?itemId=test-item']}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Periksa jadwal & biaya' }),
  );
  await screen.findByText('Jadwal tersedia saat diperiksa');
  for (const label of [
    /Saya menyetujui ketentuan/,
    /Saya menyiapkan KTP/,
    /Saya memahami pembayaran/,
    /Saya menyetujui jam/,
  ])
    await user.click(screen.getByLabelText(label));
  await user.click(screen.getByRole('button', { name: 'Buat booking' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Buat booking' }));
  expect(
    await screen.findByRole('heading', { name: 'Pembayaran booking' }),
  ).toBeVisible();
  expect(keys.length).toBe(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  expect(
    screen.getByRole('button', { name: 'Upload bukti pembayaran' }),
  ).toBeEnabled();
});

it('uploads immediately, keeps the retry key, and awaits admin verification without claiming payment is settled', async () => {
  const keys: (string | null)[] = [];
  let attempts = 0;
  const initial = financial();
  const pending = financial();
  pending.booking.status = 'menunggu_konfirmasi';
  pending.booking.obligations[0].status = 'proof_pending';
  pending.booking.obligations[0].pendingProofId = 'proof-test';
  let current = initial;
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(customerSession)),
    http.get(base + '/bookings/test-booking/payments', () =>
      HttpResponse.json(current),
    ),
    http.get(base + '/payment-options', () =>
      HttpResponse.json({ qrisImagePath: null }),
    ),
    http.post(
      base + '/bookings/test-booking/obligations/test-obligation/proofs',
      async ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        const body = await request.text();
        expect(request.headers.get('Content-Type')).toContain(
          'multipart/form-data; boundary=',
        );
        expect(body).toContain('name="claimedAmount"');
        expect(body).toContain('20000');
        expect(body).toContain('name="file"');
        attempts++;
        if (attempts === 1)
          return HttpResponse.json(
            { message: 'Upload gagal, coba lagi.' },
            { status: 503 },
          );
        current = pending;
        return HttpResponse.json(pending, { status: 201 });
      },
    ),
  );
  render(
    <Providers>
      <MemoryRouter initialEntries={['/app/bookings/test-booking/payment']}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  const user = userEvent.setup();
  await user.upload(
    await screen.findByLabelText('Bukti pembayaran'),
    new File(['fixture'], 'bukti.png', { type: 'image/png' }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Upload bukti pembayaran' }),
  );
  await screen.findByRole('alert');
  await user.click(
    screen.getByRole('button', { name: 'Upload bukti pembayaran' }),
  );
  expect(await screen.findByText(/Bukti sudah diterima/)).toBeVisible();
  expect(
    screen.queryByText('Pembayaran telah lunas dan terverifikasi.'),
  ).not.toBeInTheDocument();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});
it('uses the remaining obligation balance after partial verification', async () => {
  const partial = financial();
  partial.booking.obligations[0].remainingAmount = '15000';
  partial.booking.obligations[0].creditedAmount = '5000';
  partial.summary.applied = '5000';
  partial.summary.remaining = '55000';
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(customerSession)),
    http.get(base + '/bookings/test-booking/payments', () =>
      HttpResponse.json(partial),
    ),
    http.get(base + '/payment-options', () =>
      HttpResponse.json({ qrisImagePath: null }),
    ),
  );
  render(
    <Providers>
      <MemoryRouter initialEntries={['/app/bookings/test-booking/payment']}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  expect(
    await screen.findByLabelText('Nominal yang ditransfer (rupiah)'),
  ).toHaveValue('15000');
});

it('loads the public catalog while discovering an authenticated session on first navigation', async () => {
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(customerSession)),
    http.get(base + '/items', () =>
      HttpResponse.json({ data: [item], total: 1, page: 1 }),
    ),
  );
  render(
    <Providers>
      <MemoryRouter initialEntries={['/catalog']}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  expect(await screen.findByRole('heading', { name: item.name })).toBeVisible();
  expect(await screen.findByRole('link', { name: 'Akun saya' })).toBeVisible();
});
