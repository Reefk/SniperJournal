/** Tiny cumulative line with a dashed zero reference. No chart library needed. */
export function Sparkline({ values, width = 120, height = 36 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * width).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const color = values[values.length - 1] >= 0 ? 'var(--profit)' : 'var(--loss)';
  return (
    <svg width={width} height={height} aria-hidden>
      <line x1={0} x2={width} y1={y(0)} y2={y(0)} strokeDasharray="2 3" style={{ stroke: 'var(--line-strong)' }} />
      <path d={d} fill="none" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: color }} />
    </svg>
  );
}
