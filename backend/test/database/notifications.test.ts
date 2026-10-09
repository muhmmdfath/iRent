import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID, createECDH, randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AuthContext, AuthService } from '../../src/auth/auth.service';
import { User } from '../../src/generated/prisma/client';
import { digest, hashPassword } from '../../src/auth/crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { BookingsService } from '../../src/modules/bookings/bookings.service';
import { TERMS_VERSION } from '../../src/modules/bookings/bookings.dto';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { PushService } from '../../src/modules/notifications/push.service';
import {
  NotificationTransport,
  DeliveryError,
} from '../../src/modules/notifications/notification-transport';
import { ExtensionsService } from '../../src/modules/extensions/extensions.service';
import { OperationsService } from '../../src/modules/operations/operations.service';

import { PaymentsService } from '../../src/modules/payments/payments.service';
import { BusinessClock } from '../../src/shared/time/business-clock';
import { formatWibDateTime, wibNow } from '../../src/shared/time/wib';
import { setupApp } from '../../src/setup-app';
import { testSecrets } from '../config.fixture';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL wajib diisi.');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
type TestBooking = Awaited<ReturnType<BookingsService['create']>>;

test('notification_queue_preserves_business_actions_and_controls_delivery', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'irent-notification-proofs-'));
  const cleanupTarget = resolve(directory);
  if (
    dirname(cleanupTarget) !== resolve(tmpdir()) ||
    !basename(cleanupTarget).startsWith('irent-notification-proofs-')
  )
    throw new Error('Unsafe test storage cleanup path.');
  Object.assign(process.env, testSecrets(), {
    DATABASE_URL: url,
    NODE_ENV: 'test',
    PROOF_STORAGE_DIR: directory,
    VAPID_PUBLIC_KEY: '',
    VAPID_PRIVATE_KEY: '',
    VAPID_SUBJECT: '',
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
    payments = app.get(PaymentsService),
    notifications = app.get(NotificationsService),
    push = app.get(PushService),
    transport = app.get(NotificationTransport),
    extensions = app.get(ExtensionsService),
    operations = app.get(OperationsService),
    clock = app.get(BusinessClock),
    base = await app.getUrl();
  const actual = wibNow(),
    initialNow = new Date(
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
  const users: User[] = [];
  for (const role of ['customer', 'customer', 'admin', 'admin'] as const)
    users.push(
      await prisma.user.create({
        data: {
          name: 'Payment fixture',
          email: randomUUID() + '@payments.test',
          role,
          passwordHash,
        },
      }),
    );
  for (const user of users.slice(0, 2))
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
  const sessions: Awaited<ReturnType<AuthService['login']>>[] = [];
  for (const user of users)
    sessions.push(await auth.login(user.email!, password));
  const contexts: AuthContext[] = [];
  for (const session of sessions)
    contexts.push(await auth.authenticate(session.token));
  const itemIds: string[] = [];
  const zone = await prisma.deliveryZone.create({
    data: { name: 'No-show fixture ' + randomUUID(), fee: 10000n },
  });
  t.beforeEach(async () => {
    now = initialNow;
    transport.ready = (channel) => channel === 'push';
    transport.push = async () => 'accepted';
    await prisma.notificationDelivery.updateMany({
      where: {
        recipientAdminId: { in: users.map((row) => row.id) },
        status: { in: ['queued', 'failed', 'sending'] },
      },
      data: {
        status: 'skipped',
        retryAt: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    const previous = await prisma.booking.findMany({
      where: { userId: { in: users.map((row) => row.id) } },
      select: { id: true },
    });
    await prisma.outboxEvent.updateMany({
      where: {
        aggregateId: { in: previous.map((row) => row.id) },
        dispatchedAt: null,
      },
      data: { dispatchedAt: now },
    });
  });
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
  async function make(
    payOption: 'dp' | 'full' = 'dp',
    startAt = at(10),
    amount = 50000n,
    actor = 0,
    delivery = false,
    quantity = 1,
  ) {
    const item = await prisma.item.create({
      data: {
        name: 'Payment fixture ' + randomUUID(),
        category: 'accessory',
        includes: [],
        price6h: amount,
        price12h: amount,
        price24h: amount,
        units: {
          create: Array.from({ length: quantity }, () => ({
            code: 'TEST-' + randomUUID(),
          })),
        },
      },
      include: { units: true },
    });
    itemIds.push(item.id);
    return bookings.create(
      contexts[actor],
      {
        startAt,
        durationHours: 6,
        items: [{ itemId: item.id, quantity }],
        deliveryType: delivery ? 'delivery' : 'pickup',
        ...(delivery
          ? {
              deliveryZoneId: zone.id,
              deliveryAddress: 'Alamat fixture Semarang',
            }
          : {}),
        payOption,
        termsVersion: TERMS_VERSION,
        agreeTerms: true,
        prepareIdentity: true,
        understandPayment: true,
        agreeOperatingHours: true,
      },
      randomUUID(),
    );
  }
  async function upload(
    booking: TestBooking,
    actor = 0,
    key = randomUUID(),
    obligationId = booking.obligations[0].id,
  ) {
    return payments.upload(
      contexts[actor],
      booking.id,
      obligationId,
      { claimedAmount: '20000' },
      { buffer: pdf, size: pdf.length, mimetype: 'application/pdf' },
      key,
    );
  }
  function receipt(
    proofId: string,
    amount = '20000',
    reference: string = randomUUID(),
  ) {
    return {
      proofId,
      amount,
      occurredAt: formatWibDateTime(now),
      method: 'transfer' as const,
      receivingAccountReference: 'merchant-bca',
      transactionReference: reference,
      note: 'Uang masuk sudah diperiksa pada mutasi rekening.',
    };
  }
  function headers(actor: number, key?: string, json = true) {
    return {
      Origin: 'http://localhost:5173',
      Cookie: 'irent_session=' + sessions[actor].token,
      'X-CSRF-Token': sessions[actor].csrfToken,
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    };
  }
  async function paid(
    amount = '20000',
    payOption: 'dp' | 'full' = 'dp',
    price = 50000n,
    delivery = false,
  ) {
    const booking = await make(payOption, at(10), price, 0, delivery);
    const proof = await upload(booking);
    await payments.verify(
      contexts[2],
      booking.id,
      receipt(proof.proofId!, amount),
      randomUUID(),
    );
    return booking;
  }

  function setTime(hour: number, minute = 0, seconds = 0) {
    now = new Date(initialNow);
    now.setUTCHours(hour, minute, seconds, 0);
  }
  function handoverInput(delivery = false, time = at(10)) {
    return {
      pickedUpAt: time,
      conditionNote: 'Kondisi lengkap dan layak sudah diperiksa.',
      ...(delivery
        ? { shopDelayReason: 'Petugas terlambat berangkat dari toko.' }
        : {}),
    };
  }
  function returnInput(
    time = at(16),
    condition: 'layak' | 'maintenance' = 'layak',
  ) {
    return {
      receivedAtStore: time,
      condition,
      conditionNote: 'Kondisi barang telah diperiksa admin.',
      damageAmount: '0',
    };
  }
  async function running(delivery = false) {
    const booking = await paid(
      delivery ? '60000' : '50000',
      'full',
      50000n,
      delivery,
    );
    setTime(10);
    await operations.handover(
      contexts[2],
      booking.id,
      handoverInput(),
      randomUUID(),
    );
    return booking;
  }
  try {
    const curve = createECDH('prime256v1');
    curve.generateKeys();
    const keys = {
      p256dh: curve.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    };
    const endpoint = 'https://fcm.googleapis.com/fcm/send/' + randomUUID();

    async function rows(booking: TestBooking, type?: string) {
      return prisma.notificationDelivery.findMany({
        orderBy: { dueAt: 'asc' },
        where: {
          context: { path: ['bookingId'], equals: booking.id },
          ...(type ? { eventType: type } : {}),
        },
      });
    }
    function callsFor(calls: { url: string }[], booking: TestBooking) {
      return calls.filter((row) => row.url.includes(booking.id));
    }
    await push.subscribe(contexts[2], { endpoint, keys });
    await t.test(
      'subscription_http_enforces_admin_csrf_keys_and_endpoint_ownership',
      async () => {
        const route = base + '/api/admin/notifications/subscriptions';
        assert.equal(
          (
            await fetch(route, {
              method: 'POST',
              headers: headers(0),
              body: JSON.stringify({ endpoint, keys }),
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await fetch(route, {
              method: 'POST',
              headers: { ...headers(2), 'X-CSRF-Token': 'bad' },
              body: JSON.stringify({ endpoint, keys }),
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await fetch(route, {
              method: 'POST',
              headers: headers(2),
              body: JSON.stringify({ endpoint }),
            })
          ).status,
          400,
        );
        await assert.rejects(
          push.subscribe(contexts[3], { endpoint, keys }),
          /akun lain/,
        );
        await push.unsubscribe(contexts[3], endpoint);
        assert.equal(
          await prisma.pushSubscription.count({ where: { endpoint } }),
          1,
        );
        for (const invalid of [
          'http://fcm.googleapis.com/x',
          'https://127.0.0.1/x',
          'https://fcm.googleapis.com.evil.test/x',
          'https://user:pass@fcm.googleapis.com/x',
        ])
          await assert.rejects(
            push.subscribe(contexts[2], { endpoint: invalid, keys }),
            /diizinkan/,
          );
        const response = await fetch(
          base + '/api/admin/notifications/configuration',
          { headers: headers(2) },
        );
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), {
          enabled: false,
          publicKey: '',
        });
      },
    );
    await t.test(
      'concurrent_outbox_dispatch_and_senders_create_one_delivery_per_device',
      async () => {
        const booking = await make(),
          calls: { url: string }[] = [];
        transport.push = async (_subscription, payload) => {
          calls.push(payload);
          return 'accepted';
        };
        await Promise.all([notifications.dispatch(), notifications.dispatch()]);
        assert.equal((await rows(booking, 'booking.created')).length, 1);
        await Promise.all([notifications.sendDue(), notifications.sendDue()]);
        assert.equal(callsFor(calls, booking).length, 1);
        assert.equal((await rows(booking))[0].status, 'sent');
        assert.equal(
          (await bookings.detail(contexts[0], booking.id)).status,
          'menunggu_pembayaran',
        );
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItem: { bookingId: booking.id }, state: 'active' },
          }),
          1,
        );
      },
    );
    await t.test(
      'missing_channel_configuration_leaves_queue_without_consuming_attempts',
      async () => {
        const booking = await make();
        await notifications.dispatch();
        transport.ready = () => false;
        await notifications.sendDue();
        const delivery = (await rows(booking))[0];
        assert.equal(delivery.status, 'queued');
        assert.equal(delivery.attempts, 0);
      },
    );
    await t.test(
      'transient_failures_retry_at_one_and_five_minutes_then_stop',
      async () => {
        const booking = await make();
        await notifications.dispatch();
        transport.push = async () => {
          throw new DeliveryError('push_http_503');
        };
        await notifications.sendDue();
        let delivery = (await rows(booking))[0];
        assert.equal(delivery.attempts, 1);
        assert.equal(delivery.retryAt?.getTime(), now.getTime() + 60000);
        await notifications.sendDue();
        assert.equal((await rows(booking))[0].attempts, 1);
        now = new Date(now.getTime() + 60000);
        await notifications.sendDue();
        delivery = (await rows(booking))[0];
        assert.equal(delivery.attempts, 2);
        assert.equal(delivery.retryAt?.getTime(), now.getTime() + 300000);
        now = new Date(now.getTime() + 300000);
        await notifications.sendDue();
        delivery = (await rows(booking))[0];
        assert.equal(delivery.attempts, 3);
        assert.equal(delivery.retryAt, null);
        assert.equal(delivery.status, 'failed');
        await notifications.sendDue();
        assert.equal((await rows(booking))[0].attempts, 3);
      },
    );
    await t.test(
      'gone_push_endpoint_is_removed_and_permanent_error_is_not_retried',
      async () => {
        const booking = await make();
        await notifications.dispatch();
        transport.push = async () => {
          throw new DeliveryError('push_http_410', true, true);
        };
        await notifications.sendDue();
        assert.equal(
          await prisma.pushSubscription.count({ where: { endpoint } }),
          0,
        );
        assert.equal((await rows(booking))[0].retryAt, null);
        await push.subscribe(contexts[2], { endpoint, keys });
      },
    );
    await t.test(
      'expired_lease_can_be_recovered_without_repeating_booking_transaction',
      async () => {
        const booking = await make();
        await notifications.dispatch();
        const delivery = (await rows(booking))[0];
        await prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'sending',
            attempts: 1,
            leaseToken: randomUUID(),
            leaseExpiresAt: new Date(now.getTime() - 1),
          },
        });
        await notifications.sendDue();
        assert.equal((await rows(booking))[0].attempts, 2);
        assert.equal((await rows(booking))[0].status, 'sent');
        assert.equal(
          await prisma.booking.count({ where: { id: booking.id } }),
          1,
        );
        assert.equal(
          await prisma.outboxEvent.count({
            where: { eventKey: 'booking.created:' + booking.id },
          }),
          1,
        );
      },
    );
    await t.test(
      'deadline_reminder_is_persisted_once_and_stale_upload_version_is_skipped',
      async () => {
        const booking = await make(),
          proof = await upload(booking);
        await notifications.dispatch();
        await notifications.schedule();
        await notifications.schedule();
        const reminder = (
          await rows(booking, 'booking.confirmation_reminder')
        ).filter((row) => row.channel === 'push');
        assert.equal(reminder.length, 3);
        const current = await bookings.detail(contexts[0], booking.id);
        assert.equal(
          reminder[0].dueAt.getTime(),
          current.confirmationDueAt!.getTime() - 1800000,
        );
        now = new Date(now.getTime() + 300000);
        await payments.reject(
          contexts[2],
          booking.id,
          proof.proofId!,
          'Bukti pembayaran belum cocok.',
          randomUUID(),
        );
        await upload(booking);
        await notifications.dispatch();
        await notifications.schedule();
        now = new Date(reminder[0].dueAt);
        await notifications.sendDue();
        const stale = await prisma.notificationDelivery.findUniqueOrThrow({
          where: { id: reminder[0].id },
        });
        assert.equal(stale.status, 'skipped');
        assert.equal(
          (await rows(booking, 'booking.confirmation_reminder')).filter(
            (row) => row.channel === 'push',
          ).length,
          6,
        );
      },
    );
    await t.test(
      'escalations_send_only_current_stage_and_never_enqueue_whatsapp',
      async () => {
        const booking = await make();
        await upload(booking);
        await notifications.dispatch();
        await notifications.schedule();
        await notifications.schedule();
        const reminders = await rows(booking, 'booking.confirmation_reminder');
        assert.equal(reminders.length, 3);
        assert.ok(reminders.every((row) => row.channel === 'push'));
        now = new Date(reminders[1].dueAt);
        await notifications.sendDue();
        await notifications.sendDue();
        let current = await rows(booking, 'booking.confirmation_reminder');
        assert.deepEqual(
          current.map((row) => row.status),
          ['skipped', 'sent', 'queued'],
        );
        now = new Date(reminders[2].dueAt);
        await notifications.sendDue();
        current = await rows(booking, 'booking.confirmation_reminder');
        assert.deepEqual(
          current.map((row) => row.status),
          ['skipped', 'sent', 'sent'],
        );
        assert.ok(current.every((row) => row.attempts <= 1));
        assert.equal(
          (await rows(booking)).filter((row) => row.channel === 'whatsapp')
            .length,
          0,
        );
      },
    );
    await t.test(
      'late_worker_sends_overdue_once_and_skips_obsolete_reminder',
      async () => {
        const booking = await make();
        await upload(booking);
        await notifications.dispatch();
        await notifications.schedule();
        const current = await bookings.detail(contexts[0], booking.id);
        now = new Date(current.confirmationDueAt!.getTime() + 1);
        const calls: { url: string }[] = [];
        transport.push = async (_subscription, payload) => {
          calls.push(payload);
          return 'accepted';
        };
        await notifications.sendDue();
        await notifications.sendDue();
        assert.equal(
          (await rows(booking, 'booking.confirmation_reminder')).find(
            (row) => row.channel === 'push',
          )?.status,
          'skipped',
        );
        assert.equal(
          (await rows(booking, 'booking.confirmation_overdue')).find(
            (row) => row.channel === 'push',
          )?.status,
          'sent',
        );
        assert.equal(
          (await rows(booking)).filter((row) => row.channel === 'whatsapp')
            .length,
          0,
        );
        assert.equal(
          (await bookings.detail(contexts[0], booking.id)).status,
          'menunggu_konfirmasi',
        );
      },
    );
    await t.test(
      'approval_makes_queued_proof_and_reminders_irrelevant',
      async () => {
        const booking = await make('full'),
          proof = await upload(booking);
        await notifications.dispatch();
        await notifications.schedule();
        await payments.verify(
          contexts[2],
          booking.id,
          receipt(proof.proofId!, '50000'),
          randomUUID(),
        );
        setTime(10);
        await notifications.sendDue();
        assert.ok(
          (await rows(booking))
            .filter((row) => row.channel === 'push')
            .every((row) => row.status === 'skipped'),
        );
      },
    );
    await t.test(
      'return_report_notifies_only_while_admin_review_is_pending',
      async () => {
        const booking = await running();
        await operations.report(
          contexts[0],
          booking.id,
          booking.items[0].id,
          randomUUID(),
        );
        await notifications.dispatch();
        setTime(16);
        await operations.verifyReturn(
          contexts[2],
          booking.id,
          booking.items[0].id,
          returnInput(),
          randomUUID(),
        );
        await notifications.sendDue();
        assert.equal(
          (await rows(booking, 'return.reported'))[0].status,
          'skipped',
        );
      },
    );
    await t.test(
      'extension_upload_and_confirmation_use_the_extension_scope',
      async () => {
        const booking = await running();
        const created = await extensions.create(
            contexts[0],
            booking.id,
            { items: [{ bookingItemId: booking.items[0].id, addedHours: 6 }] },
            randomUUID(),
          ),
          id = created.decision!;
        await extensions.upload(
          contexts[0],
          booking.id,
          id,
          { claimedAmount: '50000' },
          { buffer: pdf, size: pdf.length, mimetype: 'application/pdf' },
          randomUUID(),
        );
        await notifications.dispatch();
        await notifications.schedule();
        assert.equal(
          (await rows(booking, 'extension.proof_uploaded')).length,
          1,
        );
        const reminder = (
          await rows(booking, 'extension.confirmation_reminder')
        )[0];
        assert.equal(reminder.channel, 'push');
        assert.equal(reminder.sourceId, id);
        await notifications.sendDue();
        transport.ready = (channel, adminId) =>
          channel === 'push' || adminId === users[2].id;
        let count = 0;
        transport.push = async () => {
          count++;
          return 'mock-provider-reference';
        };
        now = new Date(reminder.dueAt);
        await notifications.sendDue();
        await notifications.sendDue();
        assert.equal(count, 1);
        assert.equal(
          (await rows(booking, 'extension.confirmation_reminder')).find(
            (row) => row.recipientAdminId === users[2].id,
          )!.status,
          'sent',
        );
      },
    );
    await t.test(
      'malformed_outbox_record_does_not_prevent_other_events_from_dispatching',
      async () => {
        const booking = await make();
        const bad = await prisma.outboxEvent.create({
          data: {
            eventKey: 'bad:' + randomUUID(),
            aggregateType: 'Booking',
            aggregateId: booking.id,
            eventType: 'booking.created',
            payload: { bookingId: 'not-uuid' },
            occurredAt: now,
          },
        });
        const result = await notifications.dispatch();
        assert.equal(result.failed, 1);
        assert.equal((await rows(booking, 'booking.created')).length, 1);
        await notifications.dispatch();
        await notifications.dispatch();
        const record = await prisma.outboxEvent.findUniqueOrThrow({
          where: { id: bad.id },
        });
        assert.equal(record.attempts, 3);
        assert.equal(record.error, 'outbox_dispatch_failed');
        assert.ok(record.dispatchedAt);
      },
    );
  } finally {
    const userIds = users.map((user) => user.id),
      rows = await prisma.booking.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      }),
      ids = rows.map((row) => row.id);
    await prisma.$transaction(async (tx) => {
      const refundRows = await tx.refundRequest.findMany({
        where: { bookingId: { in: ids } },
        select: { id: true },
      });
      await tx.notificationDelivery.deleteMany({
        where: { recipientAdminId: { in: userIds } },
      });
      await tx.pushSubscription.deleteMany({
        where: { userId: { in: userIds } },
      });
      await tx.outboxEvent.deleteMany({
        where: {
          aggregateId: { in: [...ids, ...refundRows.map((row) => row.id)] },
        },
      });
      await tx.idempotencyRequest.deleteMany({
        where: { actorId: { in: userIds } },
      });
      await tx.payment.deleteMany({
        where: { bookingId: { in: ids }, direction: 'out' },
      });
      await tx.refundSource.deleteMany({ where: { bookingId: { in: ids } } });
      await tx.refundRequest.deleteMany({ where: { bookingId: { in: ids } } });
      await tx.paymentApplication.deleteMany({
        where: { bookingId: { in: ids } },
      });
      await tx.payment.deleteMany({ where: { bookingId: { in: ids } } });
      await tx.paymentObligation.updateMany({
        where: { bookingId: { in: ids } },
        data: { status: 'closed', pendingProofId: null },
      });
      await tx.paymentProof.deleteMany({
        where: { obligation: { bookingId: { in: ids } } },
      });
      await tx.paymentObligation.deleteMany({
        where: { bookingId: { in: ids } },
      });
      await tx.bookingCharge.deleteMany({
        where: { bookingId: { in: ids }, direction: 'credit' },
      });
      await tx.bookingCharge.deleteMany({ where: { bookingId: { in: ids } } });
      await tx.bookingStatusLog.deleteMany({
        where: { bookingId: { in: ids } },
      });
      await tx.unitAllocation.deleteMany({
        where: { bookingItem: { bookingId: { in: ids } } },
      });
      await tx.lossRecord.deleteMany({
        where: { bookingItem: { bookingId: { in: ids } } },
      });
      await tx.returnRecord.deleteMany({
        where: { bookingItem: { bookingId: { in: ids } } },
      });
      await tx.extensionItem.deleteMany({ where: { bookingId: { in: ids } } });
      await tx.extension.deleteMany({ where: { bookingId: { in: ids } } });
      await tx.bookingItem.deleteMany({ where: { bookingId: { in: ids } } });
      await tx.booking.deleteMany({ where: { id: { in: ids } } });
      await tx.deliveryZone.delete({ where: { id: zone.id } });
      await tx.itemUnit.deleteMany({ where: { itemId: { in: itemIds } } });
      await tx.item.deleteMany({ where: { id: { in: itemIds } } });
      await tx.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await tx.auditLog.deleteMany({
        where: {
          entityId: { in: [...ids, ...refundRows.map((row) => row.id)] },
        },
      });
      await tx.authSession.deleteMany({ where: { userId: { in: userIds } } });
      await tx.authRateLimit.deleteMany({
        where: {
          key: { in: userIds.map((id) => digest('proof.upload.user:' + id)) },
        },
      });
      await tx.customerProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    });
    await rm(cleanupTarget, { recursive: true, force: true });
  }
});
