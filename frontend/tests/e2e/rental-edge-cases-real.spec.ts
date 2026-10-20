import { test, expect, type APIRequestContext } from '@playwright/test';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
interface Actor {
  http: APIRequestContext;
  csrf: string;
}
test('real API rental safeguards: contention, retries, underpayment, private inbox and manual refund', async ({
  playwright,
  baseURL,
}) => {
  test.skip(
    !process.env.IRENT_QA_CONTROL,
    'Requires isolated QA databases and a test-only clock.',
  );
  test.setTimeout(120000);
  const cfg = JSON.parse(readFileSync(process.env.IRENT_QA_CONTROL!, 'utf8'));
  const day = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const now = day + 'T06:00:00+07:00';
  writeFileSync(cfg.clockFile + '.tmp', JSON.stringify({ instant: now }));
  renameSync(cfg.clockFile + '.tmp', cfg.clockFile);
  const adminHttp = await playwright.request.newContext({ baseURL });
  const login = await adminHttp.post('/api/auth/login', {
    headers: { Origin: baseURL! },
    data: { identity: cfg.adminEmail, password: cfg.adminPassword },
  });
  expect(login.status()).toBe(200);
  const admin = {
    http: adminHttp,
    csrf: (await login.json()).csrfToken,
  } as Actor;
  const actors: Actor[] = [admin];
  const headers = (actor: Actor, key: string = randomUUID()) => ({
    Origin: baseURL!,
    'X-CSRF-Token': actor.csrf,
    'Idempotency-Key': key,
  });
  async function post(actor: Actor, path: string, data: unknown, key?: string) {
    return actor.http.post('/api' + path, {
      headers: headers(actor, key),
      data,
    });
  }
  async function ok(actor: Actor, path: string, data: unknown, key?: string) {
    const r = await post(actor, path, data, key);
    expect(r.ok(), await r.text()).toBe(true);
    return r.json();
  }
  async function customer() {
    const http = await playwright.request.newContext({ baseURL });
    const registration = await http.post('/api/auth/register', {
      headers: { Origin: baseURL! },
      data: {
        name: 'Penyewa QA ' + randomUUID().slice(0, 6),
        email: randomUUID() + '@example.test',
        password: 'qa-' + randomUUID(),
      },
    });
    expect(registration.status()).toBe(201);
    const actor = { http, csrf: (await registration.json()).csrfToken };
    actors.push(actor);
    const profile = await http.put('/api/customer/profile', {
      headers: headers(actor),
      data: {
        fullName: 'Penyewa Simulasi',
        address: 'Alamat QA Semarang',
        phoneActive: '081234567890',
        nik: '0000000000000001',
      },
    });
    expect(profile.status()).toBe(200);
    return actor;
  }
  async function item() {
    const row = await ok(admin, '/admin/items', {
      category: 'iphone',
      name: 'Perangkat QA ' + randomUUID(),
      includes: [],
      price6h: '60000',
      price12h: '100000',
      price24h: '150000',
    });
    await ok(admin, '/admin/items/' + row.id + '/units', {
      codes: ['QA-' + randomUUID()],
    });
    return row.id;
  }
  function input(itemId: string, days = 0, full = false) {
    const date = new Date(day + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    return {
      startAt: date.toISOString().slice(0, 10) + 'T10:00:00+07:00',
      durationHours: 6,
      items: [{ itemId, quantity: 1 }],
      deliveryType: 'pickup',
      payOption: full ? 'full' : 'dp',
      termsVersion: 'irent-phase1-v1',
      agreeTerms: true,
      prepareIdentity: true,
      understandPayment: true,
      agreeOperatingHours: true,
    };
  }
  async function financial(actor: Actor, id: string) {
    const r = await actor.http.get('/api/bookings/' + id + '/payments');
    expect(r.status()).toBe(200);
    return r.json();
  }
  async function proof(actor: Actor, id: string, amount: string) {
    const f = await financial(actor, id);
    const obligation = f.booking.obligations.find(
      (o: { status: string }) => o.status === 'open',
    );
    const r = await actor.http.post(
      '/api/bookings/' + id + '/obligations/' + obligation.id + '/proofs',
      {
        headers: headers(actor),
        multipart: {
          claimedAmount: amount,
          file: {
            name: 'SIMULASI.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from(
              '%PDF-1.4\n% SIMULASI ' + randomUUID() + '\n%%EOF',
            ),
          },
        },
      },
    );
    expect(r.status()).toBe(201);
    const result = await financial(actor, id);
    return result.booking.obligations
      .flatMap((o: { proofs: { id: string; status: string }[] }) => o.proofs)
      .find((p: { status: string }) => p.status === 'pending').id;
  }
  const a = await customer(),
    b = await customer();
  const model = await item();
  let winner: Actor = a,
    loser: Actor = b,
    bookingId = '',
    winningKey = '',
    payload: ReturnType<typeof input>;
  await test.step('Only one customer can reserve the last unit; replay cannot duplicate it', async () => {
    payload = input(model);
    const keys = [randomUUID(), randomUUID()];
    const responses = await Promise.all([
      post(a, '/bookings', payload, keys[0]),
      post(b, '/bookings', payload, keys[1]),
    ]);
    expect(responses.map((r) => r.status()).sort()).toEqual([201, 409]);
    const index = responses.findIndex((r) => r.status() === 201);
    winner = [a, b][index];
    loser = [a, b][1 - index];
    winningKey = keys[index];
    bookingId = (await responses[index].json()).id;
    const retry = await ok(winner, '/bookings', payload, winningKey);
    expect(retry.id).toBe(bookingId);
    const forbidden = await loser.http.get(
      '/api/bookings/' + bookingId + '/payments',
    );
    expect(forbidden.status()).toBe(404);
  });
  await test.step('Pending proofs are private, and only verified cash reduces the obligation', async () => {
    const original = (await financial(winner, bookingId)).booking.expiresAt;
    const proofId = await proof(winner, bookingId, '20000');
    expect((await financial(winner, bookingId)).summary.received).toBe('0');
    expect(
      (
        await loser.http.get('/api/payment-proofs/' + proofId + '/file')
      ).status(),
    ).toBe(404);
    await ok(admin, '/admin/bookings/' + bookingId + '/payments/verify', {
      proofId,
      amount: '10000',
      occurredAt: now,
      method: 'cash',
      note: 'SIMULASI kurang bayar aktual 10000.',
    });
    const partial = await financial(winner, bookingId);
    expect(partial.booking.status).toBe('menunggu_pembayaran');
    expect(partial.booking.expiresAt).toBe(original);
    expect(partial.booking.obligations[0].remainingAmount).toBe('10000');
    expect(partial.summary.reserved).toBe('10000');
    const second = await proof(winner, bookingId, '10000');
    await ok(
      admin,
      '/admin/bookings/' + bookingId + '/proofs/' + second + '/reject',
      { reason: 'SIMULASI bukti tidak terbaca.' },
    );
    const rejected = await financial(winner, bookingId);
    expect(rejected.booking.status).toBe('menunggu_pembayaran');
    expect(rejected.booking.expiresAt).toBe(original);
    const replacement = await proof(winner, bookingId, '10000');
    const verification = {
      proofId: replacement,
      amount: '10000',
      occurredAt: now,
      method: 'cash',
      note: 'SIMULASI pelengkapan DP aktual.',
    };
    const results = await Promise.all([
      post(
        admin,
        '/admin/bookings/' + bookingId + '/payments/verify',
        verification,
      ),
      post(
        admin,
        '/admin/bookings/' + bookingId + '/payments/verify',
        verification,
      ),
    ]);
    expect(results.filter((r) => r.ok())).toHaveLength(1);
    const confirmed = await financial(winner, bookingId);
    expect(confirmed.booking.status).toBe('dikonfirmasi');
    expect(confirmed.summary.received).toBe('20000');
    expect(confirmed.summary.applied).toBe('20000');
    expect(confirmed.summary.remaining).toBe('40000');
  });
  await test.step('Notification read state belongs to its owner', async () => {
    const inbox = await (await winner.http.get('/api/notifications')).json();
    const entry = inbox.data.find(
      (n: { href: string }) => n.href === '/app/bookings/' + bookingId,
    );
    expect(entry).toBeTruthy();
    const other = await (await loser.http.get('/api/notifications')).json();
    expect(other.total).toBe(0);
    expect(
      (await post(loser, '/notifications/' + entry.id + '/read', {})).status(),
    ).toBe(404);
    await ok(winner, '/notifications/read-all', {});
    const read = await (await winner.http.get('/api/notifications')).json();
    expect(read.unread).toBe(0);
  });
  await test.step('Full-payment cancellation produces a 75 percent refund, and approval alone does not transfer money', async () => {
    const model = await item();
    const row = await ok(b, '/bookings', input(model, 3, true));
    const id = row.id;
    const p = await proof(b, id, '60000');
    await ok(admin, '/admin/bookings/' + id + '/payments/verify', {
      proofId: p,
      amount: '60000',
      occurredAt: now,
      method: 'cash',
      note: 'SIMULASI pembayaran penuh aktual.',
    });
    await ok(b, '/bookings/' + id + '/cancel', {
      reason: 'SIMULASI pelanggan membatalkan lebih dari dua hari.',
    });
    let value = await financial(b, id);
    expect(value.booking.status).toBe('dibatalkan');
    const refund = value.booking.refunds[0];
    expect(refund.requestedAmount).toBe('45000');
    await ok(b, '/refunds/' + refund.id + '/recipient', {
      bankName: 'Bank Simulasi',
      accountNumber: '0000012345',
      accountHolder: 'Penyewa Simulasi',
    });
    await ok(admin, '/admin/refunds/' + refund.id + '/approve', {});
    value = await financial(b, id);
    expect(value.summary.refunded).toBe('0');
    expect(value.booking.refunds[0].status).toBe('disetujui');
    const transfer = await admin.http.post(
      '/api/admin/refunds/' + refund.id + '/transfer',
      {
        headers: headers(admin),
        multipart: {
          amount: '45000',
          transferredAt: now,
          transactionReference: 'QA-' + randomUUID(),
          note: 'SIMULASI pengembalian manual selesai.',
          file: {
            name: 'refund-SIMULASI.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('%PDF-1.4\n% SIMULASI REFUND\n%%EOF'),
          },
        },
      },
    );
    expect(transfer.status(), await transfer.text()).toBe(201);
    value = await financial(b, id);
    expect(value.summary.refunded).toBe('45000');
    expect(value.booking.refunds[0].status).toBe('sudah_dikembalikan');
  });
  for (const actor of actors) await actor.http.dispose();
});
