import { api } from '@/services/api';
export interface PushClient {
  enableAdminPush: (input: {
    apiBase: string;
    csrfToken: string;
    publicKey: string;
  }) => Promise<PushSubscription>;
  disableAdminPush: (input: {
    apiBase: string;
    csrfToken: string;
  }) => Promise<void>;
}
export function loadPushClient(): Promise<PushClient> {
  const modulePath = new URL('/admin/push-client.js', window.location.origin)
    .href;
  return import(/* @vite-ignore */ modulePath);
}
export async function disableCurrentPush() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/admin/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await api.delete('/admin/notifications/subscriptions', {
    data: { endpoint: subscription.endpoint },
  });
  await subscription.unsubscribe();
}
