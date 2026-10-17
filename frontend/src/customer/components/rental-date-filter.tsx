import { useEffect, useRef, useState } from 'react';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { defaultStart, localWib } from '../format';
export interface RentalWindow {
  startAt: string;
  durationHours: number;
}
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(date + 'T00:00:00Z'));
export function RentalDateFilter({
  value,
  onChange,
}: {
  value: RentalWindow | null;
  onChange: (value: RentalWindow | null) => void;
}) {
  const panel = useRef<HTMLDetailsElement>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const element = panel.current;
      if (
        element?.open &&
        event.target instanceof Node &&
        !element.contains(event.target)
      )
        element.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && panel.current?.open) {
        panel.current.open = false;
        panel.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);
  const [month, setMonth] = useState(() => defaultStart().slice(0, 7) + '-01');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const current = new Date(month + 'T00:00:00Z');
  const days = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const offset = (current.getUTCDay() + 6) % 7;
  const today = new Date(now + 7 * 3600000).toISOString().slice(0, 10);
  const move = (delta: number) =>
    setMonth(
      new Date(
        Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1),
      )
        .toISOString()
        .slice(0, 10),
    );
  const select = (date: string) => {
    if (!from || to || date < from) {
      setFrom(date);
      setTo('');
      onChange(null);
      return;
    }
    setTo(date);
    const days = Math.round((Date.parse(date) - Date.parse(from)) / 86400000);
    onChange({
      startAt: localWib(from + 'T10:00'),
      durationHours: days === 0 ? 6 : days * 24,
    });
    if (panel.current) panel.current.open = false;
  };
  return (
    <div className="rental-calendar-filter">
      <details
        ref={panel}
        className={'rental-calendar' + (value ? ' has-active-filter' : '')}
      >
        <summary
          aria-label="Pilih rentang tanggal sewa"
          title="Pilih rentang tanggal sewa"
        >
          <CalendarIcon aria-hidden="true" />
          {value && (
            <span>
              {value.startAt.slice(8, 10)}/{value.startAt.slice(5, 7)} -{' '}
              {to.slice(8, 10)}/{to.slice(5, 7)}
            </span>
          )}
        </summary>
        <div className="rental-calendar-panel">
          <h3>Pilih rentang tanggal</h3>
          <p>
            {from && !to
              ? 'Sekarang pilih tanggal kembali.'
              : 'Klik tanggal mulai, lalu tanggal kembali.'}
          </p>
          <div className="rental-calendar-month">
            <Button
              type="button"
              variant="ghost"
              aria-label="Bulan sebelumnya"
              onClick={() => move(-1)}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <strong>
              {new Intl.DateTimeFormat('id-ID', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(current)}
            </strong>
            <Button
              type="button"
              variant="ghost"
              aria-label="Bulan berikutnya"
              onClick={() => move(1)}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>
          <div className="rental-calendar-grid">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
              <span key={day}>{day}</span>
            ))}
            {Array.from({ length: offset }, (_, index) => (
              <span key={'blank-' + index} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const date =
                month.slice(0, 8) + String(index + 1).padStart(2, '0');
              const delta = from
                ? (Date.parse(date) - Date.parse(from)) / 86400000
                : 0;
              const starting = !from || !!to || date < from;
              const tooSoon =
                Date.parse(date + 'T10:00:00+07:00') < now + 2 * 3600000;
              const nowWib = new Date(now + 7 * 3600000);
              const lastStart = new Date(
                Date.UTC(
                  nowWib.getUTCFullYear(),
                  nowWib.getUTCMonth() + (nowWib.getUTCDate() >= 25 ? 2 : 1),
                  0,
                ),
              )
                .toISOString()
                .slice(0, 10);
              const disabled =
                date < today ||
                (starting && (tooSoon || date > lastStart)) ||
                (!!from && !to && delta > 7);
              return (
                <button
                  key={date}
                  type="button"
                  aria-label={dateLabel(date)}
                  aria-pressed={date === from || date === to}
                  disabled={disabled}
                  className={
                    from && to && date > from && date < to ? 'in-range' : ''
                  }
                  onClick={() => select(date)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <p className="rental-calendar-selection">
            {from
              ? dateLabel(from) + (to ? ' sampai ' + dateLabel(to) : '')
              : 'Belum memilih tanggal'}
          </p>
          <p>
            Mulai pukul 10.00 WIB. Tanggal sama: 6 jam; rentang berbeda: kembali
            pukul 10.00 WIB, maksimal 7 hari. Jam bisa disesuaikan saat booking.
          </p>
          {(from || value) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFrom('');
                setTo('');
                onChange(null);
                panel.current?.querySelector('summary')?.focus();
              }}
            >
              Reset filter
            </Button>
          )}
        </div>
      </details>
      {value && (
        <span className="rental-calendar-note" role="status">
          Ketersediaan sesuai tanggal pilihan. Belum menahan unit.
        </span>
      )}
    </div>
  );
}
