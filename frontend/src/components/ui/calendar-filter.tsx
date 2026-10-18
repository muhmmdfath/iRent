import { dateLabel } from '@/lib/calendar-dates';
import { useEffect, useRef, useState } from 'react';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@radix-ui/react-icons';
import './calendar-filter.css';
export interface DateRange {
  from: string;
  to: string;
}
export function CalendarFilter({
  value,
  onChange,
  label = 'Pilih rentang tanggal',
  title = 'Pilih rentang tanggal',
  mode = 'range',
  maxSpanDays,
  disabledDate,
  active = !!value,
  allowClear = true,
  description,
}: {
  value: DateRange | null;
  onChange: (value: DateRange | null) => void;
  label?: string;
  title?: string;
  mode?: 'range' | 'single' | 'month';
  maxSpanDays?: number;
  disabledDate?: (date: string, from: string | null) => boolean;
  active?: boolean;
  allowClear?: boolean;
  description?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [today] = useState(() =>
    new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10),
  );
  const [month, setMonth] = useState(
    () => (value?.from || today).slice(0, 7) + '-01',
  );
  const [from, setFrom] = useState(value?.from || '');
  const [to, setTo] = useState(value?.to || '');
  const [position, setPosition] = useState({
    left: 16,
    top: 16,
    maxHeight: 600,
  });
  useEffect(() => {
    const element = ref.current!;
    const outside = (event: PointerEvent) => {
      if (element.open && !element.contains(event.target as Node))
        element.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && element.open) {
        element.open = false;
        element.querySelector('summary')?.focus();
      }
    };
    const close = () => {
      element.open = false;
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close);
    };
  }, []);
  const current = new Date(month + 'T00:00:00Z');
  const year = current.getUTCFullYear();
  const count = new Date(
    Date.UTC(year, current.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const offset = (current.getUTCDay() + 6) % 7;
  function close() {
    ref.current!.open = false;
    ref.current!.querySelector('summary')?.focus();
  }
  function choose(date: string) {
    if (mode === 'single') {
      setFrom(date);
      setTo(date);
      onChange({ from: date, to: date });
      close();
      return;
    }
    if (!from || to || date < from) {
      setFrom(date);
      setTo('');
      return;
    }
    setTo(date);
    onChange({ from, to: date });
    close();
  }
  function move(delta: number) {
    setMonth(
      new Date(
        Date.UTC(
          year + (mode === 'month' ? delta : 0),
          current.getUTCMonth() + (mode === 'month' ? 0 : delta),
          1,
        ),
      )
        .toISOString()
        .slice(0, 10),
    );
  }
  return (
    <details
      ref={ref}
      className={'calendar-filter' + (active ? ' is-filtered' : '')}
      onToggle={(event) => {
        if (!event.currentTarget.open) return;
        setFrom(value?.from || '');
        setTo(value?.to || '');
        setMonth((value?.from || today).slice(0, 7) + '-01');
        const rect = event.currentTarget
          .querySelector('summary')!
          .getBoundingClientRect();
        const width = Math.min(336, window.innerWidth - 32);
        const top =
          window.innerHeight - rect.bottom < 450 && rect.top > 460
            ? rect.top - 450
            : rect.bottom + 8;
        setPosition({
          left: Math.max(
            16,
            Math.min(rect.right - width, window.innerWidth - width - 16),
          ),
          top,
          maxHeight: window.innerHeight - top - 16,
        });
      }}
    >
      <summary aria-label={label} title={label}>
        <CalendarIcon aria-hidden="true" />
      </summary>
      <div
        className="calendar-filter-panel"
        role="dialog"
        aria-label={title}
        style={position}
      >
        <h3>{title}</h3>
        <p>
          {mode === 'range'
            ? from && !to
              ? 'Pilih tanggal sampai.'
              : 'Pilih tanggal dari, lalu tanggal sampai.'
            : mode === 'month'
              ? 'Pilih bulan laporan.'
              : 'Pilih tanggal laporan.'}
        </p>
        <div className="calendar-filter-month">
          <button
            type="button"
            aria-label={
              mode === 'month' ? 'Tahun sebelumnya' : 'Bulan sebelumnya'
            }
            onClick={() => move(-1)}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </button>
          <strong>
            {mode === 'month'
              ? year
              : new Intl.DateTimeFormat('id-ID', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                }).format(current)}
          </strong>
          <button
            type="button"
            aria-label={
              mode === 'month' ? 'Tahun berikutnya' : 'Bulan berikutnya'
            }
            onClick={() => move(1)}
          >
            <ChevronRightIcon aria-hidden="true" />
          </button>
        </div>
        {mode === 'month' ? (
          <div className="calendar-filter-months">
            {Array.from({ length: 12 }, (_, index) => {
              const first = new Date(Date.UTC(year, index, 1))
                .toISOString()
                .slice(0, 10);
              const last = new Date(Date.UTC(year, index + 1, 0))
                .toISOString()
                .slice(0, 10);
              const text = new Intl.DateTimeFormat('id-ID', {
                month: 'long',
                timeZone: 'UTC',
              }).format(new Date(first + 'T00:00:00Z'));
              return (
                <button
                  type="button"
                  key={first}
                  aria-label={text + ' ' + year}
                  aria-pressed={value?.from.slice(0, 7) === first.slice(0, 7)}
                  onClick={() => {
                    setFrom(first);
                    setTo(last);
                    onChange({ from: first, to: last });
                    close();
                  }}
                >
                  {text}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="calendar-filter-grid">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
              <span key={day}>{day}</span>
            ))}
            {Array.from({ length: offset }, (_, index) => (
              <span key={'empty-' + index} />
            ))}
            {Array.from({ length: count }, (_, index) => {
              const date =
                month.slice(0, 8) + String(index + 1).padStart(2, '0');
              const starting =
                mode === 'single' || !from || !!to || date < from;
              const disabled =
                !!disabledDate?.(date, starting ? null : from) ||
                (!starting &&
                  maxSpanDays !== undefined &&
                  (Date.parse(date) - Date.parse(from)) / 86400000 >
                    maxSpanDays);
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
                  onClick={() => choose(date)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        )}
        <div className="calendar-filter-footer">
          <p>
            {from
              ? dateLabel(from) +
                (to && to !== from ? ' - ' + dateLabel(to) : '')
              : 'Belum memilih tanggal'}
          </p>
          {description && <p>{description}</p>}
          {allowClear && (from || value) && (
            <button
              className="calendar-filter-reset"
              type="button"
              onClick={() => {
                setFrom('');
                setTo('');
                onChange(null);
                close();
              }}
            >
              Reset filter
            </button>
          )}
        </div>
      </div>
    </details>
  );
}
