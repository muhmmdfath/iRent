import { expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { Providers } from '@/app/providers';
import { AppRoutes } from '@/app/router';
import { server } from './server';
import { item } from './customer-fixtures';
const base = 'http://localhost:3000/api';
it('searches the whole catalog through the API and resets pagination while preserving category and search filters', async () => {
  const requests: URL[] = [];
  server.use(
    http.get(base + '/auth/session', () =>
      HttpResponse.json({}, { status: 401 }),
    ),
    http.get(base + '/items', ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json({ data: [item], total: 37, page: 1 });
    }),
  );
  render(
    <Providers>
      <MemoryRouter initialEntries={['/catalog?page=3']}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: item.name });
  await user.type(
    screen.getByRole('searchbox', { name: 'Cari perangkat' }),
    'iPhone',
  );
  await user.click(screen.getByRole('button', { name: 'Cari di katalog' }));
  await waitFor(() =>
    expect(requests.at(-1)?.searchParams.get('search')).toBe('iPhone'),
  );
  expect(requests.at(-1)?.searchParams.get('page')).toBe('1');
  await user.click(screen.getByRole('button', { name: 'iPhone' }));
  await waitFor(() =>
    expect(requests.at(-1)?.searchParams.get('category')).toBe('iphone'),
  );
  expect(requests.at(-1)?.searchParams.get('search')).toBe('iPhone');
  await user.click(screen.getByRole('button', { name: 'Berikutnya' }));
  await waitFor(() =>
    expect(requests.at(-1)?.searchParams.get('page')).toBe('2'),
  );
  expect(requests.at(-1)?.searchParams.get('category')).toBe('iphone');
});
it('clears an empty search result and focuses the catalog search with the keyboard shortcut', async () => {
  server.use(
    http.get(base + '/auth/session', () =>
      HttpResponse.json({}, { status: 401 }),
    ),
    http.get(base + '/items', ({ request }) =>
      HttpResponse.json({
        data: new URL(request.url).searchParams.has('search') ? [] : [item],
        total: 1,
        page: 1,
      }),
    ),
  );
  render(
    <Providers>
      <MemoryRouter initialEntries={['/catalog?search=kosong']}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Perangkat tidak ditemukan' });
  await user.click(screen.getByRole('button', { name: 'Tampilkan semua' }));
  await screen.findByRole('heading', { name: item.name });
  expect(screen.getByRole('searchbox')).toHaveValue('');
  await user.keyboard('{Control>}k{/Control}');
  expect(screen.getByRole('searchbox')).toHaveFocus();
});
