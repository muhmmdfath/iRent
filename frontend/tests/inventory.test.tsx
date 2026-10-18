import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import {
  render,
  screen,
  waitFor,
  configure,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { AppRoutes } from '@/app/router';
import { Providers } from '@/app/providers';
import { server } from './server';
import { adminSession } from './admin-fixtures';
import { inventoryItem, inventoryUnits } from './inventory-fixtures';
import { at, customerSession } from './customer-fixtures';
const base = 'http://localhost:3000/api';
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 15000 });
beforeAll(async () => {
  // JSDOM does not implement the native dialog lifecycle; browser tests cover focus/Escape.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };

  await import('@/admin/inventory/pages');
});
let item: typeof inventoryItem, units: ReturnType<typeof inventoryUnits>;
beforeEach(() => {
  item = { ...inventoryItem };
  units = inventoryUnits();
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(adminSession)),
    http.get(base + '/admin/items', () =>
      HttpResponse.json({ data: [item], total: 1, page: 1 }),
    ),
    http.get(base + '/admin/items/test-item', () => HttpResponse.json(item)),
    http.get(base + '/admin/items/test-item/units', () =>
      HttpResponse.json({ data: units, total: units.length, page: 1 }),
    ),
  );
});
function mount(route = '/admin/inventory/test-item') {
  render(
    <Providers>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
}
it('searches and filters inventory on the server with an explicit physical-stock label', async () => {
  let params = '';
  server.use(
    http.get(base + '/admin/items', ({ request }) => {
      params = new URL(request.url).search;
      return HttpResponse.json({ data: [item], total: 1, page: 1 });
    }),
  );
  mount('/admin/inventory');
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Inventaris' });
  await user.type(screen.getByLabelText('Nama model'), 'iPhone');
  await user.selectOptions(screen.getByLabelText('Kategori'), 'iphone');
  await user.selectOptions(screen.getByLabelText('Status katalog'), 'false');
  await user.click(screen.getByRole('button', { name: 'Cari' }));
  await waitFor(() => expect(params).toContain('isActive=false'));
  expect(params).toContain('search=iPhone');
  expect(params).toContain('category=iphone');
  expect(await screen.findByText('1 siap fisik')).toBeVisible();
});
it('creates a model only after review and keeps large rupiah values as strings', async () => {
  let body: unknown;
  let calls = 0;
  server.use(
    http.post(base + '/admin/items', async ({ request }) => {
      body = await request.json();
      calls++;
      expect(request.headers.get('x-csrf-token')).toBe('admin-csrf');
      return HttpResponse.json(item, { status: 201 });
    }),
  );
  mount('/admin/inventory/new');
  const user = userEvent.setup();
  const modal = within(
    await screen.findByRole('dialog', { name: 'Tambah model' }),
  );
  await user.type(modal.getByLabelText('Nama model'), 'iPhone Model Baru');
  for (const hour of ['6', '12', '24'])
    await user.type(
      modal.getByLabelText(`Tarif ${hour} jam (rupiah)`),
      '9007199254740993',
    );
  await user.type(
    modal.getByLabelText('Isi paket (satu per baris)'),
    'Kabel\nTas',
  );
  await user.click(modal.getByRole('button', { name: 'Periksa model' }));
  expect(calls).toBe(0);
  await user.click(modal.getByRole('button', { name: 'Konfirmasi perubahan' }));
  await waitFor(() => expect(calls).toBe(1));
  expect(body).toMatchObject({
    category: 'iphone',
    name: 'iPhone Model Baru',
    price6h: '9007199254740993',
    includes: ['Kabel', 'Tas'],
  });
  await screen.findByRole('heading', { name: 'Unit fisik' });
});
it('edits prices without sending a category change', async () => {
  let body: Record<string, unknown> | undefined;
  server.use(
    http.patch(base + '/admin/items/test-item', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      item = { ...item, ...body };
      return HttpResponse.json(item);
    }),
  );
  mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Edit model' }));
  expect(screen.getByLabelText('Kategori')).toBeDisabled();
  await user.clear(screen.getByLabelText('Tarif 6 jam (rupiah)'));
  await user.type(screen.getByLabelText('Tarif 6 jam (rupiah)'), '75000');
  await user.click(screen.getByRole('button', { name: 'Periksa model' }));
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi perubahan' }),
  );
  await screen.findByText(
    'Model diperbarui. Snapshot transaksi lama tetap tersimpan.',
  );
  expect(body?.price6h).toBe('75000');
  expect(body).not.toHaveProperty('category');
});
it('rejects duplicate iPhone codes before normalizing and adding the batch', async () => {
  let body: unknown;
  server.use(
    http.post(base + '/admin/items/test-item/units', async ({ request }) => {
      body = await request.json();
      return HttpResponse.json([], { status: 201 });
    }),
  );
  mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Tambah unit' }));
  const codes = screen.getByLabelText('Kode unit iPhone (satu per baris)');
  await user.type(codes, 'ip-004\nIP-004');
  await user.click(screen.getByRole('button', { name: 'Periksa unit baru' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('duplikat');
  await user.clear(codes);
  await user.type(codes, 'ip-004\nip-005');
  await user.click(screen.getByRole('button', { name: 'Periksa unit baru' }));
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi perubahan' }),
  );
  await screen.findByText('Unit baru ditambahkan.');
  expect(body).toEqual({ codes: ['IP-004', 'IP-005'] });
});
it('blocks repeated accessory creation after an uncertain server response', async () => {
  item.category = 'accessory';
  let calls = 0;
  let body: unknown;
  server.use(
    http.post(base + '/admin/items/test-item/units', async ({ request }) => {
      calls++;
      body = await request.json();
      return HttpResponse.json(
        { message: 'Response hilang.' },
        { status: 503 },
      );
    }),
  );
  mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Tambah unit' }));
  await user.type(screen.getByLabelText('Jumlah unit aksesori'), '2');
  await user.click(screen.getByRole('button', { name: 'Periksa unit baru' }));
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi perubahan' }),
  );
  expect(
    await within(screen.getByRole('dialog')).findByRole('alert'),
  ).toHaveTextContent('belum dapat dipastikan');
  expect(
    screen.getByRole('button', { name: 'Konfirmasi perubahan' }),
  ).toBeDisabled();
  expect(calls).toBe(1);
  expect(body).toEqual({ quantity: 2 });
});
it('finishes maintenance into preparation while keeping the one-hour completion guard', async () => {
  server.use(
    http.post(
      base + '/admin/units/maintenance-unit/maintenance/complete',
      () => {
        units[1] = {
          ...units[1],
          conditionStatus: 'layak',
          physicalStatus: 'preparing',
          preparationUntil: at(3600000),
        };
        return HttpResponse.json(units[1]);
      },
    ),
  );
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Selesaikan perawatan IPH-002' }),
  );
  await user.click(
    screen.getByRole('checkbox', { name: /sudah memeriksa kondisi fisik/ }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi perubahan' }),
  );
  await screen.findByText(
    'Kondisi unit diperbarui. Periksa status dan batas persiapan terbaru.',
  );
  expect(
    screen.getByRole('button', { name: 'Selesaikan persiapan IPH-002' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Selesaikan persiapan IPH-003' }),
  ).toBeDisabled();
});
it('enables preparation at its deadline but never while a return is unverified', async () => {
  units[2].preparationUntil = at(1000);
  units[0] = {
    ...units[0],
    physicalStatus: 'preparing',
    preparationUntil: at(-1000),
    unreturnedBookingCount: 1,
  };
  mount();
  const ready = await screen.findByRole('button', {
    name: 'Selesaikan persiapan IPH-003',
  });
  await waitFor(() => expect(ready).toBeEnabled(), { timeout: 4000 });
  expect(
    screen.getByRole('button', { name: 'Selesaikan persiapan IPH-001' }),
  ).toBeDisabled();
});
it('keeps reserved or rented units out of maintenance and deactivation', async () => {
  units[0].activeAllocationCount = 1;
  mount();
  await userEvent.click(await screen.findByLabelText('Tindakan unit IPH-001'));
  expect(
    await screen.findByRole('button', { name: 'Nonaktifkan IPH-001' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Mulai perawatan IPH-001' }),
  ).toBeDisabled();
});
it('records maintenance reason and marks the selected unit for repair', async () => {
  let body: unknown;
  server.use(
    http.post(
      base + '/admin/units/ready-unit/maintenance',
      async ({ request }) => {
        body = await request.json();
        units[0] = {
          ...units[0],
          conditionStatus: 'maintenance',
          physicalStatus: 'awaiting_check',
        };
        return HttpResponse.json(units[0]);
      },
    ),
  );
  mount();
  const user = userEvent.setup();
  await user.click(await screen.findByLabelText('Tindakan unit IPH-001'));
  await user.click(
    await screen.findByRole('button', { name: 'Mulai perawatan IPH-001' }),
  );
  await user.type(
    screen.getByLabelText('Alasan perawatan'),
    'Pemeriksaan baterai unit.',
  );
  await user.click(screen.getByRole('button', { name: 'Periksa perawatan' }));
  await user.click(
    screen.getByRole('checkbox', { name: /sudah memeriksa kondisi fisik/ }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi perubahan' }),
  );
  await screen.findByText(
    'Kondisi unit diperbarui. Periksa status dan batas persiapan terbaru.',
  );
  expect(body).toEqual({ reason: 'Pemeriksaan baterai unit.' });
  expect(
    screen.getByRole('button', { name: 'Selesaikan perawatan IPH-001' }),
  ).toBeVisible();
});
it('finishes preparation through the API and refreshes physical readiness', async () => {
  units[2].preparationUntil = at(-1000);
  server.use(
    http.post(base + '/admin/units/preparing-unit/preparation/complete', () => {
      units[2] = {
        ...units[2],
        physicalStatus: 'ready',
        preparationUntil: null,
      };
      return HttpResponse.json(units[2]);
    }),
  );
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Selesaikan persiapan IPH-003' }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi perubahan' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('pemeriksaan');
  await user.click(
    screen.getByRole('checkbox', { name: /sudah memeriksa kondisi fisik/ }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Konfirmasi perubahan' }),
  );
  await screen.findByText(
    'Kondisi unit diperbarui. Periksa status dan batas persiapan terbaru.',
  );
  await user.click(await screen.findByLabelText('Tindakan unit IPH-003'));
  expect(
    screen.getByRole('button', { name: 'Nonaktifkan IPH-003' }),
  ).toBeEnabled();
});
it('prevents customer access to inventory routes', async () => {
  server.use(
    http.get(base + '/auth/session', () => HttpResponse.json(customerSession)),
  );
  mount('/admin/inventory');
  expect(
    await screen.findByRole('heading', { name: 'Untuk rencana berikutnya' }),
  ).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Inventaris' }),
  ).not.toBeInTheDocument();
});
