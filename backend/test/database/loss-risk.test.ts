import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
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
import { RisksService } from '../../src/modules/risks/risks.service';
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

test('loss_replacement_and_upcoming_booking_risks', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'irent-loss-proofs-'));
  const cleanupTarget = resolve(directory);
  if (
    dirname(cleanupTarget) !== resolve(tmpdir()) ||
    !basename(cleanupTarget).startsWith('irent-loss-proofs-')
  )
    throw new Error('Unsafe test storage cleanup path.');
  Object.assign(process.env, testSecrets(), {
    DATABASE_URL: url,
    NODE_ENV: 'test',
    PROOF_STORAGE_DIR: directory,
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
    risks = app.get(RisksService),
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
  t.beforeEach(() => {
    now = initialNow;
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
  async function settle(
    booking: TestBooking,
    amount = '30000',
    key = randomUUID(),
  ) {
    return payments.recordSettlement(
      contexts[2],
      booking.id,
      {
        amount,
        occurredAt: formatWibDateTime(now),
        method: 'cash',
        note: 'Uang tunai diterima dan dihitung admin.',
      },
      key,
    );
  }
  async function detail(booking: TestBooking) {
    return payments.detail(contexts[0], booking.id);
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
    function loss(time = at(17, 1), amount = '100000') {
      return {
        lostAt: time,
        lossNote: 'Unit hilang telah diperiksa admin.',
        compensationAmount: amount,
      };
    }
    async function next(booking: TestBooking, actor = 1, start = at(18)) {
      return bookings.create(
        contexts[actor],
        {
          startAt: start,
          durationHours: start === at(10) ? 6 : 24,
          items: [{ itemId: booking.items[0].itemId, quantity: 1 }],
          deliveryType: 'pickup',
          payOption: 'full',
          termsVersion: TERMS_VERSION,
          agreeTerms: true,
          prepareIdentity: true,
          understandPayment: true,
          agreeOperatingHours: true,
        },
        randomUUID(),
      );
    }
    async function spare(booking: TestBooking) {
      return prisma.itemUnit.create({
        data: { itemId: booking.items[0].itemId, code: 'TEST-' + randomUUID() },
      });
    }
    await t.test(
      'loss_closes_usage_without_fake_return_and_preserves_unpaid_compensation',
      async () => {
        const booking = await running();
        setTime(19);
        const key = randomUUID();
        await Promise.all(
          [0, 1].map(() =>
            operations.verifyLoss(
              contexts[2],
              booking.id,
              booking.items[0].id,
              loss(),
              key,
            ),
          ),
        );
        const result = await detail(booking);
        assert.equal(result.booking.status, 'selesai');
        assert.equal(result.booking.items[0].useStatus, 'lost_closed');
        assert.equal(result.booking.items[0].returnRecord, null);
        assert.equal(result.booking.items[0].lossRecord?.lateFee, 10000n);
        assert.equal(result.summary.remaining, 110000n);
        const unit = await prisma.itemUnit.findUniqueOrThrow({
          where: { id: booking.items[0].itemUnitId },
        });
        assert.equal(unit.conditionStatus, 'lost');
        assert.equal(unit.isActive, false);
        assert.notEqual(unit.physicalStatus, 'ready');
        assert.equal(
          await prisma.bookingCharge.count({
            where: { bookingId: booking.id, kind: 'loss' },
          }),
          1,
        );
        await settle(booking, '110000');
        assert.equal((await detail(booking)).summary.remaining, 0n);
        await assert.rejects(
          operations.verifyReturn(
            contexts[2],
            booking.id,
            booking.items[0].id,
            returnInput(),
            randomUUID(),
          ),
          /tidak sedang/,
        );
      },
    );
    await t.test(
      'invalid_loss_times_compensation_and_courier_exemptions_rollback',
      async () => {
        const booking = await running();
        setTime(18);
        for (const input of [
          loss(at(9)),
          loss(at(19)),
          loss(at(17), '9223372036854775807'),
          {
            ...loss(),
            exemptions: [
              {
                type: 'courier' as const,
                from: at(16),
                to: at(17),
                reason: 'Petugas terlambat kembali.',
              },
            ],
          },
        ]) {
          await assert.rejects(
            operations.verifyLoss(
              contexts[2],
              booking.id,
              booking.items[0].id,
              input,
              randomUUID(),
            ),
          );
        }
        assert.equal(
          (await detail(booking)).booking.items[0].useStatus,
          'in_use',
        );
        assert.equal(
          await prisma.lossRecord.count({
            where: { bookingItemId: booking.items[0].id },
          }),
          0,
        );
      },
    );
    await t.test(
      'loss_rejects_customer_report_without_marking_it_verified',
      async () => {
        const booking = await running();
        await operations.report(
          contexts[0],
          booking.id,
          booking.items[0].id,
          randomUUID(),
        );
        await operations.verifyLoss(
          contexts[2],
          booking.id,
          booking.items[0].id,
          loss(at(10), '0'),
          randomUUID(),
        );
        const result = await detail(booking);
        assert.equal(result.booking.items[0].returnRecord?.status, 'rejected');
        assert.equal(result.booking.items[0].returnRecord?.verifiedAt, null);
        assert.equal(result.summary.remaining, 0n);
      },
    );
    await t.test(
      'concurrent_loss_and_return_have_one_authoritative_outcome',
      async () => {
        const booking = await running();
        setTime(17, 1);
        const outcomes = await Promise.allSettled([
          operations.verifyLoss(
            contexts[2],
            booking.id,
            booking.items[0].id,
            loss(),
            randomUUID(),
          ),
          operations.verifyReturn(
            contexts[3],
            booking.id,
            booking.items[0].id,
            returnInput(at(17, 1)),
            randomUUID(),
          ),
        ]);
        assert.equal(
          outcomes.filter((row) => row.status === 'fulfilled').length,
          1,
        );
        const result = await detail(booking),
          item = result.booking.items[0];
        assert.ok(['returned', 'lost_closed'].includes(item.useStatus));
        assert.equal(
          Number(!!item.lossRecord) +
            Number(item.returnRecord?.status === 'verified'),
          1,
        );
      },
    );
    await t.test(
      'partial_loss_keeps_other_unit_running_until_verified_return',
      async () => {
        const booking = await make('full', at(10), 50000n, 0, false, 2);
        const proof = await upload(booking);
        await payments.verify(
          contexts[2],
          booking.id,
          receipt(proof.proofId!, '100000'),
          randomUUID(),
        );
        setTime(10);
        await operations.handover(
          contexts[2],
          booking.id,
          handoverInput(),
          randomUUID(),
        );
        await operations.verifyLoss(
          contexts[2],
          booking.id,
          booking.items[0].id,
          loss(at(10)),
          randomUUID(),
        );
        assert.equal((await detail(booking)).booking.status, 'berjalan');
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItemId: booking.items[1].id, state: 'active' },
          }),
          1,
        );
        setTime(16);
        await operations.verifyReturn(
          contexts[2],
          booking.id,
          booking.items[1].id,
          returnInput(),
          randomUUID(),
        );
        assert.equal((await detail(booking)).booking.status, 'selesai');
      },
    );
    await t.test(
      'lost_unit_flags_future_booking_without_cancelling_and_replacement_preserves_history',
      async () => {
        const booking = await running();
        const future = await next(booking);
        const proof = await upload(future, 1);
        await payments.verify(
          contexts[2],
          future.id,
          receipt(proof.proofId!, '50000'),
          randomUUID(),
        );
        const newUnit = await spare(booking);
        setTime(17, 1);
        await operations.verifyLoss(
          contexts[2],
          booking.id,
          booking.items[0].id,
          loss(),
          randomUUID(),
        );
        const risky = await payments.detail(contexts[1], future.id);
        assert.equal(risky.booking.status, 'dikonfirmasi');
        assert.ok(risky.risks[0].reasons.includes('unit_hilang'));
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItemId: future.items[0].id, state: 'active' },
          }),
          1,
        );
        assert.equal(
          await prisma.outboxEvent.count({
            where: {
              aggregateId: future.id,
              eventType: 'booking.unit_at_risk',
            },
          }),
          1,
        );
        await risks.scanDue();
        await risks.scanDue();
        assert.equal(
          await prisma.outboxEvent.count({
            where: {
              aggregateId: future.id,
              eventType: 'booking.unit_at_risk',
            },
          }),
          1,
        );
        const key = randomUUID(),
          input = {
            itemUnitId: newUnit.id,
            reason: 'Unit lama hilang, ganti model sama.',
          };
        await operations.replaceUnit(
          contexts[2],
          future.id,
          future.items[0].id,
          input,
          key,
        );
        await operations.replaceUnit(
          contexts[2],
          future.id,
          future.items[0].id,
          input,
          key,
        );
        const result = await payments.detail(contexts[1], future.id);
        assert.equal(result.risks.length, 0);
        assert.equal(result.booking.items[0].itemUnitId, newUnit.id);
        assert.equal(result.booking.items[0].unitCodeSnapshot, newUnit.code);
        assert.equal(result.summary.applied, risky.summary.applied);
        assert.equal(result.summary.bill, risky.summary.bill);
        const allocations = await prisma.unitAllocation.findMany({
          where: { bookingItemId: future.items[0].id },
        });
        assert.equal(allocations.length, 2);
        assert.equal(
          allocations.filter((row) => row.state === 'released')[0].itemUnitId,
          booking.items[0].itemUnitId,
        );
        const active = allocations.find((row) => row.state === 'active')!;
        assert.equal(
          active.blockStartAt.getTime(),
          future.items[0].startAt.getTime() - 3600000,
        );
        setTime(18);
        await operations.handover(
          contexts[2],
          future.id,
          handoverInput(false, at(18)),
          randomUUID(),
        );
      },
    );
    await t.test(
      'replacement_rejects_wrong_model_inactive_and_conflicting_units',
      async () => {
        const booking = await make(),
          other = await make();
        const newUnit = await spare(booking);
        const replace = (id: string) =>
          operations.replaceUnit(
            contexts[2],
            booking.id,
            booking.items[0].id,
            {
              itemUnitId: id,
              reason: 'Penggantian setelah pemeriksaan admin.',
            },
            randomUUID(),
          );
        await assert.rejects(replace(other.items[0].itemUnitId), /model/);
        await assert.rejects(replace(randomUUID()), /model/);
        await prisma.itemUnit.update({
          where: { id: newUnit.id },
          data: { isActive: false },
        });
        await assert.rejects(replace(newUnit.id), /tidak tersedia/);
        await prisma.itemUnit.update({
          where: { id: newUnit.id },
          data: {
            isActive: true,
            conditionStatus: 'maintenance',
            physicalStatus: 'awaiting_check',
          },
        });
        await assert.rejects(replace(newUnit.id), /tidak tersedia/);
        await prisma.itemUnit.update({
          where: { id: newUnit.id },
          data: {
            conditionStatus: 'layak',
            physicalStatus: 'preparing',
            preparationUntil: new Date(initialNow.getTime() + 5 * 3600000),
          },
        });
        await assert.rejects(replace(newUnit.id), /tidak tersedia/);
        assert.equal(
          (await detail(booking)).booking.items[0].itemUnitId,
          booking.items[0].itemUnitId,
        );
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItemId: booking.items[0].id, state: 'active' },
          }),
          1,
        );
      },
    );
    await t.test(
      'two_customers_replacing_into_last_unit_cannot_double_allocate',
      async () => {
        const first = await make();
        await spare(first);
        const second = await next(first, 1, at(10));
        const target = await spare(first);
        const results = await Promise.allSettled(
          [first, second].map((booking, index) =>
            operations.replaceUnit(
              contexts[2 + index],
              booking.id,
              booking.items[0].id,
              {
                itemUnitId: target.id,
                reason: 'Ganti unit dengan model yang sama.',
              },
              randomUUID(),
            ),
          ),
        );
        assert.equal(
          results.filter((row) => row.status === 'fulfilled').length,
          1,
        );
        assert.equal(
          await prisma.unitAllocation.count({
            where: { itemUnitId: target.id, state: 'active' },
          }),
          1,
        );
      },
    );
    await t.test(
      'replacement_disallows_handover_and_expired_hold',
      async () => {
        const booking = await running(),
          newUnit = await spare(booking);
        await assert.rejects(
          operations.replaceUnit(
            contexts[2],
            booking.id,
            booking.items[0].id,
            {
              itemUnitId: newUnit.id,
              reason: 'Unit lain akan digunakan pelanggan.',
            },
            randomUUID(),
          ),
          /sebelum serah/,
        );
        setTime(6);
        const expired = await make(),
          alternate = await spare(expired);
        setTime(8, 0, 1);
        await assert.rejects(
          operations.replaceUnit(
            contexts[2],
            expired.id,
            expired.items[0].id,
            {
              itemUnitId: alternate.id,
              reason: 'Unit lain akan digunakan pelanggan.',
            },
            randomUUID(),
          ),
          /sebelum serah/,
        );
      },
    );
    await t.test(
      'risk_worker_detects_overdue_and_preparation_without_releasing_future_stock',
      async () => {
        const booking = await running(),
          future = await next(booking);
        const proof = await upload(future, 1);
        await payments.verify(
          contexts[2],
          future.id,
          receipt(proof.proofId!, '50000'),
          randomUUID(),
        );
        setTime(16);
        assert.equal(
          (await payments.detail(contexts[1], future.id)).risks.length,
          0,
        );
        setTime(16, 0, 1);
        assert.ok(
          (
            await payments.detail(contexts[1], future.id)
          ).risks[0].reasons.includes('sewa_sebelumnya_terlambat'),
        );
        await risks.scanDue();
        await risks.scanDue();
        assert.equal(
          await prisma.outboxEvent.count({
            where: {
              aggregateId: future.id,
              eventType: 'booking.unit_at_risk',
            },
          }),
          1,
        );
        setTime(17, 30);
        await operations.verifyReturn(
          contexts[2],
          booking.id,
          booking.items[0].id,
          returnInput(at(17, 30)),
          randomUUID(),
        );
        assert.ok(
          (
            await payments.detail(contexts[1], future.id)
          ).risks[0].reasons.includes('persiapan_melewati_jadwal'),
        );
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItemId: future.items[0].id, state: 'active' },
          }),
          1,
        );
        assert.equal(
          (await payments.detail(contexts[1], future.id)).booking.status,
          'dikonfirmasi',
        );
      },
    );
    await t.test(
      'loss_cancels_pending_extension_and_reconciliation_corrects_paid_late_fee',
      async () => {
        const booking = await running();
        const created = await extensions.create(
          contexts[0],
          booking.id,
          { items: [{ bookingItemId: booking.items[0].id, addedHours: 6 }] },
          randomUUID(),
        );
        const id = created.decision!;
        const proof = await extensions.upload(
          contexts[0],
          booking.id,
          id,
          { claimedAmount: '50000' },
          { buffer: pdf, size: pdf.length, mimetype: 'application/pdf' },
          randomUUID(),
        );
        setTime(18);
        await operations.verifyLoss(
          contexts[2],
          booking.id,
          booking.items[0].id,
          loss(at(18)),
          randomUUID(),
        );
        assert.equal((await detail(booking)).summary.remaining, 110000n);
        await settle(booking, '110000');
        const obligation = (await detail(booking)).booking.obligations.find(
          (row) => row.extensionId === id,
        )!;
        setTime(20);
        const input = {
          ...receipt(proof.proofId!, '50000'),
          occurredAt: at(10),
          obligationId: obligation.id,
        };
        const key = randomUUID();
        await extensions.reconcile(contexts[2], booking.id, id, input, key);
        await extensions.reconcile(contexts[2], booking.id, id, input, key);
        const result = await detail(booking);
        assert.equal(result.summary.bill, 150000n);
        assert.equal(result.booking.items[0].lossRecord?.lateFee, 10000n);
        assert.equal(
          result.booking.items[0].lossRecord?.compensationAmount,
          100000n,
        );
        assert.equal(
          result.booking.refunds.find(
            (row) => row.reasonCode === 'admin_delay_correction',
          )?.requestedAmount,
          10000n,
        );
        assert.equal(
          (await extensions.detail(contexts[0], booking.id, id)).summary
            .refundRequested,
          50000n,
        );
        assert.equal(
          (await extensions.detail(contexts[0], booking.id, id)).extension
            .status,
          'dibatalkan',
        );
        assert.equal(
          await prisma.unitAllocation.count({
            where: { extensionItem: { extensionId: id }, state: 'active' },
          }),
          0,
        );
      },
    );
    await t.test(
      'loss_of_one_unit_cancels_whole_multi_unit_extension_and_refunds_received_funds',
      async () => {
        const booking = await make('full', at(10), 50000n, 0, false, 2);
        const initialProof = await upload(booking);
        await payments.verify(
          contexts[2],
          booking.id,
          receipt(initialProof.proofId!, '100000'),
          randomUUID(),
        );
        setTime(10);
        await operations.handover(
          contexts[2],
          booking.id,
          handoverInput(),
          randomUUID(),
        );
        const created = await extensions.create(
          contexts[0],
          booking.id,
          {
            items: booking.items.map((row) => ({
              bookingItemId: row.id,
              addedHours: 6,
            })),
          },
          randomUUID(),
        );
        const id = created.decision!;
        const proof = await extensions.upload(
          contexts[0],
          booking.id,
          id,
          { claimedAmount: '25000' },
          { buffer: pdf, size: pdf.length, mimetype: 'application/pdf' },
          randomUUID(),
        );
        await extensions.verify(
          contexts[2],
          booking.id,
          id,
          receipt(proof.proofId!, '25000'),
          randomUUID(),
        );
        await operations.verifyLoss(
          contexts[2],
          booking.id,
          booking.items[0].id,
          loss(at(10)),
          randomUUID(),
        );
        const result = await detail(booking);
        assert.equal(result.booking.status, 'berjalan');
        const otherItem = result.booking.items.find(
          (row) => row.id === booking.items[1].id,
        )!;
        assert.equal(otherItem.useStatus, 'in_use');
        assert.equal(
          otherItem.currentEndAt.getTime(),
          booking.items[1].currentEndAt.getTime(),
        );
        const extension = await extensions.detail(contexts[0], booking.id, id);
        assert.equal(extension.extension.status, 'dibatalkan');
        assert.equal(extension.summary.refundRequested, 25000n);
        assert.equal(
          await prisma.unitAllocation.count({
            where: { extensionItem: { extensionId: id }, state: 'active' },
          }),
          0,
        );
        assert.equal(
          await prisma.unitAllocation.count({
            where: {
              bookingItemId: booking.items[1].id,
              allocationKind: 'rental',
              state: 'active',
            },
          }),
          1,
        );
      },
    );
    await t.test(
      'loss_and_extension_approval_are_serialized_and_never_reactivate_lost_unit',
      async () => {
        const booking = await running();
        const created = await extensions.create(
          contexts[0],
          booking.id,
          { items: [{ bookingItemId: booking.items[0].id, addedHours: 6 }] },
          randomUUID(),
        );
        const id = created.decision!;
        const proof = await extensions.upload(
          contexts[0],
          booking.id,
          id,
          { claimedAmount: '50000' },
          { buffer: pdf, size: pdf.length, mimetype: 'application/pdf' },
          randomUUID(),
        );
        setTime(12);
        const results = await Promise.allSettled([
          extensions.verify(
            contexts[2],
            booking.id,
            id,
            { ...receipt(proof.proofId!, '50000'), occurredAt: at(10) },
            randomUUID(),
          ),
          operations.verifyLoss(
            contexts[3],
            booking.id,
            booking.items[0].id,
            loss(at(12)),
            randomUUID(),
          ),
        ]);
        assert.ok(results.some((row) => row.status === 'fulfilled'));
        const result = await detail(booking);
        assert.equal(result.booking.items[0].useStatus, 'lost_closed');
        assert.equal(result.booking.status, 'selesai');
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItemId: booking.items[0].id, state: 'active' },
          }),
          0,
        );
        assert.equal(
          (
            await prisma.itemUnit.findUniqueOrThrow({
              where: { id: booking.items[0].itemUnitId },
            })
          ).physicalStatus,
          'lost',
        );
        assert.ok(
          ['disetujui', 'dibatalkan'].includes(
            (await extensions.detail(contexts[0], booking.id, id)).extension
              .status,
          ),
        );
      },
    );
    await t.test(
      'loss_and_risk_http_routes_require_admin_csrf_and_valid_payloads',
      async () => {
        const booking = await running();
        const endpoint =
          base +
          '/api/admin/bookings/' +
          booking.id +
          '/items/' +
          booking.items[0].id +
          '/loss/verify';
        for (const [actor, csrf, status] of [
          [0, false, 403],
          [2, true, 403],
        ] as const) {
          assert.equal(
            (
              await fetch(endpoint, {
                method: 'POST',
                headers: {
                  ...headers(actor, randomUUID()),
                  ...(csrf ? { 'X-CSRF-Token': 'wrong' } : {}),
                },
                body: JSON.stringify(loss(at(10))),
              })
            ).status,
            status,
          );
        }
        assert.equal(
          (
            await fetch(endpoint, {
              method: 'POST',
              headers: headers(2, randomUUID()),
              body: JSON.stringify({
                ...loss(at(10)),
                compensationAmount: '-1',
              }),
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await fetch(base + '/api/admin/bookings/at-risk', {
              headers: headers(0),
            })
          ).status,
          403,
        );
        const response = await fetch(
          base + '/api/admin/bookings/at-risk?page=1&limit=2',
          { headers: headers(2) },
        );
        assert.equal(response.status, 200, await response.clone().text());
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const result = (await response.json()) as {
          data: unknown[];
          limit: number;
        };
        assert.ok(result.data.length <= 2);
        assert.equal(result.limit, 2);
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
