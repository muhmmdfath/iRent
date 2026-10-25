import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
export const server = setupServer(
  http.get('http://localhost:3000/api/items/:id/calendar', ({ request }) => {
    const month = new URL(request.url).searchParams.get('month') || '2026-10';
    const [year, number] = month.split('-').map(Number);
    return HttpResponse.json({
      month,
      days: Array.from(
        { length: new Date(Date.UTC(year, number, 0)).getUTCDate() },
        (_, i) => ({
          date: month + '-' + String(i + 1).padStart(2, '0'),
          available: true,
        }),
      ),
    });
  }),
  http.get('http://localhost:3000/api/customer/profile', () =>
    HttpResponse.json(null),
  ),
  http.get('http://localhost:3000/api/notifications', () =>
    HttpResponse.json({ data: [], total: 0, unread: 0, page: 1, limit: 10 }),
  ),
  http.get('http://localhost:3000/api/items', () =>
    HttpResponse.json({ data: [], total: 0, page: 1, limit: 12 }),
  ),
  http.get('http://localhost:3000/api/payment-options', () =>
    HttpResponse.json({ qrisImagePath: null }),
  ),
  http.get('http://localhost:3000/api/admin/bookings/:id/receipts', () =>
    HttpResponse.json([]),
  ),
  http.get('http://localhost:3000/api/admin/bookings', () =>
    HttpResponse.json([]),
  ),
  http.get('http://localhost:3000/api/admin/overview', () =>
    HttpResponse.json({
      total: 0,
      today: 0,
      lateUnits: 0,
      readyUnits: 0,
      counts: [],
      pickups: [],
      returns: [],
    }),
  ),
  http.get('http://localhost:3000/api/bookings', () => HttpResponse.json([])),
);
