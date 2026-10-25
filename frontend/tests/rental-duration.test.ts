import { expect, it } from 'vitest';
import {
  rentalDurations,
  durationLabel,
  durationPrice,
} from '@/customer/rental-duration';
it('offers days plus six or twelve hours within the rental limit', () => {
  expect(rentalDurations()).toContain(60);
  expect(rentalDurations()).toContain(54);
  expect(rentalDurations()).not.toContain(18);
  expect(rentalDurations(48)).toEqual([6, 12, 24, 30, 36, 48]);
  expect(durationLabel(60)).toBe('2 hari + 12 jam');
  expect(durationLabel(54)).toBe('2 hari + 6 jam');
  expect(durationLabel(48)).toBe('2 hari');
  expect(
    durationPrice(
      { price24h: '120000', price12h: '80000', price6h: '50000' },
      60,
    ),
  ).toBe('320000');
  expect(
    durationPrice(
      { price24h: '9007199254740993', price12h: '80001', price6h: '50001' },
      60,
    ),
  ).toBe('18014398509561987');
});
