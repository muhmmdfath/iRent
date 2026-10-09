import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { lateCharge } from '../src/modules/operations/operations.rules';
import { settingsDefaults } from '../src/modules/settings/settings.rules';
import { parseWibDateTime } from '../src/shared/time/wib';

test('late_fee_uses_snapshot_tolerance_and_rounds_each_started_hour', () => {
  const end = parseWibDateTime('2026-10-09T16:00:00+07:00');
  const fee = (milliseconds: number) =>
    lateCharge(
      end,
      new Date(end.getTime() + milliseconds),
      settingsDefaults,
      [],
    ).fee;
  assert.equal(fee(3600000), 0n);
  assert.equal(fee(3600001), 10000n);
  assert.equal(fee(7200000), 10000n);
  assert.equal(fee(7200001), 20000n);
  assert.equal(
    lateCharge(
      end,
      new Date(end.getTime() + 7200001),
      { ...settingsDefaults, late_fee_per_hour: '9007199254740993' },
      [],
    ).fee,
    18014398509481986n,
  );
  assert.throws(
    () =>
      lateCharge(
        end,
        new Date(end.getTime() + 7200001),
        { ...settingsDefaults, late_fee_per_hour: '9223372036854775807' },
        [],
      ),
    /rentang rupiah/,
  );
});

test('exemptions_union_overlaps_and_ignore_time_outside_the_charge_window', () => {
  const end = parseWibDateTime('2026-10-09T16:00:00+07:00');
  const at = (minutes: number) => new Date(end.getTime() + minutes * 60000);
  const result = lateCharge(end, at(180), settingsDefaults, [
    { from: at(-100), to: at(90), type: 'admin', reason: 'Admin delay' },
    { from: at(80), to: at(150), type: 'courier', reason: 'Courier delay' },
    { from: at(140), to: at(500), type: 'admin', reason: 'Admin delay' },
    { from: at(600), to: at(700), type: 'courier', reason: 'Outside window' },
  ]);
  assert.equal(result.fee, 0n);
  assert.equal(result.excludedSeconds, 7200);
  assert.equal(result.courierSeconds + result.adminSeconds, 7200);
});
