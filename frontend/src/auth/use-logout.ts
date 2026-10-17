import { useMutation } from '@tanstack/react-query';
import { useSession } from './session';
import { logout } from './api';
import { clearSessionData } from '@/services/query-client';
import { errorMessage } from '@/services/api';
import { useOnline } from '@/hooks/use-online';
import { disableCurrentPush } from '@/admin/notifications/push';
export function useLogout() {
  const session = useSession();
  const online = useOnline();
  const mutation = useMutation({
    mutationFn: async () => {
      if (session.data?.user.role === 'admin') await disableCurrentPush();
      await logout();
    },
    onSuccess: clearSessionData,
  });
  return {
    onLogout: () => {
      mutation.reset();
      mutation.mutate();
    },
    logoutPending: mutation.isPending,
    logoutDisabled: mutation.isPending || !online,
    error: mutation.error ? errorMessage(mutation.error) : null,
  };
}
