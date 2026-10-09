import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server';
import { queryClient } from '@/services/query-client';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(async () => {
  cleanup();
  await queryClient.cancelQueries();
  queryClient.clear();
  server.resetHandlers();
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    configurable: true,
  });
});
afterAll(() => server.close());
window.scrollTo = vi.fn();
