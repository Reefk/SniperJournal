import type { Trade } from './types';
import { netPnl, settle, statTrades, tradeDay } from './trade-math';

export interface MonthRow {
  /** 'YYYY-MM' */
  key: string;
  net: number;
  trades: number;
  wins: number;
}

/** Reports' month table, newest first: each month's net, trades and wins, by the day a trade closed */
export function monthRows(trades: Trade[]): MonthRow[] {
  const map = new Map<string, MonthRow>();
  for (const t of statTrades(trades)) {
    const key = tradeDay(t).slice(0, 7);
    const month = map.get(key) ?? { key, net: 0, trades: 0, wins: 0 };
    const net = netPnl(t);
    // settled like a day, so +0.10, +0.20 and -0.30 make a month of 0, not a green one of 0.00000000000000006
    month.net = settle(month.net + net);
    month.trades += 1;
    if (net > 0) month.wins += 1;
    map.set(key, month);
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}
