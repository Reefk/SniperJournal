import type { Trade } from './types';
import { dateKey } from './utils';
import { tradeDay } from './trade-math';

export type RangeKey = '7D' | '30D' | '90D' | 'YTD' | 'ALL';

export const RANGE_OPTIONS: ReadonlyArray<{ value: RangeKey; label: string }> = [
  { value: '7D', label: '7D' },
  { value: '30D', label: '30D' },
  { value: '90D', label: '90D' },
  { value: 'YTD', label: 'YTD' },
  { value: 'ALL', label: 'All' },
];

/** inclusive first day of the range, or null for ALL */
export function rangeStart(range: RangeKey, now = new Date()): string | null {
  if (range === 'ALL') return null;
  if (range === 'YTD') return `${now.getFullYear()}-01-01`;
  const days = range === '7D' ? 6 : range === '30D' ? 29 : 89;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return dateKey(d);
}

/** trades inside the range, plus the net P&L of everything before it */
export function splitByRange(trades: Trade[], range: RangeKey, now = new Date()) {
  const start = rangeStart(range, now);
  if (!start) return { inRange: trades, before: [] as Trade[], start };
  const inRange: Trade[] = [];
  const before: Trade[] = [];
  for (const t of trades) (tradeDay(t) >= start ? inRange : before).push(t);
  return { inRange, before, start };
}
