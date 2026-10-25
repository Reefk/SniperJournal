'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
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
  const menu = useRef<HTMLDivElement>(null);

  // opens upwards when it would run past the bottom of the page's scroller
  // (on a phone, the tab bar) and fits above its button: a tag's menu low in
  // Settings → Tags. The menus in the header always fit below.
  // Measured from its button, 8px (mt-2) away, not from the menu's own box,
  // which animate-pop still has moved and shrunk at this point.
  useLayoutEffect(() => {
    const box = menu.current;
    if (!open || !box || !ref.current) return;
    const view = box.closest('[data-page-scroll]')?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
    const button = ref.current.getBoundingClientRect();
    const room = box.offsetHeight + 8;
    if (button.bottom + room > view.bottom && button.top - room >= view.top) box.dataset.side = 'top';
  }, [open]);

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
          ref={menu}
          data-popover
          className={cn(
            'animate-pop absolute top-full z-40 mt-2 rounded-lg border border-line bg-surface p-1 shadow-2xl shadow-black/40 data-[side=top]:bottom-full data-[side=top]:top-auto data-[side=top]:mb-2 data-[side=top]:mt-0',
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
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-3 text-left text-sm transition md:py-2',
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
