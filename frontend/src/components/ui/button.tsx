import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
const variants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-5 py-2.5 text-base font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-action-hover',
        outline: 'border border-border bg-white text-foreground hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);
export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: ComponentProps<'button'> &
  VariantProps<typeof variants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      data-slot="button"
      className={cn(variants({ variant }), className)}
      {...props}
    />
  );
}
