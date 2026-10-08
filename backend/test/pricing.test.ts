import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  settingsDefaults,
  validateSettings,
  rupiah,
} from '../src/modules/settings/settings.rules';
import {
  paymentChoice,
  rentalPrice,
  validateSchedule,
} from '../src/modules/pricing/pricing.rules';
import { parseWibDateTime } from '../src/shared/time/wib';

test('prices_6_12_24_48_168_hours_without_weekday_or_weekend_adjustments', () => {
  const tariffs = { price6h: 50000n, price12h: 80000n, price24h: 120000n };
  assert.deepEqual(
    [6, 12, 24, 48, 168].map((hours) => rentalPrice(tariffs, hours)),
    [50000n, 80000n, 120000n, 240000n, 840000n],
  );
  for (const hours of [0, 7, 18, 30, 192])
    assert.throws(() => rentalPrice(tariffs, hours));
  const now = parseWibDateTime('2026-10-08T08:00:00+07:00');
  for (const start of [
    '2026-10-09T10:00:00+07:00',
    '2026-10-10T10:00:00+07:00',
    '2026-10-11T10:00:00+07:00',
  ]) {
    validateSchedule(start, 12, settingsDefaults, now);
    assert.equal(rentalPrice(tariffs, 12), 80000n);
  }
});
test('flat_dp_is_not_multiplied_and_small_totals_always_pay_full', () => {
  assert.deepEqual(paymentChoice(20000n, 20000n, 'dp'), {
    mustPayFull: true,
    payOption: 'full',
    amountDueNow: 20000n,
  });
  assert.equal(paymentChoice(15000n, 20000n, 'dp').amountDueNow, 15000n);
  assert.equal(paymentChoice(600000n, 20000n, 'dp').amountDueNow, 20000n);
  assert.equal(paymentChoice(600000n, 20000n, 'full').amountDueNow, 600000n);
  assert.equal(rupiah('9007199254740993'), 9007199254740993n);
  assert.throws(() => rupiah(Number('9007199254740993')));
  assert.throws(() =>
    rentalPrice(
      { price6h: 0n, price12h: 0n, price24h: 9223372036854775807n },
      48,
    ),
  );
});
test('schedule_enforces_exact_lead_time_operating_hours_and_month_opening', () => {
  const now = parseWibDateTime('2026-10-08T08:00:00+07:00');
  assert.equal(
    validateSchedule(
      '2026-10-08T10:00:00+07:00',
      12,
      settingsDefaults,
      now,
    ).endAt.toISOString(),
    '2026-10-08T22:00:00.000Z',
  );
  for (const start of [
    '2026-10-08T09:59:59+07:00',
    '2026-10-09T10:00:00.001+07:00',
    '2026-11-01T10:00:00+07:00',
  ])
    assert.throws(() => validateSchedule(start, 12, settingsDefaults, now));
  validateSchedule(
    '2026-11-30T10:00:00+07:00',
    24,
    settingsDefaults,
    parseWibDateTime('2026-10-25T08:00:00+07:00'),
  );
  assert.throws(() =>
    validateSchedule(
      '2026-12-01T10:00:00+07:00',
      24,
      settingsDefaults,
      parseWibDateTime('2026-10-25T08:00:00+07:00'),
    ),
  );
});
test('settings_reject_invalid_types_unknown_keys_and_contradictory_deadlines', () => {
  const settings = validateSettings({ dp_amount: 20000 });
  assert.equal(settings.dp_amount, '20000');
  for (const patch of [
    { unknown: 1 },
    { buffer_minutes: -1 },
    { hold_minutes: '120' },
    { open_time: '23:00' },
    { booking_open_day: 29 },
    { cancel_refund_percent: 101 },
    { urgent_hold_minutes: 61 },
    { extension_hold_minutes: 91 },
    { max_duration_hours: 192 },
  ])
    assert.throws(() => validateSettings(patch));
  const isolated = structuredClone(settings);
  isolated.dp_amount = '50000';
  assert.equal(settings.dp_amount, '20000');
});
