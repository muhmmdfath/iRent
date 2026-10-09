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
import { runBusinessTransaction } from '../../src/prisma/business-transaction';
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

test('no_show_requires_due_confirmed_booking_and_verified_delivery_evidence', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'irent-no-show-proofs-'));
  const cleanupTarget = resolve(directory);
  if (
    dirname(cleanupTarget) !== resolve(tmpdir()) ||
    !basename(cleanupTarget).startsWith('irent-no-show-proofs-')
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
  async function failDelivery(
    booking: TestBooking,
    ready = at(10),
    failure = at(13),
  ) {
    return noShow.deliveryFailure(
      contexts[2],
      booking.id,
      {
        readyAt: ready,
        customerFailureAt: failure,
        reason: 'Petugas siap tetapi pelanggan tidak dapat ditemui.',
      },
      randomUUID(),
    );
  }
  async function detail(booking: TestBooking) {
    return payments.detail(contexts[0], booking.id);
  }
  try {
    await t.test(
      'pickup_is_not_cancelled_at_exact_deadline_and_dp_is_retained_after_it',
      async () => {
        const booking = await paid();
        now = new Date(booking.noShowDueAt);
        await noShow.processDue();
        assert.equal((await detail(booking)).booking.status, 'dikonfirmasi');
        now = new Date(now.getTime() + 1);
        await noShow.processDue();
        const result = await detail(booking);
        assert.equal(result.booking.status, 'dibatalkan');
        assert.equal(result.summary.bill, 20000n);
        assert.equal(result.summary.refundRequested, 0n);
        assert.equal(result.summary.remaining, 0n);
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItem: { bookingId: booking.id }, state: 'active' },
          }),
          0,
        );
        assert.equal(
          await prisma.auditLog.count({
            where: { entityId: booking.id, action: 'booking.no_show' },
          }),
          1,
        );
      },
    );
    await t.test(
      'full_payment_refunds_only_above_dp_and_uses_existing_manual_transfer_workflow',
      async () => {
        const booking = await paid('50000', 'full');
        now = new Date(booking.noShowDueAt.getTime() + 1);
        await noShow.processDue();
        const refund = await prisma.refundRequest.findFirstOrThrow({
          where: { bookingId: booking.id, reasonCode: 'no_show' },
        });
        assert.equal(refund.requestedAmount, 30000n);
        await refunds.recipient(
          contexts[2],
          refund.id,
          {
            bankName: 'BCA',
            accountNumber: '1234567890',
            accountHolder: 'Fixture',
          },
          randomUUID(),
        );
        await refunds.approve(contexts[2], refund.id, randomUUID());
        const result = await refunds.transfer(
          contexts[2],
          refund.id,
          {
            amount: '30000',
            transferredAt: formatWibDateTime(now),
            transactionReference: randomUUID(),
            note: 'Refund no-show ditransfer sesuai mutasi bank.',
          },
          { buffer: pdf, size: pdf.length, mimetype: 'application/pdf' },
          randomUUID(),
        );
        assert.equal(result.summary.netCash, 20000n);
        assert.equal(result.summary.applied, 20000n);
        assert.equal(result.summary.bill, 20000n);
        assert.equal(result.summary.remaining, 0n);
      },
    );
    await t.test(
      'completed_excess_refund_is_not_requested_again_when_customer_is_no_show',
      async () => {
        const booking = await paid('55000', 'full');
        const excess = await prisma.refundRequest.findFirstOrThrow({
          where: { bookingId: booking.id, reasonCode: 'overpayment' },
        });
        await refunds.recipient(
          contexts[2],
          excess.id,
          {
            bankName: 'BCA',
            accountNumber: '1234567890',
            accountHolder: 'Fixture',
          },
          randomUUID(),
        );
        await refunds.approve(contexts[2], excess.id, randomUUID());
        await refunds.transfer(
          contexts[2],
          excess.id,
          {
            amount: '5000',
            transferredAt: formatWibDateTime(now),
            transactionReference: randomUUID(),
            note: 'Kelebihan sudah dikembalikan kepada pelanggan.',
          },
          { buffer: pdf, size: pdf.length, mimetype: 'application/pdf' },
          randomUUID(),
        );
        now = new Date(booking.noShowDueAt.getTime() + 1);
        await noShow.processDue();
        const result = await detail(booking);
        assert.equal(result.summary.refunded, 5000n);
        assert.equal(result.summary.refundRequested, 30000n);
        assert.equal(result.summary.bill, 20000n);
        assert.equal(
          await prisma.refundRequest.count({
            where: { bookingId: booking.id },
          }),
          2,
        );
      },
    );
    await t.test(
      'small_mandatory_full_keeps_actual_total_without_inventing_a_dp_receivable',
      async () => {
        const booking = await paid('15000', 'full', 15000n);
        now = new Date(booking.noShowDueAt.getTime() + 1);
        await noShow.processDue();
        const result = await detail(booking);
        assert.equal(result.summary.bill, 15000n);
        assert.equal(result.summary.refundRequested, 0n);
        assert.equal(result.summary.remaining, 0n);
      },
    );
    await t.test(
      'partially_paid_settlement_and_overpayment_are_fully_refunded_without_duplication',
      async () => {
        const booking = await paid('25000');
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
        now = new Date(booking.noShowDueAt.getTime() + 1);
        await noShow.processDue();
        await noShow.processDue();
        const result = await detail(booking);
        assert.equal(result.summary.bill, 20000n);
        assert.equal(result.summary.refundRequested, 15000n);
        assert.equal(result.summary.reserved, 0n);
        assert.equal(
          await prisma.refundRequest.count({
            where: { bookingId: booking.id },
          }),
          2,
        );
      },
    );
    await t.test(
      'pending_settlement_can_be_reconciled_for_full_refund_after_no_show_without_reactivation',
      async () => {
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
        const input = {
          ...receipt(proof.proofId!, '30000'),
          obligationId: obligation.id,
          occurredAt: formatWibDateTime(initialNow),
        };
        await assert.rejects(
          payments.reconcile(contexts[2], booking.id, input, randomUUID()),
          /rekonsiliasi/,
        );
        now = new Date(booking.noShowDueAt.getTime() + 1);
        await noShow.processDue();
        const key = randomUUID();
        const result = await payments.reconcile(
          contexts[2],
          booking.id,
          input,
          key,
        );
        await payments.reconcile(contexts[2], booking.id, input, key);
        assert.equal(result.booking.status, 'dibatalkan');
        assert.equal(result.summary.bill, 20000n);
        assert.equal(result.summary.refundRequested, 30000n);
        assert.equal(result.summary.received, 50000n);
        assert.equal(result.summary.applied, 20000n);
        assert.equal(
          await prisma.payment.count({
            where: { bookingId: booking.id, type: 'reconciliation' },
          }),
          1,
        );
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItem: { bookingId: booking.id }, state: 'active' },
          }),
          0,
        );
      },
    );
    await t.test(
      'waiting_for_admin_or_payment_is_never_customer_no_show',
      async () => {
        const pending = await make();
        await upload(pending);
        const unpaid = await make();
        now = new Date(pending.noShowDueAt.getTime() + 1);
        await noShow.processDue();
        assert.equal(
          (await detail(pending)).booking.status,
          'menunggu_konfirmasi',
        );
        assert.equal(
          (await detail(unpaid)).booking.status,
          'menunggu_pembayaran',
        );
      },
    );
    await t.test(
      'unverified_delivery_is_flagged_once_without_forfeiting_money_or_releasing_units',
      async () => {
        const booking = await paid('20000', 'dp', 50000n, true);
        now = new Date(booking.noShowDueAt.getTime() + 1);
        await Promise.all([noShow.processDue(), noShow.processDue()]);
        const result = await detail(booking);
        assert.equal(result.booking.status, 'dikonfirmasi');
        assert.equal(result.summary.bill, 60000n);
        assert.equal(result.summary.refundRequested, 0n);
        assert.equal(
          await prisma.unitAllocation.count({
            where: { bookingItem: { bookingId: booking.id }, state: 'active' },
          }),
          1,
        );
        assert.equal(
          await prisma.outboxEvent.count({
            where: {
              aggregateId: booking.id,
              eventType: 'delivery.no_show_review',
            },
          }),
          1,
        );
        assert.ok(
          (await noShow.followUp(contexts[2])).some(
            (row) => row.id === booking.id,
          ),
        );
        await assert.rejects(noShow.followUp(contexts[0]));
      },
    );
    await t.test(
      'verified_shop_delay_preserves_full_three_hour_grace_and_original_schedule',
      async () => {
        const booking = await paid('20000', 'dp', 50000n, true);
        now = new Date(booking.initialStartAt.getTime() + 3 * 3600000);
        const evidence = await failDelivery(booking, at(12), at(13));
        assert.equal(evidence.booking.shopDelaySeconds, 7200);
        assert.equal(
          evidence.booking.noShowDueAt.toISOString(),
          at(15).replace('+07:00', 'Z'),
        );
        assert.equal(
          evidence.booking.initialStartAt.getTime(),
          booking.initialStartAt.getTime(),
        );
        now = new Date(booking.noShowDueAt.getTime() + 1);
        await noShow.processDue();
        assert.equal((await detail(booking)).booking.status, 'dikonfirmasi');
        now = new Date(evidence.booking.noShowDueAt.getTime() + 1);
        await noShow.processDue();
        assert.equal((await detail(booking)).booking.status, 'dibatalkan');
      },
    );
    await t.test(
      'delivery_evidence_enforces_roles_timestamps_idempotency_and_immutable_verification',
      async () => {
        const booking = await paid('20000', 'dp', 50000n, true);
        now = new Date(booking.noShowDueAt);
        const input = {
          readyAt: at(10),
          customerFailureAt: at(13),
          reason: 'Pelanggan tidak dapat menerima barang.',
        };
        await assert.rejects(
          noShow.deliveryFailure(contexts[0], booking.id, input, randomUUID()),
        );
        await assert.rejects(
          noShow.deliveryFailure(
            contexts[2],
            booking.id,
            { ...input, readyAt: at(14) },
            randomUUID(),
          ),
          /Waktu/,
        );
        await assert.rejects(
          noShow.deliveryFailure(
            contexts[2],
            booking.id,
            { ...input, customerFailureAt: at(14) },
            randomUUID(),
          ),
          /Waktu/,
        );
        const key = randomUUID();
        await noShow.deliveryFailure(contexts[2], booking.id, input, key);
        await noShow.deliveryFailure(contexts[2], booking.id, input, key);
        await assert.rejects(
          noShow.deliveryFailure(
            contexts[2],
            booking.id,
            { ...input, reason: 'Alasan berbeda untuk bukti yang sama.' },
            key,
          ),
          /payload berbeda/,
        );
        await assert.rejects(
          noShow.deliveryFailure(contexts[2], booking.id, input, randomUUID()),
          /sudah tersimpan/,
        );
        assert.equal(
          await prisma.auditLog.count({
            where: {
              entityId: booking.id,
              action: 'delivery.customer_failure',
            },
          }),
          1,
        );
      },
    );
    await t.test(
      'concurrent_workers_cancel_once_and_do_not_reset_physical_readiness',
      async () => {
        const booking = await paid('50000', 'full');
        const item = await prisma.bookingItem.findFirstOrThrow({
          where: { bookingId: booking.id },
        });
        await prisma.itemUnit.update({
          where: { id: item.itemUnitId },
          data: {
            conditionStatus: 'maintenance',
            physicalStatus: 'awaiting_check',
          },
        });
        now = new Date(booking.noShowDueAt.getTime() + 1);
        await Promise.all([noShow.processDue(), noShow.processDue()]);
        assert.equal(
          await prisma.refundRequest.count({
            where: { bookingId: booking.id, reasonCode: 'no_show' },
          }),
          1,
        );
        assert.equal(
          await prisma.auditLog.count({
            where: { entityId: booking.id, action: 'booking.no_show' },
          }),
          1,
        );
        assert.equal(
          (
            await prisma.itemUnit.findUniqueOrThrow({
              where: { id: item.itemUnitId },
            })
          ).physicalStatus,
          'awaiting_check',
        );
      },
    );
    await t.test(
      'handover_and_no_show_share_locks_and_only_one_valid_outcome_commits',
      async () => {
        const booking = await paid('50000', 'full');
        now = new Date(booking.noShowDueAt.getTime() + 1);
        const handover = runBusinessTransaction(prisma, async (tx) => {
          const locked = await payments.lockBooking(tx, booking.id);
          if (locked.status !== 'dikonfirmasi')
            throw new Error('Booking already closed');
          await tx.bookingItem.updateMany({
            where: { bookingId: booking.id },
            data: {
              useStatus: 'in_use',
              pickedUpAt: now,
              pickedUpBy: users[2].id,
            },
          });
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: 'berjalan' },
          });
        });
        await Promise.allSettled([handover, noShow.processDue()]);
        const result = await detail(booking);
        const used = await prisma.bookingItem.count({
          where: { bookingId: booking.id, useStatus: 'in_use' },
        });
        if (result.booking.status === 'berjalan') {
          assert.equal(used, 1);
          assert.equal(
            await prisma.refundRequest.count({
              where: { bookingId: booking.id },
            }),
            0,
          );
        } else {
          assert.equal(result.booking.status, 'dibatalkan');
          assert.equal(used, 0);
          assert.equal(result.summary.refundRequested, 30000n);
        }
      },
    );
    await t.test(
      'pending_delivery_reviews_do_not_starve_pickups_when_batch_is_small',
      async () => {
        const delivery = await paid('20000', 'dp', 50000n, true);
        const pickup = await paid();
        now = new Date(pickup.noShowDueAt.getTime() + 1);
        await noShow.processDue(1);
        assert.equal((await detail(pickup)).booking.status, 'dibatalkan');
        assert.equal((await detail(delivery)).booking.status, 'dikonfirmasi');
      },
    );
    await t.test(
      'review_batches_advance_past_previously_flagged_deliveries',
      async () => {
        const first = await paid('20000', 'dp', 50000n, true),
          second = await paid('20000', 'dp', 50000n, true);
        now = new Date(first.noShowDueAt.getTime() + 1);
        for (let cycle = 0; cycle < 10; cycle++) await noShow.processDue(1);
        for (const booking of [first, second])
          assert.equal(
            await prisma.outboxEvent.count({
              where: {
                aggregateId: booking.id,
                eventType: 'delivery.no_show_review',
              },
            }),
            1,
          );
        assert.equal((await noShow.processDue(1)).flagged, 0);
      },
    );
    await t.test(
      'http_admin_delivery_queue_and_evidence_require_authorization_and_csrf',
      async () => {
        const booking = await paid('20000', 'dp', 50000n, true);
        now = new Date(booking.noShowDueAt.getTime() + 1);
        const queue = base + '/api/admin/bookings/delivery-follow-up';
        assert.equal((await fetch(queue)).status, 401);
        assert.equal((await fetch(queue, { headers: headers(0) })).status, 403);
        assert.equal((await fetch(queue, { headers: headers(2) })).status, 200);
        const endpoint =
          base +
          '/api/admin/bookings/' +
          booking.id +
          '/delivery/customer-failure';
        const input = {
          readyAt: at(10),
          customerFailureAt: at(13),
          reason: 'Pelanggan tidak berada di lokasi.',
        };
        const wrongCsrf = {
          ...headers(2, randomUUID()),
          'X-CSRF-Token': 'invalid',
        };
        assert.equal(
          (
            await fetch(endpoint, {
              method: 'POST',
              headers: wrongCsrf,
              body: JSON.stringify(input),
            })
          ).status,
          403,
        );
        const result = await fetch(endpoint, {
          method: 'POST',
          headers: headers(2, randomUUID()),
          body: JSON.stringify(input),
        });
        assert.equal(result.status, 201, await result.clone().text());
      },
    );
    await t.test(
      'failed_booking_does_not_abort_other_no_show_records',
      async () => {
        const first = await paid(),
          second = await paid();
        now = new Date(first.noShowDueAt.getTime() + 1);
        const original = refunds.noShow.bind(refunds);
        refunds.noShow = async (tx, booking) => {
          if (booking.id === first.id)
            throw new Error('Simulated ledger failure');
          return original(tx, booking);
        };
        try {
          const result = await noShow.processDue();
          assert.equal(result.failed, 1);
          assert.equal((await detail(first)).booking.status, 'dikonfirmasi');
          assert.equal((await detail(second)).booking.status, 'dibatalkan');
        } finally {
          refunds.noShow = original;
        }
        await noShow.processDue();
        assert.equal((await detail(first)).booking.status, 'dibatalkan');
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
