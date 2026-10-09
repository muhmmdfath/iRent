import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { Providers } from '@/app/providers';
import { AppRoutes } from '@/app/router';
import { queryClient, sessionKey } from '@/services/query-client';
import { api } from '@/services/api';
import type { Session, Role } from '@/auth/types';
import { server } from './server';
const base = 'http://localhost:3000/api';
function session(role: Role = 'customer'): Session {
  return {
    user: {
      id: 'customer-test',
      name: 'Penyewa iRent',
      email: 'penyewa@example.test',
      phone: null,
      role,
      profile: null,
    },
    csrfToken: 'test-csrf-token',
  };
}
let current: Session | null;
let logoutToken: string | null;
let loginBody: unknown;
function mount(path = '/app/account') {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
}
beforeEach(() => {
  current = null;
  logoutToken = null;
  loginBody = null;
  server.use(
    http.get(base + '/auth/session', () =>
      current
        ? HttpResponse.json(current)
        : HttpResponse.json({ message: 'Silakan login.' }, { status: 401 }),
    ),
    http.post(base + '/auth/login', async ({ request }) => {
      loginBody = await request.json();
      current = session();
      return HttpResponse.json(current);
    }),
    http.post(base + '/auth/logout', ({ request }) => {
      if (!request.headers.get('Content-Type')?.includes('application/json'))
        return HttpResponse.json(
          { message: 'Gunakan request JSON.' },
          { status: 403 },
        );
      logoutToken = request.headers.get('X-CSRF-Token');
      current = null;
      return new HttpResponse(null, { status: 204 });
    }),
  );
});
describe('session and access', () => {
  it('restores the server session after reload without storing credentials', async () => {
    current = session();
    mount();
    expect(
      await screen.findByRole('heading', { name: 'Akun saya' }),
    ).toBeVisible();
    expect(screen.getByText('penyewa@example.test')).toBeVisible();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
  it('redirects unauthenticated access and returns to the intended page after login', async () => {
    mount();
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText('Email atau nomor HP'),
      '  penyewa@example.test  ',
    );
    await user.type(screen.getByLabelText('Password'), 'password-yang-valid');
    await user.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(
      await screen.findByRole('heading', { name: 'Akun saya' }),
    ).toBeVisible();
    expect(loginBody).toEqual({
      identity: 'penyewa@example.test',
      password: 'password-yang-valid',
    });
  });
  it('prevents a customer from rendering admin content', async () => {
    current = session();
    mount('/admin/account');
    expect(
      await screen.findByRole('heading', {
        name: 'Selamat datang, Penyewa iRent.',
      }),
    ).toBeVisible();
    expect(screen.queryByText('Ruang kerja admin')).not.toBeInTheDocument();
    expect(document.querySelector('link[rel="manifest"]')).toBeNull();
  });
  it('restores an admin session and attaches the admin manifest only inside admin routes', async () => {
    current = session('admin');
    mount('/admin/account');
    expect(
      await screen.findByRole('heading', { name: 'Akun saya' }),
    ).toBeVisible();
    expect(screen.getByText('Ruang kerja admin')).toBeVisible();
    expect(document.querySelector('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/admin/manifest.webmanifest',
    );
  });
  it('sends CSRF on logout and clears all private query data', async () => {
    current = session();
    mount();
    await screen.findByRole('heading', { name: 'Akun saya' });
    queryClient.setQueryData(['booking', 'private'], {
      secret: 'private-account-data',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Keluar' }));
    await screen.findByRole('heading', { name: 'Masuk' });
    expect(logoutToken).toBe('test-csrf-token');
    expect(queryClient.getQueryData(['booking', 'private'])).toBeUndefined();
    expect(queryClient.getQueryData(sessionKey)).toBeNull();
  });
  it('keeps the current account and shows the error when logout fails', async () => {
    current = session();
    server.use(http.post(base + '/auth/logout', () => HttpResponse.error()));
    mount();
    await screen.findByRole('heading', { name: 'Akun saya' });
    await userEvent.click(screen.getByRole('button', { name: 'Keluar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tidak dapat terhubung',
    );
    expect(screen.getByRole('heading', { name: 'Akun saya' })).toBeVisible();
  });
  it('removes old private data and redirects when a protected request returns 401', async () => {
    current = session();
    server.use(
      http.get(base + '/protected-test', () =>
        HttpResponse.json({}, { status: 401 }),
      ),
    );
    mount();
    await screen.findByRole('heading', { name: 'Akun saya' });
    queryClient.setQueryData(['private'], 'private-data');
    await act(async () => {
      await api.get('/protected-test').catch(() => undefined);
    });
    expect(await screen.findByRole('heading', { name: 'Masuk' })).toBeVisible();
    expect(queryClient.getQueryData(['private'])).toBeUndefined();
  });
  it('does not treat a backend outage as an unauthenticated session', async () => {
    server.use(
      http.get(base + '/auth/session', () =>
        HttpResponse.json({}, { status: 503 }),
      ),
    );
    mount();
    expect(
      await screen.findByRole('heading', {
        name: 'Tidak dapat memuat halaman',
      }),
    ).toBeVisible();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    current = session();
    server.resetHandlers();
    server.use(
      http.get(base + '/auth/session', () => HttpResponse.json(current)),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(
      await screen.findByRole('heading', { name: 'Akun saya' }),
    ).toBeVisible();
  });
  it('shows wrong credentials inline and allows a corrected attempt', async () => {
    server.use(
      http.post(base + '/auth/login', () =>
        HttpResponse.json(
          { message: 'Email/nomor HP atau password tidak sesuai.' },
          { status: 401 },
        ),
      ),
    );
    mount('/login');
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText('Email atau nomor HP'),
      'penyewa@example.test',
    );
    await user.type(screen.getByLabelText('Password'), 'salah');
    await user.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'password tidak sesuai',
    );
    expect(screen.getByLabelText('Email atau nomor HP')).toHaveValue(
      'penyewa@example.test',
    );
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeEnabled();
  });
  it('discards previous-account data when session refresh finds a different user', async () => {
    current = session();
    mount();
    await screen.findByRole('heading', { name: 'Akun saya' });
    queryClient.setQueryData(['booking', 'old-account'], {
      private: 'old-account',
    });
    current = {
      ...session(),
      user: {
        ...session().user,
        id: 'replacement-user',
        name: 'Akun Pengganti',
      },
    };
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: sessionKey });
    });
    expect(
      (await screen.findAllByText('Akun Pengganti')).length,
    ).toBeGreaterThan(0);
    expect(
      queryClient.getQueryData(['booking', 'old-account']),
    ).toBeUndefined();
  });
  it('blocks submission offline and restores it when the connection returns', async () => {
    mount('/login');
    await screen.findByLabelText('Password');
    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeDisabled();
    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Masuk' })).toBeEnabled(),
    );
  });
});
