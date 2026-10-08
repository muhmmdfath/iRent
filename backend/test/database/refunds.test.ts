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

test('cancellations_and_manual_refunds_preserve_cash_entitlements_and_stock', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'irent-refund-proofs-'));
  const cleanupTarget = resolve(directory);
  if (
    dirname(cleanupTarget) !== resolve(tmpdir()) ||
    !basename(cleanupTarget).startsWith('irent-refund-proofs-')
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
    startAt = at(10, 0, 3),
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
  const recipient = {
    bankName: 'BCA',
    accountNumber: '1234567890',
    accountHolder: 'Fixture Customer',
  };
  const proofFile = {
    buffer: pdf,
    size: pdf.length,
    mimetype: 'application/pdf',
  };
  async function paid(
    payOption: 'dp' | 'full' = 'dp',
    amount = '20000',
    startAt = at(10, 0, 3),
    bill = 50000n,
  ) {
    const booking = await make(payOption, startAt, bill);
    const proof = await upload(booking);
    await payments.verify(
      contexts[2],
      booking.id,
      receipt(proof.proofId!, amount),
      randomUUID(),
    );
    return booking;
  }
  async function cancellationRefund(booking: TestBooking, shop = false) {
    const result = await refunds.cancel(
      contexts[shop ? 2 : 0],
      booking.id,
      'Jadwal berubah oleh pemesan.',
      randomUUID(),
      shop,
    );
    return {
      result,
      refund: await prisma.refundRequest.findFirstOrThrow({
        where: {
          bookingId: booking.id,
          reasonCode: shop ? 'shop_cancellation' : 'customer_cancellation',
        },
      }),
    };
  }
  function transferInput(amount: bigint) {
    return {
      amount: amount.toString(),
      transferredAt: formatWibDateTime(now),
      transactionReference: randomUUID(),
      note: 'Transfer telah diperiksa pada mutasi bank.',
    };
  }
  try {
    await t.test(
      'early_dp_cancellation_retains_only_real_fee_and_releases_calendar_not_physical_status',
      async () => {
        const booking = await paid();
        const unitId = (
          await prisma.bookingItem.findFirstOrThrow({
            where: { bookingId: booking.id },
          })
        ).itemUnitId;
        const before = await prisma.itemUnit.findUniqueOrThrow({
          where: { id: unitId },
        });
        const { result, refund } = await cancellationRefund(booking);
        assert.equal(refund.requestedAmount, 10000n);
        assert.equal(result.summary.bill, 10000n);
        assert.equal(result.summary.remaining, 0n);
        assert.equal(result.summary.netCash, 20000n);
        assert.equal(result.booking.status, 'dibatalkan');
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItem: { bookingId: booking.id }, state: 'active' },
          }),
          0,
        );
        assert.equal(
          (await prisma.itemUnit.findUniqueOrThrow({ where: { id: unitId } }))
            .physicalStatus,
          before.physicalStatus,
        );
        await assert.rejects(
          refunds.approve(contexts[2], refund.id, randomUUID()),
          /rekening/i,
        );
        await refunds.recipient(
          contexts[0],
          refund.id,
          recipient,
          randomUUID(),
        );
        const approved = await refunds.approve(
          contexts[2],
          refund.id,
          randomUUID(),
        );
        assert.equal(approved.summary.netCash, 20000n);
        assert.equal(approved.summary.refundApproved, 10000n);
        await assert.rejects(
          refunds.recipient(
            contexts[0],
            refund.id,
            { ...recipient, accountNumber: '9999999' },
            randomUUID(),
          ),
          /sebelum keputusan/,
        );
        await assert.rejects(
          refunds.transfer(
            contexts[2],
            refund.id,
            transferInput(9999n),
            proofFile,
            randomUUID(),
          ),
          /nominal/,
        );
        const complete = await refunds.transfer(
          contexts[2],
          refund.id,
          transferInput(10000n),
          proofFile,
          randomUUID(),
        );
        assert.equal(complete.summary.netCash, 10000n);
        assert.equal(complete.summary.applied, 10000n);
        assert.equal(complete.summary.bill, 10000n);
        assert.equal(complete.summary.refunded, 10000n);
      },
    );
    await t.test(
      'exact_48_hours_has_zero_refund_but_one_millisecond_earlier_uses_snapshot',
      async () => {
        const booking = await paid('dp', '20000', at(10, 0, 2));
        const original = now;
        now = new Date(booking.initialStartAt.getTime() - 48 * 3600000);
        const result = await refunds.cancel(
          contexts[0],
          booking.id,
          'Tidak jadi melakukan perjalanan.',
          randomUUID(),
        );
        assert.equal(result.summary.bill, 20000n);
        assert.equal(result.summary.refundRequested, 0n);
        const audit = await prisma.auditLog.findFirstOrThrow({
          where: { entityId: booking.id, action: 'booking.cancelled' },
        });
        assert.match(JSON.stringify(audit.changes), /"refundAmount":"0"/);
        assert.match(JSON.stringify(audit.changes), /"appliedBefore":"20000"/);
        now = original;
        const second = await paid('dp', '20000', at(10, 0, 2));
        now = new Date(second.initialStartAt.getTime() - 48 * 3600000 - 1);
        assert.equal(
          (await cancellationRefund(second)).refund.requestedAmount,
          10000n,
        );
        now = original;
      },
    );
    await t.test(
      'full_payment_and_dp_then_settled_use_75_percent',
      async () => {
        const full = await paid('full', '50000');
        assert.equal(
          (await cancellationRefund(full)).refund.requestedAmount,
          37500n,
        );
        const booking = await paid();
        const settlement = await payments.settlement(
          contexts[0],
          booking.id,
          randomUUID(),
        );
        const obligation = settlement.booking.obligations.find(
          (row) => row.purpose === 'settlement',
        )!;
        const proof = await upload(booking, 0, randomUUID(), obligation.id);
        await payments.verify(
          contexts[2],
          booking.id,
          receipt(proof.proofId!, '30000'),
          randomUUID(),
        );
        const cancelled = await cancellationRefund(booking);
        assert.equal(cancelled.refund.requestedAmount, 37500n);
        assert.equal(cancelled.result.summary.bill, 12500n);
        const sources = await prisma.refundSource.findMany({
          where: { refundRequestId: cancelled.refund.id },
        });
        assert.equal(sources.length, 2);
        assert.equal(
          sources.reduce((sum, source) => sum + source.amount, 0n),
          37500n,
        );
      },
    );
    await t.test(
      'small_mandatory_full_and_multi_receipt_rounding_use_total_not_each_receipt',
      async () => {
        const small = await paid('full', '3', at(10, 0, 3), 3n);
        assert.equal(
          (await cancellationRefund(small)).refund.requestedAmount,
          2n,
        );
        const booking = await paid('dp', '1');
        const proof = await upload(booking);
        await payments.verify(
          contexts[2],
          booking.id,
          receipt(proof.proofId!, '19999'),
          randomUUID(),
        );
        const { refund } = await cancellationRefund(booking);
        assert.equal(refund.requestedAmount, 10000n);
        const sources = await prisma.refundSource.findMany({
          where: { refundRequestId: refund.id },
        });
        assert.equal(
          sources.reduce((sum, source) => sum + source.amount, 0n),
          10000n,
        );
      },
    );
    await t.test(
      'partial_settlement_and_excess_are_refunded_in_full_separately_from_dp',
      async () => {
        const booking = await paid('dp', '25000');
        const settlement = await payments.settlement(
          contexts[0],
          booking.id,
          randomUUID(),
        );
        const obligation = settlement.booking.obligations.find(
          (row) => row.purpose === 'settlement',
        )!;
        const proof = await upload(booking, 0, randomUUID(), obligation.id);
        await payments.verify(
          contexts[2],
          booking.id,
          receipt(proof.proofId!, '10000'),
          randomUUID(),
        );
        const { result, refund } = await cancellationRefund(booking);
        assert.equal(refund.requestedAmount, 10000n);
        assert.equal(result.summary.refundRequested, 25000n);
        assert.equal(result.summary.bill, 10000n);
        assert.equal(result.summary.reserved, 0n);
        const all = await prisma.refundRequest.findMany({
          where: { bookingId: booking.id },
        });
        for (const candidate of all) {
          await refunds.recipient(
            contexts[0],
            candidate.id,
            recipient,
            randomUUID(),
          );
          await refunds.approve(contexts[2], candidate.id, randomUUID());
          await refunds.transfer(
            contexts[2],
            candidate.id,
            transferInput(candidate.requestedAmount),
            proofFile,
            randomUUID(),
          );
        }
        const detail = await payments.detail(contexts[0], booking.id);
        assert.equal(detail.summary.netCash, 10000n);
        assert.equal(detail.summary.applied, 10000n);
        assert.equal(detail.summary.unapplied, 0n);
      },
    );
    await t.test(
      'shop_failure_returns_every_actual_payment_even_inside_cutoff',
      async () => {
        const booking = await paid('dp', '25000', at(10));
        const { result } = await cancellationRefund(booking, true);
        assert.equal(result.summary.bill, 0n);
        assert.equal(result.summary.refundRequested, 25000n);
      },
    );
    await t.test(
      'cancel_pending_proof_then_reconcile_preserves_money_without_reactivation',
      async () => {
        const booking = await make();
        const proof = await upload(booking);
        await refunds.cancel(
          contexts[0],
          booking.id,
          'Perjalanan batal sebelum persetujuan.',
          randomUUID(),
        );
        const pending = await prisma.paymentProof.findUniqueOrThrow({
          where: { id: proof.proofId! },
        });
        assert.equal(pending.status, 'pending');
        assert.equal(pending.reviewedBy, null);
        await assert.rejects(
          payments.verify(
            contexts[2],
            booking.id,
            receipt(proof.proofId!),
            randomUUID(),
          ),
        );
        await assert.rejects(
          payments.reject(
            contexts[2],
            booking.id,
            proof.proofId!,
            'Bukti belum sesuai.',
            randomUUID(),
          ),
        );
        const input = {
          ...receipt(proof.proofId!, '20000'),
          obligationId: booking.obligations[0].id,
        };
        const reconciled = await payments.reconcile(
          contexts[2],
          booking.id,
          input,
          randomUUID(),
        );
        assert.equal(reconciled.booking.status, 'dibatalkan');
        assert.equal(reconciled.summary.refundRequested, 20000n);
        assert.equal(reconciled.summary.bill, 0n);
        const reviewed = await prisma.paymentProof.findUniqueOrThrow({
          where: { id: proof.proofId! },
        });
        assert.equal(reviewed.status, 'verified');
        assert.equal(reviewed.reviewedBy, contexts[2].user.id);
      },
    );
    await t.test(
      'cancel_after_handover_is_rejected_and_other_customer_cannot_cancel',
      async () => {
        const booking = await paid();
        await assert.rejects(
          refunds.cancel(
            contexts[1],
            booking.id,
            'Tidak boleh akses booking lain.',
            randomUUID(),
          ),
          /tidak ditemukan/,
        );
        await prisma.bookingItem.updateMany({
          where: { bookingId: booking.id },
          data: {
            useStatus: 'in_use',
            pickedUpAt: now,
            pickedUpBy: contexts[2].user.id,
          },
        });
        await assert.rejects(
          refunds.cancel(
            contexts[0],
            booking.id,
            'Sudah mengambil barang sewaan.',
            randomUUID(),
          ),
          /serah terima/,
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
      'concurrent_review_and_transfer_record_only_one_refund_with_idempotent_replay',
      async () => {
        const { refund } = await cancellationRefund(await paid());
        await refunds.recipient(
          contexts[0],
          refund.id,
          recipient,
          randomUUID(),
        );
        const reviews = await Promise.allSettled([
          refunds.approve(contexts[2], refund.id, randomUUID()),
          refunds.approve(contexts[3], refund.id, randomUUID()),
        ]);
        assert.equal(
          reviews.filter((result) => result.status === 'fulfilled').length,
          1,
        );
        const beforeFiles = (await readdir(directory)).length;
        const key = randomUUID(),
          input = transferInput(10000n);
        const transfers = await Promise.allSettled([
          refunds.transfer(contexts[2], refund.id, input, proofFile, key),
          refunds.transfer(
            contexts[3],
            refund.id,
            transferInput(10000n),
            proofFile,
            randomUUID(),
          ),
        ]);
        assert.equal(
          transfers.filter((result) => result.status === 'fulfilled').length,
          1,
        );
        // Winning actor may differ: same actor/key replay if actor 2 won.
        if (transfers[0].status === 'fulfilled') {
          await refunds.transfer(contexts[2], refund.id, input, proofFile, key);
          await assert.rejects(
            refunds.transfer(
              contexts[2],
              refund.id,
              { ...input, note: 'Payload berbeda dari sebelumnya.' },
              proofFile,
              key,
            ),
            /payload berbeda/,
          );
        }
        assert.equal(
          await prisma.payment.count({ where: { refundRequestId: refund.id } }),
          1,
        );
        const outgoing = await prisma.payment.findUniqueOrThrow({
          where: { refundRequestId: refund.id },
        });
        assert.equal(outgoing.amount, 10000n);
        assert.ok(outgoing.attachmentPath);
        assert.equal((await readdir(directory)).length, beforeFiles + 1);
      },
    );
    await t.test(
      'competing_refund_proposals_cannot_spend_same_receipt_or_applied_dp',
      async () => {
        const booking = await paid('dp', '25000');
        const first = await prisma.refundRequest.findFirstOrThrow({
          where: { bookingId: booking.id },
        });
        const source = await prisma.refundSource.findFirstOrThrow({
          where: { refundRequestId: first.id },
        });
        const second = await prisma.refundRequest.create({
          data: {
            bookingId: booking.id,
            reasonCode: 'duplicate_fixture',
            requestedAmount: 5000n,
            recipientDetails: recipient,
            policySnapshot: { percent: 100 },
            sources: {
              create: {
                incomingPaymentId: source.incomingPaymentId,
                amount: 5000n,
              },
            },
          },
        });
        await refunds.recipient(contexts[0], first.id, recipient, randomUUID());
        const results = await Promise.allSettled([
          refunds.approve(contexts[2], first.id, randomUUID()),
          refunds.approve(contexts[3], second.id, randomUUID()),
        ]);
        assert.equal(
          results.filter((result) => result.status === 'fulfilled').length,
          1,
        );
        const approved = await prisma.refundRequest.findFirstOrThrow({
          where: { bookingId: booking.id, status: 'disetujui' },
        });
        await refunds.transfer(
          contexts[2],
          approved.id,
          transferInput(5000n),
          proofFile,
          randomUUID(),
        );
        const detail = await payments.detail(contexts[0], booking.id);
        assert.equal(detail.summary.applied, 20000n);
        assert.equal(detail.summary.netCash, 20000n);
      },
    );
    await t.test(
      'payment_approval_racing_cancellation_keeps_actual_receipt_and_refund_consistent',
      async () => {
        const booking = await make();
        const proof = await upload(booking);
        const results = await Promise.allSettled([
          payments.verify(
            contexts[2],
            booking.id,
            receipt(proof.proofId!),
            randomUUID(),
          ),
          refunds.cancel(
            contexts[0],
            booking.id,
            'Jadwal berubah pada saat konfirmasi.',
            randomUUID(),
          ),
        ]);
        assert.equal(results[1].status, 'fulfilled');
        const detail = await payments.detail(contexts[0], booking.id);
        assert.equal(detail.booking.status, 'dibatalkan');
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItem: { bookingId: booking.id }, state: 'active' },
          }),
          0,
        );
        if (results[0].status === 'fulfilled') {
          assert.equal(detail.summary.received, 20000n);
          assert.equal(detail.summary.refundRequested, 10000n);
        } else {
          assert.equal(detail.summary.received, 0n);
          assert.equal(detail.summary.bill, 0n);
        }
      },
    );
    await t.test(
      'http_refund_actions_enforce_roles_csrf_and_private_transfer_evidence',
      async () => {
        const booking = await paid();
        const cancel = await fetch(
          base + '/api/bookings/' + booking.id + '/cancel',
          {
            method: 'POST',
            headers: headers(0, randomUUID()),
            body: JSON.stringify({
              reason: 'Perjalanan tidak dapat dilanjutkan.',
            }),
          },
        );
        assert.equal(cancel.status, 201, await cancel.clone().text());
        const refund = await prisma.refundRequest.findFirstOrThrow({
          where: { bookingId: booking.id },
        });
        const approveUrl =
          base + '/api/admin/refunds/' + refund.id + '/approve';
        assert.equal(
          (
            await fetch(approveUrl, {
              method: 'POST',
              headers: headers(0, randomUUID()),
              body: '{}',
            })
          ).status,
          403,
        );
        await refunds.recipient(
          contexts[0],
          refund.id,
          recipient,
          randomUUID(),
        );
        await refunds.approve(contexts[2], refund.id, randomUUID());
        const form = new FormData();
        const input = transferInput(10000n);
        for (const [field, value] of Object.entries(input))
          form.append(field, value);
        form.append(
          'file',
          new Blob([Uint8Array.from(pdf)], { type: 'application/pdf' }),
          'private.pdf',
        );
        const response = await fetch(
          base + '/api/admin/refunds/' + refund.id + '/transfer',
          {
            method: 'POST',
            headers: headers(2, randomUUID(), false),
            body: form,
          },
        );
        assert.equal(response.status, 201, await response.clone().text());
        assert.ok(!(await response.text()).includes('attachmentPath'));
        const path = base + '/api/refunds/' + refund.id + '/file';
        assert.equal((await fetch(path, { headers: headers(1) })).status, 404);
        assert.equal((await fetch(path)).status, 401);
        const downloaded = await fetch(path, { headers: headers(0) });
        assert.equal(downloaded.status, 200);
        assert.equal(downloaded.headers.get('content-type'), 'application/pdf');
        assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), pdf);
      },
    );
    await t.test(
      'cancellation_replay_cannot_duplicate_credits_or_refund_entitlements',
      async () => {
        const booking = await paid();
        const key = randomUUID(),
          reason = 'Perjalanan dibatalkan oleh pemesan.';
        await refunds.cancel(contexts[0], booking.id, reason, key);
        const before = await prisma.bookingCharge.count({
          where: { bookingId: booking.id },
        });
        await refunds.cancel(contexts[0], booking.id, reason, key);
        assert.equal(
          await prisma.bookingCharge.count({
            where: { bookingId: booking.id },
          }),
          before,
        );
        assert.equal(
          await prisma.refundRequest.count({
            where: { bookingId: booking.id },
          }),
          1,
        );
        await assert.rejects(
          refunds.cancel(
            contexts[0],
            booking.id,
            'Alasan berbeda untuk key yang sama.',
            key,
          ),
          /payload berbeda/,
        );
      },
    );
    await t.test(
      'bank_reference_is_unique_across_refunds_for_different_customers',
      async () => {
        const first = await cancellationRefund(await paid());
        const otherBooking = await make('dp', at(10, 0, 3), 50000n, 1);
        const proof = await upload(otherBooking, 1);
        await payments.verify(
          contexts[2],
          otherBooking.id,
          receipt(proof.proofId!),
          randomUUID(),
        );
        await refunds.cancel(
          contexts[1],
          otherBooking.id,
          'Jadwal pelanggan kedua berubah.',
          randomUUID(),
        );
        const otherRefund = await prisma.refundRequest.findFirstOrThrow({
          where: { bookingId: otherBooking.id },
        });
        await refunds.recipient(
          contexts[0],
          first.refund.id,
          recipient,
          randomUUID(),
        );
        await refunds.recipient(
          contexts[1],
          otherRefund.id,
          recipient,
          randomUUID(),
        );
        await refunds.approve(contexts[2], first.refund.id, randomUUID());
        await refunds.approve(contexts[3], otherRefund.id, randomUUID());
        const reference = randomUUID(),
          input = { ...transferInput(10000n), transactionReference: reference };
        const results = await Promise.allSettled([
          refunds.transfer(
            contexts[2],
            first.refund.id,
            input,
            proofFile,
            randomUUID(),
          ),
          refunds.transfer(
            contexts[3],
            otherRefund.id,
            input,
            proofFile,
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
              receivingAccountReference: 'bca:1234567890',
              transactionReference: reference.toUpperCase(),
            },
          }),
          1,
        );
      },
    );
    await t.test(
      'expiry_refund_can_be_approved_and_transferred_without_creating_a_bill',
      async () => {
        const booking = await paid('dp', '10000');
        const initial = now;
        now = new Date(booking.expiresAt.getTime() + 1);
        await payments.expireDue();
        const refund = await prisma.refundRequest.findFirstOrThrow({
          where: { bookingId: booking.id },
        });
        assert.equal(refund.requestedAmount, 10000n);
        await refunds.recipient(
          contexts[2],
          refund.id,
          recipient,
          randomUUID(),
        );
        await refunds.approve(contexts[2], refund.id, randomUUID());
        const completed = await refunds.transfer(
          contexts[2],
          refund.id,
          transferInput(10000n),
          proofFile,
          randomUUID(),
        );
        assert.equal(completed.summary.netCash, 0n);
        assert.equal(completed.summary.bill, 0n);
        assert.equal(completed.booking.status, 'kedaluwarsa');
        now = initial;
      },
    );
    await t.test(
      'rejection_requires_reason_and_never_records_outgoing_cash',
      async () => {
        const { refund } = await cancellationRefund(await paid());
        await assert.rejects(
          refunds.reject(contexts[2], refund.id, ' ', randomUUID()),
          /Alasan/,
        );
        await refunds.reject(
          contexts[2],
          refund.id,
          'Permintaan perlu ditinjau bersama pemesan.',
          randomUUID(),
        );
        await assert.rejects(
          refunds.approve(contexts[2], refund.id, randomUUID()),
          /diputuskan/,
        );
        assert.equal(
          await prisma.payment.count({ where: { refundRequestId: refund.id } }),
          0,
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
