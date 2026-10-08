import { randomBytes } from 'node:crypto';

export function testSecrets() {
  return {
    CSRF_SECRET: randomBytes(32).toString('base64'),
    NIK_KEYS: JSON.stringify({ v1: randomBytes(32).toString('base64') }),
    NIK_ACTIVE_KEY: 'v1',
    CORS_ORIGINS: 'http://localhost:5173',
  };
}
