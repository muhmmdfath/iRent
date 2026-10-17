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
  ...props
}: ComponentProps<'input'> & { initiallyOpen?: boolean }) {
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
  return (
    <div className="styled-date-time" ref={container}>
      <input
        {...props}
        ref={input}
        data-slot="input"
        className={className}
        type="datetime-local"
        onChange={onChange}
      />
      <button
        ref={trigger}
        className="date-time-trigger"
        type="button"
        aria-label="Buka kalender dan jam"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={props.disabled}
        onClick={toggle}
      >
        <CalendarIcon aria-hidden="true" />
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
              {Array.from({ length: 24 }, (_, hour) => (
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
              {Array.from({ length: 60 }, (_, minute) => (
                <option key={minute} value={String(minute).padStart(2, '0')}>
                  {String(minute).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
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
