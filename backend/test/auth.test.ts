import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import {
  csrfToken,
  equalToken,
  hashPassword,
  NikCipher,
  readNikKeys,
  verifyPassword,
} from '../src/auth/crypto';
import { normalizeEmail, normalizePhone } from '../src/auth/identity';

test('password_hashes_are_salted_and_reject_wrong_or_malformed_credentials', async () => {
  const password = 'Fixture password 123!';
  const first = await hashPassword(password),
    second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('Wrong password', first), false);
  assert.equal(await verifyPassword(password, 'malformed'), false);
});
test('encrypted_nik_is_randomized_and_bound_to_its_customer', () => {
  const cipher = new NikCipher(
    JSON.stringify({ v1: randomBytes(32).toString('base64') }),
    'v1',
  );
  const nik = '1111111111111111',
    first = cipher.encrypt(nik, 'customer-1');
  assert.notEqual(first, cipher.encrypt(nik, 'customer-1'));
  assert.ok(!first.includes(nik));
  assert.equal(cipher.decrypt(first, 'customer-1'), nik);
  assert.throws(() => cipher.decrypt(first, 'customer-2'));
  const pieces = first.split('.');
  pieces[3] = randomBytes(16).toString('base64url');
  assert.throws(() => cipher.decrypt(pieces.join('.'), 'customer-1'));
});
test('nik_key_rotation_preserves_decryption_with_the_old_key', () => {
  const v1 = randomBytes(32).toString('base64'),
    v2 = randomBytes(32).toString('base64');
  const old = new NikCipher(JSON.stringify({ v1 }), 'v1');
  const rotated = new NikCipher(JSON.stringify({ v1, v2 }), 'v2');
  assert.equal(
    rotated.decrypt(old.encrypt('1111111111111111', 'owner'), 'owner'),
    '1111111111111111',
  );
  assert.ok(rotated.encrypt('1111111111111111', 'owner').startsWith('v1.v2.'));
  assert.throws(() => readNikKeys('{"v1":"not-a-key"}', 'v1'), /tidak valid/);
});
test('csrf_tokens_are_bound_to_the_session_and_identity_is_normalized', () => {
  const secret = randomBytes(32).toString('base64');
  const token = csrfToken('session-1', secret);
  assert.equal(equalToken(token, token), true);
  assert.equal(equalToken(token, csrfToken('session-2', secret)), false);
  assert.equal(equalToken(['bad'], token), false);
  assert.equal(normalizePhone('0812-3456-7890'), '+6281234567890');
  assert.equal(normalizePhone('6281234567890'), '+6281234567890');
  assert.equal(normalizeEmail(' USER@Example.com '), 'user@example.com');
});
