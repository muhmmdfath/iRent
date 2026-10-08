import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { setupApp } from '../../src/setup-app';
import { testSecrets } from '../config.fixture';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL wajib diisi.');

test('serves_health_endpoints_through_the_configured_api', async (t) => {
  const previous = {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    CSRF_SECRET: process.env.CSRF_SECRET,
    NIK_KEYS: process.env.NIK_KEYS,
    NIK_ACTIVE_KEY: process.env.NIK_ACTIVE_KEY,
  };
  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  Object.assign(process.env, testSecrets());
  const { AppModule } = await import('../../src/app.module');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });
  try {
    setupApp(app);
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();
    await t.test(
      'reports_liveness_without_exposing_server_headers',
      async () => {
        const response = await fetch(baseUrl + '/api/health/live');
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('x-powered-by'), null);
        assert.deepEqual(await response.json(), {
          status: 'ok',
          service: 'irent-api',
        });
      },
    );
    await t.test(
      'reports_readiness_after_connecting_to_postgresql',
      async () => {
        const response = await fetch(baseUrl + '/api/health/ready', {
          headers: { Origin: 'http://localhost:5173' },
        });
        assert.equal(response.status, 200);
        assert.equal(
          response.headers.get('access-control-allow-origin'),
          'http://localhost:5173',
        );
        assert.deepEqual(await response.json(), {
          status: 'ok',
          database: 'connected',
        });
      },
    );
  } finally {
    await app.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
