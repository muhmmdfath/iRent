import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Providers } from '@/app/providers';
import { RentalDateTimeInput } from '@/customer/components/rental-date-time-input';
import { server } from './server';
function Calendar() {
  const [value, setValue] = useState('2026-10-25T10:00');
  return (
    <Providers>
      <RentalDateTimeInput
        aria-label="Jadwal sewa"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        initiallyOpen
        timeRange={{ from: '08:00', to: '22:00' }}
        items={[{ itemId: 'test-item', quantity: 2 }]}
        durationHours={24}
      />
      <output aria-label="Jadwal pilihan">{value}</output>
    </Providers>
  );
}
it('uses monthly stock for the selected time, quantity and duration and reloads when time changes', async () => {
  let query: URLSearchParams | undefined;
  server.use(
    http.get(
      'http://localhost:3000/api/items/test-item/calendar',
      ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json({
          month: '2026-10',
          days: [
            { date: '2026-10-25', available: true },
            { date: '2026-10-29', available: false },
            { date: '2026-10-30', available: query.get('time') === '10:00' },
          ],
        });
      },
    ),
  );
  render(<Calendar />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: '30 Oktober 2026' }),
    ).toBeEnabled(),
  );
  expect(query?.get('quantity')).toBe('2');
  expect(query?.get('durationHours')).toBe('24');
  expect(
    screen.getByRole('button', { name: '29 Oktober 2026' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: '24 Oktober 2026' }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '29 Oktober 2026' }));
  expect(screen.getByLabelText('Jadwal pilihan')).toHaveTextContent(
    '2026-10-25T10:00',
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Jam' }), {
    target: { value: '11' },
  });
  await waitFor(() => expect(query?.get('time')).toBe('11:00'));
  expect(
    screen.getByRole('button', { name: '30 Oktober 2026' }),
  ).toBeDisabled();
});
it('keeps dates disabled when availability cannot be checked', async () => {
  server.use(
    http.get('http://localhost:3000/api/items/test-item/calendar', () =>
      HttpResponse.json({}, { status: 503 }),
    ),
  );
  render(<Calendar />);
  await screen.findByText(/Ketersediaan belum dapat dimuat/);
  expect(
    screen.getByRole('button', { name: '30 Oktober 2026' }),
  ).toBeDisabled();
});
