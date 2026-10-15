'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

// Dialogs are not portalled, so the one on top is simply the last in the page
// (the trade form and the confirmation are rendered after the page content).
const isTopmost = (dialog: HTMLElement) => {
  const all = document.querySelectorAll('[data-modal-root]');
  return all[all.length - 1] === dialog;
};

/** what Tab can reach inside a dialog, in page order */
function tabbable(dialog: HTMLElement): HTMLElement[] {
  const candidates = dialog.querySelectorAll<HTMLElement>(
    'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]',
  );
  return [...candidates].filter(
    (el) =>
      el !== dialog &&
      el.tabIndex >= 0 &&
      !(el as HTMLButtonElement).disabled &&
      !(el instanceof HTMLInputElement && el.type === 'hidden') &&
      el.getClientRects().length > 0 && // not display:none, nor inside a closed <details>
      getComputedStyle(el).visibility !== 'hidden',
  );
}

/**
 * The page scrolls inside <main data-page-scroll>, not the window, so that is
 * what has to stay still behind an open dialog. Counted, so a dialog opened
 * over another doesn't unlock the page when it closes. The scrollbar's width
 * is given back as padding, so nothing behind the backdrop shifts sideways.
 */
let scrollLocks = 0;
let unlockPage: (() => void) | null = null;
function lockPageScroll(): () => void {
  if (scrollLocks++ === 0) {
    const pages = [...document.querySelectorAll<HTMLElement>('[data-page-scroll]')];
    const before = pages.map((el) => ({ overflow: el.style.overflow, paddingRight: el.style.paddingRight }));
    for (const el of pages) {
      const scrollbar = el.offsetWidth - el.clientWidth;
      el.style.overflow = 'hidden';
      if (scrollbar > 0) el.style.paddingRight = `${scrollbar}px`;
    }
    unlockPage = () => pages.forEach((el, i) => Object.assign(el.style, before[i]));
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--scrollLocks === 0) {
      unlockPage?.();
      unlockPage = null;
    }
  };
}

/**
 * Where focus was before its latest move. A dialog whose content takes focus
 * as it opens (autoFocus, like the confirm button) has already moved it by the
 * time the dialog's effect runs, so this is where focus has to go back to.
 */
let lastFocus: Element | null = null;
let focusBefore: Element | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'focusin',
    (e) => {
      focusBefore = lastFocus;
      lastFocus = e.target as Element;
    },
    true,
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  closable = true,
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
  /** false for a dialog that must be answered with one of its own buttons: no close button */
  closable?: boolean;
  /** below the md breakpoint: a sheet rising from the bottom, or the whole screen */
  phone?: 'sheet' | 'full';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Keyboard and screen-reader users land inside the dialog when it opens
  // (unless a field in it already took focus), and go back to where they were
  // when it closes.
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    const active = document.activeElement;
    const before = (dialog?.contains(active) ? focusBefore : active) as HTMLElement | null;
    if (dialog && !dialog.contains(active)) dialog.focus({ preventScroll: true });
    return () => {
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return lockPageScroll();
  }, [open]);

  // Escape closes the dialog on top. Tab and Shift+Tab go round the dialog on
  // top and never reach the page behind it, and focus that gets out some other
  // way is brought back in.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const dialog = ref.current;
      if (!dialog || !isTopmost(dialog)) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = tabbable(dialog);
      const active = document.activeElement;
      if (!items.length) {
        e.preventDefault();
        dialog.focus({ preventScroll: true });
      } else if (e.shiftKey && (active === items[0] || active === dialog || !dialog.contains(active))) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && (active === items[items.length - 1] || !dialog.contains(active))) {
        e.preventDefault();
        items[0].focus();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      const dialog = ref.current;
      if (!dialog || !isTopmost(dialog) || dialog.contains(e.target as Node)) return;
      (tabbable(dialog)[0] ?? dialog).focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      data-modal-root
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      tabIndex={-1}
      className={cn(
        // phone: the panel scrolls inside itself, so its header and footer stay put
        'fixed inset-0 z-50 flex justify-center overscroll-contain bg-black/60 outline-none backdrop-blur-[2px]',
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
          phone === 'full' ? 'h-full pt-safe' : 'max-h-[calc(100%-1rem)] rounded-t-2xl border-x border-t',
          'md:block md:h-auto md:max-h-none md:rounded-xl md:border md:pt-0',
          SIZES[size],
        )}
      >
        {title && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[15px] font-semibold text-fg">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            {closable && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-m-2 rounded-md p-3 text-muted transition hover:bg-raised hover:text-fg md:m-0 md:p-1"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 md:overflow-visible',
            !footer && 'max-md:pb-safe-4',
          )}
        >
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
