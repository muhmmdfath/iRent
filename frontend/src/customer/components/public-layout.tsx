import { useLogout } from '@/auth/use-logout';
import { Outlet } from 'react-router-dom';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useSession } from '@/auth/session';
export function PublicLayout() {
  const user = useSession().data?.user;
  const logoutProps = useLogout();
  return (
    <WorkspaceShell user={user} {...logoutProps}>
      <Outlet />
    </WorkspaceShell>
  );
}
