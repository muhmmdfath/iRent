import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { formatWibDateTime, parseWibDateTime } from '../../src/shared/time/wib';

const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw new Error(
    'TEST_DATABASE_URL wajib diisi dengan database pengujian terpisah.',
  );

test('postgresql_rejects_inconsistent_booking_and_payment_data', async (t) => {
  const client = new Client({ connectionString: url });
  await client.connect();
  const user = randomUUID(),
    item = randomUUID(),
    otherItem = randomUUID();
  const unit = randomUUID(),
    booking = randomUUID(),
    otherBooking = randomUUID();
  const bookingItem = randomUUID(),
    obligation = randomUUID(),
    proof = randomUUID();
  try {
    await client.query('BEGIN');
    await client.query(
      "INSERT INTO users(id,name,email,password_hash,role) VALUES($1,'Fixture','fixture@example.test','not-a-login','customer')",
      [user],
    );
    for (const id of [item, otherItem]) {
      await client.query(
        "INSERT INTO items(id,category,name,includes,price_6h,price_12h,price_24h) VALUES($1,'iphone','Fixture','[]',50000,80000,120000)",
        [id],
      );
    }
    await client.query(
      "INSERT INTO item_units(id,item_id,code) VALUES($1,$2,'FIXTURE-UNIT')",
      [unit, item],
    );
    for (const id of [booking, otherBooking]) {
      await client.query(
        `INSERT INTO bookings(id,code,user_id,initial_start_at,initial_end_at,delivery_type,delivery_fee_snapshot,initial_rental_total,initial_grand_total,dp_snapshot,pay_option,amount_due_now,expires_at,no_show_due_at,terms_version,agreed_terms_at,rules_snapshot)
        VALUES($1::uuid,$1::uuid::text,$2,LOCALTIMESTAMP+INTERVAL '1 day',LOCALTIMESTAMP+INTERVAL '30 hours','pickup',0,50000,50000,20000,'dp',20000,LOCALTIMESTAMP+INTERVAL '12 hours',LOCALTIMESTAMP+INTERVAL '27 hours','test',LOCALTIMESTAMP,'{}')`,
        [id, user],
      );
    }
    await client.query(
      `INSERT INTO booking_items(id,booking_id,item_id,item_unit_id,item_name_snapshot,unit_code_snapshot,initial_start_at,start_at,initial_end_at,current_end_at,unit_price_snapshot,tariff_6h_snapshot,tariff_12h_snapshot,tariff_24h_snapshot)
      VALUES($1,$2,$3,$4,'Fixture','FIXTURE-UNIT',LOCALTIMESTAMP+INTERVAL '1 day',LOCALTIMESTAMP+INTERVAL '1 day',LOCALTIMESTAMP+INTERVAL '30 hours',LOCALTIMESTAMP+INTERVAL '30 hours',50000,50000,80000,120000)`,
      [bookingItem, booking, item, unit],
    );
    await client.query(
      "INSERT INTO payment_obligations(id,booking_id,purpose,amount_due) VALUES($1,$2,'initial_dp',20000)",
      [obligation, booking],
    );
    await client.query(
      "INSERT INTO payment_proofs(id,payment_obligation_id,proof_path,mime,size,file_hash,claimed_amount,uploaded_at) VALUES($1,$2,'private/fixture.png','image/png',100,repeat('a',64),20000,LOCALTIMESTAMP)",
      [proof, obligation],
    );

    async function rejects(
      sql: string,
      values: unknown[],
      code: string | string[],
      constraint: string,
    ): Promise<void> {
      await client.query('SAVEPOINT invalid_case');
      try {
        await assert.rejects(client.query(sql, values), (error: unknown) => {
          assert.ok(error instanceof Error);
          const fields = error as Error & { code: string; constraint: string };
          assert.ok(
            (Array.isArray(code) ? code : [code]).includes(fields.code),
            `Unexpected SQLSTATE ${fields.code}`,
          );
          assert.equal(fields.constraint, constraint);
          return true;
        });
      } finally {
        await client.query('ROLLBACK TO SAVEPOINT invalid_case');
        await client.query('RELEASE SAVEPOINT invalid_case');
      }
    }

    await t.test('rejects_negative_tariffs', () =>
      rejects(
        'UPDATE items SET price_6h=-1 WHERE id=$1',
        [item],
        '23514',
        'items_nonnegative_amounts',
      ),
    );
    await t.test('rejects_a_unit_from_another_catalog_item', () =>
      rejects(
        'UPDATE booking_items SET item_id=$1 WHERE id=$2',
        [otherItem, bookingItem],
        '23503',
        'booking_item_unit_matches_item',
      ),
    );
    await t.test('rejects_duplicate_pending_payment_proofs', () =>
      rejects(
        "INSERT INTO payment_proofs(payment_obligation_id,proof_path,mime,size,file_hash,claimed_amount,uploaded_at) VALUES($1,'private/other.png','image/png',100,repeat('b',64),20000,LOCALTIMESTAMP)",
        [obligation],
        '23505',
        'one_pending_proof_per_obligation',
      ),
    );
    await t.test('rejects_payment_obligations_from_another_booking', () =>
      rejects(
        "INSERT INTO payments(booking_id,payment_obligation_id,direction,type,method,amount,occurred_at,recorded_by,source_key) VALUES($1,$2,'in','dp','qris',20000,LOCALTIMESTAMP,$3,'fixture-payment')",
        [otherBooking, obligation, user],
        '23503',
        'payments_obligation_scope',
      ),
    );
    await t.test('rejects_approved_refunds_without_an_approved_amount', () =>
      rejects(
        "INSERT INTO refund_requests(booking_id,status,reason_code,requested_amount,policy_snapshot,recipient_details,approved_by,approved_at) VALUES($1,'disetujui','test',20000,'{}','{}',$2,LOCALTIMESTAMP)",
        [booking, user],
        '23514',
        'refund_approval_fields',
      ),
    );
    await t.test('requires_a_preparation_deadline', () =>
      rejects(
        "UPDATE item_units SET physical_status='preparing' WHERE id=$1",
        [unit],
        '23514',
        'units_preparation_deadline',
      ),
    );
    await t.test('preserves_history_when_deleting_a_booked_unit', () =>
      rejects(
        'DELETE FROM item_units WHERE id=$1',
        [unit],
        ['23503', '23001'],
        'booking_item_unit_matches_item',
      ),
    );
    await t.test('rejects_duplicate_active_rental_allocations', async () => {
      const sql =
        "INSERT INTO unit_allocations(booking_item_id,item_unit_id,allocation_kind,state,start_at,end_at,block_start_at,block_end_at) SELECT id,item_unit_id,'rental','active',start_at,current_end_at,start_at,current_end_at+INTERVAL '1 hour' FROM booking_items WHERE id=$1";
      await client.query(sql, [bookingItem]);
      await rejects(
        sql,
        [bookingItem],
        '23505',
        'one_active_rental_per_booking_item',
      );
    });
    await t.test(
      'allows_deactivating_a_free_physically_ready_unit',
      async () => {
        const freeUnit = randomUUID();
        await client.query(
          "INSERT INTO item_units(id,item_id,code) VALUES($1,$2,'FIXTURE-FREE')",
          [freeUnit, item],
        );
        await client.query(
          'UPDATE item_units SET is_active=false WHERE id=$1',
          [freeUnit],
        );
        const physical = await client.query<{
          physical_status: string;
          is_active: boolean;
        }>('SELECT physical_status,is_active FROM item_units WHERE id=$1', [
          freeUnit,
        ]);
        assert.equal(physical.rows[0].physical_status, 'ready');
        assert.equal(physical.rows[0].is_active, false);
      },
    );
    await t.test(
      'retains_released_allocations_when_replacing_the_booked_unit',
      async () => {
        const replacement = randomUUID();
        await client.query(
          "INSERT INTO item_units(id,item_id,code) VALUES($1,$2,'FIXTURE-REPLACEMENT')",
          [replacement, item],
        );
        await client.query(
          "UPDATE unit_allocations SET state='released',released_at=LOCALTIMESTAMP,released_reason='replacement' WHERE booking_item_id=$1",
          [bookingItem],
        );
        await client.query(
          'UPDATE booking_items SET item_unit_id=$1 WHERE id=$2',
          [replacement, bookingItem],
        );
        await client.query(
          "INSERT INTO unit_allocations(booking_item_id,item_unit_id,allocation_kind,state,start_at,end_at,block_start_at,block_end_at) SELECT id,item_unit_id,'rental','active',start_at,current_end_at,start_at,current_end_at+INTERVAL '1 hour' FROM booking_items WHERE id=$1",
          [bookingItem],
        );
        await client.query('SET CONSTRAINTS ALL IMMEDIATE');
        const history = await client.query<{ item_unit_id: string }>(
          "SELECT item_unit_id FROM unit_allocations WHERE booking_item_id=$1 AND state='released'",
          [bookingItem],
        );
        assert.equal(history.rows[0].item_unit_id, unit);
        await rejects(
          'UPDATE booking_items SET item_unit_id=$1 WHERE id=$2',
          [unit, bookingItem],
          '23514',
          'allocation_matches_booking_unit',
        );
      },
    );
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});

test('prisma_roundtrips_bigint_and_wib_independently_of_database_session_timezone', async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  const rollback = new Error('rollback fixture');
  try {
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
        const wallTime = parseWibDateTime('2026-10-08T11:30:00+07:00');
        const item = await tx.item.create({
          data: {
            category: 'iphone',
            name: 'Precision fixture',
            includes: [],
            price6h: 9007199254740993n,
            price12h: 0n,
            price24h: 0n,
            createdAt: wallTime,
          },
        });
        const stored = await tx.item.findUniqueOrThrow({
          where: { id: item.id },
        });
        assert.equal(stored.price6h, 9007199254740993n);
        assert.equal(
          formatWibDateTime(stored.createdAt),
          '2026-10-08T11:30:00.000+07:00',
        );
        const updated = await tx.item.update({
          where: { id: item.id },
          data: { name: 'Changed' },
        });
        const clock = await tx.$queryRaw<
          { value: string }[]
        >`SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::timestamp(3), 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS value`;
        assert.equal(
          formatWibDateTime(updated.updatedAt),
          clock[0].value + '+07:00',
        );
        throw rollback;
      }),
      (error: unknown) => error === rollback,
    );
  } finally {
    await prisma.$disconnect();
  }
});
