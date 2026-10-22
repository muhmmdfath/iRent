import { beforeEach, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { Providers } from '@/app/providers';
import { ChangePasswordPanel } from '@/account/components/change-password-panel';
import { queryClient, sessionKey } from '@/services/query-client';
import { customerSession } from './customer-fixtures';
import { server } from './server';

const base = 'http://localhost:3000/api';
let requests: unknown[];
beforeEach(() => {
  requests = [];
  queryClient.setQueryData(sessionKey, customerSession);
  server.use(
    http.post(base + '/auth/password', async ({ request }) => {
      expect(request.headers.get('X-CSRF-Token')).toBe(
        customerSession.csrfToken,
      );
      requests.push(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
  );
});
function mount(admin = false) {
  render(
    <Providers>
      <MemoryRouter initialEntries={['/account']}>
        <Routes>
          <Route
            path="/account"
            element={<ChangePasswordPanel admin={admin} />}
          />
          <Route path="/login" element={<h1>Masuk kembali</h1>} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
}
async function fill(
  user: ReturnType<typeof userEvent.setup>,
  confirmation = 'after123',
) {
  await user.type(
    screen.getByLabelText('Password lama', { exact: true }),
    'before12',
  );
  await user.type(
    screen.getByLabelText('Password baru', { exact: true }),
    'after123',
  );
  await user.type(
    screen.getByLabelText('Konfirmasi password baru', { exact: true }),
    confirmation,
  );
}

it('changes an eight-character password and clears private state before returning to login', async () => {
  mount();
  const user = userEvent.setup();
  queryClient.setQueryData(['booking', 'private'], { secret: 'private-data' });
  await user.click(screen.getByRole('button', { name: 'Ganti password' }));
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Simpan password' }));
  await screen.findByRole('heading', { name: 'Masuk kembali' });
  expect(requests).toEqual([
    { currentPassword: 'before12', newPassword: 'after123' },
  ]);
  expect(queryClient.getQueryData(sessionKey)).toBeNull();
  expect(queryClient.getQueryData(['booking', 'private'])).toBeUndefined();
  expect(localStorage.getItem('password')).toBeNull();
});
it('rejects mismatched confirmation and short passwords without sending a request', async () => {
  mount();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Ganti password' }));
  await fill(user, 'wrong123');
  await user.click(screen.getByRole('button', { name: 'Simpan password' }));
  expect(
    await screen.findByText('Konfirmasi password belum cocok.'),
  ).toBeVisible();
  await user.clear(screen.getByLabelText('Password baru', { exact: true }));
  await user.type(
    screen.getByLabelText('Password baru', { exact: true }),
    'short12',
  );
  await user.click(screen.getByRole('button', { name: 'Simpan password' }));
  expect(await screen.findByText('Gunakan minimal 8 karakter.')).toBeVisible();
  expect(requests).toEqual([]);
});
it('keeps the session and form available when the old password is incorrect', async () => {
  server.use(
    http.post(base + '/auth/password', () =>
      HttpResponse.json(
        { message: 'Password lama tidak sesuai.' },
        { status: 400 },
      ),
    ),
  );
  mount();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Ganti password' }));
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Simpan password' }));
  await waitFor(() =>
    expect(
      screen.getAllByText('Password lama tidak sesuai.').length,
    ).toBeGreaterThan(0),
  );
  expect(screen.getByRole('dialog', { name: 'Ganti password' })).toBeVisible();
  expect(queryClient.getQueryData(sessionKey)).toEqual(customerSession);
});
it('supports revealing a field and clears entered passwords when the dialog is closed', async () => {
  mount(true);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Ganti password' }));
  await fill(user);
  expect(
    screen.getByText(/Notifikasi PWA perlu diaktifkan kembali/),
  ).toBeVisible();
  await user.click(
    screen.getByRole('button', {
      name: 'Tampilkan password baru',
    }),
  );
  expect(
    screen.getByLabelText('Password baru', { exact: true }),
  ).toHaveAttribute('type', 'text');
  await user.click(screen.getByRole('button', { name: 'Batal' }));
  await user.click(screen.getByRole('button', { name: 'Ganti password' }));
  expect(screen.getByLabelText('Password baru', { exact: true })).toHaveValue(
    '',
  );
  expect(
    screen.getByLabelText('Password baru', { exact: true }),
  ).toHaveAttribute('type', 'password');
});
