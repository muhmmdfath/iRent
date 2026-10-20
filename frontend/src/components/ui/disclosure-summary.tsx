import type { ComponentProps } from 'react';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';
import './disclosure-summary.css';

export function DisclosureSummary({
  children,
  className,
  ...props
}: ComponentProps<'summary'>) {
  return (
    <summary className={cn('disclosure-summary', className)} {...props}>
      <ChevronRightIcon aria-hidden="true" className="disclosure-chevron" />
      {children}
    </summary>
  );
}
