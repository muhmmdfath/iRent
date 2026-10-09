import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
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
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { PaymentLedgerService } from '../../src/modules/payments/payment-ledger.service';
import { ProofStorageService } from '../../src/modules/payments/proof-storage.service';
import { BusinessClock } from '../../src/shared/time/business-clock';
import { formatWibDateTime, wibNow } from '../../src/shared/time/wib';
import { setupApp } from '../../src/setup-app';
import { testSecrets } from '../config.fixture';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL wajib diisi.');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
type TestBooking = Awaited<ReturnType<BookingsService['create']>>;

test('private_proofs_receipts_approval_and_expiry_keep_stock_and_money_consistent', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'irent-payment-proofs-'));
  const cleanupTarget = resolve(directory);
  if (
    dirname(cleanupTarget) !== resolve(tmpdir()) ||
    !basename(cleanupTarget).startsWith('irent-payment-proofs-')
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
    ledger = app.get(PaymentLedgerService),
    storage = app.get(ProofStorageService),
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
  ) {
    const item = await prisma.item.create({
      data: {
        name: 'Payment fixture ' + randomUUID(),
        category: 'accessory',
        includes: [],
        price6h: amount,
        price12h: amount,
        price24h: amount,
        units: { create: { code: 'TEST-' + randomUUID() } },
      },
      include: { units: true },
    });
    itemIds.push(item.id);
    return bookings.create(
      contexts[actor],
      {
        startAt,
        durationHours: 6,
        items: [{ itemId: item.id, quantity: 1 }],
        deliveryType: 'pickup',
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
  async function formUpload(
    booking: TestBooking,
    actor = 0,
    key = randomUUID(),
    data = pdf,
    mime = 'application/pdf',
  ) {
    const form = new FormData();
    form.append('claimedAmount', '20000');
    form.append(
      'file',
      new Blob([Uint8Array.from(data)], { type: mime }),
      '../../unsafe.pdf',
    );
    return fetch(
      base +
        '/api/bookings/' +
        booking.id +
        '/obligations/' +
        booking.obligations[0].id +
        '/proofs',
      { method: 'POST', headers: headers(actor, key, false), body: form },
    );
  }
  try {
    await t.test(
      'multipart_upload_requires_owner_csrf_and_private_download_authorization',
      async () => {
        const booking = await make();
        assert.equal((await formUpload(booking, 1)).status, 404);
        assert.equal((await formUpload(booking, 2)).status, 403);
        const response = await formUpload(booking);
        assert.equal(response.status, 201, await response.clone().text());
        const result = (await response.json()) as {
          proofId: string;
          booking: { status: string };
        };
        assert.equal(result.booking.status, 'menunggu_konfirmasi');
        assert.equal(
          await prisma.payment.count({ where: { bookingId: booking.id } }),
          0,
        );
        const stored = await prisma.paymentProof.findUniqueOrThrow({
          where: { id: result.proofId },
        });
        assert.match(stored.proofPath, /^[0-9a-f-]{36}\.pdf$/);
        assert.equal(
          (
            await fetch(
              base + '/api/payment-proofs/' + result.proofId + '/file',
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await fetch(
              base + '/api/payment-proofs/' + result.proofId + '/file',
              { headers: headers(1) },
            )
          ).status,
          404,
        );
        for (const actor of [0, 2]) {
          const file = await fetch(
            base + '/api/payment-proofs/' + result.proofId + '/file',
            { headers: headers(actor) },
          );
          assert.equal(file.status, 200);
          assert.equal(file.headers.get('content-type'), 'application/pdf');
          assert.equal(file.headers.get('cache-control'), 'no-store');
          assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
          assert.match(
            file.headers.get('content-disposition')!,
            /^attachment;/,
          );
          assert.deepEqual(Buffer.from(await file.arrayBuffer()), pdf);
        }
        const view = await fetch(
          base + '/api/bookings/' + booking.id + '/payments',
          { headers: headers(0) },
        );
        assert.equal(view.status, 200);
        assert.ok(!(await view.text()).includes(stored.proofPath));
        const form = new FormData();
        form.append('claimedAmount', '20000');
        form.append(
          'file',
          new Blob([Uint8Array.from(pdf)], { type: 'application/pdf' }),
          'proof.pdf',
        );
        const missingCsrf = headers(0, randomUUID(), false);
        delete (missingCsrf as Partial<Record<string, string>>)['X-CSRF-Token'];
        assert.equal(
          (
            await fetch(
              base +
                '/api/bookings/' +
                booking.id +
                '/obligations/' +
                booking.obligations[0].id +
                '/proofs',
              { method: 'POST', headers: missingCsrf, body: form },
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      'file_validation_rejects_spoofed_mime_oversize_and_empty_files',
      async () => {
        const booking = await make();
        assert.equal(
          (await formUpload(booking, 0, randomUUID(), Buffer.from('not a pdf')))
            .status,
          400,
        );
        assert.equal(
          (await formUpload(booking, 0, randomUUID(), pdf, 'image/jpeg'))
            .status,
          400,
        );
        assert.equal(
          (await formUpload(booking, 0, randomUUID(), Buffer.alloc(2097153)))
            .status,
          413,
        );
        assert.equal(
          (await formUpload(booking, 0, randomUUID(), Buffer.alloc(0))).status,
          400,
        );
        assert.equal(
          await prisma.paymentProof.count({
            where: { paymentObligationId: booking.obligations[0].id },
          }),
          0,
        );
      },
    );
    await t.test(
      'concurrent_upload_retries_keep_one_pending_proof_and_one_private_file',
      async () => {
        const booking = await make(),
          key = randomUUID(),
          before = (await readdir(directory)).length;
        const [one, two] = await Promise.all([
          upload(booking, 0, key),
          upload(booking, 0, key),
        ]);
        assert.equal(one.proofId, two.proofId);
        assert.equal((await readdir(directory)).length, before + 1);
        await assert.rejects(upload(booking), { status: 409 });
        assert.equal((await readdir(directory)).length, before + 1);
        await assert.rejects(
          payments.upload(
            contexts[0],
            booking.id,
            booking.obligations[0].id,
            { claimedAmount: '25000' },
            { buffer: pdf, size: pdf.length, mimetype: 'application/pdf' },
            key,
          ),
          { status: 409 },
        );
      },
    );
    await t.test(
      'urgent_upload_at_deadline_is_kept_and_confirmation_is_capped_before_pickup',
      async () => {
        const booking = await make('dp', at(8));
        now = booking.expiresAt;
        const result = await upload(booking);
        assert.equal(
          result.booking.confirmationDueAt!.getTime(),
          booking.initialStartAt.getTime() - 3600000,
        );
        now = new Date(result.booking.confirmationDueAt!.getTime() + 1);
        await payments.expireDue();
        const pending = await payments.detail(contexts[0], booking.id);
        assert.equal(pending.booking.status, 'menunggu_konfirmasi');
        assert.equal(pending.confirmationOverdue, true);
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItem: { bookingId: booking.id }, state: 'active' },
          }),
          1,
        );
        now = initialNow;
      },
    );
    await t.test(
      'late_upload_cannot_steal_a_new_customers_allocation',
      async () => {
        const booking = await make('dp', at(11));
        now = new Date(booking.expiresAt.getTime() + 1);
        const next = await bookings.create(
          contexts[1],
          {
            startAt: at(11),
            durationHours: 6,
            items: [{ itemId: booking.items[0].itemId, quantity: 1 }],
            deliveryType: 'pickup',
            payOption: 'dp',
            termsVersion: TERMS_VERSION,
            agreeTerms: true,
            prepareIdentity: true,
            understandPayment: true,
            agreeOperatingHours: true,
          },
          randomUUID(),
        );
        const files = (await readdir(directory)).length;
        await assert.rejects(upload(booking), { status: 409 });
        assert.equal((await readdir(directory)).length, files);
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItem: { bookingId: next.id }, state: 'active' },
          }),
          1,
        );
        now = initialNow;
      },
    );
    await t.test(
      'upload_finishing_file_storage_after_deadline_is_rejected_and_cleaned',
      async () => {
        const booking = await make(),
          files = (await readdir(directory)).length;
        now = booking.expiresAt;
        const original = storage.save.bind(storage);
        storage.save = async (file) => {
          const saved = await original(file);
          now = new Date(booking.expiresAt.getTime() + 1);
          return saved;
        };
        try {
          await assert.rejects(upload(booking), { status: 409 });
        } finally {
          storage.save = original;
          now = initialNow;
        }
        assert.equal(
          await prisma.paymentProof.count({
            where: { paymentObligationId: booking.obligations[0].id },
          }),
          0,
        );
        assert.equal((await readdir(directory)).length, files);
      },
    );
    await t.test(
      'upload_recording_after_deadline_rolls_back_proof_status_outbox_and_key',
      async () => {
        const booking = await make(),
          files = (await readdir(directory)).length,
          key = randomUUID();
        now = booking.expiresAt;
        const original = ledger.summary.bind(ledger);
        ledger.summary = async (tx, id) => {
          const result = await original(tx, id);
          if (
            id === booking.id &&
            (await tx.paymentProof.count({
              where: { paymentObligationId: booking.obligations[0].id },
            }))
          )
            now = new Date(booking.expiresAt.getTime() + 1);
          return result;
        };
        try {
          await assert.rejects(upload(booking, 0, key), { status: 409 });
        } finally {
          ledger.summary = original;
          now = initialNow;
        }
        assert.equal(
          (await payments.detail(contexts[0], booking.id)).booking.status,
          'menunggu_pembayaran',
        );
        assert.equal(
          await prisma.paymentProof.count({
            where: { paymentObligationId: booking.obligations[0].id },
          }),
          0,
        );
        assert.equal(
          await prisma.outboxEvent.count({
            where: {
              aggregateId: booking.id,
              eventType: 'payment.proof_uploaded',
            },
          }),
          0,
        );
        assert.equal(
          await prisma.idempotencyRequest.count({
            where: { actorId: users[0].id, operation: 'payment.upload', key },
          }),
          0,
        );
        assert.equal((await readdir(directory)).length, files);
      },
    );
    await t.test(
      'two_admins_verifying_the_same_proof_record_money_and_approval_once',
      async () => {
        const booking = await make(),
          proof = await upload(booking),
          input = receipt(proof.proofId!);
        const results = await Promise.allSettled([
          payments.verify(contexts[2], booking.id, input, randomUUID()),
          payments.verify(contexts[3], booking.id, input, randomUUID()),
        ]);
        assert.equal(
          results.filter((result) => result.status === 'fulfilled').length,
          1,
        );
        const result = await payments.detail(contexts[0], booking.id);
        assert.equal(result.booking.status, 'dikonfirmasi');
        assert.equal(result.summary.paymentStatus, 'dp_terverifikasi');
        assert.equal(result.summary.received, 20000n);
        assert.equal(result.summary.applied, 20000n);
        assert.equal(result.summary.remaining, 30000n);
        assert.equal(
          await prisma.payment.count({ where: { bookingId: booking.id } }),
          1,
        );
        assert.equal(
          await prisma.bookingStatusLog.count({
            where: { bookingId: booking.id, toStatus: 'dikonfirmasi' },
          }),
          1,
        );
      },
    );
    await t.test(
      'partial_initial_payment_keeps_original_deadline_and_can_be_completed',
      async () => {
        const booking = await make(),
          proof = await upload(booking);
        const partial = await payments.verify(
          contexts[2],
          booking.id,
          receipt(proof.proofId!, '10000'),
          randomUUID(),
        );
        assert.equal(partial.decision, 'underpaid');
        assert.equal(partial.booking.status, 'menunggu_pembayaran');
        assert.equal(partial.summary.reserved, 10000n);
        assert.equal(partial.summary.applied, 0n);
        assert.equal(partial.booking.obligations[0].creditedAmount, 10000n);
        assert.equal(partial.booking.obligations[0].remainingAmount, 10000n);
        assert.equal(
          partial.booking.expiresAt.getTime(),
          booking.expiresAt.getTime(),
        );
        now = new Date(initialNow.getTime() + 3600000);
        const second = await upload(booking);
        now = new Date(booking.expiresAt.getTime() + 1);
        await payments.expireDue();
        const result = await payments.verify(
          contexts[2],
          booking.id,
          receipt(second.proofId!, '10000'),
          randomUUID(),
        );
        assert.equal(result.booking.status, 'dikonfirmasi');
        assert.equal(result.summary.applied, 20000n);
        assert.equal(result.summary.reserved, 0n);
        now = initialNow;
      },
    );
    await t.test(
      'partial_payment_verified_after_deadline_preserves_receipt_and_requests_full_refund',
      async () => {
        const booking = await make(),
          proof = await upload(booking);
        now = new Date(booking.expiresAt.getTime() + 1);
        const result = await payments.verify(
          contexts[2],
          booking.id,
          receipt(proof.proofId!, '10000'),
          randomUUID(),
        );
        assert.equal(result.booking.status, 'kedaluwarsa');
        assert.equal(result.summary.bill, 0n);
        assert.equal(result.summary.remaining, 0n);
        assert.equal(result.summary.received, 10000n);
        assert.equal(result.summary.refunded, 0n);
        assert.equal(result.summary.refundRequested, 10000n);
        assert.equal(result.summary.unapplied, 10000n);
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItem: { bookingId: booking.id }, state: 'active' },
          }),
          0,
        );
        now = initialNow;
      },
    );
    await t.test(
      'overpayment_only_applies_dp_and_does_not_claim_full_settlement',
      async () => {
        const booking = await make(),
          proof = await upload(booking),
          key = randomUUID(),
          input = receipt(proof.proofId!, '25000');
        const result = await payments.verify(
          contexts[2],
          booking.id,
          input,
          key,
        );
        assert.equal(result.summary.applied, 20000n);
        assert.equal(result.summary.unapplied, 5000n);
        assert.equal(result.summary.refundRequested, 5000n);
        assert.equal(result.summary.remaining, 30000n);
        assert.equal(result.summary.netCash, 25000n);
        assert.equal(result.summary.paymentStatus, 'dp_terverifikasi');
        assert.equal(
          (await payments.verify(contexts[2], booking.id, input, key)).summary
            .received,
          25000n,
        );
        await assert.rejects(
          payments.verify(
            contexts[2],
            booking.id,
            { ...input, amount: '30000' },
            key,
          ),
          { status: 409 },
        );
      },
    );
    await t.test(
      'bank_reference_is_unique_across_bookings_and_admins',
      async () => {
        const one = await make(),
          two = await make('dp', at(10), 50000n, 1),
          proofOne = await upload(one),
          proofTwo = await upload(two, 1),
          reference = randomUUID();
        const results = await Promise.allSettled([
          payments.verify(
            contexts[2],
            one.id,
            receipt(proofOne.proofId!, '20000', reference),
            randomUUID(),
          ),
          payments.verify(
            contexts[3],
            two.id,
            receipt(proofTwo.proofId!, '20000', reference.toUpperCase()),
            randomUUID(),
          ),
        ]);
        assert.equal(
          results.filter((result) => result.status === 'fulfilled').length,
          1,
        );
        assert.equal(
          await prisma.payment.count({
            where: {
              receivingAccountReference: 'merchant-bca',
              transactionReference: reference.toUpperCase(),
            },
          }),
          1,
        );
      },
    );
    await t.test(
      'business_approval_failure_keeps_actual_money_and_releases_stock_for_refund',
      async () => {
        const booking = await make(),
          proof = await upload(booking);
        await prisma.itemUnit.update({
          where: { id: booking.items[0].itemUnitId },
          data: { isActive: false },
        });
        const result = await payments.verify(
          contexts[2],
          booking.id,
          receipt(proof.proofId!),
          randomUUID(),
        );
        assert.equal(result.decision, 'refund_required');
        assert.equal(result.booking.status, 'ditolak');
        assert.equal(result.summary.received, 20000n);
        assert.equal(result.summary.bill, 0n);
        assert.equal(result.summary.refundRequested, 20000n);
        assert.equal(
          (
            await prisma.paymentProof.findUniqueOrThrow({
              where: { id: proof.proofId! },
            })
          ).status,
          'verified',
        );
      },
    );
    await t.test(
      'rejecting_proof_preserves_history_and_does_not_restart_deadline',
      async () => {
        const booking = await make(),
          proof = await upload(booking);
        const result = await payments.reject(
          contexts[2],
          booking.id,
          proof.proofId!,
          'Mutasi rekening belum menunjukkan uang masuk.',
          randomUUID(),
        );
        assert.equal(result.booking.status, 'menunggu_pembayaran');
        assert.equal(
          result.booking.expiresAt.getTime(),
          booking.expiresAt.getTime(),
        );
        assert.equal(result.summary.received, 0n);
        const next = await upload(booking);
        assert.notEqual(next.proofId, proof.proofId);
        now = new Date(booking.expiresAt.getTime() + 1);
        const expired = await payments.reject(
          contexts[2],
          booking.id,
          next.proofId!,
          'Bukti kedua tidak sesuai transaksi rekening.',
          randomUUID(),
        );
        assert.equal(expired.booking.status, 'kedaluwarsa');
        assert.equal(expired.summary.bill, 0n);
        assert.equal(
          await prisma.paymentProof.count({
            where: { paymentObligationId: booking.obligations[0].id },
          }),
          2,
        );
        now = initialNow;
      },
    );
    await t.test(
      'expiry_is_inclusive_and_concurrent_workers_close_ledger_once',
      async () => {
        const booking = await make();
        now = booking.expiresAt;
        await payments.expireDue();
        assert.equal(
          (await payments.detail(contexts[0], booking.id)).booking.status,
          'menunggu_pembayaran',
        );
        now = new Date(booking.expiresAt.getTime() + 1);
        await Promise.all([payments.expireDue(), payments.expireDue()]);
        const result = await payments.detail(contexts[0], booking.id);
        assert.equal(result.booking.status, 'kedaluwarsa');
        assert.equal(result.summary.bill, 0n);
        assert.equal(result.summary.remaining, 0n);
        assert.equal(
          await prisma.bookingCharge.count({
            where: { bookingId: booking.id, direction: 'credit' },
          }),
          1,
        );
        assert.equal(
          await prisma.bookingStatusLog.count({
            where: { bookingId: booking.id, toStatus: 'kedaluwarsa' },
          }),
          1,
        );
        assert.equal(result.booking.obligations[0].status, 'closed');
        assert.equal(
          await prisma.outboxEvent.count({
            where: {
              aggregateId: booking.id,
              eventType: 'booking.kedaluwarsa',
            },
          }),
          1,
        );
        now = initialNow;
      },
    );
    await t.test(
      'expiry_refunds_partial_funds_and_one_failed_booking_does_not_stop_the_batch',
      async () => {
        const partialBooking = await make(),
          proof = await upload(partialBooking);
        await payments.verify(
          contexts[2],
          partialBooking.id,
          receipt(proof.proofId!, '10000'),
          randomUUID(),
        );
        const broken = await make();
        now = new Date(partialBooking.expiresAt.getTime() + 1);
        const original = ledger.closeInitialBooking.bind(ledger);
        ledger.closeInitialBooking = async (tx, booking, ...args) => {
          if (booking.id === broken.id) throw new Error('Injected failure');
          return original(tx, booking, ...args);
        };
        try {
          const result = await payments.expireDue();
          assert.equal(result.failed, 1);
          assert.equal(
            (await payments.detail(contexts[0], broken.id)).booking.status,
            'menunggu_pembayaran',
          );
          const closed = await payments.detail(contexts[0], partialBooking.id);
          assert.equal(closed.booking.status, 'kedaluwarsa');
          assert.equal(closed.summary.remaining, 0n);
          assert.equal(closed.summary.refundRequested, 10000n);
          assert.equal(closed.summary.netCash, 10000n);
        } finally {
          ledger.closeInitialBooking = original;
          now = initialNow;
        }
      },
    );
    await t.test(
      'full_payment_and_small_total_apply_only_the_actual_obligation',
      async () => {
        for (const total of [15000n, 50000n]) {
          const booking = await make('full', at(10), total),
            proof = await upload(booking);
          const result = await payments.verify(
            contexts[2],
            booking.id,
            receipt(proof.proofId!, total.toString()),
            randomUUID(),
          );
          assert.equal(result.booking.status, 'dikonfirmasi');
          assert.equal(result.summary.paymentStatus, 'lunas');
          assert.equal(result.summary.applied, total);
          assert.equal(result.summary.remaining, 0n);
        }
      },
    );
    await t.test(
      'reconciliation_of_expired_booking_records_cash_without_reactivating_old_allocation',
      async () => {
        const booking = await make(),
          proof = await upload(booking);
        await payments.reject(
          contexts[2],
          booking.id,
          proof.proofId!,
          'Screenshot tidak sesuai rekening penerima.',
          randomUUID(),
        );
        now = new Date(booking.expiresAt.getTime() + 1);
        await payments.expireDue();
        const result = await payments.reconcile(
          contexts[2],
          booking.id,
          {
            ...receipt(proof.proofId!, '20000'),
            obligationId: booking.obligations[0].id,
          },
          randomUUID(),
        );
        assert.equal(result.booking.status, 'kedaluwarsa');
        assert.equal(result.summary.netCash, 20000n);
        assert.equal(result.summary.applied, 0n);
        assert.equal(result.summary.refundRequested, 20000n);
        assert.equal(
          (
            await prisma.paymentProof.findUniqueOrThrow({
              where: { id: proof.proofId! },
            })
          ).status,
          'rejected',
        );
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItem: { bookingId: booking.id }, state: 'active' },
          }),
          0,
        );
        now = initialNow;
      },
    );
    await t.test(
      'settlement_is_separate_from_dp_and_partial_receipts_do_not_allow_full_payment_label',
      async () => {
        const booking = await make(),
          first = await upload(booking);
        await payments.verify(
          contexts[2],
          booking.id,
          receipt(first.proofId!),
          randomUUID(),
        );
        const opened = await payments.settlement(
          contexts[0],
          booking.id,
          randomUUID(),
        );
        const obligation = opened.booking.obligations.find(
          (item) => item.purpose === 'settlement',
        )!;
        assert.equal(obligation.amountDue, 30000n);
        const partial = await upload(booking, 0, randomUUID(), obligation.id);
        const result = await payments.verify(
          contexts[2],
          booking.id,
          receipt(partial.proofId!, '15000'),
          randomUUID(),
        );
        assert.equal(result.booking.status, 'dikonfirmasi');
        assert.equal(result.summary.applied, 20000n);
        assert.equal(result.summary.reserved, 15000n);
        assert.equal(result.summary.paymentStatus, 'dp_terverifikasi');
        const last = await upload(booking, 0, randomUUID(), obligation.id);
        const paid = await payments.verify(
          contexts[2],
          booking.id,
          receipt(last.proofId!, '15000'),
          randomUUID(),
        );
        assert.equal(paid.summary.paymentStatus, 'lunas');
        assert.equal(paid.summary.applied, 50000n);
        assert.equal(paid.summary.remaining, 0n);
        assert.equal(paid.booking.status, 'dikonfirmasi');
      },
    );
    await t.test(
      'approval_requires_real_funds_and_free_booking_still_requires_admin',
      async () => {
        const booking = await make();
        await assert.rejects(
          payments.approve(contexts[2], booking.id, randomUUID()),
          { status: 409 },
        );
        const free = await make('full', at(10), 0n);
        assert.equal(free.status, 'menunggu_pembayaran');
        assert.equal(
          (await payments.approve(contexts[2], free.id, randomUUID())).booking
            .status,
          'dikonfirmasi',
        );
      },
    );
    await t.test(
      'http_admin_review_is_guarded_and_does_not_trust_claimed_amount',
      async () => {
        const booking = await make(),
          proof = await upload(booking),
          body = receipt(proof.proofId!, '25000');
        assert.equal(
          (
            await fetch(
              base + '/api/admin/bookings/' + booking.id + '/payments/verify',
              {
                method: 'POST',
                headers: headers(0, randomUUID()),
                body: JSON.stringify(body),
              },
            )
          ).status,
          403,
        );
        const result = await fetch(
          base + '/api/admin/bookings/' + booking.id + '/payments/verify',
          {
            method: 'POST',
            headers: headers(2, randomUUID()),
            body: JSON.stringify(body),
          },
        );
        assert.equal(result.status, 201, await result.clone().text());
        const value = (await result.json()) as {
          summary: { received: string; applied: string };
        };
        assert.equal(value.summary.received, '25000');
        assert.equal(value.summary.applied, '20000');
        await assert.rejects(storage.download('../escape.pdf'), {
          status: 404,
        });
      },
    );
    await t.test('upload_budget_returns_429_after_the_user_limit', async () => {
      const booking = await make('dp', at(10), 50000n, 1);
      await prisma.authRateLimit.upsert({
        where: { key: digest('proof.upload.user:' + users[1].id) },
        create: {
          key: digest('proof.upload.user:' + users[1].id),
          count: 19,
          resetAt: new Date(wibNow().getTime() + 3600000),
        },
        update: { count: 19, resetAt: new Date(wibNow().getTime() + 3600000) },
      });
      assert.equal(
        (await formUpload(booking, 1, randomUUID(), Buffer.from('invalid pdf')))
          .status,
        400,
      );
      assert.equal((await formUpload(booking, 1)).status, 429);
    });
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
      await tx.bookingItem.deleteMany({ where: { bookingId: { in: ids } } });
      await tx.booking.deleteMany({ where: { id: { in: ids } } });
      await tx.itemUnit.deleteMany({ where: { itemId: { in: itemIds } } });
      await tx.item.deleteMany({ where: { id: { in: itemIds } } });
      await tx.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await tx.auditLog.deleteMany({ where: { entityId: { in: ids } } });
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
