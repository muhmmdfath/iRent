import { BadRequestException } from '@nestjs/common';
import { parseWibDateTime } from '../../shared/time/wib';

export function reportPeriod(kind: 'day' | 'month', period: string) {
  try {
    const date = kind === 'month' ? period + '-01' : period;
    if (
      !(kind === 'month' ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/).test(period)
    )
      throw new Error();
    const start = parseWibDateTime(date + 'T00:00:00+07:00');
    if (start.getUTCFullYear() < 2000 || start.getUTCFullYear() > 9998)
      throw new Error();
    const end = new Date(start);
    if (kind === 'month') end.setUTCMonth(end.getUTCMonth() + 1);
    else end.setUTCDate(end.getUTCDate() + 1);
    return { kind, period, start, end };
  } catch {
    throw new BadRequestException(
      'Periode wajib YYYY-MM-DD (harian) atau YYYY-MM (bulanan).',
    );
  }
}
