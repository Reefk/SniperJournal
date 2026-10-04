import type { Trade } from './types';
import { parseLocal } from './utils';

export function isClosed(t: Trade): boolean {
  return t.manualPnl != null || (t.exitPrice != null && Number.isFinite(t.exitPrice));
}

/** P&L before fees */
export function grossPnl(t: Trade): number {
  if (t.manualPnl != null) return t.manualPnl;
  if (t.exitPrice == null) return 0;
  const direction = t.side === 'LONG' ? 1 : -1;
  return (t.exitPrice - t.entryPrice) * t.quantity * (t.multiplier || 1) * direction;
}

/** P&L after fees and commissions — the number that matters */
export function netPnl(t: Trade): number {
  if (!isClosed(t)) return 0;
  return grossPnl(t) - (t.fees || 0);
}

/** Money at risk from entry to stop. Null when no stop was recorded. */
export function riskAmount(t: Trade): number | null {
  if (t.stopLoss == null || !Number.isFinite(t.stopLoss)) return null;
  const perUnit = Math.abs(t.entryPrice - t.stopLoss);
  const risk = perUnit * t.quantity * (t.multiplier || 1);
  return risk > 0 ? risk : null;
}

/** Result expressed in units of the risk taken */
export function rMultiple(t: Trade): number | null {
  const risk = riskAmount(t);
  if (risk == null || !isClosed(t)) return null;
  return netPnl(t) / risk;
}

/** Reward-to-risk the plan promised, from stop and target */
export function plannedRR(t: Trade): number | null {
  if (t.stopLoss == null || t.takeProfit == null) return null;
  const risk = Math.abs(t.entryPrice - t.stopLoss);
  const reward = Math.abs(t.takeProfit - t.entryPrice);
  if (risk <= 0) return null;
  return reward / risk;
}

export function tradeTimestamp(t: Trade): string {
  return t.closedAt || t.openedAt;
}

/** the day a trade counts towards: the day it was closed */
export function tradeDay(t: Trade): string {
  return tradeTimestamp(t).slice(0, 10);
}

export function holdMinutes(t: Trade): number | null {
  if (!t.closedAt || !t.openedAt) return null;
  const mins = (parseLocal(t.closedAt).getTime() - parseLocal(t.openedAt).getTime()) / 60000;
  return mins >= 0 ? mins : null;
}

/** The fields a trade needs before it can count towards anything */
export function missingDetails(t: Trade): string[] {
  const missing: string[] = [];
  if (!t.symbol?.trim()) missing.push('symbol');
  if (!t.openedAt) missing.push('entry time');
  if (!(t.quantity > 0)) missing.push('quantity');
  // a price of exactly zero is what an empty column becomes, never a real fill
  if (t.entryPrice == null || !Number.isFinite(t.entryPrice) || t.entryPrice === 0) missing.push('entry price');
  return missing;
}

export function isIncomplete(t: Trade): boolean {
  return missingDetails(t).length > 0;
}

export type Outcome = 'WIN' | 'LOSS' | 'BE' | 'OPEN';

export function outcome(t: Trade): Outcome {
  if (!isClosed(t)) return 'OPEN';
  const p = netPnl(t);
  return p > 0 ? 'WIN' : p < 0 ? 'LOSS' : 'BE';
}

export function sortChronological(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => tradeTimestamp(a).localeCompare(tradeTimestamp(b)));
}

/** closed, complete and not excluded — the set every statistic is built from */
export function statTrades(trades: Trade[]): Trade[] {
  return trades.filter((t) => isClosed(t) && !t.excluded && !isIncomplete(t));
}

export function matchesSearch(t: Trade, term: string, setupNames?: Map<string, string>): boolean {
  if (!term) return true;
  const setup = t.setupId ? (setupNames?.get(t.setupId) ?? '') : '';
  return [t.symbol, t.side, t.notes ?? '', t.session ?? '', setup, ...t.tags].join(' ').toLowerCase().includes(term);
}
