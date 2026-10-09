import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/auth/session';
import { customerApi } from './api';
export function useProfile() {
  const userId = useSession().data?.user.id;
  return useQuery({
    queryKey: ['customer', userId, 'profile'],
    queryFn: ({ signal }) => customerApi.profile(signal),
    enabled: !!userId,
    retry: false,
  });
}
export function usePolicy() {
  return useQuery({
    queryKey: ['rental-policy'],
    queryFn: ({ signal }) => customerApi.policy(signal),
    staleTime: 60_000,
  });
}
export function useBookings(page = 1) {
  const userId = useSession().data?.user.id;
  return useQuery({
    queryKey: ['customer', userId, 'bookings', page],
    queryFn: ({ signal }) => customerApi.bookings(page, signal),
    enabled: !!userId,
    refetchInterval: 30_000,
  });
}
export function useBooking(id: string) {
  const userId = useSession().data?.user.id;
  return useQuery({
    queryKey: ['customer', userId, 'booking', id],
    queryFn: ({ signal }) => customerApi.booking(id, signal),
    enabled: !!userId && !!id,
    refetchInterval: 30_000,
  });
}
export function useFinancial(id: string) {
  const userId = useSession().data?.user.id;
  return useQuery({
    queryKey: ['customer', userId, 'financial', id],
    queryFn: ({ signal }) => customerApi.financial(id, signal),
    enabled: !!userId && !!id,
    refetchInterval: 15_000,
  });
}
