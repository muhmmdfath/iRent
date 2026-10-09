import { BadRequestException } from '@nestjs/common';
import { createECDH } from 'node:crypto';
export function validatePush(
  endpoint: string,
  keys?: { p256dh: string; auth: string },
) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new BadRequestException('Endpoint push tidak valid.');
  }
  const allowed =
    [
      'fcm.googleapis.com',
      'updates.push.services.mozilla.com',
      'web.push.apple.com',
    ].includes(url.hostname) || url.hostname.endsWith('.notify.windows.com');
  if (
    !allowed ||
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new BadRequestException('Layanan push tidak diizinkan.');
  if (keys) {
    try {
      if (
        !/^[A-Za-z0-9_-]{87}$/.test(keys.p256dh) ||
        !/^[A-Za-z0-9_-]{22}$/.test(keys.auth)
      )
        throw new Error();
      const publicKey = Buffer.from(keys.p256dh, 'base64url'),
        auth = Buffer.from(keys.auth, 'base64url');
      if (
        publicKey.length !== 65 ||
        publicKey[0] !== 4 ||
        auth.length !== 16 ||
        publicKey.toString('base64url') !== keys.p256dh ||
        auth.toString('base64url') !== keys.auth
      )
        throw new Error();
      const curve = createECDH('prime256v1');
      curve.generateKeys();
      curve.computeSecret(publicKey);
    } catch {
      throw new BadRequestException('Kunci subscription tidak valid.');
    }
  }
  return endpoint;
}
