import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SegmentedControl<T extends string>({
  options, value, onChange, className,
}: {
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex items-center rounded-lg border border-line bg-app p-0.5', className)} role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition',
            value === o.value ? 'bg-raised text-fg ring-1 ring-line-strong/60' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
