import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthService } from '../../src/auth/auth.service';
import { CustomersService } from '../../src/modules/customers/customers.service';
import { createFirstAdmin } from '../../src/auth/bootstrap-admin';
import { digest } from '../../src/auth/crypto';
import { setupApp } from '../../src/setup-app';
import { wibNow } from '../../src/shared/time/wib';
import { testSecrets } from '../config.fixture';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL wajib diisi.');

test('auth_and_customer_profile_enforce_roles_privacy_csrf_and_session_revocation', async (t) => {
  Object.assign(process.env, testSecrets(), {
    DATABASE_URL: url,
    NODE_ENV: 'test',
  });
  const { AppModule } = await import('../../src/app.module');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });
  setupApp(app);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl(),
    prisma = app.get(PrismaService),
    auth = app.get(AuthService);
  const suffix = randomUUID(),
    customerEmail = 'customer-' + suffix + '@example.test',
    adminEmail = 'admin-' + suffix + '@example.test';
  const password = 'Test password 123!',
    newPassword = 'New password 456!',
    nik = '1111111111111111';
  let customerId = '',
    customerCookie = '',
    customerCsrf = '',
    adminCookie = '',
    adminCsrf = '';
  const rateKeys: string[] = [];
  async function call(
    path: string,
    method = 'GET',
    body?: unknown,
    cookie?: string,
    csrf?: string,
    origin = 'http://localhost:5173',
  ) {
    const headers: Record<string, string> = {};
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      headers.Origin = origin;
    }
    if (cookie) headers.Cookie = cookie;
    if (csrf) headers['X-CSRF-Token'] = csrf;
    return fetch(base + '/api' + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async function login(identity: string, secret = password) {
    const response = await call('/auth/login', 'POST', {
      identity,
      password: secret,
    });
    assert.equal(response.status, 200, await response.clone().text());
    const data = (await response.json()) as {
      csrfToken: string;
      user: { id: string; role: string };
    };
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    return { ...data, cookie };
  }
  try {
    await t.test(
      'rejects_untrusted_origins_and_public_role_escalation',
      async () => {
        assert.equal(
          (
            await call(
              '/auth/register',
              'POST',
              { name: 'Fixture', email: customerEmail, password },
              undefined,
              undefined,
              'https://evil.example',
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call('/auth/register', 'POST', {
              name: 'Fixture',
              email: customerEmail,
              password,
              role: 'admin',
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      'registers_a_customer_and_stores_only_a_hashed_session_token',
      async () => {
        const response = await call('/auth/register', 'POST', {
          name: 'Fixture',
          email: customerEmail.toUpperCase(),
          password,
        });
        assert.equal(response.status, 201, await response.clone().text());
        const text = await response.text(),
          data = JSON.parse(text) as {
            user: { id: string; role: string; email: string };
            csrfToken: string;
          };
        customerId = data.user.id;
        customerCsrf = data.csrfToken;
        const header = response.headers.get('set-cookie')!;
        assert.match(header, /HttpOnly/);
        assert.match(header, /SameSite=Lax/);
        customerCookie = header.split(';')[0];
        assert.equal(data.user.role, 'customer');
        assert.equal(data.user.email, customerEmail);
        assert.ok(
          !text.includes('passwordHash') &&
            !text.includes('nikCiphertext') &&
            !text.includes('"token"'),
        );
        const session = await prisma.authSession.findFirstOrThrow({
          where: { userId: customerId },
        });
        assert.equal(session.tokenHash, digest(customerCookie.split('=')[1]));
        assert.notEqual(session.tokenHash, customerCookie.split('=')[1]);
        assert.equal(
          (
            await call(
              '/admin/customers/' + customerId,
              'GET',
              undefined,
              customerCookie,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call(
              '/admin/accounts',
              'POST',
              {
                name: 'Forbidden',
                email: 'other-' + suffix + '@example.test',
                password,
              },
              customerCookie,
              customerCsrf,
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      'requires_initial_nik_and_csrf_but_allows_empty_optional_profile_fields',
      async () => {
        const profile = {
          fullName: 'Pelanggan Fixture',
          address: 'Alamat Fixture',
          phoneActive: '081234567890',
          nik,
        };
        assert.equal(
          (await call('/customer/profile', 'PUT', profile, customerCookie))
            .status,
          403,
        );
        assert.equal(
          (
            await call(
              '/customer/profile',
              'PUT',
              { ...profile, completedAt: '2026-10-08' },
              customerCookie,
              customerCsrf,
            )
          ).status,
          400,
        );
        const { nik: _, ...withoutNik } = profile;
        void _;
        assert.equal(
          (
            await call(
              '/customer/profile',
              'PUT',
              withoutNik,
              customerCookie,
              customerCsrf,
            )
          ).status,
          400,
        );
        const response = await call(
          '/customer/profile',
          'PUT',
          { ...profile, phoneAlt: '', instagram: '', emailContact: '' },
          customerCookie,
          customerCsrf,
        );
        assert.equal(response.status, 200, await response.clone().text());
        const text = await response.text(),
          saved = JSON.parse(text) as {
            completedAt: string;
            phoneActive: string;
          };
        assert.ok(saved.completedAt.endsWith('+07:00'));
        assert.equal(saved.phoneActive, '+6281234567890');
        assert.ok(!text.includes(nik) && !text.includes('nikCiphertext'));
        const stored = await prisma.customerProfile.findUniqueOrThrow({
          where: { userId: customerId },
        });
        assert.ok(!stored.nikCiphertext.includes(nik));
        assert.equal(
          (
            await call(
              '/customer/profile',
              'PUT',
              { ...withoutNik, address: 'Alamat berubah' },
              customerCookie,
              customerCsrf,
            )
          ).status,
          200,
        );
        const read = await call(
          '/customer/profile',
          'GET',
          undefined,
          customerCookie,
        );
        assert.ok(!(await read.text()).includes(nik));
      },
    );
    await t.test(
      'serializes_first_admin_bootstrap_and_restricts_nik_to_admin_detail',
      async () => {
        // Requires a dedicated empty test database, never an existing deployment.
        const outcomes = await Promise.allSettled([
          createFirstAdmin(prisma, {
            name: 'Fixture Admin',
            email: adminEmail,
            password,
          }),
          createFirstAdmin(prisma, {
            name: 'Fixture Admin',
            email: adminEmail,
            password,
          }),
        ]);
        assert.equal(
          outcomes.filter((result) => result.status === 'fulfilled').length,
          1,
        );
        assert.equal(
          outcomes.filter((result) => result.status === 'rejected').length,
          1,
        );
        const session = await login(adminEmail);
        adminCookie = session.cookie;
        adminCsrf = session.csrfToken;
        assert.equal(session.user.role, 'admin');
        const response = await call(
          '/admin/customers/' + customerId,
          'GET',
          undefined,
          adminCookie,
        );
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const text = await response.text(),
          data = JSON.parse(text) as { profile: { nik: string } };
        assert.equal(data.profile.nik, nik);
        assert.ok(
          !text.includes('nikCiphertext') && !text.includes('passwordHash'),
        );
        const logs = await prisma.auditLog.findMany({
          where: { entityId: customerId },
        });
        assert.ok(logs.some((log) => log.action === 'customer.nik_viewed'));
        assert.ok(
          !JSON.stringify(logs).includes(nik) &&
            !JSON.stringify(logs).includes(password),
        );
      },
    );
    await t.test(
      'allows_admin_creation_without_switching_the_current_admin_session',
      async () => {
        const response = await call(
          '/admin/accounts',
          'POST',
          {
            name: 'Admin Kedua',
            email: 'second-' + suffix + '@example.test',
            password,
          },
          adminCookie,
          adminCsrf,
        );
        assert.equal(response.status, 201, await response.clone().text());
        assert.equal(response.headers.get('set-cookie'), null);
        const result = (await response.json()) as { user: { role: string } };
        assert.equal(result.user.role, 'admin');
      },
    );
    await t.test(
      'password_reset_revokes_every_customer_session_and_rejects_the_old_password',
      async () => {
        const second = await login(customerEmail);
        const staleContext = await auth.authenticate(
          second.cookie.split('=')[1],
        );
        const response = await call(
          '/admin/customers/' + customerId + '/password',
          'POST',
          { password: newPassword },
          adminCookie,
          adminCsrf,
        );
        assert.equal(response.status, 204);
        await assert.rejects(
          app.get(CustomersService).saveProfile(staleContext, {
            fullName: 'Rejected stale change',
            address: 'Rejected',
            phoneActive: '081234567890',
          }),
          /login kembali/,
        );
        for (const cookie of [customerCookie, second.cookie])
          assert.equal(
            (await call('/auth/session', 'GET', undefined, cookie)).status,
            401,
          );
        assert.equal(
          (
            await call('/auth/login', 'POST', {
              identity: customerEmail,
              password,
            })
          ).status,
          401,
        );
        const current = await login(customerEmail, newPassword);
        customerCookie = current.cookie;
        customerCsrf = current.csrfToken;
      },
    );
    await t.test(
      'expired_and_inactive_sessions_are_rejected_and_logout_revokes_the_cookie',
      async () => {
        const expired = await login(customerEmail, newPassword);
        await prisma.authSession.updateMany({
          where: { tokenHash: digest(expired.cookie.split('=')[1]) },
          data: {
            createdAt: new Date(wibNow().getTime() - 7200000),
            expiresAt: new Date(wibNow().getTime() - 3600000),
          },
        });
        assert.equal(
          (await call('/auth/session', 'GET', undefined, expired.cookie))
            .status,
          401,
        );
        await prisma.user.update({
          where: { id: customerId },
          data: { isActive: false },
        });
        assert.equal(
          (await call('/auth/session', 'GET', undefined, customerCookie))
            .status,
          401,
        );
        assert.equal(
          (
            await call('/auth/login', 'POST', {
              identity: customerEmail,
              password: newPassword,
            })
          ).status,
          401,
        );
        await prisma.user.update({
          where: { id: customerId },
          data: { isActive: true },
        });
        assert.equal(
          (await call('/auth/logout', 'POST', {}, customerCookie, customerCsrf))
            .status,
          204,
        );
        assert.equal(
          (await call('/auth/session', 'GET', undefined, customerCookie))
            .status,
          401,
        );
      },
    );
    await t.test(
      'postgresql_throttle_remains_atomic_under_concurrent_attempts',
      async () => {
        const identity = randomUUID();
        rateKeys.push(digest('test.concurrent:' + identity));
        const attempts = await Promise.allSettled(
          Array.from({ length: 12 }, () =>
            auth.throttle('test.concurrent', identity, 6, 900),
          ),
        );
        assert.equal(
          attempts.filter((result) => result.status === 'fulfilled').length,
          6,
        );
        assert.equal(
          attempts.filter((result) => result.status === 'rejected').length,
          6,
        );
        const stored = await prisma.authRateLimit.findUniqueOrThrow({
          where: { key: rateKeys[0] },
        });
        assert.equal(stored.count, 12);
        await prisma.authRateLimit.update({
          where: { key: rateKeys[0] },
          data: { resetAt: new Date(wibNow().getTime() - 1000) },
        });
        await auth.throttle('test.concurrent', identity, 6, 900);
        assert.equal(
          (
            await prisma.authRateLimit.findUniqueOrThrow({
              where: { key: rateKeys[0] },
            })
          ).count,
          1,
        );
      },
    );
    await t.test(
      'login_endpoint_returns_429_when_the_identity_budget_is_exhausted',
      async () => {
        const key = digest(
          'login.identity:' + JSON.stringify({ email: customerEmail }),
        );
        await prisma.authRateLimit.upsert({
          where: { key },
          create: {
            key,
            count: 10,
            resetAt: new Date(wibNow().getTime() + 900000),
          },
          update: { count: 10, resetAt: new Date(wibNow().getTime() + 900000) },
        });
        assert.equal(
          (
            await call('/auth/login', 'POST', {
              identity: customerEmail.toUpperCase(),
              password: newPassword,
            })
          ).status,
          429,
        );
      },
    );
  } finally {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: suffix + '@example.test' } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({
        where: { OR: [{ actorId: { in: ids } }, { entityId: { in: ids } }] },
      });
      await tx.authSession.deleteMany({ where: { userId: { in: ids } } });
      await tx.customerProfile.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
      await tx.authRateLimit.deleteMany({
        where: {
          key: {
            in: [
              ...rateKeys,
              digest('register.ip:127.0.0.1'),
              digest('login.ip:127.0.0.1'),
              digest(
                'login.identity:' + JSON.stringify({ email: customerEmail }),
              ),
              digest('login.identity:' + JSON.stringify({ email: adminEmail })),
            ],
          },
        },
      });
    });
    await app.close();
  }
});
