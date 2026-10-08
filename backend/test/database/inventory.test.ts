import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Prisma, User } from '../../src/generated/prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthService } from '../../src/auth/auth.service';
import { hashPassword } from '../../src/auth/crypto';
import { InventoryService } from '../../src/modules/inventory/inventory.service';
import { SettingsService } from '../../src/modules/settings/settings.service';
import {
  SettingsValues,
  settingsDefaults,
} from '../../src/modules/settings/settings.rules';
import { testSecrets } from '../config.fixture';
import { formatWibDateTime, wibNow } from '../../src/shared/time/wib';
import { setupApp } from '../../src/setup-app';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL wajib diisi.');
test('inventory_settings_and_quotes_preserve_stock_history_and_money', async (t) => {
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
    auth = app.get(AuthService),
    inventory = app.get(InventoryService),
    settings = app.get(SettingsService);
  const suffix = randomUUID(),
    itemIds: string[] = [],
    zoneIds: string[] = [],
    users: User[] = [];
  const originalSettings = await prisma.setting.findMany();
  const originalRevision = await prisma.businessCounter.findUnique({
    where: { key: 'settings.revision' },
  });
  const passwordHash = await hashPassword('Fixture password 123!');
  for (const role of ['admin', 'admin', 'customer'] as const)
    users.push(
      await prisma.user.create({
        data: {
          name: 'Fixture',
          email: randomUUID() + '@inventory.test',
          passwordHash,
          role,
        },
      }),
    );
  const sessions = await Promise.all(
    users.map((user) => auth.login(user.email!, 'Fixture password 123!')),
  );
  const contexts = await Promise.all(
    sessions.map((session) => auth.authenticate(session.token)),
  );
  const now = wibNow(),
    start = formatWibDateTime(
      new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 2,
          10,
        ),
      ),
    );
  let iphoneId = '',
    accessoryId = '',
    iphoneUnitId = '',
    freeUnitId = '',
    zoneId = '',
    bookingId = '',
    bookingItemId = '';
  async function call(
    path: string,
    method = 'GET',
    body?: unknown,
    actor?: number,
  ) {
    const headers: Record<string, string> = {};
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      headers.Origin = 'http://localhost:5173';
    }
    if (actor !== undefined) {
      headers.Cookie = 'irent_session=' + sessions[actor].token;
      headers['X-CSRF-Token'] = sessions[actor].csrfToken;
    }
    return fetch(base + '/api' + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async function item(
    category: 'iphone' | 'accessory',
    name: string,
    prices = ['50000', '80000', '120000'],
  ) {
    const response = await call(
      '/admin/items',
      'POST',
      {
        category,
        name: name + ' ' + suffix,
        includes: ['Kabel'],
        price6h: prices[0],
        price12h: prices[1],
        price24h: prices[2],
      },
      0,
    );
    assert.equal(response.status, 201, await response.clone().text());
    const value = (await response.json()) as { id: string };
    itemIds.push(value.id);
    return value.id;
  }
  async function quote(
    items: { itemId: string; quantity: number }[],
    durationHours = 6,
    deliveryType = 'pickup',
    deliveryZoneId?: string,
  ) {
    return call(
      '/pricing/quote',
      'POST',
      {
        startAt: start,
        durationHours,
        items,
        deliveryType,
        deliveryZoneId,
        payOption: 'dp',
      },
      2,
    );
  }
  try {
    // Restore these changes after the test. Defaults isolate expectations from a previous run.
    await settings.update(contexts[0], settingsDefaults);
    await t.test(
      'admin_crud_is_guarded_and_public_catalog_does_not_claim_calendar_availability',
      async () => {
        assert.equal(
          (await call('/admin/settings', 'GET', undefined, 2)).status,
          403,
        );
        assert.equal(
          (
            await call(
              '/admin/items',
              'POST',
              {
                category: 'accessory',
                name: 'Denied',
                includes: [],
                price6h: '1000',
                price12h: '1000',
                price24h: '1000',
              },
              2,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call(
              '/admin/items',
              'POST',
              {
                category: 'iphone',
                name: 'Invalid',
                includes: [],
                price6h: '1.5',
                price12h: '1000',
                price24h: '1000',
              },
              0,
            )
          ).status,
          400,
        );
        iphoneId = await item('iphone', 'iPhone');
        accessoryId = await item('accessory', 'Powerbank', [
          '5000',
          '9000',
          '15000',
        ]);
        const response = await call('/items/' + accessoryId);
        assert.equal(response.status, 200);
        const data = (await response.json()) as {
          price6h: string;
          availabilityChecked: boolean;
        };
        assert.equal(data.price6h, '5000');
        assert.equal(data.availabilityChecked, false);
      },
    );
    await t.test(
      'concurrent_accessory_codes_are_unique_across_items_and_admins',
      async () => {
        const other = await item('accessory', 'Tripod', [
          '5000',
          '9000',
          '15000',
        ]);
        const batches = await Promise.all([
          inventory.addUnits(contexts[0], accessoryId, { quantity: 3 }),
          inventory.addUnits(contexts[1], other, { quantity: 2 }),
        ]);
        const codes = batches.flat().map((unit) => unit.code);
        const counterBefore = await prisma.businessCounter.findUniqueOrThrow({
          where: { key: 'accessory.code' },
        });
        await assert.rejects(
          inventory.addUnits(contexts[0], accessoryId, { quantity: 0 }),
          /Quantity/,
        );
        assert.equal(
          (
            await prisma.businessCounter.findUniqueOrThrow({
              where: { key: 'accessory.code' },
            })
          ).value,
          counterBefore.value,
        );
        assert.equal(
          (
            await call(
              '/admin/items/' + iphoneId + '/units',
              'POST',
              { codes: ['ACC000001'] },
              0,
            )
          ).status,
          400,
        );
        assert.equal(new Set(codes).size, 5);
        for (const code of codes) assert.match(code, /^ACC[0-9]{6,}$/);
        freeUnitId = batches[0][0].id;
        const response = await call(
          '/admin/items/' + iphoneId + '/units',
          'POST',
          { codes: ['ip-' + suffix.slice(0, 8)] },
          0,
        );
        assert.equal(response.status, 201);
        iphoneUnitId = ((await response.json()) as { id: string }[])[0].id;
        assert.equal(
          (
            await call(
              '/admin/items/' + iphoneId + '/units',
              'POST',
              { codes: ['duplicate', 'DUPLICATE'] },
              0,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await call(
              '/admin/items/' + accessoryId + '/units',
              'POST',
              { codes: ['CUSTOM'] },
              0,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await call(
              '/admin/units/' + freeUnitId + '/active',
              'PATCH',
              { isActive: false, physicalStatus: 'ready' },
              0,
            )
          ).status,
          400,
        );
      },
    );
    await t.test(
      'quote_counts_units_one_roundtrip_delivery_fee_and_flat_dp',
      async () => {
        const response = await call(
          '/admin/delivery-zones',
          'POST',
          { name: 'Zona ' + suffix, fee: '15000' },
          0,
        );
        assert.equal(response.status, 201);
        zoneId = ((await response.json()) as { id: string }).id;
        zoneIds.push(zoneId);
        const result = await quote(
          [
            { itemId: iphoneId, quantity: 1 },
            { itemId: accessoryId, quantity: 2 },
          ],
          6,
          'delivery',
          zoneId,
        );
        assert.equal(result.status, 201, await result.clone().text());
        const data = (await result.json()) as {
          rentalTotal: string;
          deliveryFee: string;
          grandTotal: string;
          amountDueNow: string;
          availabilityChecked: boolean;
        };
        assert.deepEqual(
          [
            data.rentalTotal,
            data.deliveryFee,
            data.grandTotal,
            data.amountDueNow,
          ],
          ['60000', '15000', '75000', '20000'],
        );
        assert.equal(data.availabilityChecked, false);
        const small = await quote([{ itemId: accessoryId, quantity: 2 }]);
        const payment = (await small.json()) as {
          payOption: string;
          amountDueNow: string;
        };
        assert.equal(payment.payOption, 'full');
        assert.equal(payment.amountDueNow, '10000');
        assert.equal(
          (await quote([{ itemId: iphoneId, quantity: 2 }])).status,
          400,
        );
        assert.equal(
          (
            await quote([
              { itemId: accessoryId, quantity: 1 },
              { itemId: accessoryId, quantity: 1 },
            ])
          ).status,
          400,
        );
        assert.equal(
          (
            await call(
              '/admin/delivery-zones/' + zoneId,
              'PUT',
              { name: 'Zona ' + suffix, fee: '15000', isActive: false },
              0,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await quote(
              [{ itemId: accessoryId, quantity: 1 }],
              6,
              'delivery',
              zoneId,
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await call(
              '/admin/delivery-zones/' + zoneId,
              'PUT',
              { name: 'Zona ' + suffix, fee: '15000', isActive: true },
              0,
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      'settings_invalidate_caches_across_instances_and_reject_invalid_updates_atomically',
      async () => {
        const another = new SettingsService(prisma, auth);
        const old = await another.read();
        const response = await call(
          '/admin/settings',
          'PATCH',
          { values: { dp_amount: '30000' } },
          0,
        );
        assert.equal(response.status, 200);
        assert.equal((await another.read()).values.dp_amount, '30000');
        assert.equal(old.values.dp_amount, '20000');
        const current = await settings.read();
        assert.equal(
          (
            await call(
              '/admin/settings',
              'PATCH',
              { values: { close_time: '07:00' } },
              0,
            )
          ).status,
          400,
        );
        assert.deepEqual(await settings.read(), current);
        assert.equal(
          (
            await call(
              '/admin/settings',
              'PATCH',
              { values: { unknown_rule: 1 } },
              0,
            )
          ).status,
          400,
        );
        const quoted = await quote([{ itemId: iphoneId, quantity: 1 }]);
        assert.equal(
          ((await quoted.json()) as { amountDueNow: string }).amountDueNow,
          '30000',
        );
      },
    );
    await t.test(
      'catalog_updates_keep_booking_tariffs_and_unit_allocation_history_unchanged',
      async () => {
        const response = await quote([{ itemId: iphoneId, quantity: 1 }]);
        const priced = (await response.json()) as {
          startAt: string;
          endAt: string;
          grandTotal: string;
          dpSnapshot: string;
          amountDueNow: string;
          snapshot: {
            rules: {
              schemaVersion: 1;
              revision: string;
              values: SettingsValues;
            };
          };
        };
        const startAt = new Date(priced.startAt.replace('+07:00', 'Z')),
          endAt = new Date(priced.endAt.replace('+07:00', 'Z'));
        const booking = await prisma.booking.create({
          data: {
            code: 'TEST-' + suffix,
            userId: users[2].id,
            initialStartAt: startAt,
            initialEndAt: endAt,
            deliveryType: 'pickup',
            deliveryFeeSnapshot: 0n,
            initialRentalTotal: BigInt(priced.grandTotal),
            initialGrandTotal: BigInt(priced.grandTotal),
            dpSnapshot: BigInt(priced.dpSnapshot),
            payOption: 'dp',
            amountDueNow: BigInt(priced.amountDueNow),
            expiresAt: new Date(now.getTime() + 7200000),
            noShowDueAt: new Date(startAt.getTime() + 10800000),
            termsVersion: 'test',
            agreedTermsAt: now,
            rulesSnapshot: priced.snapshot.rules,
          },
        });
        bookingId = booking.id;
        const bookingItem = await prisma.bookingItem.create({
          data: {
            bookingId,
            itemId: iphoneId,
            itemUnitId: iphoneUnitId,
            itemNameSnapshot: 'Original iPhone',
            unitCodeSnapshot: 'Original unit',
            initialStartAt: startAt,
            startAt,
            initialEndAt: endAt,
            currentEndAt: endAt,
            unitPriceSnapshot: 50000n,
            tariff6hSnapshot: 50000n,
            tariff12hSnapshot: 80000n,
            tariff24hSnapshot: 120000n,
          },
        });
        bookingItemId = bookingItem.id;
        await prisma.unitAllocation.create({
          data: {
            bookingItemId,
            itemUnitId: iphoneUnitId,
            allocationKind: 'rental',
            state: 'active',
            startAt,
            endAt,
            blockStartAt: startAt,
            blockEndAt: new Date(endAt.getTime() + 3600000),
          },
        });
        assert.equal(
          (
            await call(
              '/admin/units/' + iphoneUnitId + '/active',
              'PATCH',
              { isActive: false },
              0,
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await call(
              '/admin/units/' + iphoneUnitId + '/maintenance',
              'POST',
              { reason: 'Blocked by booking' },
              0,
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await call(
              '/admin/items/' + iphoneId,
              'PATCH',
              { name: 'Updated iPhone', price6h: '60000', price24h: '160000' },
              0,
            )
          ).status,
          200,
        );
        const stored = await prisma.bookingItem.findUniqueOrThrow({
          where: { id: bookingItemId },
        });
        assert.equal(stored.unitPriceSnapshot, 50000n);
        assert.equal(stored.tariff24hSnapshot, 120000n);
        assert.equal(stored.itemNameSnapshot, 'Original iPhone');
        assert.equal(
          (await settings.read()).values.dp_amount,
          priced.snapshot.rules.values.dp_amount,
        );
        const next = await quote([{ itemId: iphoneId, quantity: 1 }]);
        assert.equal(
          ((await next.json()) as { grandTotal: string }).grandTotal,
          '60000',
        );
      },
    );
    await t.test(
      'maintenance_requires_free_stock_and_preparation_cannot_be_bypassed',
      async () => {
        assert.equal(
          (
            await call(
              '/admin/units/' + freeUnitId + '/maintenance',
              'POST',
              { reason: 'Pemeriksaan baterai' },
              0,
            )
          ).status,
          201,
        );
        assert.equal(
          (
            await call(
              '/admin/units/' + freeUnitId + '/active',
              'PATCH',
              { isActive: false },
              0,
            )
          ).status,
          409,
        );
        const completed = await call(
          '/admin/units/' + freeUnitId + '/maintenance/complete',
          'POST',
          {},
          0,
        );
        assert.equal(completed.status, 201);
        const prepared = (await completed.json()) as {
          physicalStatus: string;
          preparationUntil: string;
          maintenanceCompletedAt: string;
        };
        assert.equal(prepared.physicalStatus, 'preparing');
        assert.equal(
          new Date(prepared.preparationUntil).getTime() -
            new Date(prepared.maintenanceCompletedAt).getTime(),
          3600000,
        );
        assert.equal(
          (
            await call(
              '/admin/units/' + freeUnitId + '/preparation/complete',
              'POST',
              {},
              0,
            )
          ).status,
          409,
        );
        await prisma.itemUnit.update({
          where: { id: freeUnitId },
          data: { preparationUntil: new Date(wibNow().getTime() - 1000) },
        });
        assert.equal(
          (
            await call(
              '/admin/units/' + freeUnitId + '/preparation/complete',
              'POST',
              {},
              0,
            )
          ).status,
          201,
        );
        assert.equal(
          (
            await prisma.itemUnit.findUniqueOrThrow({
              where: { id: freeUnitId },
            })
          ).physicalStatus,
          'ready',
        );
        assert.equal(
          (
            await call(
              '/admin/units/' + freeUnitId + '/active',
              'PATCH',
              { isActive: false },
              0,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await call(
              '/admin/units/' + freeUnitId + '/active',
              'PATCH',
              { isActive: true },
              0,
            )
          ).status,
          200,
        );
      },
    );
  } finally {
    await prisma.$transaction(async (tx) => {
      if (bookingId) {
        await tx.unitAllocation.deleteMany({
          where: { bookingItem: { bookingId } },
        });
        await tx.bookingItem.deleteMany({ where: { bookingId } });
        await tx.booking.delete({ where: { id: bookingId } });
      }
      await tx.itemUnit.deleteMany({ where: { itemId: { in: itemIds } } });
      await tx.item.deleteMany({ where: { id: { in: itemIds } } });
      await tx.deliveryZone.deleteMany({ where: { id: { in: zoneIds } } });
      await tx.setting.deleteMany();
      for (const row of originalSettings)
        await tx.setting.create({
          data: {
            ...row,
            typedValue:
              row.typedValue === null ? Prisma.JsonNull : row.typedValue,
          },
        });
      if (originalRevision)
        await tx.businessCounter.update({
          where: { key: 'settings.revision' },
          data: { value: originalRevision.value },
        });
      else
        await tx.businessCounter.deleteMany({
          where: { key: 'settings.revision' },
        });
      const ids = users.map((user) => user.id);
      await tx.auditLog.deleteMany({ where: { actorId: { in: ids } } });
      await tx.authSession.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    });
    await app.close();
  }
});
