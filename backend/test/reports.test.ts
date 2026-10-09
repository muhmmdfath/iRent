import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { reportPeriod } from '../src/modules/reports/reports.rules';

test('reports_use_WIB_calendar_periods_and_reject_invalid_dates', () => {
  const day = reportPeriod('day', '2026-10-09');
  assert.equal(day.start.toISOString(), '2026-10-09T00:00:00.000Z');
  assert.equal(day.end.toISOString(), '2026-10-10T00:00:00.000Z');
  const month = reportPeriod('month', '2026-02');
  assert.equal(month.end.toISOString(), '2026-03-01T00:00:00.000Z');
  assert.throws(() => reportPeriod('day', '2026-02-30'));
  assert.throws(() => reportPeriod('month', '2026-13'));
});
