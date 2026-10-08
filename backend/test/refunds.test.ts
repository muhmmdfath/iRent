import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  cancellationPolicy,
  refundShares,
} from '../src/modules/payments/refunds.rules';
import { settingsDefaults } from '../src/modules/settings/settings.rules';

test('cancellation_cutoff_is_strict_timestamp_and_category_uses_applied_funds', () => {
  const start = new Date('2026-10-15T10:00:00.000Z');
  const exact = new Date('2026-10-13T10:00:00.000Z');
  assert.equal(
    cancellationPolicy(settingsDefaults, start, exact, 20000n, 50000n, false)
      .percent,
    0,
  );
  const early = new Date(exact.getTime() - 1);
  assert.equal(
    cancellationPolicy(settingsDefaults, start, early, 20000n, 50000n, false)
      .percent,
    50,
  );
  assert.equal(
    cancellationPolicy(settingsDefaults, start, early, 50000n, 50000n, false)
      .percent,
    75,
  );
  assert.equal(
    cancellationPolicy(settingsDefaults, start, exact, 50000n, 50000n, true)
      .percent,
    100,
  );
});
test('refund_rounds_once_and_preserves_bigint_precision_and_source_caps', () => {
  assert.deepEqual(refundShares([1n, 19999n], 50), {
    total: 20000n,
    refund: 10000n,
    shares: [1n, 9999n],
  });
  assert.deepEqual(refundShares([1n, 2n], 75), {
    total: 3n,
    refund: 2n,
    shares: [1n, 1n],
  });
  const total = 9007199254740993n;
  assert.equal(refundShares([total], 75).refund, 6755399441055745n);
  assert.deepEqual(refundShares([1n, 2n], 100).shares, [1n, 2n]);
});
