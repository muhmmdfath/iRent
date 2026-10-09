import { BadRequestException, ConflictException } from '@nestjs/common';
import { BookingItem } from '../../generated/prisma/client';
import { SettingsValues } from '../settings/settings.rules';
import { rentalPrice } from '../pricing/pricing.rules';
import { withinOperating } from '../operations/operations.rules';

export const pendingExtensions = [
  'draft_quote',
  'menunggu_pembayaran',
  'menunggu_konfirmasi',
] as const;
export function extensionSchedule(
  item: BookingItem,
  hours: number,
  rules: SettingsValues,
  now: Date,
  submitting = true,
) {
  if (!['in_use', 'return_pending'].includes(item.useStatus))
    throw new ConflictException('Unit tidak sedang disewa.');
  if (![6, 12, 24].includes(hours))
    throw new BadRequestException('Paket perpanjangan hanya 6/12/24 jam.');
  if (
    submitting &&
    item.currentEndAt.getTime() - now.getTime() <
      rules.extension_min_lead_minutes * 60000
  )
    throw new ConflictException(
      'Pengajuan paling lambat dua jam sebelum jadwal kembali.',
    );
  const end = new Date(item.currentEndAt.getTime() + hours * 3600000);
  if (
    end.getTime() - item.startAt.getTime() >
    rules.max_duration_hours * 3600000
  )
    throw new ConflictException('Total sewa unit melebihi tujuh hari.');
  if (!withinOperating(end, rules))
    throw new ConflictException('Jadwal baru melewati jam operasional.');
  const price = rentalPrice(
    {
      price6h: item.tariff6hSnapshot,
      price12h: item.tariff12hSnapshot,
      price24h: item.tariff24hSnapshot,
    },
    hours,
  );
  return { end, price };
}
