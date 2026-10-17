import type { ComponentProps } from 'react';
import { DateTimeInput } from './date-time-input';
import { cn } from '@/lib/utils';
export function Input({ className, ...props }: ComponentProps<'input'>) {
  if (props.type === 'datetime-local')
    return (
      <DateTimeInput
        {...props}
        className={cn(
          'flex min-h-11 w-full rounded-[10px] border border-input bg-white px-3 py-2.5 text-[13px] disabled:bg-muted aria-invalid:border-destructive',
          className,
        )}
      />
    );
  return (
    <input
      data-slot="input"
      className={cn(
        'flex min-h-11 w-full rounded-[10px] border border-input bg-white px-3 py-2.5 text-[13px] disabled:bg-muted aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
