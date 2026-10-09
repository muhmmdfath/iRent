import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      className={cn(
        'flex min-h-11 w-full rounded-[10px] border border-input bg-white px-3 py-2.5 text-base disabled:bg-muted aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
