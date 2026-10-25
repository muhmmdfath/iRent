import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
} from 'react';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from '@radix-ui/react-icons';
export function DateTimeInput({
  ref,
  className,
  onChange,
  initiallyOpen = false,
  timeRange,
  disabledDate,
  onMonthChange,
  ...props
}: ComponentProps<'input'> & {
  initiallyOpen?: boolean;
  disabledDate?: (date: string) => boolean;
  onMonthChange?: (month: string) => void;
  timeRange?: { from: string; to: string };
}) {
  const input = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [initialValue] = useState(() =>
    String(
      props.value ||
        props.defaultValue ||
        new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10) +
          'T10:00',
    ),
  );
  const [open, setOpen] = useState(initiallyOpen);
  const [month, setMonth] = useState(initialValue.slice(0, 7) + '-01');
  const [selected, setSelected] = useState(initialValue.slice(0, 10));
  const [time, setTime] = useState(initialValue.slice(11, 16));
  useImperativeHandle(ref, () => input.current!);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  useEffect(() => {
    onMonthChange?.(month.slice(0, 7));
  }, [month, onMonthChange]);
  const toggle = () => {
    if (!open) {
      const value =
        input.current?.value ||
        new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10) +
          'T10:00';
      setSelected(value.slice(0, 10));
      setTime(value.slice(11, 16));
      setMonth(value.slice(0, 7) + '-01');
    }
    setOpen(!open);
  };
  const update = (date: string, clock: string) => {
    if (timeRange)
      clock =
        clock < timeRange.from
          ? timeRange.from
          : clock > timeRange.to
            ? timeRange.to
            : clock;
    setSelected(date);
    setTime(clock);
    if (input.current && date) {
      input.current.value = date + 'T' + clock;
      onChange?.({
        type: 'change',
        target: input.current,
        currentTarget: input.current,
      } as ChangeEvent<HTMLInputElement>);
    }
  };
  const current = new Date((month || '2026-01-01') + 'T00:00:00Z');
  const offset = (current.getUTCDay() + 6) % 7;
  const days = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const move = (delta: number) =>
    setMonth(
      new Date(
        Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1),
      )
        .toISOString()
        .slice(0, 10),
    );
  const firstHour = timeRange ? Number(timeRange.from.slice(0, 2)) : 0;
  const lastHour = timeRange ? Number(timeRange.to.slice(0, 2)) : 23;
  const visibleValue = String(props.value ?? selected + 'T' + time);
  const displayDate =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(visibleValue) &&
    Number.isFinite(Date.parse(visibleValue))
      ? new Intl.DateTimeFormat('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(visibleValue.slice(0, 10) + 'T00:00:00Z')) +
        ' · ' +
        visibleValue.slice(11, 16) +
        ' WIB'
      : 'Pilih tanggal dan jam';
  return (
    <div className="styled-date-time" ref={container}>
      <input
        {...props}
        ref={input}
        data-slot="input"
        className={className}
        id={timeRange && props.id ? props.id + '-value' : props.id}
        type={timeRange ? 'hidden' : 'datetime-local'}
        onChange={onChange}
      />
      <button
        ref={trigger}
        id={timeRange ? props.id : undefined}
        className={timeRange ? 'date-time-value' : 'date-time-trigger'}
        type="button"
        aria-label={timeRange ? props['aria-label'] : 'Buka kalender dan jam'}
        aria-describedby={props['aria-describedby']}
        aria-expanded={open}
        aria-controls={panelId}
        disabled={props.disabled}
        onClick={toggle}
      >
        <CalendarIcon aria-hidden="true" />
        {timeRange && <span>{displayDate}</span>}
      </button>
      {open && (
        <div
          className="date-time-popover"
          id={panelId}
          role="group"
          aria-label="Pilih tanggal dan jam"
        >
          <div className="date-time-month">
            <button
              type="button"
              aria-label="Bulan sebelumnya"
              onClick={() => move(-1)}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </button>
            <strong>
              {new Intl.DateTimeFormat('id-ID', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(current)}
            </strong>
            <button
              type="button"
              aria-label="Bulan berikutnya"
              onClick={() => move(1)}
            >
              <ChevronRightIcon aria-hidden="true" />
            </button>
          </div>
          <div className="date-time-days">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
              <span key={day}>{day}</span>
            ))}
            {Array.from({ length: offset }, (_, index) => (
              <span key={'blank-' + index} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const date =
                month.slice(0, 8) + String(index + 1).padStart(2, '0');
              const label = new Intl.DateTimeFormat('id-ID', {
                dateStyle: 'long',
                timeZone: 'UTC',
              }).format(new Date(date + 'T00:00:00Z'));
              return (
                <button
                  key={date}
                  type="button"
                  aria-label={label}
                  aria-pressed={date === selected}
                  disabled={
                    disabledDate?.(date) ||
                    (typeof props.min === 'string' &&
                      date < props.min.slice(0, 10)) ||
                    (typeof props.max === 'string' &&
                      date > props.max.slice(0, 10))
                  }
                  onClick={() => update(date, time)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div className="date-time-clock">
            <ClockIcon aria-hidden="true" />
            <span>Waktu (WIB)</span>
            <select
              aria-label="Jam"
              value={time.slice(0, 2)}
              onChange={(event) =>
                update(selected, event.target.value + time.slice(2))
              }
            >
              {Array.from(
                { length: lastHour - firstHour + 1 },
                (_, index) => firstHour + index,
              ).map((hour) => (
                <option key={hour} value={String(hour).padStart(2, '0')}>
                  {String(hour).padStart(2, '0')}
                </option>
              ))}
            </select>
            <span>:</span>
            <select
              aria-label="Menit"
              value={time.slice(3, 5)}
              onChange={(event) =>
                update(selected, time.slice(0, 3) + event.target.value)
              }
            >
              {Array.from({ length: 60 }, (_, minute) => minute)
                .filter((minute) => {
                  const clock =
                    time.slice(0, 3) + String(minute).padStart(2, '0');
                  return (
                    !timeRange ||
                    (clock >= timeRange.from && clock <= timeRange.to)
                  );
                })
                .map((minute) => (
                  <option key={minute} value={String(minute).padStart(2, '0')}>
                    {String(minute).padStart(2, '0')}
                  </option>
                ))}
            </select>
          </div>
          {timeRange && (
            <p className="date-time-hours-note">
              Jam layanan {timeRange.from}–{timeRange.to} WIB · format 24 jam
            </p>
          )}
          <button
            type="button"
            className="date-time-done"
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            Selesai
          </button>
        </div>
      )}
    </div>
  );
}
