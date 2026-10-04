'use client';

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Popover({
  trigger,
  children,
  align = 'end',
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={cn(
            'animate-pop absolute top-full z-40 mt-2 rounded-lg border border-line bg-surface p-1 shadow-2xl shadow-black/40',
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon: Icon,
  children,
  onClick,
  selected,
  danger,
  trailing,
}: {
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  danger?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition',
        danger ? 'text-loss hover:bg-loss/10' : 'text-fg hover:bg-raised',
      )}
    >
      {Icon && <Icon className={cn('size-4 shrink-0', danger ? 'text-loss' : 'text-muted')} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
      {selected && <Check className="size-4 shrink-0 text-accent" />}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-line" />;
}
