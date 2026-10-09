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
import { NoShowService } from '../../src/modules/payments/no-show.service';
import { OperationsService } from '../../src/modules/operations/operations.service';
import { InventoryService } from '../../src/modules/inventory/inventory.service';
import { RefundsService } from '../../src/modules/payments/refunds.service';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { BusinessClock } from '../../src/shared/time/business-clock';
import { formatWibDateTime, wibNow } from '../../src/shared/time/wib';
import { setupApp } from '../../src/setup-app';
import { testSecrets } from '../config.fixture';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL wajib diisi.');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
type TestBooking = Awaited<ReturnType<BookingsService['create']>>;

test('operations_preserve_money_stock_and_verified_return_rules', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'irent-operations-proofs-'));
  const cleanupTarget = resolve(directory);
  if (
    dirname(cleanupTarget) !== resolve(tmpdir()) ||
    !basename(cleanupTarget).startsWith('irent-operations-proofs-')
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
    refunds = app.get(RefundsService),
    noShow = app.get(NoShowService),
    operations = app.get(OperationsService),
    inventory = app.get(InventoryService),
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
    await t.test(
      'handover_requires_applied_full_payment_and_cash_receipt_is_idempotent',
      async () => {
        const booking = await paid();
        setTime(10);
        await assert.rejects(
          operations.handover(
            contexts[2],
            booking.id,
            handoverInput(),
            randomUUID(),
          ),
          /harus lunas/,
        );
        await settle(booking, '10000');
        await assert.rejects(
          operations.handover(
            contexts[2],
            booking.id,
            handoverInput(),
            randomUUID(),
          ),
          /harus lunas/,
        );
        const key = randomUUID();
        await Promise.all([
          settle(booking, '25000', key),
          settle(booking, '25000', key),
        ]);
        const result = await detail(booking);
        assert.equal(result.summary.applied, 50000n);
        assert.equal(result.summary.remaining, 0n);
        assert.equal(result.booking.refunds[0].requestedAmount, 5000n);
        assert.equal(
          await prisma.payment.count({
            where: { bookingId: booking.id, direction: 'in' },
          }),
          3,
        );
        const handoverKey = randomUUID();
        await operations.handover(
          contexts[2],
          booking.id,
          handoverInput(),
          handoverKey,
        );
        await operations.handover(
          contexts[2],
          booking.id,
          handoverInput(),
          handoverKey,
        );
        await assert.rejects(
          operations.handover(
            contexts[2],
            booking.id,
            handoverInput(),
            randomUUID(),
          ),
          /belum diserahkan/,
        );
        assert.equal((await detail(booking)).booking.status, 'berjalan');
        assert.equal(
          (
            await prisma.itemUnit.findUniqueOrThrow({
              where: { id: booking.items[0].itemUnitId },
            })
          ).physicalStatus,
          'in_use',
        );
      },
    );
    await t.test(
      'handover_checks_physical_readiness_and_timestamp_before_mutation',
      async () => {
        const booking = await paid('50000', 'full');
        const unitId = booking.items[0].itemUnitId;
        setTime(10);
        await assert.rejects(
          operations.handover(
            contexts[2],
            booking.id,
            handoverInput(false, at(9)),
            randomUUID(),
          ),
          /Waktu serah/,
        );
        await assert.rejects(
          operations.handover(
            contexts[2],
            booking.id,
            handoverInput(false, at(11)),
            randomUUID(),
          ),
          /Waktu serah/,
        );
        await prisma.itemUnit.update({
          where: { id: unitId },
          data: {
            physicalStatus: 'preparing',
            preparationUntil: new Date(now.getTime() + 3600000),
          },
        });
        await assert.rejects(
          operations.handover(
            contexts[2],
            booking.id,
            handoverInput(),
            randomUUID(),
          ),
          /belum siap/,
        );
        setTime(11);
        await inventory.finishPreparation(contexts[2], unitId);
        // The cleared current preparation deadline must not permit a timestamp before maintenance preparation.
        await prisma.itemUnit.update({
          where: { id: unitId },
          data: { maintenanceCompletedAt: new Date(now.getTime() - 3600000) },
        });
        await assert.rejects(
          operations.handover(
            contexts[2],
            booking.id,
            handoverInput(),
            randomUUID(),
          ),
          /belum siap/,
        );
        await operations.handover(
          contexts[2],
          booking.id,
          handoverInput(false, at(11)),
          randomUUID(),
        );
      },
    );
    await t.test(
      'customer_report_keeps_stock_occupied_until_admin_verifies',
      async () => {
        const booking = await running(),
          item = booking.items[0];
        setTime(16);
        await assert.rejects(
          operations.report(contexts[1], booking.id, item.id, randomUUID()),
          /tidak ditemukan/,
        );
        await operations.report(contexts[0], booking.id, item.id, randomUUID());
        assert.equal(
          (await detail(booking)).booking.items[0].useStatus,
          'return_pending',
        );
        assert.equal(
          (
            await prisma.itemUnit.findUniqueOrThrow({
              where: { id: item.itemUnitId },
            })
          ).physicalStatus,
          'in_use',
        );
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItemId: item.id, state: 'active' },
          }),
          1,
        );
        await operations.rejectReport(
          contexts[2],
          booking.id,
          item.id,
          'Barang belum diterima di toko.',
          randomUUID(),
        );
        await operations.report(contexts[0], booking.id, item.id, randomUUID());
        setTime(18);
        await operations.verifyReturn(
          contexts[2],
          booking.id,
          item.id,
          returnInput(at(16)),
          randomUUID(),
        );
        const result = await detail(booking);
        assert.equal(result.booking.status, 'selesai');
        assert.equal(result.booking.items[0].returnRecord?.lateFee, 0n);
        assert.equal(
          result.booking.items[0].returnRecord?.preparationStartedAt?.getTime(),
          now.getTime(),
        );
        await assert.rejects(
          inventory.finishPreparation(contexts[2], item.itemUnitId),
          /belum selesai/,
        );
        setTime(18, 59, 59);
        await assert.rejects(
          inventory.finishPreparation(contexts[2], item.itemUnitId),
          /belum selesai/,
        );
        setTime(19);
        await inventory.finishPreparation(contexts[2], item.itemUnitId);
        assert.equal(
          (
            await prisma.itemUnit.findUniqueOrThrow({
              where: { id: item.itemUnitId },
            })
          ).physicalStatus,
          'ready',
        );
      },
    );
    await t.test(
      'partial_returns_charge_each_unit_once_and_finish_even_with_unpaid_fees',
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
        setTime(18);
        const [first, second] = booking.items;
        const input = {
          ...returnInput(at(18)),
          damageAmount: '15000',
          damageNote: 'Kaca pelindung rusak perlu diganti.',
        };
        const results = await Promise.allSettled([
          operations.verifyReturn(
            contexts[2],
            booking.id,
            first.id,
            input,
            randomUUID(),
          ),
          operations.verifyReturn(
            contexts[3],
            booking.id,
            first.id,
            input,
            randomUUID(),
          ),
        ]);
        assert.equal(
          results.filter((result) => result.status === 'fulfilled').length,
          1,
        );
        assert.equal((await detail(booking)).booking.status, 'berjalan');
        assert.equal(
          (
            await prisma.itemUnit.findUniqueOrThrow({
              where: { id: second.itemUnitId },
            })
          ).physicalStatus,
          'in_use',
        );
        assert.equal(
          await prisma.bookingCharge.count({
            where: {
              bookingItemId: first.id,
              kind: { in: ['late', 'damage'] },
            },
          }),
          2,
        );
        await operations.verifyReturn(
          contexts[2],
          booking.id,
          second.id,
          returnInput(at(18)),
          randomUUID(),
        );
        const result = await detail(booking);
        assert.equal(result.booking.status, 'selesai');
        assert.equal(result.summary.remaining, 35000n);
        setTime(19);
        await inventory.finishPreparation(contexts[2], first.itemUnitId);
        await settle(booking, '35000');
        assert.equal((await detail(booking)).summary.remaining, 0n);
      },
    );
    await t.test(
      'open_settlement_includes_new_return_charges_before_cash_is_applied',
      async () => {
        const booking = await running();
        setTime(16);
        // An open obligation created before inspection cannot treat new fees as overpayment.
        await prisma.bookingCharge.create({
          data: {
            bookingId: booking.id,
            kind: 'damage',
            direction: 'debit',
            amount: 10000n,
            effectiveAt: now,
            reason: 'Kerusakan tercatat saat pemeriksaan.',
            sourceKey: randomUUID(),
          },
        });
        await settle(booking, '5000');
        setTime(18);
        await operations.verifyReturn(
          contexts[2],
          booking.id,
          booking.items[0].id,
          returnInput(at(18)),
          randomUUID(),
        );
        await settle(booking, '15000');
        const result = await detail(booking);
        assert.equal(result.summary.remaining, 0n);
        assert.equal(result.summary.applied, 70000n);
        assert.equal(result.booking.refunds.length, 0);
      },
    );
    await t.test(
      'pending_settlement_proof_review_includes_fees_added_after_upload',
      async () => {
        const booking = await running();
        setTime(16);
        await prisma.bookingCharge.create({
          data: {
            bookingId: booking.id,
            kind: 'damage',
            direction: 'debit',
            amount: 10000n,
            effectiveAt: now,
            reason: 'Kerusakan tercatat saat pemeriksaan.',
            sourceKey: randomUUID(),
          },
        });
        await settle(booking, '5000');
        const settlement = await payments.settlement(
          contexts[0],
          booking.id,
          randomUUID(),
        );
        const obligation = settlement.booking.obligations.find(
          (row) => row.purpose === 'settlement' && row.status === 'open',
        )!;
        const proof = await upload(booking, 0, randomUUID(), obligation.id);
        setTime(18);
        await operations.verifyReturn(
          contexts[2],
          booking.id,
          booking.items[0].id,
          returnInput(at(18)),
          randomUUID(),
        );
        await assert.rejects(settle(booking, '15000'), /masih pending/);
        await payments.verify(
          contexts[2],
          booking.id,
          receipt(proof.proofId!, '15000'),
          randomUUID(),
        );
        assert.equal((await detail(booking)).summary.remaining, 0n);
        assert.equal((await detail(booking)).booking.refunds.length, 0);
      },
    );
    await t.test(
      'courier_receipt_stops_fee_and_maintenance_requires_its_own_hour',
      async () => {
        const booking = await running(true),
          item = booking.items[0];
        setTime(20);
        await operations.verifyReturn(
          contexts[2],
          booking.id,
          item.id,
          {
            ...returnInput(at(19), 'maintenance'),
            receivedByCourierAt: at(16, 30),
            damageAmount: '20000',
            damageNote: 'Perangkat perlu perbaikan konektor.',
          },
          randomUUID(),
        );
        const record = (await detail(booking)).booking.items[0].returnRecord;
        assert.equal(record?.lateFee, 0n);
        assert.equal(record?.preparationStartedAt, null);
        await assert.rejects(
          inventory.finishPreparation(contexts[2], item.itemUnitId),
          /belum selesai/,
        );
        await inventory.finishMaintenance(contexts[2], item.itemUnitId);
        await assert.rejects(
          inventory.finishPreparation(contexts[2], item.itemUnitId),
          /belum selesai/,
        );
        setTime(21);
        await inventory.finishPreparation(contexts[2], item.itemUnitId);
        assert.equal((await detail(booking)).summary.remaining, 20000n);
      },
    );
    await t.test(
      'overlapping_exemptions_are_clipped_and_audited_without_double_subtraction',
      async () => {
        const booking = await running(true),
          item = booking.items[0];
        setTime(20);
        const key = randomUUID();
        const input = {
          ...returnInput(at(20)),
          receivedByCourierAt: at(19),
          exemptions: [
            {
              type: 'admin' as const,
              from: at(16),
              to: at(18, 30),
              reason: 'Admin terlambat melakukan pemeriksaan.',
            },
            {
              type: 'courier' as const,
              from: at(18),
              to: at(19),
              reason: 'Petugas terlambat mengambil barang.',
            },
          ],
        };
        await operations.verifyReturn(
          contexts[2],
          booking.id,
          item.id,
          input,
          key,
        );
        await operations.verifyReturn(
          contexts[2],
          booking.id,
          item.id,
          input,
          key,
        );
        const record = (await detail(booking)).booking.items[0].returnRecord;
        assert.equal(record?.lateSeconds, 7200);
        assert.equal(record?.lateFee, 0n);
        assert.equal(record?.adminDelayExemptionSeconds, 3600);
        assert.equal(record?.courierDelayExemptionSeconds, 3600);
        assert.equal(
          await prisma.auditLog.count({
            where: { entityId: item.id, action: 'return.verified' },
          }),
          1,
        );
      },
    );
    await t.test(
      'invalid_return_timestamps_damage_notes_and_courier_context_roll_back',
      async () => {
        const booking = await running(),
          item = booking.items[0];
        setTime(16);
        for (const input of [
          returnInput(at(17)),
          returnInput(at(9)),
          { ...returnInput(), receivedByCourierAt: at(15) },
          { ...returnInput(), damageAmount: '10000' },
          {
            ...returnInput(),
            exemptions: [
              {
                type: 'admin' as const,
                from: at(15),
                to: at(17),
                reason: 'Admin terlambat memeriksa barang.',
              },
            ],
          },
        ])
          await assert.rejects(
            operations.verifyReturn(
              contexts[2],
              booking.id,
              item.id,
              input,
              randomUUID(),
            ),
          );
        assert.equal(
          await prisma.returnRecord.count({
            where: { bookingItemId: item.id },
          }),
          0,
        );
        assert.equal(
          (await detail(booking)).booking.items[0].useStatus,
          'in_use',
        );
      },
    );
    await t.test(
      'shop_delivery_delay_shifts_schedule_without_changing_initial_price',
      async () => {
        const booking = await paid('60000', 'full', 50000n, true);
        setTime(11);
        await assert.rejects(
          operations.handover(
            contexts[2],
            booking.id,
            handoverInput(false, at(11)),
            randomUUID(),
          ),
          /alasan/,
        );
        await operations.handover(
          contexts[2],
          booking.id,
          handoverInput(true, at(11)),
          randomUUID(),
        );
        const result = await detail(booking),
          item = result.booking.items[0];
        assert.equal(formatWibDateTime(item.startAt), at(11));
        assert.equal(formatWibDateTime(item.currentEndAt), at(17));
        assert.equal(formatWibDateTime(item.initialEndAt), at(16));
        assert.equal(result.summary.bill, 60000n);
        assert.equal(result.booking.shopDelaySeconds, 3600);
        const allocation = await prisma.unitAllocation.findFirstOrThrow({
          where: { bookingItemId: item.id, state: 'active' },
        });
        assert.equal(allocation.endAt.getTime(), item.currentEndAt.getTime());
      },
    );
    await t.test(
      'delivery_shift_cannot_take_a_future_confirmed_unit',
      async () => {
        const booking = await make('full', at(8), 50000n, 0, true);
        const initialProof = await upload(booking);
        await payments.verify(
          contexts[2],
          booking.id,
          receipt(initialProof.proofId!, '60000'),
          randomUUID(),
        );
        const other = await bookings.create(
          contexts[1],
          {
            startAt: at(16),
            durationHours: 6,
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
        const proof = await upload(other, 1);
        await payments.verify(
          contexts[2],
          other.id,
          receipt(proof.proofId!, '50000'),
          randomUUID(),
        );
        setTime(11);
        await assert.rejects(
          operations.handover(
            contexts[2],
            booking.id,
            handoverInput(true, at(11)),
            randomUUID(),
          ),
          /bertabrakan/,
        );
        assert.equal((await detail(booking)).booking.status, 'dikonfirmasi');
        assert.equal((await detail(booking)).summary.applied, 60000n);
      },
    );
    await t.test(
      'return_cancels_whole_pending_extension_and_refunds_actual_extra_money',
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
        const extension = await prisma.extension.create({
          data: {
            bookingId: booking.id,
            status: 'menunggu_konfirmasi',
            rentalQuoteTotal: 100000n,
            amountDue: 100000n,
            submittedAt: now,
            expiresAt: new Date(now.getTime() + 1800000),
            uploadedAt: now,
            confirmationDueAt: new Date(now.getTime() + 3600000),
          },
        });
        for (const item of booking.items) {
          const extended = await prisma.extensionItem.create({
            data: {
              extensionId: extension.id,
              bookingId: booking.id,
              bookingItemId: item.id,
              oldEndAt: item.currentEndAt,
              proposedEndAt: new Date(item.currentEndAt.getTime() + 21600000),
              addedHours: 6,
              expectedItemVersion: 1,
              unitPriceSnapshot: 50000n,
            },
          });
          await prisma.unitAllocation.create({
            data: {
              bookingItemId: item.id,
              itemUnitId: item.itemUnitId,
              extensionItemId: extended.id,
              allocationKind: 'extension_hold',
              startAt: extended.oldEndAt,
              endAt: extended.proposedEndAt,
              blockStartAt: new Date(extended.oldEndAt.getTime() - 3600000),
              blockEndAt: new Date(extended.proposedEndAt.getTime() + 3600000),
            },
          });
        }
        const obligation = await prisma.paymentObligation.create({
          data: {
            bookingId: booking.id,
            extensionId: extension.id,
            purpose: 'extension',
            amountDue: 100000n,
          },
        });
        const incoming = await prisma.payment.create({
          data: {
            bookingId: booking.id,
            extensionId: extension.id,
            paymentObligationId: obligation.id,
            direction: 'in',
            type: 'extension',
            method: 'cash',
            amount: 120000n,
            occurredAt: now,
            recordedBy: users[2].id,
            recordedAt: now,
            note: 'Dana tambahan sudah diterima.',
            sourceKey: randomUUID(),
          },
        });
        await prisma.paymentApplication.create({
          data: {
            bookingId: booking.id,
            paymentObligationId: obligation.id,
            incomingPaymentId: incoming.id,
            amount: 100000n,
            state: 'reserved',
          },
        });
        setTime(16);
        await operations.verifyReturn(
          contexts[2],
          booking.id,
          booking.items[0].id,
          returnInput(),
          randomUUID(),
        );
        assert.equal(
          (
            await prisma.extension.findUniqueOrThrow({
              where: { id: extension.id },
            })
          ).status,
          'dibatalkan',
        );
        assert.equal(
          await prisma.unitAllocation.count({
            where: {
              extensionItem: { extensionId: extension.id },
              state: 'active',
            },
          }),
          0,
        );
        const result = await detail(booking);
        assert.equal(result.booking.status, 'berjalan');
        assert.equal(
          result.booking.items.find((item) => item.id === booking.items[1].id)
            ?.useStatus,
          'in_use',
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
        const refund = result.booking.refunds.find(
          (row) => row.extensionId === extension.id,
        )!;
        assert.equal(refund.requestedAmount, 120000n);
        assert.equal(result.summary.remaining, 0n);
        await refunds.recipient(
          contexts[0],
          refund.id,
          {
            bankName: 'BCA',
            accountNumber: '1234567890',
            accountHolder: 'Fixture Pelanggan',
          },
          randomUUID(),
        );
        await refunds.approve(contexts[2], refund.id, randomUUID());
        await refunds.transfer(
          contexts[2],
          refund.id,
          {
            amount: '120000',
            transferredAt: formatWibDateTime(now),
            transactionReference: randomUUID(),
            note: 'Transfer refund telah berhasil.',
          },
          { buffer: pdf, size: pdf.length, mimetype: 'application/pdf' },
          randomUUID(),
        );
        const outgoing = await prisma.payment.findFirstOrThrow({
          where: { refundRequestId: refund.id },
        });
        assert.equal(outgoing.extensionId, extension.id);
        assert.equal((await detail(booking)).summary.netCash, 100000n);
      },
    );
    await t.test(
      'real_handover_and_no_show_cancel_are_serialized',
      async () => {
        const booking = await paid('50000', 'full');
        setTime(13, 0, 1);
        await Promise.allSettled([
          operations.handover(
            contexts[2],
            booking.id,
            handoverInput(false, at(13)),
            randomUUID(),
          ),
          noShow.processDue(),
        ]);
        const result = await detail(booking);
        assert.ok(['berjalan', 'dibatalkan'].includes(result.booking.status));
        assert.equal(
          result.booking.items[0].useStatus,
          result.booking.status === 'berjalan' ? 'in_use' : 'allocated',
        );
        const allocations = await prisma.unitAllocation.findMany({
          where: { bookingItemId: result.booking.items[0].id },
        });
        assert.ok(allocations.length > 0);
        assert.ok(
          allocations.every(
            (row) =>
              row.state ===
              (result.booking.status === 'berjalan' ? 'active' : 'released'),
          ),
        );
        if (result.booking.status === 'dibatalkan')
          assert.equal(result.booking.items[0].pickedUpAt, null);
      },
    );
    await t.test(
      'http_routes_enforce_admin_customer_csrf_and_dto_rules',
      async () => {
        const booking = await paid('50000', 'full');
        setTime(10);
        const endpoint =
          base + '/api/admin/bookings/' + booking.id + '/handover';
        assert.equal(
          (
            await fetch(endpoint, {
              method: 'POST',
              headers: headers(0, randomUUID()),
              body: JSON.stringify(handoverInput()),
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await fetch(endpoint, {
              method: 'POST',
              headers: { ...headers(2, randomUUID()), 'X-CSRF-Token': 'wrong' },
              body: JSON.stringify(handoverInput()),
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await fetch(endpoint, {
              method: 'POST',
              headers: headers(2, randomUUID()),
              body: JSON.stringify({
                ...handoverInput(),
                pickedUpAt: 'yesterday',
              }),
            })
          ).status,
          400,
        );
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: headers(2, randomUUID()),
          body: JSON.stringify(handoverInput()),
        });
        assert.equal(response.status, 201, await response.clone().text());
        const returned = await fetch(
          base +
            '/api/bookings/' +
            booking.id +
            '/items/' +
            booking.items[0].id +
            '/return-report',
          { method: 'POST', headers: headers(0, randomUUID()), body: '{}' },
        );
        assert.equal(returned.status, 201, await returned.clone().text());
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
