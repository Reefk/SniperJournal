'use client';

import { useId } from 'react';

/**
 * The app's logo: a sniper's scope with a rising trend arrowed through it.
 *
 * The same drawing as the launcher icon and the browser tab, so the mark in the
 * header matches the one the app was opened from. scripts/make-icons.mjs draws
 * every other size — change the shape here and there together.
 *
 * Every instance gets its own gradient ids. Sharing one set would leave the
 * sidebar's copy — the first in the page, and display:none on a phone — owning
 * them, and the Android webview refuses to paint with a gradient that sits in a
 * hidden subtree, so the header's logo would come out empty.
 */
export function LogoMark({ size = 30 }: { size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (part: string) => `logo-${part}-${uid}`;
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      className="shrink-0"
      role="img"
      aria-label="Sniper Journal"
    >
      <defs>
        <linearGradient id={id('bg')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1b2747" />
          <stop offset="55%" stopColor="#0f1830" />
          <stop offset="100%" stopColor="#070c18" />
        </linearGradient>
        <radialGradient id={id('glow')} cx="0.28" cy="0.2" r="0.85">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#6366f1" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('ring')} x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#f4f7ff" />
          <stop offset="100%" stopColor="#ccd6f6" />
        </linearGradient>
        <linearGradient id={id('trend')} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#0ea06f" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>

      <rect width="1024" height="1024" rx="232" fill={`url(#${id('bg')})`} />
      <rect width="1024" height="1024" rx="232" fill={`url(#${id('glow')})`} />
      {/* a hairline so the dark tile still has an edge on a dark surface */}
      <rect x="8" y="8" width="1008" height="1008" rx="224" fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="16" />

      <g stroke={`url(#${id('ring')})`} strokeWidth="46" strokeLinecap="round" fill="none">
        <circle cx="512" cy="512" r="296" />
        <path d="M512 92V176M512 932V848M92 512H176M932 512H848" />
      </g>
      <g stroke={`url(#${id('trend')})`} strokeWidth="50" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M356 668 668 356" />
        <path d="M560 356H668V464" />
      </g>
    </svg>
  );
}
