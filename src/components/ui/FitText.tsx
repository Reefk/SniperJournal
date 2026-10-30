'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The font size, in px, that fits one line of text `wide` px wide into `room`
 * px: text widens with its font, so the share that fits is the size that fits.
 * Rounded down to half a pixel, never below `least` of the full size (the line
 * is cut with "…" beyond that). The full size when it fits already.
 */
export function fitFontSize(full: number, room: number, wide: number, least: number): number {
  if (wide <= room || room <= 0) return full;
  return Math.max(full * least, Math.floor(((full * room) / wide) * 2) / 2);
}

// the box's own size first, then the one that fits its room
function fit(el: HTMLElement, least: number) {
  el.style.fontSize = '';
  const full = parseFloat(getComputedStyle(el).fontSize);
  const size = fitFontSize(full, el.clientWidth, el.scrollWidth, least);
  if (size < full) el.style.fontSize = `${size}px`;
}

/**
 * One line of figures that would otherwise be cut with "…": a smaller font
 * instead. Spanish writes "+11.179,87 US$" where English writes "+$11,179.87",
 * in a card of the same width. A line that fits keeps its size.
 */
export function FitText({
  className,
  children,
  least = 0.7,
}: {
  className?: string;
  children: ReactNode;
  least?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // after every render: the text may have changed
  useLayoutEffect(() => {
    if (ref.current) fit(ref.current, least);
  });

  // and whenever the box changes size, watched once rather than on every render
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(() => fit(el, least));
    watch.observe(el);
    // the figures' font can arrive after the first measure
    let live = true;
    void document.fonts?.ready.then(() => live && fit(el, least));
    return () => {
      live = false;
      watch.disconnect();
    };
  }, [least]);

  return (
    <div ref={ref} className={cn('truncate', className)}>
      {children}
    </div>
  );
}
