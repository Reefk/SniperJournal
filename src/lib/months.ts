import type { Trade } from './types';
import { isClosed, isIncomplete, netPnl, settle, statTrades, tradeDay } from './trade-math';

export interface MonthRow {
  /** 'YYYY-MM' */
  key: string;
  net: number;
  trades: number;
  wins: number;
  /**
   * where the month left the account: the starting balance plus the net of every trade closed by its end,
   * counting excluded trades too when Settings counts them in the balance
   */
  balance: number;
}

/** each month's net, trades and wins, by the day a trade closed */
function byMonth(trades: Trade[]): Map<string, Omit<MonthRow, 'key' | 'balance'>> {
  const map = new Map<string, Omit<MonthRow, 'key' | 'balance'>>();
  for (const t of statTrades(trades)) {
    const key = tradeDay(t).slice(0, 7);
    const month = map.get(key) ?? { net: 0, trades: 0, wins: 0 };
    const net = netPnl(t);
    // settled like a day, so +0.10, +0.20 and -0.30 make a month of 0, not a green one of 0.00000000000000006
    month.net = settle(month.net + net);
    month.trades += 1;
    if (net > 0) month.wins += 1;
    map.set(key, month);
  }
  return map;
}

/**
 * Reports' month table, newest first: the months of `trades` (the range
 * picked), each with the balance it left. The balance runs over `all` the
 * account's trades from `startingBalance`, so a month's is the same whatever
 * the range. With `countExcluded` (Settings → Accounts) it counts the trades
 * left out of the statistics, as the account's balance does, so the newest
 * month ends where the sidebar's balance is; a month's net, trades and wins
 * never count them.
 */
export function monthRows(trades: Trade[], all: Trade[], startingBalance: number, countExcluded = false): MonthRow[] {
  const steps = new Map([...byMonth(all)].map(([key, month]) => [key, month.net]));
  if (countExcluded) {
    for (const t of all.filter((t) => t.excluded && isClosed(t) && !isIncomplete(t))) {
      const key = tradeDay(t).slice(0, 7);
      steps.set(key, (steps.get(key) ?? 0) + netPnl(t));
    }
  }
  const balances = new Map<string, number>();
  let balance = startingBalance;
  for (const [key, step] of [...steps].sort((a, b) => a[0].localeCompare(b[0]))) {
    balance = settle(balance + step);
    balances.set(key, balance);
  }
  return [...byMonth(trades)]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, month]) => ({ key, ...month, balance: balances.get(key) ?? startingBalance }));
}
