import { BadRequestException } from '@nestjs/common';
import { SettingsValues, MAX_RUPIAH } from '../settings/settings.rules';
import { parseWibDateTime } from '../../shared/time/wib';
export function rentalPrice(
  tariffs: { price6h: bigint; price12h: bigint; price24h: bigint },
  hours: number,
): bigint {
  if (
    hours !== 6 &&
    hours !== 12 &&
    (hours < 24 || hours > 168 || hours % 24 !== 0)
  )
    throw new BadRequestException('Durasi sewa tidak valid.');
  const price =
    hours === 6
      ? tariffs.price6h
      : hours === 12
        ? tariffs.price12h
        : tariffs.price24h * BigInt(hours / 24);
  if (price < 0n || price > MAX_RUPIAH)
    throw new BadRequestException('Harga melampaui rentang rupiah.');
  return price;
}
export function validateSchedule(
  start: string,
  hours: number,
  rules: SettingsValues,
  now: Date,
) {
  let startAt: Date;
  try {
    startAt = parseWibDateTime(start);
  } catch {
    throw new BadRequestException('Jadwal harus datetime WIB yang valid.');
  }
  rentalPrice({ price6h: 0n, price12h: 0n, price24h: 0n }, hours);
  if (hours > rules.max_duration_hours)
    throw new BadRequestException('Durasi melebihi batas sewa.');
  const endAt = new Date(startAt.getTime() + hours * 3600000);
  if (startAt.getTime() < now.getTime() + rules.min_lead_minutes * 60000)
    throw new BadRequestException('Jadwal terlalu dekat.');
  const [oh, om] = rules.open_time.split(':').map(Number),
    [ch, cm] = rules.close_time.split(':').map(Number);
  const open = (oh * 60 + om) * 60000,
    close = (ch * 60 + cm) * 60000;
  for (const time of [startAt, endAt]) {
    const dayTime =
      (time.getUTCHours() * 60 + time.getUTCMinutes()) * 60000 +
      time.getUTCSeconds() * 1000 +
      time.getUTCMilliseconds();
    if (dayTime < open || dayTime > close)
      throw new BadRequestException(
        'Ambil dan kembali wajib dalam jam operasional.',
      );
  }
  const month =
    now.getUTCMonth() + (now.getUTCDate() >= rules.booking_open_day ? 1 : 0);
  const limit = Date.UTC(now.getUTCFullYear(), month + 1, 1);
  if (startAt.getTime() >= limit)
    throw new BadRequestException('Booking bulan tersebut belum dibuka.');
  return { startAt, endAt };
}
export function paymentChoice(
  total: bigint,
  dp: bigint,
  requested: 'dp' | 'full',
) {
  if (total < 0n || total > MAX_RUPIAH || dp < 0n || dp > MAX_RUPIAH)
    throw new BadRequestException('Total melampaui rentang rupiah.');
  const mustPayFull = total <= dp;
  const payOption = mustPayFull ? 'full' : requested;
  return {
    mustPayFull,
    payOption,
    amountDueNow: payOption === 'dp' ? dp : total,
  };
}
