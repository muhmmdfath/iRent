import { useLogout } from '@/auth/use-logout';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useSession } from '@/auth/session';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
export function AppLayout() {
  const session = useSession();
  const logoutProps = useLogout();
  const admin = session.data?.user.role === 'admin';
  useEffect(() => {
    const scope = admin ? '/admin/' : '/';
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = scope + 'manifest.webmanifest';
    document.head.appendChild(link);
    const icon = document.createElement('link');
    icon.rel = 'apple-touch-icon';
    icon.href = '/admin/icon-192.png';
    document.head.appendChild(icon);
    if (window.isSecureContext && 'serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register(scope + 'sw.js', { scope })
        .catch(() => {
          // Installation failure must not block operational pages.
        });
    }
    return () => {
      link.remove();
      icon.remove();
    };
  }, [admin]);
  return (
    <WorkspaceShell user={session.data?.user} {...logoutProps}>
      <PwaInstallPrompt
        key={admin ? 'admin' : 'customer'}
        mode={admin ? 'admin' : 'customer'}
      />
      <Outlet />
    </WorkspaceShell>
  );
}
