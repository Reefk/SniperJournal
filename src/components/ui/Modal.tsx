'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  phone = 'sheet',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  /** false for forms, so a stray click never throws away typing */
  closeOnBackdrop?: boolean;
  /** below the md breakpoint: a sheet rising from the bottom, or the whole screen */
  phone?: 'sheet' | 'full';
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const all = document.querySelectorAll('[data-modal-root]');
      if (all[all.length - 1] === ref.current) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      data-modal-root
      role="dialog"
      aria-modal="true"
      className={cn(
        // phone: the panel scrolls inside itself, so its header and footer stay put
        'fixed inset-0 z-50 flex justify-center bg-black/60 backdrop-blur-[2px]',
        phone === 'full' ? 'items-stretch' : 'items-end pt-safe',
        'md:items-start md:overflow-y-auto md:p-6 md:pt-[6vh]',
      )}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'animate-pop flex w-full flex-col border-line bg-surface shadow-2xl shadow-black/40',
          phone === 'full'
            ? 'h-full pt-safe'
            : 'max-h-[calc(100%-1rem)] rounded-t-2xl border-x border-t',
          'md:block md:h-auto md:max-h-none md:rounded-xl md:border md:pt-0',
          SIZES[size],
        )}
      >
        {title && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-2 rounded-md p-3 text-muted transition hover:bg-raised hover:text-fg md:m-0 md:p-1"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4 md:overflow-visible', !footer && 'max-md:pb-safe-4')}>
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3 max-md:pb-safe-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
