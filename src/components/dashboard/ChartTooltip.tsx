'use client';

import type { ReactNode } from 'react';
import type { DayAgg, EquityPoint, ScoreAxis } from '@/lib/stats';
import { formatMoney, formatShortDate } from '@/lib/format';

/** Minimal shape of what Recharts hands a custom tooltip */
export interface TooltipProps<T> {
  active?: boolean;
  payload?: Array<{ payload?: T }>;
}

function Card({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-2xl shadow-black/40">
      <div className="mb-1 font-medium text-fg">{title}</div>
      <div className="space-y-0.5 text-muted">{children}</div>
    </div>
  );
}

export function EquityTooltip({ active, payload, currency }: TooltipProps<EquityPoint> & { currency?: string }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <Card title={point.label === 'Start' ? 'Starting balance' : formatShortDate(point.label)}>
      <div className="num text-sm text-fg">{formatMoney(point.equity, currency)}</div>
      {point.index > 0 && (
        <div className={point.net > 0 ? 'text-profit' : point.net < 0 ? 'text-loss' : undefined}>
          {formatMoney(point.net, currency, { sign: true })} on this trade
        </div>
      )}
    </Card>
  );
}

export function DayTooltip({ active, payload, currency }: TooltipProps<DayAgg> & { currency?: string }) {
  const day = active ? payload?.[0]?.payload : undefined;
  if (!day) return null;
  return (
    <Card title={formatShortDate(day.day)}>
      <div className={`num text-sm ${day.net > 0 ? 'text-profit' : day.net < 0 ? 'text-loss' : 'text-fg'}`}>
        {formatMoney(day.net, currency, { sign: true })}
      </div>
      <div>
        {day.trades} {day.trades === 1 ? 'trade' : 'trades'} · {day.wins}W / {day.losses}L
      </div>
    </Card>
  );
}

export function ScoreTooltip({ active, payload }: TooltipProps<ScoreAxis>) {
  const axis = active ? payload?.[0]?.payload : undefined;
  if (!axis) return null;
  return (
    <Card title={axis.axis}>
      {axis.rated && <div className="num text-sm text-accent">{Math.round(axis.score)} / 100</div>}
      <div className="max-w-[200px] leading-relaxed">{axis.detail}</div>
    </Card>
  );
}
