import 'reflect-metadata';
import { testSecrets } from './config.fixture';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  validateEnvironment,
  parseCorsOrigins,
} from '../src/config/environment';
import { toApiValue } from '../src/shared/http/api-value';
import {
  parseWibDateTime,
  formatWibDateTime,
  wibNow,
} from '../src/shared/time/wib';

test('serializes_rupiah_above_javascript_safe_integer_without_precision_loss', () => {
  const value = { payments: [{ amount: 9_007_199_254_740_993n }] };
  assert.equal(
    JSON.stringify(toApiValue(value)),
    '{"payments":[{"amount":"9007199254740993"}]}',
  );
});

test('preserves_explicit_wib_business_time_at_api_and_database_boundaries', () => {
  const input = '2026-10-08T11:30:00+07:00';
  const wallTime = parseWibDateTime(input);
  assert.equal(wallTime.toISOString(), '2026-10-08T11:30:00.000Z');
  assert.equal(formatWibDateTime(wallTime), '2026-10-08T11:30:00.000+07:00');
  assert.equal(
    formatWibDateTime(wibNow(new Date('2026-10-08T04:30:00Z'))),
    '2026-10-08T11:30:00.000+07:00',
  );
});

test('rejects_ambiguous_and_impossible_booking_timestamps', () => {
  for (const value of [
    '2026-10-08T11:30:00',
    '2026-10-08T11:30:00Z',
    '2026-02-30T11:30:00+07:00',
    '2026-10-08T25:00:00+07:00',
  ]) {
    assert.throws(() => parseWibDateTime(value));
  }
});

test('validates_database_and_port_without_exposing_credentials', () => {
  const secrets = testSecrets();
  const originalValidate = validateEnvironment;
  const validate = (raw: Record<string, unknown>) =>
    originalValidate({ ...secrets, ...raw });
  assert.equal(
    validate({
      DATABASE_URL: 'postgresql://user:secret@localhost/irent',
      PORT: '3001',
    }).PORT,
    3001,
  );
  assert.throws(
    () =>
      validate({
        DATABASE_URL: 'mysql://user:secret@localhost/irent',
      }),
    /PostgreSQL/,
  );
  assert.throws(
    () => validate({ DATABASE_URL: 'not-a-url-secret' }),
    /PostgreSQL/,
  );
  assert.throws(
    () =>
      validate({
        DATABASE_URL: 'postgresql://localhost/irent',
        PORT: '0',
      }),
    /PORT/,
  );
});
test('keeps_public_media_storage_disjoint_from_private_payment_evidence', () => {
  const config = {
    ...testSecrets(),
    DATABASE_URL: 'postgresql://localhost/irent',
  };
  for (const [media, proofs] of [
    ['storage', 'storage/proofs'],
    ['storage', 'storage/..proofs'],
    ['storage/proofs/media', 'storage/proofs'],
    ['storage/shared', 'storage/shared'],
  ])
    assert.throws(
      () =>
        validateEnvironment({
          ...config,
          MEDIA_STORAGE_DIR: media,
          PROOF_STORAGE_DIR: proofs,
        }),
      /direktori terpisah/,
    );
});

test('rejects_wildcard_or_path_based_credentialed_cors_origins', () => {
  assert.deepEqual(
    parseCorsOrigins('http://localhost:5173, https://irent.example'),
    ['http://localhost:5173', 'https://irent.example'],
  );
  for (const value of [
    '*',
    'https://irent.example/path',
    'https://user:password@irent.example',
    'https://irent.example?q=1',
  ]) {
    assert.throws(() => parseCorsOrigins(value));
  }
});
