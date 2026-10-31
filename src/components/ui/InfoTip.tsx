'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/** how far the bubble keeps from its icon and from the window's edges */
const GAP = 8;

/**
 * Plain-language explanation for a metric, on hover or keyboard focus. On a
 * phone, tapping the icon shows it in a bar above the tabs, since a bubble
 * beside a small icon near the screen edge would be cut off.
 *
 * On a larger screen the bubble sits under its icon (over it when the window
 * has no room below), moved in from the window's edge, and is drawn above the
 * page: a popover, or fixed to the window in a WebView without popovers. No
 * box around it cuts it then: the Dashboard's metric strip, which hides what
 * sticks out of its rounded corners, cut its first column's bubbles on the
 * left, its last column's on the right and its bottom row's at the bottom.
 * Unseen, it takes no room.
 */
export function InfoTip({ text }: { text: string }) {
  const icon = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = hovered || focused;

  useLayoutEffect(() => {
    const box = tip.current;
    if (!open || !box) return;
    const popover = typeof box.showPopover === 'function';
    if (popover) box.showPopover();
    // (on a phone the bar's own place, set with !important, wins over this one)
    const place = () => {
      const at = icon.current?.getBoundingClientRect();
      if (!at) return;
      const { offsetWidth: w, offsetHeight: h } = box;
      box.style.left = `${Math.max(GAP, Math.min(at.left + at.width / 2 - w / 2, window.innerWidth - GAP - w))}px`;
      const below = at.bottom + GAP;
      const above = at.top - GAP - h;
      box.style.top = `${below + h > window.innerHeight - GAP && above >= GAP ? above : below}px`;
    };
    place();
    // it stays by its icon while the page scrolls under it
    window.addEventListener('scroll', place, { capture: true, passive: true });
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, { capture: true });
      window.removeEventListener('resize', place);
      // (one taken off the page has closed with it)
      if (popover && box.isConnected) box.hidePopover();
    };
  }, [open, text]); // (a new text, a new height: it may need the other side)

  return (
    <span
      ref={icon}
      className="group/tip inline-flex max-md:-m-2 max-md:p-2"
      tabIndex={0}
      aria-label={text}
      onPointerEnter={(e) => {
        // a finger's tap focuses it instead, which shows the bar; lifting the finger "leaves" it
        if (e.pointerType !== 'touch') setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <Info className="size-3 cursor-help text-faint transition group-hover/tip:text-muted" />
      <span
        ref={tip}
        role="tooltip"
        popover="manual"
        className={cn(
          'pointer-events-none fixed inset-auto z-30 m-0 w-60 whitespace-normal rounded-md border border-line bg-raised px-3 py-2 text-xs font-normal leading-relaxed text-fg shadow-xl transition-opacity starting:opacity-0 max-md:inset-x-4! max-md:top-auto! max-md:bottom-[calc(5rem_+_var(--safe-area-inset-bottom,0px))] max-md:w-auto max-md:text-sm',
          open ? 'block' : 'hidden',
        )}
      >
        {text}
      </span>
    </span>
  );
}
