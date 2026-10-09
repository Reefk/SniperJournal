import type { JournalData, Trade } from '@/lib/types';
import { isClosed, isIncomplete, netPnl, statTrades } from '@/lib/trade-math';

/**
 * Realised P&L counted the way every statistic counts it: closed, complete
 * and not excluded. Balances and day totals go through here too, so the
 * balance in the sidebar, the end of the equity curve, the dashboard's
 * opening balance and the calendar's day totals always agree.
 *
 * Two things this deliberately leaves out:
 *   - an imported row that is still missing its entry price or size, whose
 *     price-based P&L would be meaningless (an ES exit at 5000 against a
 *     missing entry reads as +$250,000);
 *   - a trade you excluded, which every statistic leaves out (and the
 *     balance too, unless Settings counts it there; see accountBalances).
 */
export function realised(trades: Trade[]): number {
  return statTrades(trades).reduce((a, t) => a + netPnl(t), 0);
}

/**
 * Realised P&L of the closed, complete trades you excluded from the
 * statistics. Settings can count these toward the balance; the statistics
 * themselves never do.
 */
export function excludedRealised(trades: Trade[]): number {
  return trades.filter((t) => t.excluded && isClosed(t) && !isIncomplete(t)).reduce((a, t) => a + netPnl(t), 0);
}

/**
 * Starting balance plus realised P&L, per account. Excluded trades count
 * only when `countExcluded` is on (Settings → Accounts); then the balance no
 * longer equals the end of the equity curve, which stays a statistic.
 */
export function accountBalances(data: Pick<JournalData, 'accounts' | 'trades'>, countExcluded = false): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const account of data.accounts) {
    const trades = data.trades.filter((t) => t.accountId === account.id);
    balances[account.id] = account.startingBalance + realised(trades) + (countExcluded ? excludedRealised(trades) : 0);
  }
  return balances;
}

/** the balance at the start of a date range: everything realised before it */
export function openingBalance(startingBalance: number, before: Trade[]): number {
  return startingBalance + realised(before);
}
