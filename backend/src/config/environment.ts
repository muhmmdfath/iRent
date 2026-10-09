import { plainToInstance, Transform } from 'class-transformer';
import { readNikKeys } from '../auth/crypto';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { createECDH } from 'node:crypto';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class Environment {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV = 'development';

  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  CORS_ORIGINS = '';
  @IsString() @IsNotEmpty() CSRF_SECRET!: string;
  @IsString() @IsNotEmpty() NIK_KEYS!: string;
  @IsString() NIK_ACTIVE_KEY = 'v1';
  @IsString() @IsNotEmpty() PROOF_STORAGE_DIR = resolve('storage/proofs');
  @IsString() @IsNotEmpty() MEDIA_STORAGE_DIR = resolve('storage/media');
  @IsIn(['true', 'false']) PAYMENT_WORKER_ENABLED = 'true';
  @IsIn(['true', 'false']) NO_SHOW_WORKER_ENABLED = 'true';
  @IsIn(['true', 'false']) EXTENSION_WORKER_ENABLED = 'true';
  @IsIn(['true', 'false']) RISK_WORKER_ENABLED = 'true';
  @IsIn(['true', 'false']) NOTIFICATION_WORKER_ENABLED = 'false';
  @IsString() VAPID_PUBLIC_KEY = '';
  @IsString() VAPID_PRIVATE_KEY = '';
  @IsString() VAPID_SUBJECT = '';
}

export function validateEnvironment(raw: Record<string, unknown>): Environment {
  const selected = Object.fromEntries(
    [
      'NODE_ENV',
      'PORT',
      'DATABASE_URL',
      'CORS_ORIGINS',
      'CSRF_SECRET',
      'NIK_KEYS',
      'NIK_ACTIVE_KEY',
      'PROOF_STORAGE_DIR',
      'MEDIA_STORAGE_DIR',
      'PAYMENT_WORKER_ENABLED',
      'NO_SHOW_WORKER_ENABLED',
      'EXTENSION_WORKER_ENABLED',
      'RISK_WORKER_ENABLED',
      'NOTIFICATION_WORKER_ENABLED',
      'VAPID_PUBLIC_KEY',
      'VAPID_PRIVATE_KEY',
      'VAPID_SUBJECT',
    ]
      .filter((key) => raw[key] !== undefined)
      .map((key) => [key, raw[key]]),
  );
  const config = plainToInstance(Environment, selected);
  const errors = validateSync(config, {
    validationError: { target: false, value: false },
  });
  if (errors.length) {
    throw new Error(
      `Konfigurasi environment tidak valid: ${errors.map((error) => error.property).join(', ')}`,
    );
  }
  const media = resolve(config.MEDIA_STORAGE_DIR),
    proofs = resolve(config.PROOF_STORAGE_DIR);
  const nested = (parent: string, child: string) => {
    const path = relative(parent, child);
    return (
      path === '' ||
      (path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path))
    );
  };
  if (nested(media, proofs) || nested(proofs, media))
    throw new Error(
      'MEDIA_STORAGE_DIR dan PROOF_STORAGE_DIR wajib berupa direktori terpisah tanpa nesting.',
    );
  try {
    const url = new URL(config.DATABASE_URL);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2
    ) {
      throw new Error('invalid database URL');
    }
  } catch {
    throw new Error(
      'DATABASE_URL harus menunjuk database PostgreSQL khusus iRent.',
    );
  }
  parseCorsOrigins(config.CORS_ORIGINS);
  if (
    !/^[A-Za-z0-9+/]{43}=$/.test(config.CSRF_SECRET) ||
    Buffer.from(config.CSRF_SECRET, 'base64').length !== 32 ||
    Buffer.from(config.CSRF_SECRET, 'base64').toString('base64') !==
      config.CSRF_SECRET
  ) {
    throw new Error('CSRF_SECRET harus base64 dari 32 byte acak.');
  }
  readNikKeys(config.NIK_KEYS, config.NIK_ACTIVE_KEY);
  if (
    config.VAPID_PUBLIC_KEY ||
    config.VAPID_PRIVATE_KEY ||
    config.VAPID_SUBJECT
  ) {
    try {
      if (
        !/^[A-Za-z0-9_-]{87}$/.test(config.VAPID_PUBLIC_KEY) ||
        !/^[A-Za-z0-9_-]{43}$/.test(config.VAPID_PRIVATE_KEY)
      )
        throw new Error();
      const curve = createECDH('prime256v1');
      curve.setPrivateKey(Buffer.from(config.VAPID_PRIVATE_KEY, 'base64url'));
      if (
        curve.getPublicKey().toString('base64url') !== config.VAPID_PUBLIC_KEY
      )
        throw new Error();
      const subject = new URL(config.VAPID_SUBJECT);
      if (
        !['https:', 'mailto:'].includes(subject.protocol) ||
        subject.username ||
        subject.password
      )
        throw new Error();
    } catch {
      throw new Error(
        'Konfigurasi VAPID wajib lengkap dengan pasangan kunci dan subject yang valid.',
      );
    }
  }
  if (!config.CORS_ORIGINS)
    throw new Error('CORS_ORIGINS wajib berisi origin frontend.');
  if (
    config.NODE_ENV === 'production' &&
    parseCorsOrigins(config.CORS_ORIGINS).some(
      (origin) => !origin.startsWith('https://'),
    )
  ) {
    throw new Error('Origin produksi wajib HTTPS.');
  }
  return config;
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      let parsed: URL;
      try {
        parsed = new URL(origin);
      } catch {
        throw new Error(
          'CORS_ORIGINS harus berisi origin HTTP/HTTPS yang eksplisit.',
        );
      }
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.origin !== origin ||
        parsed.username ||
        parsed.password
      ) {
        throw new Error(
          'CORS_ORIGINS tidak boleh wildcard, kredensial, path, atau query.',
        );
      }
      return origin;
    });
}
