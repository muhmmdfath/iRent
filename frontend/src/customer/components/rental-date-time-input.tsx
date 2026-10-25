import { useEffect, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { DateTimeInput } from '@/components/ui/date-time-input';
import { customerApi } from '../api';
import type { ComponentProps } from 'react';

// Calendar availability is advisory; booking still checks and allocates atomically.
export function RentalDateTimeInput({
  items,
  durationHours,
  onAvailabilityChange,
  ...props
}: ComponentProps<typeof DateTimeInput> & {
  items: { itemId: string; quantity: number }[];
  durationHours: number;
  onAvailabilityChange?: (available: boolean) => void;
}) {
  const value = String(props.value || props.defaultValue || '');
  const [month, setMonth] = useState(
    () =>
      value.slice(0, 7) ||
      new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7),
  );
  const time = value.slice(11, 16) || '10:00';
  const queries = useQueries({
    queries: items.map((item) => ({
      queryKey: [
        'item-calendar',
        item.itemId,
        month,
        time,
        durationHours,
        item.quantity,
      ],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        customerApi.itemCalendar(
          item.itemId,
          { month, time, durationHours, quantity: item.quantity },
          signal,
        ),
      staleTime: 15000,
      refetchInterval: 30000,
      retry: false,
    })),
  });
  const pending = queries.some((query) => query.isPending || query.isFetching);
  const failed = queries.some((query) => query.isError);
  const disabledDate = (date: string) =>
    !items.length ||
    pending ||
    failed ||
    queries.some(
      (query) =>
        !query.data?.days.some((day) => day.date === date && day.available),
    );
  const available = !disabledDate(value.slice(0, 10));
  useEffect(() => {
    onAvailabilityChange?.(available);
  }, [available, onAvailabilityChange]);
  return (
    <>
      <DateTimeInput
        {...props}
        onMonthChange={setMonth}
        disabledDate={disabledDate}
      />
      <p className="muted text-sm" role="status">
        {failed
          ? 'Ketersediaan belum dapat dimuat. Coba periksa lagi.'
          : pending
            ? 'Memeriksa ketersediaan tanggal...'
            : 'Tanggal abu-abu tidak bisa dipilih.'}
      </p>
      {failed && (
        <button
          type="button"
          className="am-plain-link"
          onClick={() => {
            void Promise.all(queries.map((query) => query.refetch()));
          }}
        >
          Periksa ketersediaan lagi
        </button>
      )}
    </>
  );
}
