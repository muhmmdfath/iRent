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
import { ExtensionsService } from '../../src/modules/extensions/extensions.service';
import { OperationsService } from '../../src/modules/operations/operations.service';
import { ProofStorageService } from '../../src/modules/payments/proof-storage.service';
import { PaymentLedgerService } from '../../src/modules/payments/payment-ledger.service';
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

test('extensions_preserve_scoped_money_calendar_deadlines_and_return_races', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'irent-extension-proofs-'));
  const cleanupTarget = resolve(directory);
  if (
    dirname(cleanupTarget) !== resolve(tmpdir()) ||
    !basename(cleanupTarget).startsWith('irent-extension-proofs-')
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

  async function extend(
    booking: TestBooking,
    ids = booking.items.map((row) => row.id),
    hours = 6,
    key = randomUUID(),
  ) {
    const result = await extensions.create(
      contexts[0],
      booking.id,
      {
        items: ids.map((bookingItemId) => ({
          bookingItemId,
          addedHours: hours,
        })),
      },
      key,
    );
    return result.booking.extensions.find((row) => row.id === result.decision)!;
  }
  async function uploadExtension(
    booking: TestBooking,
    id: string,
    key = randomUUID(),
  ) {
    return extensions.upload(
      contexts[0],
      booking.id,
      id,
      { claimedAmount: '50000' },
      { buffer: pdf, size: pdf.length, mimetype: 'application/pdf' },
      key,
    );
  }
  async function verifyExtension(
    booking: TestBooking,
    id: string,
    proofId: string,
    amount = '50000',
    actor = 2,
    key = randomUUID(),
    occurredAt = formatWibDateTime(now),
  ) {
    return extensions.verify(
      contexts[actor],
      booking.id,
      id,
      { ...receipt(proofId, amount, proofId), occurredAt },
      key,
    );
  }
  async function runMulti(delivery = false) {
    const booking = await make('full', at(10), 50000n, 0, delivery, 2),
      proof = await upload(booking);
    await payments.verify(
      contexts[2],
      booking.id,
      receipt(proof.proofId!, delivery ? '110000' : '100000'),
      randomUUID(),
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
  async function futureBooking(booking: TestBooking, startAt = at(16)) {
    return bookings.create(
      contexts[1],
      {
        startAt,
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
  }
  async function startEarly() {
    const booking = await make('full', at(8)),
      proof = await upload(booking);
    await payments.verify(
      contexts[2],
      booking.id,
      receipt(proof.proofId!, '50000'),
      randomUUID(),
    );
    setTime(8);
    await operations.handover(
      contexts[2],
      booking.id,
      handoverInput(false, at(8)),
      randomUUID(),
    );
    setTime(10);
    return booking;
  }
  try {
    await t.test(
      'approval_applies_snapshot_price_and_merges_hold_without_changing_initial_balance',
      async () => {
        const booking = await running();
        await prisma.item.update({
          where: { id: booking.items[0].itemId },
          data: { price6h: 999999n },
        });
        const proposal = await extend(booking);
        assert.equal(proposal.amountDue, 50000n);
        assert.equal(formatWibDateTime(proposal.expiresAt!), at(10, 30));
        const proof = await uploadExtension(booking, proposal.id);
        assert.equal(
          formatWibDateTime(
            (await extensions.detail(contexts[0], booking.id, proposal.id))
              .extension.confirmationDueAt!,
          ),
          at(11),
        );
        const key = randomUUID();
        await Promise.all([
          verifyExtension(
            booking,
            proposal.id,
            proof.proofId!,
            '55000',
            2,
            key,
          ),
          verifyExtension(
            booking,
            proposal.id,
            proof.proofId!,
            '55000',
            2,
            key,
          ),
        ]);
        const result = await extensions.detail(
          contexts[0],
          booking.id,
          proposal.id,
        );
        assert.equal(result.extension.status, 'disetujui');
        assert.equal(result.summary.applied, 50000n);
        assert.equal(result.summary.refundRequested, 5000n);
        const initial = await detail(booking);
        assert.equal(initial.summary.bill, 50000n);
        assert.equal(initial.summary.applied, 50000n);
        assert.equal(
          formatWibDateTime(initial.booking.items[0].currentEndAt),
          at(22),
        );
        assert.equal(
          formatWibDateTime(initial.booking.items[0].initialEndAt),
          at(16),
        );
        assert.equal(initial.booking.status, 'berjalan');
        assert.equal(
          await prisma.unitAllocation.count({
            where: {
              extensionItem: { extensionId: proposal.id },
              state: 'active',
            },
          }),
          0,
        );
        assert.equal(
          await prisma.bookingCharge.count({
            where: { extensionId: proposal.id },
          }),
          1,
        );
      },
    );
    await t.test(
      'concurrent_proposals_and_normalized_retries_cannot_hold_a_unit_twice',
      async () => {
        const booking = await running(),
          key = randomUUID();
        const result = await Promise.all([
          extend(booking, undefined, 6, key),
          extend(booking, undefined, 6, key),
        ]);
        assert.equal(result[0].id, result[1].id);
        await assert.rejects(extend(booking), /pengajuan aktif/);
        await assert.rejects(
          extend(booking, undefined, 24, key),
          /payload berbeda/,
        );
        assert.equal(
          await prisma.extension.count({ where: { bookingId: booking.id } }),
          1,
        );
      },
    );
    await t.test(
      'submission_enforces_two_hour_boundary_operating_hours_and_seven_day_limit',
      async () => {
        const booking = await running();
        setTime(14, 0, 1);
        await assert.rejects(extend(booking), /dua jam/);
        setTime(14);
        const proposal = await extend(booking);
        await extensions.cancel(
          contexts[0],
          booking.id,
          proposal.id,
          'Pelanggan membatalkan pengajuan.',
          randomUUID(),
        );
        setTime(12);
        await assert.rejects(extend(booking, undefined, 12), /operasional/);
        await assert.rejects(extend(booking, undefined, 18), /6\/12\/24/);
        await prisma.bookingItem.update({
          where: { id: booking.items[0].id },
          data: {
            currentEndAt: new Date(
              booking.items[0].startAt.getTime() + 168 * 3600000,
            ),
          },
        });
        await assert.rejects(extend(booking, undefined, 24), /tujuh hari/);
      },
    );
    await t.test(
      'future_booking_and_extension_compete_for_the_same_calendar_atomically',
      async () => {
        const booking = await startEarly();
        const results = await Promise.allSettled([
          extend(booking),
          futureBooking(booking),
        ]);
        assert.equal(
          results.filter((row) => row.status === 'fulfilled').length,
          1,
        );
        if (results[0].status === 'fulfilled') {
          const extension = results[0].value;
          setTime(10, 30, 1);
          await futureBooking(booking);
          await extensions.expireDue();
          assert.equal(
            (await extensions.detail(contexts[0], booking.id, extension.id))
              .extension.status,
            'kedaluwarsa',
          );
        }
        assert.equal(
          formatWibDateTime(
            (await detail(booking)).booking.items[0].currentEndAt,
          ),
          at(14),
        );
      },
    );
    await t.test(
      'timely_upload_keeps_hold_after_payment_and_confirmation_deadlines',
      async () => {
        const booking = await startEarly(),
          proposal = await extend(booking);
        setTime(10, 30);
        const proof = await uploadExtension(booking, proposal.id);
        setTime(12);
        await extensions.expireDue();
        const result = await extensions.detail(
          contexts[0],
          booking.id,
          proposal.id,
        );
        assert.equal(result.extension.status, 'menunggu_konfirmasi');
        assert.equal(result.confirmationOverdue, true);
        await assert.rejects(
          futureBooking(booking),
          /tersedia|stok|unit|dipesan/i,
        );
        await verifyExtension(
          booking,
          proposal.id,
          proof.proofId!,
          '50000',
          2,
          randomUUID(),
          at(10, 20),
        );
        assert.equal(
          (await extensions.detail(contexts[0], booking.id, proposal.id))
            .extension.status,
          'disetujui',
        );
      },
    );
    await t.test(
      'partial_payment_keeps_original_deadline_and_can_be_completed_without_double_receipt',
      async () => {
        const booking = await running(),
          proposal = await extend(booking),
          first = await uploadExtension(booking, proposal.id);
        await verifyExtension(booking, proposal.id, first.proofId!, '20000');
        assert.equal(
          (await extensions.detail(contexts[0], booking.id, proposal.id))
            .extension.status,
          'menunggu_pembayaran',
        );
        setTime(10, 25);
        const second = await uploadExtension(booking, proposal.id);
        await verifyExtension(booking, proposal.id, second.proofId!, '30000');
        assert.equal(
          (await extensions.detail(contexts[0], booking.id, proposal.id))
            .summary.applied,
          50000n,
        );
        assert.equal(
          formatWibDateTime(
            (await extensions.detail(contexts[0], booking.id, proposal.id))
              .extension.expiresAt!,
          ),
          at(10, 30),
        );
      },
    );
    await t.test(
      'underpayment_after_deadline_refunds_all_received_money_and_keeps_old_rental',
      async () => {
        const booking = await running(),
          proposal = await extend(booking),
          proof = await uploadExtension(booking, proposal.id);
        setTime(11);
        await verifyExtension(
          booking,
          proposal.id,
          proof.proofId!,
          '20000',
          2,
          randomUUID(),
          at(10),
        );
        const result = await extensions.detail(
          contexts[0],
          booking.id,
          proposal.id,
        );
        assert.equal(result.extension.status, 'kedaluwarsa');
        assert.equal(result.summary.refundRequested, 20000n);
        assert.equal(result.summary.remaining, 0n);
        assert.equal(
          formatWibDateTime(
            (await detail(booking)).booking.items[0].currentEndAt,
          ),
          at(16),
        );
      },
    );
    await t.test(
      'rejecting_a_proof_allows_retry_only_until_original_expiry',
      async () => {
        const booking = await running(),
          proposal = await extend(booking),
          first = await uploadExtension(booking, proposal.id);
        await extensions.reject(
          contexts[2],
          booking.id,
          proposal.id,
          'Transaksi belum masuk rekening.',
          randomUUID(),
          first.proofId!,
        );
        setTime(10, 30);
        const second = await uploadExtension(booking, proposal.id);
        setTime(10, 30, 1);
        await extensions.reject(
          contexts[2],
          booking.id,
          proposal.id,
          'Transaksi belum masuk rekening.',
          randomUUID(),
          second.proofId!,
        );
        assert.equal(
          (await extensions.detail(contexts[0], booking.id, proposal.id))
            .extension.status,
          'kedaluwarsa',
        );
        await assert.rejects(
          uploadExtension(booking, proposal.id),
          /deadline|tidak menerima/,
        );
      },
    );
    await t.test(
      'partial_delivery_requires_admin_quote_and_explicit_latest_price_consent',
      async () => {
        const booking = await runMulti(true),
          proposal = await extend(booking, [booking.items[0].id]);
        assert.equal(proposal.status, 'draft_quote');
        assert.equal(proposal.expiresAt, null);
        assert.equal(
          await prisma.unitAllocation.count({
            where: { extensionItem: { extensionId: proposal.id } },
          }),
          0,
        );
        await assert.rejects(
          extensions.submit(
            contexts[0],
            booking.id,
            proposal.id,
            { agreeExtraDelivery: true, expectedExtraDeliveryQuote: '0' },
            randomUUID(),
          ),
          /quotation/,
        );
        await extensions.quote(
          contexts[2],
          booking.id,
          proposal.id,
          {
            extraDeliveryQuote: '10000',
            note: 'Penjemputan terpisah satu kali tambahan.',
          },
          randomUUID(),
        );
        await assert.rejects(
          extensions.submit(
            contexts[0],
            booking.id,
            proposal.id,
            { agreeExtraDelivery: true, expectedExtraDeliveryQuote: '0' },
            randomUUID(),
          ),
          /quotation/,
        );
        await assert.rejects(
          extensions.submit(
            contexts[0],
            booking.id,
            proposal.id,
            { agreeExtraDelivery: false, expectedExtraDeliveryQuote: '10000' },
            randomUUID(),
          ),
          /quotation/,
        );
        await extensions.submit(
          contexts[0],
          booking.id,
          proposal.id,
          { agreeExtraDelivery: true, expectedExtraDeliveryQuote: '10000' },
          randomUUID(),
        );
        const proof = await uploadExtension(booking, proposal.id);
        await verifyExtension(booking, proposal.id, proof.proofId!, '60000');
        const result = await detail(booking);
        assert.equal(
          formatWibDateTime(
            result.booking.items.find((row) => row.id === booking.items[0].id)!
              .currentEndAt,
          ),
          at(22),
        );
        assert.equal(
          formatWibDateTime(
            result.booking.items.find((row) => row.id === booking.items[1].id)!
              .currentEndAt,
          ),
          at(16),
        );
        assert.equal(
          (await extensions.detail(contexts[0], booking.id, proposal.id))
            .summary.bill,
          60000n,
        );
      },
    );
    await t.test(
      'draft_quote_does_not_hold_stock_or_extend_submission_cutoff',
      async () => {
        const booking = await runMulti(true),
          proposal = await extend(booking, [booking.items[0].id]);
        await extensions.quote(
          contexts[2],
          booking.id,
          proposal.id,
          {
            extraDeliveryQuote: '10000',
            note: 'Penjemputan terpisah satu kali tambahan.',
          },
          randomUUID(),
        );
        setTime(14, 0, 1);
        await assert.rejects(
          extensions.submit(
            contexts[0],
            booking.id,
            proposal.id,
            { agreeExtraDelivery: true, expectedExtraDeliveryQuote: '10000' },
            randomUUID(),
          ),
          /tidak lagi tersedia/,
        );
        assert.equal(
          (await extensions.detail(contexts[0], booking.id, proposal.id))
            .extension.status,
          'draft_quote',
        );
        assert.equal(
          await prisma.paymentObligation.count({
            where: { extensionId: proposal.id },
          }),
          0,
        );
      },
    );
    await t.test(
      'multi_unit_approval_failure_keeps_receipt_but_rolls_back_all_schedules',
      async () => {
        const booking = await runMulti(),
          proposal = await extend(booking),
          proof = await uploadExtension(booking, proposal.id);
        await prisma.bookingItem.update({
          where: { id: booking.items[1].id },
          data: { version: { increment: 1 } },
        });
        await verifyExtension(booking, proposal.id, proof.proofId!, '100000');
        const result = await extensions.detail(
          contexts[0],
          booking.id,
          proposal.id,
        );
        assert.equal(result.extension.status, 'ditolak');
        assert.equal(result.summary.refundRequested, 100000n);
        assert.equal(result.summary.bill, 0n);
        assert.ok(
          (await detail(booking)).booking.items.every(
            (row) => formatWibDateTime(row.currentEndAt) === at(16),
          ),
        );
      },
    );
    await t.test(
      'return_and_approval_serialize_the_whole_multi_unit_proposal',
      async () => {
        const booking = await runMulti(),
          proposal = await extend(booking),
          proof = await uploadExtension(booking, proposal.id);
        setTime(16);
        const results = await Promise.allSettled([
          verifyExtension(
            booking,
            proposal.id,
            proof.proofId!,
            '100000',
            2,
            randomUUID(),
            at(10),
          ),
          operations.verifyReturn(
            contexts[3],
            booking.id,
            booking.items[0].id,
            returnInput(),
            randomUUID(),
          ),
        ]);
        assert.ok(results.some((result) => result.status === 'fulfilled'));
        const result = await extensions.detail(
          contexts[0],
          booking.id,
          proposal.id,
        );
        assert.ok(
          ['disetujui', 'dibatalkan'].includes(result.extension.status),
        );
        assert.equal(
          await prisma.unitAllocation.count({
            where: {
              extensionItem: { extensionId: proposal.id },
              state: 'active',
            },
          }),
          0,
        );
        if (result.extension.status === 'dibatalkan') {
          await extensions.reconcile(
            contexts[2],
            booking.id,
            proposal.id,
            {
              ...receipt(proof.proofId!, '100000'),
              occurredAt: at(10),
              obligationId: (await detail(booking)).booking.obligations.find(
                (row) => row.extensionId === proposal.id,
              )!.id,
              proofId: proof.proofId!,
            },
            randomUUID(),
          );
          assert.equal(
            (await extensions.detail(contexts[0], booking.id, proposal.id))
              .summary.refundRequested,
            100000n,
          );
        }
      },
    );
    await t.test(
      'approval_after_old_end_is_allowed_for_a_timely_paid_proposal',
      async () => {
        const booking = await running(),
          proposal = await extend(booking),
          proof = await uploadExtension(booking, proposal.id);
        setTime(18);
        await verifyExtension(
          booking,
          proposal.id,
          proof.proofId!,
          '50000',
          2,
          randomUUID(),
          at(10),
        );
        assert.equal(
          (await extensions.detail(contexts[0], booking.id, proposal.id))
            .extension.status,
          'disetujui',
        );
        assert.equal(
          formatWibDateTime(
            (await detail(booking)).booking.items[0].currentEndAt,
          ),
          at(22),
        );
      },
    );
    await t.test(
      'late_review_reconciliation_corrects_paid_return_fees_and_requests_manual_refund',
      async () => {
        const booking = await running(),
          proposal = await extend(booking),
          proof = await uploadExtension(booking, proposal.id);
        setTime(18);
        await operations.verifyReturn(
          contexts[2],
          booking.id,
          booking.items[0].id,
          returnInput(at(18)),
          randomUUID(),
        );
        assert.equal((await detail(booking)).summary.remaining, 10000n);
        await payments.recordSettlement(
          contexts[2],
          booking.id,
          {
            amount: '10000',
            occurredAt: at(18),
            method: 'cash',
            note: 'Denda sudah diterima tunai oleh admin.',
          },
          randomUUID(),
        );
        setTime(20);
        const obligation = (await detail(booking)).booking.obligations.find(
          (row) => row.extensionId === proposal.id,
        )!;
        const key = randomUUID();
        const input = {
          ...receipt(proof.proofId!, '50000'),
          occurredAt: at(10),
          obligationId: obligation.id,
          proofId: proof.proofId!,
        };
        await extensions.reconcile(
          contexts[2],
          booking.id,
          proposal.id,
          input,
          key,
        );
        await extensions.reconcile(
          contexts[2],
          booking.id,
          proposal.id,
          input,
          key,
        );
        const result = await detail(booking);
        assert.equal(result.summary.bill, 50000n);
        assert.equal(result.summary.refundRequested, 10000n);
        const refund = result.booking.refunds.find(
          (row) => row.reasonCode === 'admin_delay_correction',
        )!;
        assert.equal(refund.requestedAmount, 10000n);
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
            amount: '10000',
            transferredAt: at(20),
            transactionReference: randomUUID(),
            note: 'Denda akibat admin sudah dikembalikan.',
          },
          { buffer: pdf, size: pdf.length, mimetype: 'application/pdf' },
          randomUUID(),
        );
        assert.equal((await detail(booking)).summary.applied, 50000n);
        assert.equal(
          (await extensions.detail(contexts[0], booking.id, proposal.id))
            .summary.refundRequested,
          50000n,
        );
      },
    );
    await t.test(
      'expiry_workers_close_once_and_isolate_failed_proposals',
      async () => {
        const first = await running(),
          a = await extend(first);
        now = initialNow;
        const second = await running(),
          b = await extend(second);
        setTime(10, 30);
        await extensions.expireDue();
        assert.equal(
          (await extensions.detail(contexts[0], first.id, a.id)).extension
            .status,
          'menunggu_pembayaran',
        );
        setTime(10, 30, 1);
        const originalClose = extensions.close.bind(extensions);
        extensions.close = async (tx, proposal, status, reason, actor) => {
          if (proposal.id === a.id)
            throw new Error('Simulated proposal failure');
          return originalClose(tx, proposal, status, reason, actor);
        };
        try {
          assert.equal((await extensions.expireDue()).failed, 1);
          assert.equal(
            (await extensions.detail(contexts[0], first.id, a.id)).extension
              .status,
            'menunggu_pembayaran',
          );
          assert.equal(
            (await extensions.detail(contexts[0], second.id, b.id)).extension
              .status,
            'kedaluwarsa',
          );
        } finally {
          extensions.close = originalClose;
        }
        await Promise.all([extensions.expireDue(), extensions.expireDue()]);
        assert.equal(
          (await extensions.detail(contexts[0], first.id, a.id)).extension
            .status,
          'kedaluwarsa',
        );
        assert.equal(
          (await extensions.detail(contexts[0], second.id, b.id)).extension
            .status,
          'kedaluwarsa',
        );
        assert.equal(
          await prisma.auditLog.count({
            where: { entityId: a.id, action: 'extension.closed' },
          }),
          1,
        );
      },
    );
    await t.test(
      'submission_recording_after_cutoff_rolls_back_proposal_hold_and_idempotency',
      async () => {
        const booking = await running(),
          ledger = app.get(PaymentLedgerService),
          original = ledger.summary.bind(ledger);
        ledger.summary = async (tx, id, scope) => {
          const result = await original(tx, id, scope);
          if (id === booking.id) setTime(14, 0, 1);
          return result;
        };
        try {
          await assert.rejects(extend(booking), /batas dua jam/);
        } finally {
          ledger.summary = original;
        }
        assert.equal(
          await prisma.extension.count({ where: { bookingId: booking.id } }),
          0,
        );
        assert.equal(
          await prisma.unitAllocation.count({
            where: {
              bookingItem: { bookingId: booking.id },
              allocationKind: 'extension_hold',
            },
          }),
          0,
        );
      },
    );
    await t.test(
      'confirmation_reminders_and_urgent_alerts_are_deduplicated_at_boundaries',
      async () => {
        const booking = await running(),
          proposal = await extend(booking);
        await uploadExtension(booking, proposal.id);
        setTime(10, 29, 59);
        await extensions.alertDue();
        assert.equal(
          await prisma.outboxEvent.count({
            where: {
              eventKey: {
                startsWith: 'extension.confirmation_reminder:' + proposal.id,
              },
            },
          }),
          0,
        );
        setTime(10, 30);
        await Promise.all([extensions.alertDue(), extensions.alertDue()]);
        assert.equal(
          await prisma.outboxEvent.count({
            where: {
              eventKey: {
                startsWith: 'extension.confirmation_reminder:' + proposal.id,
              },
            },
          }),
          1,
        );
        setTime(11);
        await extensions.alertDue();
        assert.equal(
          await prisma.outboxEvent.count({
            where: {
              eventKey: {
                startsWith: 'extension.confirmation_overdue:' + proposal.id,
              },
            },
          }),
          0,
        );
        setTime(11, 0, 1);
        await Promise.all([extensions.alertDue(), extensions.alertDue()]);
        assert.equal(
          await prisma.outboxEvent.count({
            where: {
              eventKey: {
                startsWith: 'extension.confirmation_overdue:' + proposal.id,
              },
            },
          }),
          1,
        );
        assert.equal(
          (await extensions.detail(contexts[0], booking.id, proposal.id))
            .extension.status,
          'menunggu_konfirmasi',
        );
      },
    );
    await t.test(
      'upload_finishing_private_storage_after_expiry_does_not_create_a_proof',
      async () => {
        const booking = await running(),
          proposal = await extend(booking),
          storage = app.get(ProofStorageService);
        const original = storage.save.bind(storage);
        storage.save = async (file) => {
          const saved = await original(file);
          setTime(10, 30, 1);
          return saved;
        };
        try {
          await assert.rejects(
            uploadExtension(booking, proposal.id),
            /deadline/,
          );
        } finally {
          storage.save = original;
        }
        assert.equal(
          await prisma.paymentProof.count({
            where: { obligation: { extensionId: proposal.id } },
          }),
          0,
        );
      },
    );
    await t.test(
      'free_extension_requires_admin_approval_and_never_fabricates_a_receipt',
      async () => {
        const booking = await make('full', at(10), 0n);
        await payments.approve(contexts[2], booking.id, randomUUID());
        setTime(10);
        await operations.handover(
          contexts[2],
          booking.id,
          handoverInput(),
          randomUUID(),
        );
        const proposal = await extend(booking);
        await extensions.approve(
          contexts[2],
          booking.id,
          proposal.id,
          randomUUID(),
        );
        assert.equal(
          (await extensions.detail(contexts[0], booking.id, proposal.id))
            .extension.status,
          'disetujui',
        );
        assert.equal(
          await prisma.payment.count({ where: { extensionId: proposal.id } }),
          0,
        );
      },
    );
    await t.test(
      'http_validates_roles_csrf_duplicate_units_and_private_proofs',
      async () => {
        const booking = await running(),
          endpoint = base + '/api/bookings/' + booking.id + '/extensions';
        const input = {
          items: [{ bookingItemId: booking.items[0].id, addedHours: 6 }],
        };
        assert.equal(
          (
            await fetch(endpoint, {
              method: 'POST',
              headers: headers(2, randomUUID()),
              body: JSON.stringify(input),
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await fetch(endpoint, {
              method: 'POST',
              headers: { ...headers(0, randomUUID()), 'X-CSRF-Token': 'wrong' },
              body: JSON.stringify(input),
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await fetch(endpoint, {
              method: 'POST',
              headers: headers(0, randomUUID()),
              body: JSON.stringify({ items: [...input.items, ...input.items] }),
            })
          ).status,
          400,
        );
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: headers(0, randomUUID()),
          body: JSON.stringify(input),
        });
        assert.equal(response.status, 201, await response.clone().text());
        const result = (await response.json()) as { decision: string };
        assert.equal(
          (
            await fetch(endpoint + '/' + result.decision, {
              headers: headers(1),
            })
          ).status,
          404,
        );
        const form = new FormData();
        form.append('claimedAmount', '50000');
        form.append(
          'file',
          new Blob([pdf], { type: 'application/pdf' }),
          'proof.pdf',
        );
        const uploaded = await fetch(
          endpoint + '/' + result.decision + '/proofs',
          {
            method: 'POST',
            headers: headers(0, randomUUID(), false),
            body: form,
          },
        );
        assert.equal(uploaded.status, 201, await uploaded.clone().text());
        const value = (await uploaded.json()) as { proofId: string };
        assert.equal(
          (
            await fetch(
              base + '/api/payment-proofs/' + value.proofId + '/file',
              { headers: headers(1) },
            )
          ).status,
          404,
        );
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
      const extensionRows = await tx.extension.findMany({
        where: { bookingId: { in: ids } },
        select: { id: true },
      });
      await tx.auditLog.deleteMany({
        where: { entityId: { in: extensionRows.map((row) => row.id) } },
      });
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
