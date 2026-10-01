import type { ReactNode } from 'react';

/** Donut indicator. value is 0..1; the track can be tinted to show the other side. */
export function RingProgress({
  value, size = 58, stroke = 6, color = 'var(--profit)', track = 'var(--line)', children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: track }} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap={v < 1 ? 'butt' : 'round'}
            strokeDasharray={`${c * v} ${c}`}
            style={{ stroke: color, transition: 'stroke-dasharray 600ms ease' }}
          />
        )}
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}
