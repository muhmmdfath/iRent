import type { BookingStatus } from './types';
export function rupiah(value: string) {
  if (!/^-?\d+$/.test(value)) throw new Error('Nominal tidak valid.');
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(BigInt(value));
}
export function wib(value: string) {
  return (
    new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(value)) + ' WIB'
  );
}
export function localWib(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error('Pilih tanggal dan jam yang valid.');
  const result = value + ':00+07:00';
  const date = new Date(result);
  if (
    !Number.isFinite(date.getTime()) ||
    new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 16) !== value
  )
    throw new Error('Tanggal dan jam belum valid.');
  return result;
}
export function defaultStart() {
  const now = new Date(Date.now() + 7 * 3600000);
  now.setUTCDate(now.getUTCDate() + 1);
  return now.toISOString().slice(0, 10) + 'T10:00';
}
export const statusLabels: Record<BookingStatus, string> = {
  menunggu_pembayaran: 'Dipesan - menunggu pembayaran',
  menunggu_konfirmasi: 'Menunggu verifikasi pembayaran',
  dikonfirmasi: 'Booking dikonfirmasi',
  berjalan: 'Sedang disewa',
  selesai: 'Selesai',
  kedaluwarsa: 'Kedaluwarsa',
  ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan',
};
