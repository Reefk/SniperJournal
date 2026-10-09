import type { JournalData, Trade } from '@/lib/types';
import { netPnl, statTrades } from '@/lib/trade-math';

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
 *   - a trade you excluded, which the app promises to leave out of every
 *     figure.
 */
export function realised(trades: Trade[]): number {
  return statTrades(trades).reduce((a, t) => a + netPnl(t), 0);
}

/** starting balance plus realised P&L, per account */
export function accountBalances(data: Pick<JournalData, 'accounts' | 'trades'>): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const account of data.accounts) {
    balances[account.id] = account.startingBalance + realised(data.trades.filter((t) => t.accountId === account.id));
  }
  return balances;
}

/** the balance at the start of a date range: everything realised before it */
export function openingBalance(startingBalance: number, before: Trade[]): number {
  return startingBalance + realised(before);
}
