import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { server } from './server';
import { useToastStore } from '@/stores/notifications';
import { queryClient } from '@/services/query-client';
configure({ asyncUtilTimeout: 5000 });
// JSDOM lacks native dialog methods; browser tests cover modality and Escape.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open');
};
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(async () => {
  cleanup();
  useToastStore.getState().clear();
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
