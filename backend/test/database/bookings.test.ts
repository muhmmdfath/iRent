import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AuthService } from '../../src/auth/auth.service';
import { hashPassword } from '../../src/auth/crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { BookingsService } from '../../src/modules/bookings/bookings.service';
import {
  CreateBookingDto,
  TERMS_VERSION,
} from '../../src/modules/bookings/bookings.dto';
import { BusinessClock } from '../../src/shared/time/business-clock';
import { formatWibDateTime, wibNow } from '../../src/shared/time/wib';
import { setupApp } from '../../src/setup-app';
import { testSecrets } from '../config.fixture';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL wajib diisi.');

test('booking_allocation_is_atomic_fair_and_idempotent_in_postgresql', async (t) => {
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
  t.after(() => app.close());
  const prisma = app.get(PrismaService),
    auth = app.get(AuthService),
    bookings = app.get(BookingsService),
    clock = app.get(BusinessClock),
    base = await app.getUrl();
  const actual = wibNow();
  const initialNow = new Date(
    Date.UTC(
      actual.getUTCFullYear(),
      actual.getUTCMonth(),
      actual.getUTCDate(),
      6,
    ),
  );
  let now = initialNow;
  clock.now = () => new Date(now);
  const password = 'Fixture password 123!',
    passwordHash = await hashPassword(password);
  const users = await Promise.all(
    ['customer', 'customer', 'customer', 'admin'].map((role) =>
      prisma.user.create({
        data: {
          name: 'Booking fixture',
          email: randomUUID() + '@booking.test',
          role: role === 'admin' ? 'admin' : 'customer',
          passwordHash,
        },
      }),
    ),
  );
  for (const user of users.slice(0, 3))
    await prisma.customerProfile.create({
      data: {
        userId: user.id,
        fullName: 'Fixture',
        address: 'Semarang',
        phoneActive: '+6281234567890',
        nikCiphertext: 'encrypted-fixture',
        completedAt: actual,
      },
    });
  const sessions = await Promise.all(
    users.map((user) => auth.login(user.email!, password)),
  );
  const contexts = await Promise.all(
    sessions.map((session) => auth.authenticate(session.token)),
  );
  const itemIds: string[] = [],
    zoneIds: string[] = [];
  function at(hour: number, minute = 0, day = 0) {
    return formatWibDateTime(
      new Date(
        Date.UTC(
          initialNow.getUTCFullYear(),
          initialNow.getUTCMonth(),
          initialNow.getUTCDate() + day,
          hour,
          minute,
        ),
      ),
    );
  }
  async function item(
    category: 'iphone' | 'accessory' = 'accessory',
    quantity = 1,
  ) {
    const value = await prisma.item.create({
      data: {
        category,
        name: 'Fixture ' + randomUUID(),
        includes: [],
        price6h: 50000n,
        price12h: 80000n,
        price24h: 120000n,
        units: {
          create: Array.from({ length: quantity }, () => ({
            code: 'TEST-' + randomUUID(),
          })),
        },
      },
      include: { units: true },
    });
    itemIds.push(value.id);
    return value;
  }
  function input(
    itemId: string,
    extra: Partial<CreateBookingDto> = {},
  ): CreateBookingDto {
    return {
      startAt: at(10),
      durationHours: 6,
      items: [{ itemId, quantity: 1 }],
      deliveryType: 'pickup',
      payOption: 'dp',
      termsVersion: TERMS_VERSION,
      agreeTerms: true,
      prepareIdentity: true,
      understandPayment: true,
      agreeOperatingHours: true,
      ...extra,
    };
  }
  async function call(
    path: string,
    method: string,
    body: unknown,
    actor = 0,
    key?: string,
  ) {
    return fetch(base + '/api' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        Cookie: 'irent_session=' + sessions[actor].token,
        'X-CSRF-Token': sessions[actor].csrfToken,
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      body: method === 'GET' ? undefined : JSON.stringify(body),
    });
  }
  try {
    await t.test(
      'two_customers_competing_for_last_unit_have_one_winner',
      async () => {
        const value = await item();
        const results = await Promise.allSettled([
          bookings.create(contexts[0], input(value.id), randomUUID()),
          bookings.create(contexts[1], input(value.id), randomUUID()),
        ]);
        assert.equal(
          results.filter((result) => result.status === 'fulfilled').length,
          1,
        );
        const loser = results.find((result) => result.status === 'rejected');
        assert.ok(loser && loser.status === 'rejected');
        assert.equal((loser.reason as { status: number }).status, 409);
        assert.equal(
          await prisma.unitAllocation.count({
            where: { itemUnitId: value.units[0].id, state: 'active' },
          }),
          1,
        );
      },
    );
    await t.test(
      'concurrent_identical_keys_return_one_booking_and_one_ledger',
      async () => {
        const value = await item(),
          key = randomUUID(),
          payload = input(value.id);
        const [one, two] = await Promise.all([
          bookings.create(contexts[0], payload, key),
          bookings.create(contexts[0], payload, key),
        ]);
        assert.equal(one.id, two.id);
        assert.equal(one.status, 'menunggu_pembayaran');
        assert.equal(one.amountDueNow, 20000n);
        assert.equal(
          await prisma.bookingCharge.count({ where: { bookingId: one.id } }),
          1,
        );
        assert.equal(
          await prisma.outboxEvent.count({ where: { aggregateId: one.id } }),
          1,
        );
        assert.equal(one.obligations[0].status, 'open');
        assert.equal(
          one.expiresAt.getTime() - one.createdAt.getTime(),
          120 * 60000,
        );
        await assert.rejects(
          bookings.create(contexts[0], { ...payload, payOption: 'full' }, key),
          { status: 409 },
        );
        now = new Date(initialNow.getTime() + 24 * 3600000);
        assert.equal(
          (await bookings.create(contexts[0], payload, key)).id,
          one.id,
        );
        now = initialNow;
      },
    );
    await t.test(
      'batch_shortage_rolls_back_allocations_charges_and_counter',
      async () => {
        const free = await item(),
          absent = await item('accessory', 0),
          key = randomUUID();
        const before = await prisma.businessCounter.findUnique({
          where: { key: 'booking.code.' + now.toISOString().slice(0, 10) },
        });
        await assert.rejects(
          bookings.create(
            contexts[0],
            input(free.id, {
              items: [
                { itemId: free.id, quantity: 1 },
                { itemId: absent.id, quantity: 1 },
              ],
            }),
            key,
          ),
          { status: 409 },
        );
        assert.equal(
          await prisma.unitAllocation.count({
            where: { itemUnitId: free.units[0].id },
          }),
          0,
        );
        assert.equal(
          await prisma.idempotencyRequest.count({
            where: { actorId: users[0].id, key },
          }),
          0,
        );
        assert.equal(
          (
            await prisma.businessCounter.findUnique({
              where: { key: 'booking.code.' + now.toISOString().slice(0, 10) },
            })
          )?.value,
          before?.value,
        );
      },
    );
    await t.test(
      'idempotency_normalizes_item_order_field_order_and_uuid_case',
      async () => {
        const one = await item(),
          two = await item(),
          key = randomUUID();
        const first = await bookings.create(
          contexts[0],
          input(one.id, {
            items: [
              { itemId: one.id.toUpperCase(), quantity: 1 },
              { itemId: two.id, quantity: 1 },
            ],
          }),
          key,
        );
        const retry = await bookings.create(
          contexts[0],
          input(one.id, {
            items: [
              { quantity: 1, itemId: two.id.toUpperCase() },
              { quantity: 1, itemId: one.id },
            ],
          }),
          key,
        );
        assert.equal(first.id, retry.id);
        await assert.rejects(
          bookings.create(
            contexts[1],
            input(one.id, {
              items: [
                { itemId: one.id, quantity: 1 },
                { itemId: one.id.toUpperCase(), quantity: 1 },
              ],
            }),
            randomUUID(),
          ),
          { status: 400 },
        );
      },
    );
    await t.test(
      'same_customer_cannot_win_overlapping_iphones_on_different_items',
      async () => {
        const one = await item('iphone'),
          two = await item('iphone');
        const results = await Promise.allSettled([
          bookings.create(contexts[2], input(one.id), randomUUID()),
          bookings.create(contexts[2], input(two.id), randomUUID()),
        ]);
        assert.equal(
          results.filter((result) => result.status === 'fulfilled').length,
          1,
        );
      },
    );
    await t.test(
      'exact_one_hour_gap_is_allowed_and_shorter_gap_is_rejected',
      async () => {
        const value = await item();
        await bookings.create(
          contexts[0],
          input(value.id, { startAt: at(8) }),
          randomUUID(),
        );
        await assert.rejects(
          bookings.create(
            contexts[1],
            input(value.id, { startAt: at(14, 59) }),
            randomUUID(),
          ),
          { status: 409 },
        );
        const next = await bookings.create(
          contexts[1],
          input(value.id, { startAt: at(15) }),
          randomUUID(),
        );
        assert.equal(next.initialStartAt.getUTCHours(), 15);
      },
    );
    await t.test(
      'deadline_is_inclusive_and_expired_hold_does_not_wait_for_worker',
      async () => {
        const value = await item();
        const prior = await bookings.create(
          contexts[0],
          input(value.id, { startAt: at(11) }),
          randomUUID(),
        );
        now = prior.expiresAt;
        const query = input(value.id, { startAt: at(11) });
        assert.equal(
          (await bookings.availability(contexts[1], query)).available,
          false,
        );
        now = new Date(prior.expiresAt.getTime() + 1);
        assert.equal(
          (await bookings.availability(contexts[1], query)).available,
          true,
        );
        const next = await bookings.create(contexts[1], query, randomUUID());
        assert.notEqual(next.id, prior.id);
        assert.equal(
          (await prisma.booking.findUniqueOrThrow({ where: { id: prior.id } }))
            .status,
          'menunggu_pembayaran',
        );
        now = initialNow;
      },
    );
    await t.test(
      'pending_admin_verification_keeps_stock_after_payment_deadline',
      async () => {
        const value = await item(),
          prior = await bookings.create(
            contexts[0],
            input(value.id, { startAt: at(11) }),
            randomUUID(),
          );
        await prisma.booking.update({
          where: { id: prior.id },
          data: {
            status: 'menunggu_konfirmasi',
            uploadedAt: initialNow,
            confirmationDueAt: prior.expiresAt,
          },
        });
        now = new Date(prior.expiresAt.getTime() + 1);
        await assert.rejects(
          bookings.create(
            contexts[1],
            input(value.id, { startAt: at(11) }),
            randomUUID(),
          ),
          { status: 409 },
        );
        now = initialNow;
      },
    );
    await t.test(
      'urgent_two_and_three_hour_boundaries_have_thirty_minute_holds',
      async () => {
        for (const hour of [8, 9]) {
          const value = await item();
          const booking = await bookings.create(
            contexts[0],
            input(value.id, { startAt: at(hour) }),
            randomUUID(),
          );
          assert.equal(
            booking.expiresAt.getTime() - booking.createdAt.getTime(),
            30 * 60000,
          );
        }
        const value = await item();
        await assert.rejects(
          bookings.create(
            contexts[0],
            input(value.id, { startAt: at(7, 59) }),
            randomUUID(),
          ),
          { status: 400 },
        );
      },
    );
    await t.test(
      'future_booking_of_nonlate_unit_is_allowed_but_overdue_return_is_blocked',
      async () => {
        const value = await item('iphone'),
          prior = await bookings.create(
            contexts[0],
            input(value.id, { startAt: at(8) }),
            randomUUID(),
          );
        await prisma.booking.update({
          where: { id: prior.id },
          data: {
            status: 'berjalan',
            confirmedAt: now,
            confirmedBy: users[3].id,
          },
        });
        await prisma.bookingItem.update({
          where: { id: prior.items[0].id },
          data: {
            useStatus: 'in_use',
            pickedUpAt: now,
            pickedUpBy: users[3].id,
          },
        });
        await prisma.itemUnit.update({
          where: { id: value.units[0].id },
          data: { physicalStatus: 'in_use' },
        });
        assert.equal(
          (
            await bookings.availability(
              contexts[1],
              input(value.id, { startAt: at(15) }),
            )
          ).available,
          true,
        );
        await prisma.bookingItem.update({
          where: { id: prior.items[0].id },
          data: { useStatus: 'return_pending' },
        });
        await prisma.itemUnit.update({
          where: { id: value.units[0].id },
          data: { physicalStatus: 'awaiting_check' },
        });
        now = new Date(prior.initialEndAt.getTime() + 1);
        assert.equal(
          (
            await bookings.availability(
              contexts[1],
              input(value.id, { startAt: at(10, 0, 1) }),
            )
          ).available,
          false,
        );
        const different = await item('iphone');
        await assert.rejects(
          bookings.create(
            contexts[0],
            input(different.id, { startAt: at(10, 0, 1) }),
            randomUUID(),
          ),
          { status: 409 },
        );
        now = initialNow;
      },
    );
    await t.test(
      'preparation_blocks_early_pickup_and_keeps_future_calendar_protected',
      async () => {
        const value = await item();
        const until = new Date(initialNow.getTime() + 5 * 3600000);
        await prisma.itemUnit.update({
          where: { id: value.units[0].id },
          data: { physicalStatus: 'preparing', preparationUntil: until },
        });
        assert.equal(
          (await bookings.availability(contexts[0], input(value.id))).available,
          false,
        );
        const booking = await bookings.create(
          contexts[0],
          input(value.id, { startAt: at(11) }),
          randomUUID(),
        );
        assert.equal(booking.initialStartAt.getTime(), until.getTime());
        assert.equal(
          (
            await prisma.itemUnit.findUniqueOrThrow({
              where: { id: value.units[0].id },
            })
          ).physicalStatus,
          'preparing',
        );
      },
    );
    await t.test('time_is_rechecked_after_waiting_for_item_lock', async () => {
      const value = await item();
      let release!: () => void, locked!: () => void;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      const acquired = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const blocker = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM items WHERE id=${value.id}::uuid FOR UPDATE`;
        locked();
        await released;
      });
      await acquired;
      const waiting = bookings.create(
        contexts[1],
        input(value.id, { startAt: at(8) }),
        randomUUID(),
      );
      // Moving the clock before release verifies validation after the locking read.
      now = new Date(initialNow.getTime() + 1);
      release();
      await blocker;
      await assert.rejects(waiting, { status: 400 });
      assert.equal(
        await prisma.unitAllocation.count({
          where: { itemUnitId: value.units[0].id },
        }),
        0,
      );
      now = initialNow;
    });
    await t.test(
      'lock_timeout_is_retried_without_partial_booking',
      async () => {
        const value = await item();
        let release!: () => void, locked!: () => void;
        const released = new Promise<void>((resolve) => {
          release = resolve;
        });
        const acquired = new Promise<void>((resolve) => {
          locked = resolve;
        });
        const blocker = prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM items WHERE id=${value.id}::uuid FOR UPDATE`;
            locked();
            await released;
          },
          { timeout: 15000 },
        );
        await acquired;
        const timer = setTimeout(release, 5500);
        try {
          const result = await bookings.create(
            contexts[1],
            input(value.id),
            randomUUID(),
          );
          assert.equal(
            await prisma.unitAllocation.count({
              where: { itemUnitId: value.units[0].id },
            }),
            1,
          );
          assert.equal(
            await prisma.outboxEvent.count({
              where: { aggregateId: result.id },
            }),
            1,
          );
        } finally {
          clearTimeout(timer);
          release();
          await blocker;
        }
      },
    );
    await t.test(
      'daily_counter_remains_unique_across_items_and_expands_past_999',
      async () => {
        now = new Date(initialNow.getTime() + 24 * 3600000);
        const key = 'booking.code.' + now.toISOString().slice(0, 10);
        const original = await prisma.businessCounter.findUnique({
          where: { key },
        });
        try {
          await prisma.businessCounter.upsert({
            where: { key },
            create: { key, value: 999n },
            update: { value: 999n },
          });
          const one = await item(),
            two = await item();
          const results = await Promise.all([
            bookings.create(
              contexts[0],
              input(one.id, { startAt: at(10, 0, 1) }),
              randomUUID(),
            ),
            bookings.create(
              contexts[1],
              input(two.id, { startAt: at(10, 0, 1) }),
              randomUUID(),
            ),
          ]);
          assert.deepEqual(
            results.map((booking) => booking.code.slice(-4)).sort(),
            ['1000', '1001'],
          );
          assert.notEqual(results[0].code, results[1].code);
          const history = await bookings.list(
            contexts[3],
            { page: 1, limit: 100 },
            true,
          );
          assert.deepEqual(
            history
              .filter((booking) =>
                results.some((result) => result.id === booking.id),
              )
              .map((booking) => booking.code.slice(-4)),
            ['1000', '1001'],
          );
        } finally {
          now = initialNow;
          if (original)
            await prisma.businessCounter.update({
              where: { key },
              data: { value: original.value },
            });
          else await prisma.businessCounter.delete({ where: { key } });
        }
      },
    );
    await t.test(
      'extension_hold_is_protected_independently_of_initial_rental_interval',
      async () => {
        const value = await item(),
          prior = await bookings.create(
            contexts[0],
            input(value.id, { startAt: at(8) }),
            randomUUID(),
          );
        const oldEndAt = prior.initialEndAt,
          proposedEndAt = new Date(oldEndAt.getTime() + 6 * 3600000);
        const extension = await prisma.extension.create({
          data: {
            bookingId: prior.id,
            status: 'menunggu_pembayaran',
            rentalQuoteTotal: 50000n,
            amountDue: 50000n,
            expiresAt: new Date(now.getTime() + 30 * 60000),
            submittedAt: now,
          },
        });
        const extensionItem = await prisma.extensionItem.create({
          data: {
            extensionId: extension.id,
            bookingId: prior.id,
            bookingItemId: prior.items[0].id,
            oldEndAt,
            proposedEndAt,
            expectedItemVersion: 0,
            addedHours: 6,
            unitPriceSnapshot: 50000n,
          },
        });
        await prisma.unitAllocation.create({
          data: {
            bookingItemId: prior.items[0].id,
            itemUnitId: value.units[0].id,
            extensionItemId: extensionItem.id,
            allocationKind: 'extension_hold',
            startAt: oldEndAt,
            endAt: proposedEndAt,
            blockStartAt: new Date(oldEndAt.getTime() - 3600000),
            blockEndAt: new Date(proposedEndAt.getTime() + 3600000),
            holdExpiresAt: extension.expiresAt,
          },
        });
        const payload = input(value.id, { startAt: at(15) });
        assert.equal(
          (await bookings.availability(contexts[1], payload)).available,
          false,
        );
        now = new Date(extension.expiresAt!.getTime() + 1);
        assert.equal(
          (await bookings.availability(contexts[1], payload)).available,
          true,
        );
        await prisma.extension.update({
          where: { id: extension.id },
          data: { status: 'menunggu_konfirmasi', uploadedAt: initialNow },
        });
        assert.equal(
          (await bookings.availability(contexts[1], payload)).available,
          false,
        );
        now = initialNow;
      },
    );
    await t.test(
      'http_validates_consent_key_roles_profile_and_owner_access',
      async () => {
        const value = await item(),
          payload = input(value.id),
          key = randomUUID();
        assert.equal((await call('/bookings', 'POST', payload)).status, 400);
        assert.equal(
          (
            await call(
              '/bookings',
              'POST',
              { ...payload, agreeTerms: false },
              0,
              key,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await call(
              '/bookings',
              'POST',
              { ...payload, status: 'dikonfirmasi' },
              0,
              key,
            )
          ).status,
          400,
        );
        assert.equal(
          (await call('/bookings', 'POST', payload, 3, key)).status,
          403,
        );
        const response = await call('/bookings', 'POST', payload, 0, key);
        assert.equal(response.status, 201, await response.clone().text());
        const result = (await response.json()) as {
          id: string;
          amountDueNow: string;
          expiresAt: string;
        };
        assert.equal(result.amountDueNow, '20000');
        assert.ok(result.expiresAt.endsWith('+07:00'));
        assert.equal(
          (await call('/bookings/' + result.id, 'GET', undefined, 1)).status,
          404,
        );
        const admin = await call('/bookings/' + result.id, 'GET', undefined, 3);
        assert.equal(admin.status, 200);
        assert.equal(admin.headers.get('Cache-Control'), 'no-store');
        assert.equal(
          (await call('/admin/bookings', 'GET', undefined, 0)).status,
          403,
        );
        assert.equal(
          (await call('/admin/bookings', 'GET', undefined, 3)).status,
          200,
        );
        const own = await call('/bookings', 'GET', undefined, 0);
        assert.equal(own.status, 200);
        assert.ok(
          ((await own.json()) as { userId: string }[]).every(
            (booking) => booking.userId === users[0].id,
          ),
        );
        const availability = {
          startAt: payload.startAt,
          durationHours: payload.durationHours,
          items: payload.items,
          deliveryType: payload.deliveryType,
          payOption: payload.payOption,
        };
        assert.equal(
          (await call('/bookings/availability', 'POST', availability, 1))
            .status,
          201,
        );
        await prisma.customerProfile.delete({ where: { userId: users[1].id } });
        const free = await item();
        await assert.rejects(
          bookings.create(contexts[1], input(free.id), randomUUID()),
          { status: 400 },
        );
      },
    );
    await t.test(
      'delivery_is_charged_once_and_each_accessory_gets_physical_allocation',
      async () => {
        const value = await item('accessory', 2),
          zone = await prisma.deliveryZone.create({
            data: { name: randomUUID(), fee: 15000n },
          });
        zoneIds.push(zone.id);
        const booking = await bookings.create(
          contexts[0],
          input(value.id, {
            items: [{ itemId: value.id, quantity: 2 }],
            deliveryType: 'delivery',
            deliveryZoneId: zone.id,
            deliveryAddress: 'Jalan Semarang 123',
            payOption: 'full',
          }),
          randomUUID(),
        );
        assert.equal(booking.items.length, 2);
        assert.equal(booking.initialGrandTotal, 115000n);
        assert.equal(booking.amountDueNow, 115000n);
        assert.equal(
          await prisma.bookingCharge.count({
            where: { bookingId: booking.id, kind: 'delivery' },
          }),
          1,
        );
        await prisma.item.update({
          where: { id: value.id },
          data: { price6h: 90000n },
        });
        assert.equal(
          (await bookings.detail(contexts[0], booking.id)).items[0]
            .unitPriceSnapshot,
          50000n,
        );
      },
    );
  } finally {
    const userIds = users.map((user) => user.id);
    const owned = await prisma.booking.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const ids = owned.map((booking) => booking.id);
    await prisma.$transaction(async (tx) => {
      await tx.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
      await tx.idempotencyRequest.deleteMany({
        where: { actorId: { in: userIds } },
      });
      await tx.bookingStatusLog.deleteMany({
        where: { bookingId: { in: ids } },
      });
      await tx.bookingCharge.deleteMany({ where: { bookingId: { in: ids } } });
      await tx.paymentObligation.deleteMany({
        where: { bookingId: { in: ids } },
      });
      await tx.unitAllocation.deleteMany({
        where: { bookingItem: { bookingId: { in: ids } } },
      });
      await tx.extensionItem.deleteMany({ where: { bookingId: { in: ids } } });
      await tx.extension.deleteMany({ where: { bookingId: { in: ids } } });
      await tx.bookingItem.deleteMany({ where: { bookingId: { in: ids } } });
      await tx.booking.deleteMany({ where: { id: { in: ids } } });
      await tx.itemUnit.deleteMany({ where: { itemId: { in: itemIds } } });
      await tx.item.deleteMany({ where: { id: { in: itemIds } } });
      await tx.deliveryZone.deleteMany({ where: { id: { in: zoneIds } } });
      await tx.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await tx.authSession.deleteMany({ where: { userId: { in: userIds } } });
      await tx.customerProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    });
  }
});
