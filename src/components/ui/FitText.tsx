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

// The line's width, measured as its text as well as by the box's scroll width,
// rounded as that is. On CI's Windows runner figures kept their full size, cut
// with "…", while their text measured wider than the box: the scroll width
// missed it there. (jsdom can't measure text; there the scroll width is all.)
function lineWidth(el: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(el);
  const text = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect().width : 0;
  return Math.max(el.scrollWidth, Math.round(text));
}

// the box's own size first, then the one that fits its room; half a pixel smaller
// while the line is still too wide, as it can be where each letter is drawn a
// whole number of pixels wide and the line narrows less than its font
function fit(el: HTMLElement, least: number) {
  el.style.fontSize = '';
  const full = parseFloat(getComputedStyle(el).fontSize);
  let size = fitFontSize(full, el.clientWidth, lineWidth(el), least);
  while (size < full) {
    el.style.fontSize = `${size}px`;
    if (lineWidth(el) <= el.clientWidth || size <= full * least) break;
    size = Math.max(full * least, size - 0.5);
  }
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
