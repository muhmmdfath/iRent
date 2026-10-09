import { useQuery } from '@tanstack/react-query';
import { sessionKey } from '@/services/query-client';
import { getSession } from './api';
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: ({ signal }) => getSession(signal),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: 'always',
  });
}
