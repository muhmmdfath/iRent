export interface AlertSound {
  enable: () => Promise<void>;
  update: (tasks: { key: string }[]) => void;
  acknowledge: (key: string) => void;
  disable: () => void;
  dispose: () => void;
}
export function loadAlertSound(): Promise<{
  createAdminAlertSound: () => AlertSound;
}> {
  const modulePath = new URL('/admin/alert-sound.js', window.location.origin)
    .href;
  return import(/* @vite-ignore */ modulePath);
}
