import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/auth/session';
import { refreshBookingQueries } from '@/services/business-action';
import { adminApi } from './api';
import type { BookingFilters } from './types';
export function useAdminBookings(filters: BookingFilters) {
  const user = useSession().data?.user;
  return useQuery({
    queryKey: ['admin', user?.id, 'bookings', filters],
    queryFn: ({ signal }) => adminApi.bookings(filters, signal),
    enabled: user?.role === 'admin',
    refetchInterval: 30_000,
  });
}
export function useAdminTasks() {
  const user = useSession().data?.user;
  return useQuery({
    queryKey: ['admin', user?.id, 'tasks'],
    queryFn: ({ signal }) => adminApi.tasks(signal),
    enabled: user?.role === 'admin',
    refetchInterval: 30_000,
  });
}
export function useAdminDetail(id: string) {
  const user = useSession().data?.user;
  const enabled = user?.role === 'admin' && !!id;
  const booking = useQuery({
    queryKey: ['admin', user?.id, 'booking', id],
    queryFn: ({ signal }) => adminApi.booking(id, signal),
    enabled,
    refetchInterval: 30_000,
  });
  const financial = useQuery({
    queryKey: ['admin', user?.id, 'financial', id],
    queryFn: ({ signal }) => adminApi.financial(id, signal),
    enabled,
    refetchInterval: 30_000,
  });
  return { booking, financial };
}
export async function refreshAdminPayments() {
  await refreshBookingQueries();
}
