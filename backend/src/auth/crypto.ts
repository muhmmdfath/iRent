import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';

const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return ['scrypt-v1', salt.toString('hex'), key.toString('hex')].join('$');
}
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const valid = /^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded);
  const [, salt, key] = valid
    ? encoded.split('$')
    : ['scrypt-v1', '0'.repeat(32), '0'.repeat(128)];
  const actual = await derive(password, Buffer.from(salt, 'hex'));
  return timingSafeEqual(actual, Buffer.from(key, 'hex')) && valid;
}
export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function csrfToken(sessionToken: string, secret: string): string {
  return createHmac('sha256', Buffer.from(secret, 'base64'))
    .update('irent-csrf-v1:' + sessionToken)
    .digest('hex');
}
export function equalToken(actual: unknown, expected: string): boolean {
  return (
    typeof actual === 'string' &&
    /^[a-f0-9]{64}$/.test(actual) &&
    timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))
  );
}
export function readNikKeys(
  encoded: string,
  active: string,
): Record<string, Buffer> {
  try {
    const parsed: unknown = JSON.parse(encoded);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error();
    const keys: Record<string, Buffer> = Object.create(null) as Record<
      string,
      Buffer
    >;
    for (const [id, value] of Object.entries(parsed)) {
      if (
        !/^[a-zA-Z0-9_-]{1,32}$/.test(id) ||
        typeof value !== 'string' ||
        !/^[A-Za-z0-9+/]{43}=$/.test(value)
      )
        throw new Error();
      const key = Buffer.from(value, 'base64');
      if (key.length !== 32 || key.toString('base64') !== value)
        throw new Error();
      keys[id] = key;
    }
    if (!Object.hasOwn(keys, active)) throw new Error();
    return keys;
  } catch {
    throw new Error('NIK_KEYS/NIK_ACTIVE_KEY tidak valid.');
  }
}
export class NikCipher {
  private readonly keys: Record<string, Buffer>;
  constructor(
    encoded: string,
    private readonly active: string,
  ) {
    this.keys = readNikKeys(encoded, active);
  }
  encrypt(nik: string, userId: string): string {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.keys[this.active], iv);
    cipher.setAAD(Buffer.from('irent-nik-v1:' + userId));
    const data = Buffer.concat([cipher.update(nik, 'utf8'), cipher.final()]);
    return [
      'v1',
      this.active,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      data.toString('base64url'),
    ].join('.');
  }
  decrypt(value: string, userId: string): string {
    const [version, id, iv, tag, data, ...extra] = value.split('.');
    if (version !== 'v1' || extra.length || !Object.hasOwn(this.keys, id))
      throw new Error('NIK tidak dapat dibaca.');
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.keys[id],
        Buffer.from(iv, 'base64url'),
      );
      decipher.setAAD(Buffer.from('irent-nik-v1:' + userId));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(data, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error('NIK tidak dapat dibaca.');
    }
  }
}
