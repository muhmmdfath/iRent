import type { Role } from './types';
export function roleHome(role: Role) {
  return role === 'admin' ? '/admin/' : '/app/';
}
export function safeReturnTo(value: string | null, role: Role) {
  const prefix = roleHome(role);
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    Array.from(value).some((char) => char === '\\' || char.charCodeAt(0) <= 32)
  )
    return prefix;
  const url = new URL(value, 'https://irent.local');
  if (
    url.origin !== 'https://irent.local' ||
    !(url.pathname === prefix.slice(0, -1) || url.pathname.startsWith(prefix))
  )
    return prefix;
  return url.pathname + url.search + url.hash;
}
