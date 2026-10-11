import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/auth/session';
import { api } from '@/services/api';
export function useAdminRead<T>(
  name: string,
  path: string,
  params: Record<string, string | number | undefined> = {},
  poll = false,
) {
  const user = useSession().data?.user;
  return useQuery({
    queryKey: ['admin', user?.id, name, params],
    enabled: user?.role === 'admin',
    refetchInterval: poll ? 30_000 : false,
    queryFn: async ({ signal }) =>
      (await api.get<T>(path, { signal, params })).data,
  });
}
export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
