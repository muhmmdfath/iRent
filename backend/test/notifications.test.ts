import { strict as assert } from 'node:assert';
import { createECDH, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { validatePush } from '../src/modules/notifications/push.rules';
import { validateEnvironment } from '../src/config/environment';
import { testSecrets } from './config.fixture';
import webPush from 'web-push';
import { ConfigService } from '@nestjs/config';
import {
  DeliveryError,
  NotificationTransport,
  WhatsAppAdapter,
} from '../src/modules/notifications/notification-transport';
test('push_keys_and_hosts_reject_invalid_crypto_private_networks_and_lookalike_domains', () => {
  const curve = createECDH('prime256v1');
  curve.generateKeys();
  const keys = {
    p256dh: curve.getPublicKey().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  };
  for (const host of [
    'fcm.googleapis.com',
    'updates.push.services.mozilla.com',
    'web.push.apple.com',
  ])
    assert.equal(
      validatePush('https://' + host + '/push', keys),
      'https://' + host + '/push',
    );
  for (const host of [
    'localhost',
    '127.0.0.1',
    '[::1]',
    'fcm.googleapis.com.evil.test',
    'notify.windows.com.evil.test',
  ])
    assert.throws(() => validatePush('https://' + host + '/push', keys));
  assert.throws(() =>
    validatePush('https://fcm.googleapis.com/push', {
      ...keys,
      p256dh: 'A'.repeat(87),
    }),
  );
  assert.throws(() =>
    validatePush('https://fcm.googleapis.com/push', {
      ...keys,
      auth: 'A'.repeat(21),
    }),
  );
});
test('vapid_configuration_requires_a_matching_key_pair_without_exposing_secrets', () => {
  const curve = createECDH('prime256v1');
  curve.generateKeys();
  const raw = {
    ...testSecrets(),
    DATABASE_URL: 'postgresql://fixture@localhost/test',
    NODE_ENV: 'test',
    VAPID_PUBLIC_KEY: curve.getPublicKey().toString('base64url'),
    VAPID_PRIVATE_KEY: Buffer.concat([
      Buffer.alloc(32 - curve.getPrivateKey().length),
      curve.getPrivateKey(),
    ]).toString('base64url'),
    VAPID_SUBJECT: 'mailto:admin@example.test',
  };
  assert.doesNotThrow(() => validateEnvironment(raw));
  for (const invalid of [
    { ...raw, VAPID_PRIVATE_KEY: '' },
    { ...raw, VAPID_SUBJECT: 'http://localhost' },
    { ...raw, VAPID_PUBLIC_KEY: 'A'.repeat(87) },
  ])
    assert.throws(() => validateEnvironment(invalid), /VAPID wajib lengkap/);
});
test('service_worker_shows_push_safely_and_click_opens_only_admin_routes_without_offline_cache', async () => {
  const source = await readFile(
    resolve('../frontend/public/admin/sw.js'),
    'utf8',
  );
  type WorkerEvent = {
    data?: { json: () => unknown };
    notification?: { data: { url: string }; close: () => void };
    waitUntil: (promise: Promise<unknown>) => void;
  };
  const handlers = new Map<string, (event: WorkerEvent) => void>(),
    shown: {
      title: string;
      options: { data: { url: string }; tag: string; renotify: boolean };
    }[] = [],
    opened: string[] = [];
  const worker = {
    location: { origin: 'https://irent.example' },
    addEventListener: (type: string, handler: (event: WorkerEvent) => void) =>
      handlers.set(type, handler),
    registration: {
      showNotification: async (
        title: string,
        options: { data: { url: string }; tag: string; renotify: boolean },
      ) => {
        shown.push({ title, options });
      },
    },
    clients: {
      matchAll: async () => [],
      openWindow: async (url: string) => {
        opened.push(url);
      },
    },
  };
  runInNewContext(source, { self: worker, URL });
  assert.equal(handlers.has('fetch'), false);
  for (const url of [
    'https://evil.test/admin/x',
    '/customer/private',
    '/admin/bookings/test',
  ]) {
    let wait: Promise<unknown> = Promise.resolve();
    handlers.get('push')!({
      data: {
        json: () => ({
          title: 'Periksa booking',
          body: 'IRN fixture',
          url,
          tag: 'dedupe',
        }),
      },
      waitUntil: (promise) => {
        wait = promise;
      },
    });
    await wait;
    assert.equal(
      shown.at(-1)?.options.data.url,
      url.startsWith('/admin/') ? url : '/admin/',
    );
    assert.equal(shown.at(-1)?.options.renotify, false);
  }
  let wait: Promise<unknown> = Promise.resolve();
  handlers.get('notificationclick')!({
    notification: { data: { url: 'https://evil.test/' }, close: () => {} },
    waitUntil: (promise) => {
      wait = promise;
    },
  });
  await wait;
  assert.deepEqual(opened, ['https://irent.example/admin/']);
});

test('web_push_adapter_bounds_network_requests_and_sanitizes_permanent_errors', async (t) => {
  const curve = createECDH('prime256v1');
  curve.generateKeys();
  const config = new ConfigService({
    VAPID_PUBLIC_KEY: curve.getPublicKey().toString('base64url'),
    VAPID_PRIVATE_KEY: Buffer.concat([
      Buffer.alloc(32 - curve.getPrivateKey().length),
      curve.getPrivateKey(),
    ]).toString('base64url'),
    VAPID_SUBJECT: 'mailto:admin@example.test',
  });
  const adapter = new NotificationTransport(config, new WhatsAppAdapter());
  const original = webPush.sendNotification;
  t.after(() => {
    webPush.sendNotification = original;
  });
  let timeout: number | undefined;
  webPush.sendNotification = async (subscription, payload, options) => {
    void subscription;
    void payload;
    timeout = options?.timeout;
    throw Object.assign(new Error('credential-must-not-be-persisted'), {
      statusCode: 410,
    });
  };
  await assert.rejects(
    adapter.push(
      {
        id: 'fixture',
        userId: 'fixture',
        endpoint: 'https://fcm.googleapis.com/fixture',
        p256dh: curve.getPublicKey().toString('base64url'),
        auth: randomBytes(16).toString('base64url'),
        userAgent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        title: 'iRent',
        body: 'Periksa booking',
        url: '/admin/',
        tag: 'fixture',
      },
    ),
    (cause) =>
      cause instanceof DeliveryError &&
      cause.code === 'push_http_410' &&
      cause.expired &&
      cause.permanent,
  );
  assert.equal(timeout, 15000);
  assert.equal(adapter.ready('whatsapp', 'fixture'), false);
});

test('admin_manifest_and_png_icons_match_the_scoped_pwa_requirements', async () => {
  const manifest = JSON.parse(
    await readFile(
      resolve('../frontend/public/admin/manifest.webmanifest'),
      'utf8',
    ),
  ) as {
    name: string;
    start_url: string;
    scope: string;
    icons: { src: string; sizes: string }[];
  };
  assert.equal(manifest.name, 'iRent Admin');
  assert.equal(manifest.start_url, '/admin/');
  assert.equal(manifest.scope, '/admin/');
  for (const size of [192, 512]) {
    const icon = await readFile(
      resolve('../frontend/public/admin/icon-' + size + '.png'),
    );
    assert.equal(icon.subarray(1, 4).toString(), 'PNG');
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
    assert.ok(
      manifest.icons.some(
        (row) =>
          row.src === '/admin/icon-' + size + '.png' &&
          row.sizes === size + 'x' + size,
      ),
    );
  }
});

test('foreground_sound_requires_activation_and_stops_on_acknowledgement_background_and_disposal', async () => {
  const source = (
    await readFile(resolve('../frontend/public/admin/alert-sound.js'), 'utf8')
  ).replace('export function', 'function');
  let tones = 0,
    interval: (() => void) | undefined,
    visibility: (() => void) | undefined;
  const document = {
    visibilityState: 'visible',
    addEventListener: (_type: string, listener: () => void) => {
      visibility = listener;
    },
    removeEventListener: () => {
      visibility = undefined;
    },
  };
  class Audio {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    async resume() {
      this.state = 'running';
    }
    async close() {
      this.state = 'closed';
    }
    createOscillator() {
      return {
        frequency: { value: 0 },
        connect() {},
        disconnect() {},
        start() {
          tones++;
        },
        stop() {},
        onended: undefined,
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
    }
  }
  const controller: {
    enable(): Promise<void>;
    update(tasks: { key: string }[]): void;
    acknowledge(key: string): void;
    dispose(): Promise<void>;
  } = runInNewContext(source + '\ncreateAdminAlertSound()', {
    document,
    window: { AudioContext: Audio },
    Set,
    setInterval: (fn: () => void) => {
      interval = fn;
      return 1;
    },
    clearInterval: () => {
      interval = undefined;
    },
  });
  controller.update([{ key: 'booking:proof1' }]);
  assert.equal(tones, 0);
  await controller.enable();
  assert.equal(tones, 1);
  controller.update([{ key: 'booking:proof1' }]);
  assert.equal(tones, 1);
  interval!();
  assert.equal(tones, 2);
  controller.acknowledge('booking:proof1');
  assert.equal(interval, undefined);
  controller.update([{ key: 'booking:proof2' }]);
  assert.equal(tones, 3);
  document.visibilityState = 'hidden';
  visibility!();
  assert.equal(interval, undefined);
  document.visibilityState = 'visible';
  visibility!();
  assert.equal(tones, 4);
  controller.update([]);
  assert.equal(interval, undefined);
  await controller.dispose();
  assert.equal(visibility, undefined);
});
