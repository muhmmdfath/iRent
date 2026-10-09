import { describe, expect, it } from 'vitest';
import { safeReturnTo } from '@/auth/navigation';
describe('login return destinations', () => {
  it.each([
    'https://example.test',
    '//example.test',
    '/admin/account',
    '/app/../../admin',
    '/app/\\example.test',
    'javascript:alert(1)',
    '/app/%2e%2e/admin',
  ])('rejects external or wrong-role destination %s', (value) => {
    expect(safeReturnTo(value, 'customer')).toBe('/app/');
  });
  it('keeps a same-role deep link including its query and fragment', () => {
    expect(
      safeReturnTo('/admin/bookings/example?tab=proof#payment', 'admin'),
    ).toBe('/admin/bookings/example?tab=proof#payment');
  });
});
