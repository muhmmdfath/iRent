import { useEffect, useRef, type ReactNode } from 'react';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
export function InventoryActionMenu({
  label,
  disabled,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const element = ref.current!;
    function outside(event: PointerEvent) {
      if (!element.contains(event.target as Node)) element.open = false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && element.open) {
        element.open = false;
        element.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return (
    <details className="inv-action-menu" ref={ref}>
      <summary
        aria-label={label}
        title={label}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (disabled && ['Enter', ' '].includes(event.key))
            event.preventDefault();
        }}
      >
        <DotsHorizontalIcon aria-hidden="true" />
      </summary>
      <div
        className="inv-menu-panel"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('button:not(:disabled)'))
            ref.current!.open = false;
        }}
      >
        {children}
      </div>
    </details>
  );
}
