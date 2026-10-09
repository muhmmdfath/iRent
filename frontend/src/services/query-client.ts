import { useUiStore } from '@/stores/ui';
import type { Session } from '@/auth/types';
import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';
export const sessionKey = ['auth', 'session'] as const;
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (attempt, error) =>
          attempt < 1 &&
          !(
            axios.isAxiosError(error) &&
            error.response &&
            error.response.status < 500
          ),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}
export const queryClient = createQueryClient();
const publicQueryKeys = new Set([
  'catalog',
  'item',
  'rental-policy',
  'delivery-zones',
  'payment-options',
]);
const privateQuery = (query: { queryKey: readonly unknown[] }) =>
  !publicQueryKeys.has(String(query.queryKey[0])) &&
  !(
    query.queryKey.length === 2 &&
    query.queryKey[0] === 'auth' &&
    query.queryKey[1] === 'session'
  );
export async function discardPrivateData() {
  await queryClient.cancelQueries({ predicate: privateQuery });
  queryClient.removeQueries({ predicate: privateQuery });
  queryClient.getMutationCache().clear();
  useUiStore.getState().setNavigationOpen(false);
}
export async function replaceSession(session: Session | null) {
  await queryClient.cancelQueries();
  // Keep the active session query so guards observe the new value immediately.
  await discardPrivateData();
  queryClient.setQueryData(sessionKey, session);
}
export function clearSessionData() {
  return replaceSession(null);
}
