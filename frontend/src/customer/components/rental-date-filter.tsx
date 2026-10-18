import { shiftDate } from '@/lib/calendar-dates';
import { useEffect, useState } from 'react';
import { CalendarFilter } from '@/components/ui/calendar-filter';
import { localWib } from '../format';
export interface RentalWindow {
  startAt: string;
  durationHours: number;
}
export function RentalDateFilter({
  value,
  onChange,
}: {
  value: RentalWindow | null;
  onChange: (value: RentalWindow | null) => void;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const from = value?.startAt.slice(0, 10);
  const to =
    from && value
      ? shiftDate(
          from,
          value.durationHours === 6 ? 0 : value.durationHours / 24,
        )
      : null;
  return (
    <div className="rental-calendar-filter">
      <CalendarFilter
        label="Pilih rentang tanggal sewa"
        value={from && to ? { from, to } : null}
        maxSpanDays={7}
        description="Mulai pukul 10.00 WIB. Tanggal sama: 6 jam; rentang berbeda: kembali pukul 10.00 WIB, maksimal 7 hari. Jam bisa disesuaikan saat booking."
        disabledDate={(date, fromDate) => {
          const today = new Date(now + 7 * 3600000).toISOString().slice(0, 10);
          const wib = new Date(now + 7 * 3600000);
          const last = new Date(
            Date.UTC(
              wib.getUTCFullYear(),
              wib.getUTCMonth() + (wib.getUTCDate() >= 25 ? 2 : 1),
              0,
            ),
          )
            .toISOString()
            .slice(0, 10);
          return (
            date < today ||
            (!fromDate &&
              (Date.parse(date + 'T10:00:00+07:00') < now + 2 * 3600000 ||
                date > last))
          );
        }}
        onChange={(range) => {
          if (!range) {
            onChange(null);
            return;
          }
          const days =
            (Date.parse(range.to) - Date.parse(range.from)) / 86400000;
          onChange({
            startAt: localWib(range.from + 'T10:00'),
            durationHours: days === 0 ? 6 : days * 24,
          });
        }}
      />
      {value && (
        <span className="rental-calendar-note" role="status">
          Ketersediaan sesuai tanggal pilihan. Belum menahan unit.
        </span>
      )}
    </div>
  );
}
