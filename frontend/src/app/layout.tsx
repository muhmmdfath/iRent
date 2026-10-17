import { useLogout } from '@/auth/use-logout';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useSession } from '@/auth/session';
export function AppLayout() {
  const session = useSession();
  const logoutProps = useLogout();
  const admin = session.data?.user.role === 'admin';
  useEffect(() => {
    if (!admin) return;
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/admin/manifest.webmanifest';
    document.head.appendChild(link);
    return () => link.remove();
  }, [admin]);
  return (
    <WorkspaceShell user={session.data?.user} {...logoutProps}>
      <Outlet />
    </WorkspaceShell>
  );
}
