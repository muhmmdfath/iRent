import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthService } from '../../src/auth/auth.service';
import { createFirstAdmin } from '../../src/auth/bootstrap-admin';
import { setupApp } from '../../src/setup-app';
import { testSecrets } from '../config.fixture';
import { digest } from '../../src/auth/crypto';

const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw new Error('TEST_DATABASE_URL wajib menunjuk database uji kosong.');

test('self_service_password_change_checks_credentials_and_revokes_sessions_for_both_roles', async (t) => {
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
  const base = await app.getUrl();
  const prisma = app.get(PrismaService);
  const auth = app.get(AuthService);
  const suffix = randomUUID();
  const original = 'before12';
  const replacement = 'after123';
  const identities = [
    `admin-${suffix}@example.test`,
    `customer-${suffix}@example.test`,
  ];
  async function call(
    path: string,
    body?: unknown,
    session?: { cookie: string; csrfToken: string },
    csrf = true,
  ) {
    return fetch(base + '/api' + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body
          ? {
              'Content-Type': 'application/json',
              Origin: 'http://localhost:5173',
            }
          : {}),
        ...(session
          ? {
              Cookie: session.cookie,
              ...(csrf ? { 'X-CSRF-Token': session.csrfToken } : {}),
            }
          : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  async function login(identity: string, password = original) {
    const response = await call('/auth/login', { identity, password });
    assert.equal(response.status, 200, await response.clone().text());
    const data = (await response.json()) as {
      csrfToken: string;
      user: { id: string };
    };
    return {
      ...data,
      cookie: response.headers.get('set-cookie')!.split(';')[0],
    };
  }
  try {
    await createFirstAdmin(prisma, {
      name: 'Admin fixture',
      email: identities[0],
      password: original,
    });
    await auth.register({
      name: 'Customer fixture',
      email: identities[1],
      password: original,
    });
    assert.equal(
      (
        await call('/auth/password', {
          currentPassword: original,
          newPassword: replacement,
        })
      ).status,
      401,
    );
    for (const [index, identity] of identities.entries()) {
      await t.test(
        index === 0
          ? 'admin_changes_own_password'
          : 'customer_changes_own_password',
        async () => {
          const first = await login(identity);
          const second = await login(identity);
          const before = await prisma.user.findUniqueOrThrow({
            where: { id: first.user.id },
          });
          const other = await prisma.user.findUniqueOrThrow({
            where: { email: identities[1 - index] },
          });
          if (index === 0)
            await prisma.pushSubscription.create({
              data: {
                userId: first.user.id,
                endpoint: `https://fcm.googleapis.com/fcm/send/${suffix}`,
                p256dh: 'fixture',
                auth: 'fixture',
              },
            });
          const payload = {
            currentPassword: original,
            newPassword: replacement,
          };
          assert.equal(
            (await call('/auth/password', payload, first, false)).status,
            403,
          );
          assert.equal(
            (
              await call(
                '/auth/password',
                { ...payload, newPassword: 'short12' },
                first,
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await call(
                '/auth/password',
                { ...payload, userId: other.id },
                first,
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await call(
                '/auth/password',
                { ...payload, newPassword: original },
                first,
              )
            ).status,
            400,
          );
          const wrong = await call(
            '/auth/password',
            { ...payload, currentPassword: 'incorrect' },
            first,
          );
          assert.equal(wrong.status, 400);
          assert.match(await wrong.text(), /Password lama tidak sesuai/);
          assert.equal(
            (await call('/auth/session', undefined, first)).status,
            200,
          );
          assert.equal(
            (await prisma.user.findUniqueOrThrow({ where: { id: before.id } }))
              .passwordHash,
            before.passwordHash,
          );
          const changed = await call('/auth/password', payload, first);
          assert.equal(changed.status, 204, await changed.clone().text());
          assert.match(
            changed.headers.get('set-cookie')!,
            /Expires=Thu, 01 Jan 1970/,
          );
          assert.equal(
            await prisma.authSession.count({ where: { userId: before.id } }),
            0,
          );
          assert.equal(
            await prisma.pushSubscription.count({
              where: { userId: before.id },
            }),
            0,
          );
          assert.equal(
            (await prisma.user.findUniqueOrThrow({ where: { id: before.id } }))
              .authVersion,
            before.authVersion + 1,
          );
          assert.equal(
            (await prisma.user.findUniqueOrThrow({ where: { id: other.id } }))
              .passwordHash,
            other.passwordHash,
          );
          for (const session of [first, second])
            assert.equal(
              (await call('/auth/session', undefined, session)).status,
              401,
            );
          assert.equal(
            (await call('/auth/login', { identity, password: original }))
              .status,
            401,
          );
          const current = await login(identity, replacement);
          const changes = await prisma.auditLog.findMany({
            where: { entityId: before.id, action: 'auth.password_changed' },
          });
          assert.equal(changes.length, 1);
          for (const secret of [original, replacement, before.passwordHash])
            assert.ok(!JSON.stringify(changes).includes(secret));
          // Both requests start from the same valid session; the user lock allows one change only.
          const race = await Promise.all([
            call(
              '/auth/password',
              { currentPassword: replacement, newPassword: 'again123' },
              current,
            ),
            call(
              '/auth/password',
              { currentPassword: replacement, newPassword: 'again456' },
              current,
            ),
          ]);
          assert.deepEqual(
            race.map((response) => response.status).sort(),
            [204, 401],
          );
          const winner = race[0].status === 204 ? 'again123' : 'again456';
          const latest = await login(identity, winner);
          assert.equal(
            (
              await call(
                '/auth/password',
                { currentPassword: winner, newPassword: 'another8' },
                latest,
              )
            ).status,
            429,
          );
        },
      );
    }
  } finally {
    const users = await prisma.user.findMany({
      where: { email: { in: identities } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.pushSubscription.deleteMany({
      where: { userId: { in: ids } },
    });
    await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.authRateLimit.deleteMany({
      where: {
        key: {
          in: [
            ...ids.map((id) => digest('password.change.user:' + id)),
            ...identities.map((email) =>
              digest('login.identity:' + JSON.stringify({ email })),
            ),
            digest('login.ip:127.0.0.1'),
          ],
        },
      },
    });
    await app.close();
  }
});
