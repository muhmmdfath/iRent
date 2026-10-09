import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../session';
import { roleHome } from '../navigation';
import type { Role } from '../types';
import { LoadingState, ErrorState } from '@/components/feedback';
export function RequireSession({ role }: { role: Role }) {
  const session = useSession();
  const location = useLocation();
  if (session.isPending) return <LoadingState />;
  if (session.data === null)
    return (
      <Navigate
        to={
          '/login?returnTo=' +
          encodeURIComponent(
            location.pathname + location.search + location.hash,
          )
        }
        replace
      />
    );
  if (session.isError)
    return (
      <ErrorState error={session.error} retry={() => void session.refetch()} />
    );
  if (!session.data) return <LoadingState />;
  if (session.data.user.role !== role)
    return <Navigate to={roleHome(session.data.user.role)} replace />;
  return <Outlet key={session.data.user.id} />;
}
