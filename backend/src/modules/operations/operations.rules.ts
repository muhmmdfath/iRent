import { BadRequestException } from '@nestjs/common';
import { MAX_RUPIAH, SettingsValues } from '../settings/settings.rules';

export const PREPARATION_MS = 3600000;
export type Exemption = {
  from: Date;
  to: Date;
  type: 'admin' | 'courier';
  reason: string;
};
function unionLength(intervals: [number, number][]) {
  intervals.sort((a, b) => a[0] - b[0]);
  let length = 0,
    from = 0,
    to = 0;
  for (const [start, end] of intervals) {
    if (start >= end) continue;
    if (start > to) {
      length += to - from;
      from = start;
      to = end;
    } else to = Math.max(to, end);
  }
  return length + to - from;
}
export function lateCharge(
  endAt: Date,
  returnedAt: Date,
  rules: SettingsValues,
  exemptions: Exemption[],
) {
  const limit = endAt.getTime() + rules.late_tolerance_minutes * 60000;
  const finish = returnedAt.getTime(),
    raw = Math.max(0, finish - limit);
  const clipped = (type?: Exemption['type']): [number, number][] =>
    exemptions
      .filter((entry) => !type || entry.type === type)
      .map((entry) => [
        Math.max(limit, entry.from.getTime()),
        Math.min(finish, entry.to.getTime()),
      ]);
  const excluded = unionLength(clipped()),
    courier = unionLength(clipped('courier'));
  const lateSeconds = Math.ceil(raw / 1000),
    excludedSeconds = Math.ceil(excluded / 1000);
  const courierSeconds = Math.min(excludedSeconds, Math.ceil(courier / 1000));
  if (lateSeconds > 2147483647)
    throw new BadRequestException('Durasi keterlambatan melampaui batas.');
  const hours = Math.ceil(Math.max(0, raw - excluded) / 3600000);
  const fee = BigInt(hours) * BigInt(rules.late_fee_per_hour);
  if (fee > MAX_RUPIAH)
    throw new BadRequestException('Denda melampaui rentang rupiah.');
  return {
    lateSeconds,
    excludedSeconds,
    courierSeconds,
    adminSeconds: excludedSeconds - courierSeconds,
    hours,
    fee,
  };
}
export function withinOperating(time: Date, rules: SettingsValues) {
  const minutes =
    time.getUTCHours() * 60 +
    time.getUTCMinutes() +
    time.getUTCSeconds() / 60 +
    time.getUTCMilliseconds() / 60000;
  const value = (text: string) => {
    const [hour, minute] = text.split(':').map(Number);
    return hour * 60 + minute;
  };
  return (
    minutes >= value(rules.open_time) && minutes <= value(rules.close_time)
  );
}
