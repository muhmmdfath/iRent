import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import { Client } from 'pg';
import { AuthService } from '../../src/auth/auth.service';
import { hashPassword } from '../../src/auth/crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { BusinessClock } from '../../src/shared/time/business-clock';
import { wibNow, formatWibDateTime } from '../../src/shared/time/wib';
import { BookingsService } from '../../src/modules/bookings/bookings.service';
import { TERMS_VERSION } from '../../src/modules/bookings/bookings.dto';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { OperationsService } from '../../src/modules/operations/operations.service';
import { ReportsService } from '../../src/modules/reports/reports.service';
import { ReceiptCorrectionsService } from '../../src/modules/payments/receipt-corrections.service';
import { RefundsService } from '../../src/modules/payments/refunds.service';
import { SettingsService } from '../../src/modules/settings/settings.service';
import { ExtensionsService } from '../../src/modules/extensions/extensions.service';
import { PaymentLedgerService } from '../../src/modules/payments/payment-ledger.service';
import { setupApp } from '../../src/setup-app';
import { testSecrets } from '../config.fixture';

const database = process.env.TEST_DATABASE_URL;
if (!database) throw new Error('TEST_DATABASE_URL wajib diisi.');

test('admin_read_models_reports_and_public_media_follow_real_business_state', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'irent-public-media-'));
  const cleanup = resolve(directory);
  if (
    dirname(cleanup) !== resolve(tmpdir()) ||
    !basename(cleanup).startsWith('irent-public-media-')
  )
    throw new Error('Unsafe cleanup path');
  const schema = 'irent_test_' + randomUUID().replaceAll('-', '');
  const control = new Client({ connectionString: database });
  await control.connect();
  await control.query(`CREATE SCHEMA "${schema}"`);
  const lifecycle: { app?: NestExpressApplication } = {};
  t.after(async () => {
    if (lifecycle.app) await lifecycle.app.close();
    if (!/^irent_test_[a-f0-9]{32}$/.test(schema))
      throw new Error('Unsafe test schema cleanup');
    try {
      await control.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await control.end();
      await rm(cleanup, { recursive: true, force: true });
    }
  });
  await control.query(`SET search_path TO "${schema}"`);
  const migrations = join(process.cwd(), 'prisma', 'migrations');
  for (const entry of (await readdir(migrations, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await control.query(
      await readFile(join(migrations, entry.name, 'migration.sql'), 'utf8'),
    );
  const scoped = new URL(database!);
  scoped.searchParams.set('schema', schema);
  Object.assign(process.env, testSecrets(), {
    DATABASE_URL: scoped.toString(),
    NODE_ENV: 'test',
    MEDIA_STORAGE_DIR: join(directory, 'media'),
    PROOF_STORAGE_DIR: join(directory, 'proofs'),
    PAYMENT_WORKER_ENABLED: 'false',
    NO_SHOW_WORKER_ENABLED: 'false',
    EXTENSION_WORKER_ENABLED: 'false',
    RISK_WORKER_ENABLED: 'false',
    NOTIFICATION_WORKER_ENABLED: 'false',
  });
  const { AppModule } = await import('../../src/app.module');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });
  lifecycle.app = app;
  setupApp(app);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl(),
    prisma = app.get(PrismaService),
    auth = app.get(AuthService),
    bookings = app.get(BookingsService),
    payments = app.get(PaymentsService),
    operations = app.get(OperationsService),
    reports = app.get(ReportsService),
    clock = app.get(BusinessClock);
  const initial = wibNow();
  initial.setUTCHours(6, 0, 0, 0);
  let now = new Date(initial);
  clock.now = () => new Date(now);
  const tomorrow = new Date(initial);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(10);
  const day = formatWibDateTime(initial).slice(0, 10),
    nextDay = formatWibDateTime(tomorrow).slice(0, 10);
  const password = 'Fixture password 123!',
    passwordHash = await hashPassword(password);
  const customer = await prisma.user.create({
    data: {
      name: 'Read customer',
      email: randomUUID() + '@read.test',
      role: 'customer',
      passwordHash,
    },
  });
  const admin = await prisma.user.create({
    data: {
      name: 'Read admin',
      email: randomUUID() + '@read.test',
      role: 'admin',
      passwordHash,
    },
  });
  await prisma.customerProfile.create({
    data: {
      userId: customer.id,
      fullName: 'Read fixture',
      address: 'Semarang',
      phoneActive: '+6281234567890',
      nikCiphertext: 'must-never-leak',
      completedAt: initial,
    },
  });
  const sessions = await Promise.all([
    auth.login(customer.email!, password),
    auth.login(admin.email!, password),
  ]);
  const contexts = await Promise.all(
    sessions.map((session) => auth.authenticate(session.token)),
  );
  const price = 9007199254740993n;
  const item = await prisma.item.create({
    data: {
      name: 'Report item ' + randomUUID(),
      category: 'accessory',
      includes: [],
      price6h: price,
      price12h: price,
      price24h: price,
      units: { create: { code: 'READ-' + randomUUID() } },
    },
    include: { units: true },
  });
  function headers(actor: number, multipart = false) {
    return {
      Cookie: 'irent_session=' + sessions[actor].token,
      Origin: 'http://localhost:5173',
      'X-CSRF-Token': sessions[actor].csrfToken,
      ...(multipart ? {} : { 'Content-Type': 'application/json' }),
    };
  }
  async function get(path: string, actor = 1) {
    return fetch(base + '/api' + path, { headers: headers(actor) });
  }
  const booking = await bookings.create(
    contexts[0],
    {
      startAt: formatWibDateTime(tomorrow),
      durationHours: 6,
      items: [{ itemId: item.id, quantity: 1 }],
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
  const period = { kind: 'day' as const, period: day, page: 1, limit: 100 };
  const before = await reports.read(contexts[1], period);
  let proofId: string;

  await t.test(
    'requires_admin_and_returns_paginated_accounts_without_identity_secrets',
    async () => {
      for (const path of [
        '/admin/customers',
        '/admin/accounts',
        '/admin/tasks',
        '/admin/refunds',
        '/admin/extensions',
        '/admin/reports?period=' + day,
        '/admin/api-docs',
      ]) {
        assert.equal((await fetch(base + '/api' + path)).status, 401);
        assert.equal((await get(path, 0)).status, 403);
      }
      const response = await get(
        '/admin/customers?search=' + encodeURIComponent(customer.email!),
      );
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.total, 1);
      assert.equal(body.data[0].id, customer.id);
      assert.equal(JSON.stringify(body).includes('nik'), false);
      assert.equal(JSON.stringify(body).includes('password'), false);
      assert.equal((await get('/admin/customers?limit=101')).status, 400);
      const docs = await (await get('/admin/api-docs')).json();
      assert.ok(docs.paths['/api/admin/reports/excel']);
      assert.ok(docs.paths['/api/admin/calendar']);
      const pageParameter = docs.paths[
        '/api/admin/reports'
      ].get.parameters.find(
        (parameter: { name: string }) => parameter.name === 'page',
      );
      assert.equal(pageParameter.required, false);
      assert.equal(pageParameter.schema.type, 'integer');
      assert.deepEqual(docs.paths['/api/admin/calendar'].get.security, [
        { cookie: [] },
      ]);
      assert.equal(docs.paths['/api/payment-options'].get.security, undefined);
      assert.ok(
        docs.paths['/api/admin/items/{id}/photo'].post.requestBody.content[
          'multipart/form-data'
        ],
      );
    },
  );
  await t.test(
    'pending_proof_creates_an_actionable_task_but_never_cash_or_successful_transaction',
    async () => {
      const data = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
      const proof = await payments.upload(
        contexts[0],
        booking.id,
        booking.obligations[0].id,
        { claimedAmount: price.toString() },
        { buffer: data, size: data.length, mimetype: 'application/pdf' },
        randomUUID(),
      );
      proofId = proof.proofId!;
      const body = await (await get('/admin/tasks?kind=payment')).json();
      assert.equal(typeof body.total, 'number');
      const task = body.data.find((row: { id: string }) => row.id === proofId);
      assert.ok(task);
      assert.equal(task.bookingId, booking.id);
      assert.equal(task.overdue, false);
      assert.match(task.version, /^[a-f0-9]{64}$/);
      assert.equal(JSON.stringify(body).includes('proofPath'), false);
      const report = await reports.read(contexts[1], period);
      assert.equal(report.cash.incoming, before.cash.incoming);
      assert.equal(
        report.successfulTransactions.some((row) => row.id === booking.id),
        false,
      );
    },
  );
  await t.test(
    'calendar_keeps_pending_confirmation_allocations_and_rejects_ambiguous_time',
    async () => {
      const query = new URLSearchParams({
        itemId: item.id,
        startAt: formatWibDateTime(tomorrow),
        endAt: formatWibDateTime(new Date(tomorrow.getTime() + 86400000)),
      });
      const response = await get('/admin/calendar?' + query);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].allocations[0].bookingId, booking.id);
      assert.equal(body.data[0].allocations[0].status, 'menunggu_konfirmasi');
      assert.equal(JSON.stringify(body).includes('deliveryAddress'), false);
      query.set('startAt', '2026-10-09T10:00:00Z');
      assert.equal((await get('/admin/calendar?' + query)).status, 400);
    },
  );
  await t.test(
    'actual_cash_uses_occurred_at_and_xlsx_preserves_bigint_and_literal_formula_like_notes',
    async () => {
      await payments.verify(
        contexts[1],
        booking.id,
        {
          proofId,
          amount: price.toString(),
          method: 'cash',
          occurredAt: formatWibDateTime(initial),
          note: '=HYPERLINK("https://example.invalid")',
        },
        randomUUID(),
      );
      const report = await reports.read(contexts[1], period);
      assert.equal(report.cash.incoming - before.cash.incoming, price);
      assert.equal(
        report.successfulTransactions.some((row) => row.id === booking.id),
        false,
      );
      const tasks = await (await get('/admin/tasks?kind=payment')).json();
      assert.equal(
        tasks.data.some((row: { id: string }) => row.id === proofId),
        false,
      );
      const excel = await get('/admin/reports/excel?period=' + day);
      assert.equal(excel.status, 200);
      assert.match(excel.headers.get('content-type')!, /spreadsheetml/);
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(await excel.arrayBuffer());
      const sheet = book.getWorksheet('Mutasi')!;
      let found = false;
      sheet.eachRow((row) => {
        if (row.getCell(2).value === booking.code) {
          found = true;
          assert.equal(row.getCell(6).value, price.toString());
          assert.equal(row.getCell(10).type, ExcelJS.ValueType.String);
        }
      });
      assert.equal(found, true);
      assert.equal((await get('/admin/reports?period=2026-02-30')).status, 400);
    },
  );
  await t.test(
    'verified_return_changes_tasks_and_completed_report_without_automatic_readiness',
    async () => {
      now = new Date(tomorrow);
      await operations.handover(
        contexts[1],
        booking.id,
        {
          pickedUpAt: formatWibDateTime(now),
          conditionNote: 'Kondisi baik saat diserahkan.',
        },
        randomUUID(),
      );
      now = new Date(tomorrow.getTime() + 6 * 3600000);
      await operations.report(
        contexts[0],
        booking.id,
        booking.items[0].id,
        randomUUID(),
      );
      const returnTasks = await (await get('/admin/tasks?kind=return')).json();
      assert.equal(
        returnTasks.data.some(
          (row: { bookingId: string }) => row.bookingId === booking.id,
        ),
        true,
      );
      await operations.verifyReturn(
        contexts[1],
        booking.id,
        booking.items[0].id,
        {
          receivedAtStore: formatWibDateTime(now),
          condition: 'layak',
          conditionNote: 'Barang kembali lengkap dan baik.',
          damageAmount: '0',
        },
        randomUUID(),
      );
      const pending = await (await get('/admin/tasks?kind=return')).json();
      assert.equal(
        pending.data.some(
          (row: { bookingId: string }) => row.bookingId === booking.id,
        ),
        false,
      );
      const preparation = await (
        await get('/admin/tasks?kind=preparation')
      ).json();
      assert.equal(
        preparation.data.some(
          (row: { id: string }) => row.id === item.units[0].id,
        ),
        true,
      );
      const current = await prisma.itemUnit.findUniqueOrThrow({
        where: { id: item.units[0].id },
      });
      assert.equal(current.physicalStatus, 'preparing');
      const report = await reports.read(contexts[1], {
        ...period,
        period: nextDay,
      });
      assert.equal(
        report.successfulTransactions.some((row) => row.id === booking.id),
        true,
      );
      assert.equal(
        report.journal.data.some((row) => row.booking.id === booking.id),
        false,
      );
    },
  );
  await t.test(
    'receipt_correction_is_atomic_immutable_idempotent_and_does_not_reopen_completed_bookings',
    async () => {
      const original = await prisma.payment.findFirstOrThrow({
        where: { bookingId: booking.id, direction: 'in' },
      });
      const input = {
        amount: (price - 10000n).toString(),
        occurredAt: formatWibDateTime(initial),
        method: 'cash' as const,
        note: 'Nominal aktual diperiksa ulang.',
        reason: 'Salah mengetik nominal receipt awal.',
      };
      const endpoint =
          base +
          '/api/admin/bookings/' +
          booking.id +
          '/payments/' +
          original.id +
          '/correct',
        key = randomUUID();
      assert.equal(
        (
          await fetch(endpoint, {
            method: 'POST',
            headers: { ...headers(0), 'Idempotency-Key': key },
            body: JSON.stringify(input),
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(endpoint, {
            method: 'POST',
            headers: { ...headers(1), 'Idempotency-Key': key },
            body: JSON.stringify({ ...input, reason: ' ' }),
          })
        ).status,
        400,
      );
      const results = await Promise.all(
        Array.from({ length: 2 }, () =>
          fetch(endpoint, {
            method: 'POST',
            headers: { ...headers(1), 'Idempotency-Key': key },
            body: JSON.stringify(input),
          }),
        ),
      );
      results.forEach((response) => assert.equal(response.status, 201));
      const [a, b] = await Promise.all(
        results.map((response) => response.json()),
      );
      assert.equal(a.decision, b.decision);
      assert.equal(a.summary.remaining, '10000');
      assert.equal(a.booking.status, 'selesai');
      const preserved = await prisma.payment.findUniqueOrThrow({
        where: { id: original.id },
      });
      assert.equal(preserved.amount, original.amount);
      assert.equal(preserved.note, original.note);
      assert.equal(
        preserved.occurredAt.getTime(),
        original.occurredAt.getTime(),
      );
      assert.ok(preserved.supersededAt);
      const correction = await prisma.receiptCorrection.findUniqueOrThrow({
        where: { originalPaymentId: original.id },
      });
      assert.equal(correction.reversalAmount, price);
      assert.equal(
        await prisma.receiptCorrection.count({
          where: { originalPaymentId: original.id },
        }),
        1,
      );
      assert.equal(
        (await reports.read(contexts[1], period)).cash.incoming -
          before.cash.incoming,
        price - 10000n,
      );
      assert.equal(
        (
          await reports.read(contexts[1], { ...period, period: nextDay })
        ).successfulTransactions.some((row) => row.id === booking.id),
        false,
      );
      assert.equal(
        (
          await prisma.itemUnit.findUniqueOrThrow({
            where: { id: item.units[0].id },
          })
        ).physicalStatus,
        'preparing',
      );
      await assert.rejects(
        prisma.payment.update({
          where: { id: original.id },
          data: { amount: 1n },
        }),
        /immutable/,
      );
      await assert.rejects(
        prisma.receiptCorrection.update({
          where: { id: correction.id },
          data: { reason: 'Rewrite attempted' },
        }),
        /immutable/,
      );
      assert.equal(
        (
          await fetch(endpoint, {
            method: 'POST',
            headers: { ...headers(1), 'Idempotency-Key': randomUUID() },
            body: JSON.stringify(input),
          })
        ).status,
        409,
      );
      await payments.recordSettlement(
        contexts[1],
        booking.id,
        {
          amount: '10000',
          occurredAt: formatWibDateTime(now),
          method: 'cash',
          note: 'Pelunasan selisih setelah koreksi.',
        },
        randomUUID(),
      );
      assert.equal(
        (
          await reports.read(contexts[1], { ...period, period: nextDay })
        ).successfulTransactions.some((row) => row.id === booking.id),
        true,
      );
      assert.equal(
        await prisma.auditLog.count({
          where: { entityId: original.id, action: 'payment.corrected' },
        }),
        1,
      );
    },
  );
  await t.test(
    'correction_overpayment_creates_manual_refund_and_blocks_recorrection_of_reserved_refund_money',
    async () => {
      const receipt = await prisma.payment.findFirstOrThrow({
        where: {
          bookingId: booking.id,
          type: 'settlement',
          supersededAt: null,
        },
      });
      const corrections = app.get(ReceiptCorrectionsService);
      const result = await corrections.correct(
        contexts[1],
        booking.id,
        receipt.id,
        {
          amount: '15000',
          occurredAt: formatWibDateTime(now),
          method: 'cash',
          note: 'Uang tunai diterima 15 ribu.',
          reason: 'Penerimaan pelunasan lebih besar dari catatan.',
        },
        randomUUID(),
      );
      assert.equal(result.summary.remaining, 0n);
      assert.equal(result.summary.refundRequested, 5000n);
      const linked = await prisma.receiptCorrection.findUniqueOrThrow({
        where: { originalPaymentId: receipt.id },
      });
      const request = await prisma.refundRequest.findFirstOrThrow({
        where: { bookingId: booking.id, status: 'diajukan' },
      });
      const queries = await (
        await get('/admin/refunds?bookingId=' + booking.id)
      ).json();
      assert.equal(queries.total, 1);
      assert.equal(queries.data[0].requestedAmount, '5000');
      assert.equal(JSON.stringify(queries).includes('recipientDetails'), false);
      const beforeAttempt = await prisma.payment.count({
        where: { bookingId: booking.id },
      });
      await assert.rejects(
        corrections.correct(
          contexts[1],
          booking.id,
          linked.replacementPaymentId,
          {
            amount: '14000',
            occurredAt: formatWibDateTime(now),
            method: 'cash',
            note: 'Periksa ulang uang tunai.',
            reason: 'Koreksi dengan refund yang masih aktif.',
          },
          randomUUID(),
        ),
        /refund aktif/,
      );
      assert.equal(
        await prisma.payment.count({ where: { bookingId: booking.id } }),
        beforeAttempt,
      );
      const refunds = app.get(RefundsService);
      await refunds.recipient(
        contexts[0],
        request.id,
        {
          bankName: 'BCA',
          accountNumber: '1234567890',
          accountHolder: 'Read customer',
        },
        randomUUID(),
      );
      await refunds.approve(contexts[1], request.id, randomUUID());
      const report = await reports.read(contexts[1], {
        ...period,
        period: nextDay,
      });
      assert.ok(report.pendingRefundsNow >= 5000n);
      assert.equal(report.cash.outgoing, 0n);
    },
  );
  async function freshPaid() {
    now = new Date(initial);
    const freshItem = await prisma.item.create({
      data: {
        name: 'Correction fixture ' + randomUUID(),
        category: 'accessory',
        includes: [],
        price6h: 50000n,
        price12h: 50000n,
        price24h: 50000n,
        units: { create: { code: 'CORR-' + randomUUID() } },
      },
    });
    const row = await bookings.create(
      contexts[0],
      {
        startAt: formatWibDateTime(tomorrow),
        durationHours: 6,
        items: [{ itemId: freshItem.id, quantity: 1 }],
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
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const uploaded = await payments.upload(
      contexts[0],
      row.id,
      row.obligations[0].id,
      { claimedAmount: '50000' },
      { buffer: pdf, size: pdf.length, mimetype: 'application/pdf' },
      randomUUID(),
    );
    const reference = randomUUID();
    await payments.verify(
      contexts[1],
      row.id,
      {
        proofId: uploaded.proofId!,
        amount: '50000',
        method: 'transfer',
        receivingAccountReference: 'correction-merchant',
        transactionReference: reference,
        occurredAt: formatWibDateTime(now),
        note: 'Uang awal diterima di rekening.',
      },
      randomUUID(),
    );
    return { row, pdf, reference };
  }
  await t.test(
    'correction_preserves_bank_claim_and_cancellation_refunds_only_the_latest_receipt',
    async () => {
      const { row, reference } = await freshPaid(),
        corrections = app.get(ReceiptCorrectionsService);
      const original = await prisma.payment.findFirstOrThrow({
        where: { bookingId: row.id, direction: 'in' },
      });
      const input = {
        amount: '40000',
        occurredAt: formatWibDateTime(now),
        method: 'transfer' as const,
        receivingAccountReference: 'correction-merchant',
        transactionReference: reference,
        note: 'Nominal masuk empat puluh ribu.',
        reason: 'Nominal receipt awal salah dicatat.',
      };
      const outcomes = await Promise.allSettled([
        corrections.correct(
          contexts[1],
          row.id,
          original.id,
          input,
          randomUUID(),
        ),
        corrections.correct(
          contexts[1],
          row.id,
          original.id,
          input,
          randomUUID(),
        ),
      ]);
      assert.equal(
        outcomes.filter((outcome) => outcome.status === 'fulfilled').length,
        1,
      );
      assert.equal(
        (await payments.detail(contexts[1], row.id)).summary.remaining,
        10000n,
      );
      const other = await freshPaid();
      const otherReceipt = await prisma.payment.findFirstOrThrow({
        where: { bookingId: other.row.id, direction: 'in' },
      });
      await assert.rejects(
        corrections.correct(
          contexts[1],
          other.row.id,
          otherReceipt.id,
          input,
          randomUUID(),
        ),
        /sudah tercatat/,
      );
      assert.equal(
        (
          await prisma.payment.findUniqueOrThrow({
            where: { id: otherReceipt.id },
          })
        ).supersededAt,
        null,
      );
      const closed = await app!
        .get(RefundsService)
        .cancel(
          contexts[1],
          row.id,
          'Toko membatalkan pesanan pelanggan.',
          randomUUID(),
          true,
        );
      assert.equal(closed.summary.received, 40000n);
      assert.equal(closed.summary.refundRequested, 40000n);
      const sources = await prisma.refundSource.findMany({
        where: { bookingId: row.id },
      });
      assert.equal(
        sources.some((source) => source.incomingPaymentId === original.id),
        false,
      );
    },
  );
  await t.test(
    'corrected_approved_extension_can_be_settled_in_its_scope_without_rescheduling',
    async () => {
      const { row, pdf } = await freshPaid(),
        extensions = app.get(ExtensionsService);
      now = new Date(tomorrow);
      await operations.handover(
        contexts[1],
        row.id,
        {
          pickedUpAt: formatWibDateTime(now),
          conditionNote: 'Barang diserahkan dengan baik.',
        },
        randomUUID(),
      );
      const created = await extensions.create(
        contexts[0],
        row.id,
        { items: [{ bookingItemId: row.items[0].id, addedHours: 6 }] },
        randomUUID(),
      );
      const extensionId = created.decision!;
      const upload = await extensions.upload(
        contexts[0],
        row.id,
        extensionId,
        { claimedAmount: '50000' },
        { buffer: pdf, size: pdf.length, mimetype: 'application/pdf' },
        randomUUID(),
      );
      await extensions.verify(
        contexts[1],
        row.id,
        extensionId,
        {
          proofId: upload.proofId!,
          amount: '50000',
          method: 'cash',
          occurredAt: formatWibDateTime(now),
          note: 'Perpanjangan lunas tunai.',
        },
        randomUUID(),
      );
      const original = await prisma.payment.findFirstOrThrow({
        where: { bookingId: row.id, extensionId, direction: 'in' },
      });
      const endBefore = (
        await prisma.bookingItem.findUniqueOrThrow({
          where: { id: row.items[0].id },
        })
      ).currentEndAt;
      await app!.get(ReceiptCorrectionsService).correct(
        contexts[1],
        row.id,
        original.id,
        {
          amount: '40000',
          method: 'cash',
          occurredAt: formatWibDateTime(now),
          note: 'Uang aktual empat puluh ribu.',
          reason: 'Salah input nominal perpanjangan.',
        },
        randomUUID(),
      );
      const settlement = await fetch(
        base + '/api/admin/bookings/' + row.id + '/settlement',
        {
          method: 'POST',
          headers: { ...headers(1), 'Idempotency-Key': randomUUID() },
          body: JSON.stringify({
            extensionId,
            amount: '10000',
            occurredAt: formatWibDateTime(now),
            method: 'cash',
            note: 'Pelunasan kekurangan perpanjangan.',
          }),
        },
      );
      assert.equal(settlement.status, 201);
      const scope = await prisma.$transaction((tx) =>
        app.get(PaymentLedgerService).summary(tx, row.id, extensionId),
      );
      assert.equal(scope.remaining, 0n);
      assert.equal(scope.received, 50000n);
      assert.equal(
        (
          await prisma.bookingItem.findUniqueOrThrow({
            where: { id: row.items[0].id },
          })
        ).currentEndAt.getTime(),
        endBefore.getTime(),
      );
      assert.equal(
        (
          await prisma.extension.findUniqueOrThrow({
            where: { id: extensionId },
          })
        ).status,
        'disetujui',
      );
      const listing = await (
        await get('/admin/extensions?bookingId=' + row.id + '&status=disetujui')
      ).json();
      assert.equal(listing.total, 1);
      assert.equal(listing.data[0].id, extensionId);
    },
  );
  await t.test(
    'return_corrections_append_fee_adjustments_and_preserve_physical_preparation_and_audit',
    async () => {
      const { row } = await freshPaid();
      now = new Date(tomorrow);
      await operations.handover(
        contexts[1],
        row.id,
        {
          pickedUpAt: formatWibDateTime(now),
          conditionNote: 'Barang diserahkan dengan baik.',
        },
        randomUUID(),
      );
      now = new Date(tomorrow.getTime() + 8 * 3600000);
      await operations.verifyReturn(
        contexts[1],
        row.id,
        row.items[0].id,
        {
          receivedAtStore: formatWibDateTime(now),
          condition: 'layak',
          conditionNote: 'Periksa kondisi setelah kembali.',
          damageAmount: '10000',
          damageNote: 'Ganti kabel sesuai pemeriksaan.',
        },
        randomUUID(),
      );
      await payments.recordSettlement(
        contexts[1],
        row.id,
        {
          amount: '20000',
          occurredAt: formatWibDateTime(now),
          method: 'cash',
          note: 'Pelunasan denda dan kerusakan.',
        },
        randomUUID(),
      );
      const beforeUnit = await prisma.itemUnit.findUniqueOrThrow({
        where: { id: row.items[0].itemUnitId },
      });
      const originalReturn = await prisma.returnRecord.findUniqueOrThrow({
        where: { bookingItemId: row.items[0].id },
      });
      const input = {
        receivedAtStore: formatWibDateTime(
          new Date(tomorrow.getTime() + 6 * 3600000),
        ),
        conditionNote: 'Kabel ternyata lengkap dan masih baik.',
        damageAmount: '0',
        reason: 'Waktu penerimaan dan kerusakan salah dicatat.',
      };
      const key = randomUUID(),
        endpoint =
          base +
          '/api/admin/bookings/' +
          row.id +
          '/items/' +
          row.items[0].id +
          '/return/correct';
      assert.equal(
        (
          await fetch(endpoint, {
            method: 'POST',
            headers: { ...headers(0), 'Idempotency-Key': key },
            body: JSON.stringify(input),
          })
        ).status,
        403,
      );
      const attempts = await Promise.all(
        Array.from({ length: 2 }, () =>
          fetch(endpoint, {
            method: 'POST',
            headers: { ...headers(1), 'Idempotency-Key': key },
            body: JSON.stringify(input),
          }),
        ),
      );
      attempts.forEach((response) => assert.equal(response.status, 201));
      const [a, b] = await Promise.all(
        attempts.map((response) => response.json()),
      );
      assert.equal(a.decision, b.decision);
      assert.equal(a.summary.bill, '50000');
      assert.equal(a.summary.refundRequested, '20000');
      const unit = await prisma.itemUnit.findUniqueOrThrow({
        where: { id: row.items[0].itemUnitId },
      });
      assert.equal(unit.physicalStatus, 'preparing');
      assert.equal(
        unit.preparationUntil!.getTime(),
        beforeUnit.preparationUntil!.getTime(),
      );
      const verified = await prisma.returnRecord.findUniqueOrThrow({
        where: { id: originalReturn.id },
      });
      assert.equal(
        verified.verifiedAt!.getTime(),
        originalReturn.verifiedAt!.getTime(),
      );
      assert.equal(
        await prisma.auditLog.count({
          where: { entityId: row.items[0].id, action: 'return.corrected' },
        }),
        1,
      );
      assert.equal(
        await prisma.bookingCharge.count({
          where: { bookingItemId: row.items[0].id, kind: 'adjustment' },
        }),
        2,
      );
      const refunds = app.get(RefundsService);
      const pending = await prisma.refundRequest.findFirstOrThrow({
        where: { bookingId: row.id, status: 'diajukan' },
      });
      await assert.rejects(
        operations.correctReturn(
          contexts[1],
          row.id,
          row.items[0].id,
          input,
          randomUUID(),
        ),
        /refund yang masih aktif/,
      );
      await refunds.reject(
        contexts[1],
        pending.id,
        'Koreksi penerimaan perlu ditinjau kembali.',
        randomUUID(),
      );
      const raised = await operations.correctReturn(
        contexts[1],
        row.id,
        row.items[0].id,
        {
          ...input,
          receivedAtStore: formatWibDateTime(now),
          reason: 'Waktu aktual kembali dipastikan pukul 18.',
        },
        randomUUID(),
      );
      assert.equal(raised.summary.bill, 60000n);
      assert.equal(raised.summary.refundRequested, 10000n);
      const second = await prisma.refundRequest.findFirstOrThrow({
        where: { bookingId: row.id, status: 'diajukan' },
      });
      await refunds.reject(
        contexts[1],
        second.id,
        'Pengecualian admin perlu diperiksa kembali.',
        randomUUID(),
      );
      const from = formatWibDateTime(
          new Date(tomorrow.getTime() + 7 * 3600000),
        ),
        to = formatWibDateTime(now);
      const exempt = await operations.correctReturn(
        contexts[1],
        row.id,
        row.items[0].id,
        {
          ...input,
          receivedAtStore: to,
          exemptions: [
            {
              type: 'admin',
              from,
              to,
              reason: 'Antrean admin setelah barang diterima.',
            },
            {
              type: 'admin',
              from,
              to,
              reason: 'Interval yang sama dari catatan toko.',
            },
          ],
        },
        randomUUID(),
      );
      assert.equal(exempt.summary.bill, 50000n);
      assert.equal(exempt.summary.refundRequested, 20000n);
      const third = await prisma.refundRequest.findFirstOrThrow({
        where: { bookingId: row.id, status: 'diajukan' },
      });
      await refunds.reject(
        contexts[1],
        third.id,
        'Periksa ulang catatan tanpa menghapus pengecualian.',
        randomUUID(),
      );
      const preserved = await operations.correctReturn(
        contexts[1],
        row.id,
        row.items[0].id,
        {
          ...input,
          receivedAtStore: to,
          reason: 'Perbaiki catatan dan pertahankan pengecualian.',
        },
        randomUUID(),
      );
      assert.equal(preserved.summary.bill, 50000n);
      assert.equal(
        (
          await prisma.returnRecord.findUniqueOrThrow({
            where: { id: originalReturn.id },
          })
        ).manualExemptions instanceof Array,
        true,
      );
      const invalid = await fetch(
        base + '/api/admin/bookings/' + row.id + '/handover',
        {
          method: 'POST',
          headers: { ...headers(1), 'Idempotency-Key': randomUUID() },
          body: JSON.stringify({
            pickedUpAt: '2026-02-30T10:00:00+07:00',
            conditionNote: 'Tanggal penerimaan tidak valid.',
          }),
        },
      );
      assert.equal(invalid.status, 400);
    },
  );
  await t.test(
    'publishes_only_sanitized_item_images_and_never_private_proofs',
    async () => {
      const png = await sharp({
        create: { width: 80, height: 80, channels: 3, background: '#f0b0b0' },
      })
        .png()
        .withMetadata()
        .toBuffer();
      function form(data = png, mime = 'image/png') {
        const form = new FormData();
        form.set(
          'file',
          new Blob([new Uint8Array(data)], { type: mime }),
          'photo.png',
        );
        return form;
      }
      assert.equal(
        (
          await fetch(base + '/api/admin/items/' + item.id + '/photo', {
            method: 'POST',
            headers: headers(0, true),
            body: form(),
          })
        ).status,
        403,
      );
      const response = await fetch(
        base + '/api/admin/items/' + item.id + '/photo',
        { method: 'POST', headers: headers(1, true), body: form() },
      );
      assert.equal(response.status, 201);
      const uploaded = await response.json();
      assert.match(uploaded.path, /^\/media\/items\/.*\.webp$/);
      const image = await fetch(base + uploaded.path);
      assert.equal(image.status, 200);
      assert.equal(image.headers.get('content-type'), 'image/webp');
      assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
      const meta = await sharp(
        Buffer.from(await image.arrayBuffer()),
      ).metadata();
      assert.equal(meta.exif, undefined);
      const stored = await prisma.item.findUniqueOrThrow({
        where: { id: item.id },
      });
      assert.equal(stored.photoPath, uploaded.path);
      const count = (await readdir(join(directory, 'media', 'items'))).length;
      const failed = await fetch(
        base + '/api/admin/items/' + randomUUID() + '/photo',
        { method: 'POST', headers: headers(1, true), body: form() },
      );
      assert.equal(failed.status, 404);
      assert.equal(
        (await readdir(join(directory, 'media', 'items'))).length,
        count,
      );
      assert.equal(
        (
          await fetch(base + '/api/admin/items/' + item.id + '/photo', {
            method: 'POST',
            headers: headers(1, true),
            body: form(Buffer.from('<svg/>')),
          })
        ).status,
        400,
      );
      assert.equal(
        (await fetch(base + '/media/proofs/' + proofId + '.pdf')).status,
        404,
      );
      assert.equal(
        (await fetch(base + '/media/items/anything.svg')).status,
        404,
      );
    },
  );
  await t.test(
    'qris_upload_publishes_lossless_image_and_limits_public_settings_to_payment_options',
    async () => {
      const settings = app.get(SettingsService),
        previous = (await settings.read()).values.qris_image_path;
      const png = await sharp({
        create: { width: 64, height: 64, channels: 3, background: '#ffffff' },
      })
        .png()
        .toBuffer();
      const body = new FormData();
      body.set(
        'file',
        new Blob([new Uint8Array(png)], { type: 'image/png' }),
        'qris.png',
      );
      try {
        const response = await fetch(base + '/api/admin/settings/qris-image', {
          method: 'POST',
          headers: headers(1, true),
          body,
        });
        assert.equal(response.status, 201);
        const result = await response.json();
        assert.match(result.path, /^\/media\/qris\/.*\.png$/);
        const options = await (
          await fetch(base + '/api/payment-options')
        ).json();
        assert.deepEqual(Object.keys(options), ['qrisImagePath']);
        assert.equal(options.qrisImagePath, result.path);
        const image = await fetch(base + options.qrisImagePath);
        const meta = await sharp(
          Buffer.from(await image.arrayBuffer()),
        ).metadata();
        assert.equal(meta.format, 'png');
        assert.equal(meta.width, 64);
        assert.equal(meta.height, 64);
      } finally {
        await settings.update(contexts[1], { qris_image_path: previous });
      }
    },
  );
  await t.test(
    'public_rental_policy_exposes_only_customer_rules_and_current_terms',
    async () => {
      const response = await fetch(base + '/api/rental-policy');
      assert.equal(response.status, 200);
      const policy = await response.json();
      assert.equal(policy.termsVersion, TERMS_VERSION);
      assert.equal(policy.values.min_lead_minutes, 120);
      assert.equal(policy.values.open_time, '08:00');
      assert.equal('qris_image_path' in policy.values, false);
      assert.equal('receiving_account_reference' in policy.values, false);
      assert.deepEqual(Object.keys(policy).sort(), ['termsVersion', 'values']);
    },
  );
});
