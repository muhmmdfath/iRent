import { BadRequestException } from '@nestjs/common';

export const settingsDefaults = {
  dp_amount: '20000',
  hold_minutes: 120,
  urgent_threshold_minutes: 180,
  urgent_hold_minutes: 30,
  min_lead_minutes: 120,
  confirm_sla_hours: 24,
  urgent_confirm_minutes: 60,
  confirm_before_pickup_minutes: 60,
  confirmation_reminder_minutes: 30,
  pickup_escalation_minutes: 20,
  buffer_minutes: 60,
  late_tolerance_minutes: 60,
  late_fee_per_hour: '10000',
  open_time: '08:00',
  close_time: '22:00',
  max_duration_hours: 168,
  booking_open_day: 25,
  no_show_minutes: 180,
  cancel_refund_cutoff_days: 2,
  cancel_refund_percent: 50,
  cancel_full_refund_percent: 75,
  extension_min_lead_minutes: 120,
  extension_hold_minutes: 30,
  extension_confirm_minutes: 60,
  extension_confirm_before_return_minutes: 30,
  qris_image_path: null as string | null,
};
export type SettingsValues = typeof settingsDefaults;
export const MAX_RUPIAH = 9223372036854775807n;
export function rupiah(value: unknown): bigint {
  const normalized =
    typeof value === 'number' && Number.isSafeInteger(value)
      ? String(value)
      : value;
  if (
    typeof normalized !== 'string' ||
    !/^(0|[1-9][0-9]{0,18})$/.test(normalized) ||
    BigInt(normalized) > MAX_RUPIAH
  )
    throw new BadRequestException(
      'Rupiah harus integer nonnegatif dalam rentang BIGINT.',
    );
  return BigInt(normalized);
}
export function publicImage(
  value: unknown,
  folder: 'items' | 'qris',
): string | null {
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    !new RegExp(
      '^/media/' + folder + '/[A-Za-z0-9_-]+\\.(png|jpg|jpeg|webp)$',
    ).test(value)
  )
    throw new BadRequestException('Path gambar publik tidak valid.');
  return value;
}
export function validateSettings(raw: Record<string, unknown>): SettingsValues {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(raw))
    if (!Object.hasOwn(settingsDefaults, key))
      throw new BadRequestException('Key pengaturan tidak dikenal: ' + key);
  for (const [key, initial] of Object.entries(settingsDefaults)) {
    const value = raw[key] === undefined ? initial : raw[key];
    if (key === 'dp_amount' || key === 'late_fee_per_hour')
      result[key] = rupiah(value).toString();
    else if (key === 'qris_image_path')
      result[key] = publicImage(value, 'qris');
    else if (key === 'open_time' || key === 'close_time') {
      if (
        typeof value !== 'string' ||
        !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)
      )
        throw new BadRequestException('Jam operasional harus HH:mm.');
      result[key] = value;
    } else {
      if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < 0 ||
        value > 2147483647
      )
        throw new BadRequestException(
          'Pengaturan ' + key + ' harus integer nonnegatif.',
        );
      result[key] = value;
    }
  }
  const rules = result as SettingsValues;
  if (
    rules.open_time >= rules.close_time ||
    rules.booking_open_day < 1 ||
    rules.booking_open_day > 28 ||
    rules.cancel_refund_percent > 100 ||
    rules.cancel_full_refund_percent > 100 ||
    rules.max_duration_hours < 24 ||
    rules.max_duration_hours > 168 ||
    rules.max_duration_hours % 24 !== 0
  )
    throw new BadRequestException('Rentang pengaturan tidak valid.');
  if (
    rules.urgent_threshold_minutes < rules.min_lead_minutes ||
    rules.urgent_hold_minutes + rules.confirm_before_pickup_minutes >
      rules.min_lead_minutes ||
    rules.hold_minutes + rules.confirm_before_pickup_minutes >
      rules.urgent_threshold_minutes ||
    rules.extension_hold_minutes +
      rules.extension_confirm_before_return_minutes >
      rules.extension_min_lead_minutes
  )
    throw new BadRequestException(
      'Hubungan waktu membentuk deadline yang tidak valid.',
    );
  return rules;
}
