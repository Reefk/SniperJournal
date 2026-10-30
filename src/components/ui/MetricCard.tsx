import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { FitText } from './FitText';
import { InfoTip } from './InfoTip';

export type MetricTone = 'profit' | 'loss' | 'accent' | 'neutral';

export function toneText(tone: MetricTone): string {
  return tone === 'profit'
    ? 'text-profit'
    : tone === 'loss'
      ? 'text-loss'
      : tone === 'accent'
        ? 'text-accent'
        : 'text-fg';
}

export function toneFor(value: number): MetricTone {
  return value > 0 ? 'profit' : value < 0 ? 'loss' : 'neutral';
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: MetricTone;
  aside?: ReactNode;
  info?: string;
  className?: string;
}

/** Headline metric, with room for a ring or sparkline on the right */
export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'neutral',
  aside,
  info,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 md:gap-4 md:px-5 md:py-4',
        className,
      )}
    >
      <div className="min-w-0">
        {/* a longer label or line in another language wraps rather than being cut: at the
            narrowest desktop (1180 px) Spanish takes three lines for "Factor de beneficio" and four
            for "13,09 mil US$ ganados frente a 1,91 mil US$ perdidos" */}
        <div className="flex items-center gap-1.5 text-[13px] text-muted">
          {Icon && <Icon className="size-3.5 shrink-0 text-faint" />}
          {/* min-w-0: a word longer than the card breaks rather than pushing out of it */}
          <span className="min-w-0 break-words">{label}</span>
          {info && <InfoTip text={info} />}
        </div>
        <FitText
          className={cn(
            'num mt-1.5 text-[21px] font-semibold leading-7 md:mt-2 md:text-[27px] md:leading-8',
            toneText(tone),
          )}
        >
          {value}
        </FitText>
        {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

/** Compact metric for the secondary strip */
export function MetricCell({
  label,
  value,
  sub,
  info,
  tone = 'neutral',
}: Omit<MetricCardProps, 'aside' | 'icon' | 'className'>) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3.5">
      <div className="flex items-center gap-1 text-xs text-muted">
        <span className="min-w-0 break-words">{label}</span>
        {info && <InfoTip text={info} />}
      </div>
      <FitText className={cn('num mt-1.5 text-[15px] font-semibold', toneText(tone))}>{value}</FitText>
      {/* eight to a row on a laptop leaves too little room for "held 1h 49m on average": it wraps rather than being cut */}
      {sub && <div className="mt-0.5 text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

/** Eight secondary metrics in one divided container: calmer than eight cards */
export function MetricStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4 2xl:grid-cols-8',
        className,
      )}
    >
      {children}
    </div>
  );
}
