import { test as base } from '@playwright/test';
export { expect } from '@playwright/test';
// Common shell queries stay simulated too. Each scenario can override these routes.
// Real API scenarios deliberately use the backend, with no fallback responses.
export const test = base.extend({
  page: async ({ page }, providePage, info) => {
    if (!info.title.startsWith('real API:')) {
      await page.route(/\/api\/notifications(?:\?.*)?$/, (route) =>
        route.fulfill({
          json: { data: [], total: 0, unread: 0, page: 1, limit: 10 },
        }),
      );
      await page.route('**/api/customer/profile', (route) =>
        route.fulfill({ json: null }),
      );
      await page.route(/\/api\/items(?:\?.*)?$/, (route) =>
        route.fulfill({ json: { data: [], total: 0, page: 1, limit: 12 } }),
      );
      await page.route(/\/api\/bookings(?:\?.*)?$/, (route) =>
        route.fulfill({ json: [] }),
      );
      await page.route(/\/api\/admin\/bookings(?:\?.*)?$/, (route) =>
        route.fulfill({ json: [] }),
      );
      await page.route('**/api/admin/overview', (route) =>
        route.fulfill({
          json: {
            total: 0,
            today: 0,
            lateUnits: 0,
            readyUnits: 0,
            counts: [],
            pickups: [],
            returns: [],
          },
        }),
      );
      await page.route(/\/api\/admin\/tasks(?:\?.*)?$/, (route) =>
        route.fulfill({ json: { data: [], total: 0, page: 1, limit: 20 } }),
      );
    }
    await providePage(page);
  },
});
