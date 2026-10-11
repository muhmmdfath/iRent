import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
export const server = setupServer(
  http.get('http://localhost:3000/api/items', () =>
    HttpResponse.json({ data: [], total: 0, page: 1, limit: 12 }),
  ),
  http.get('http://localhost:3000/api/payment-options', () =>
    HttpResponse.json({ qrisImagePath: null }),
  ),
  http.get('http://localhost:3000/api/admin/bookings/:id/receipts', () =>
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
