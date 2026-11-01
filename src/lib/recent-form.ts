import type { Trade } from './types';
import { mean } from './utils';
import { netPnl, rMultiple, sortChronological, statTrades } from './trade-math';

/** how far back Recent form looks, in trades */
export const FORM_WINDOWS = [10, 20, 50] as const;

/** trades with a stop a window's average R needs before it is set against the whole record */
export const FORM_R_MIN = 10;

export interface FormLine {
  /** how many trades it looks back over; null for the whole record */
  size: number | null;
  /** the trades in it: `size` once there are that many, none before; every one for the whole record */
  trades: number;
  /** how many more trades it needs before it can be read; 0 once it can */
  needed: number;
  /** the share of its trades that made money, 0–100; null with none */
  winRate: number | null;
  /** the average R of its trades that recorded a stop; null with none */
  avgR: number | null;
  /** how many of its trades recorded a stop, so have an R */
  rTrades: number;
}

export interface RecentForm {
  /** the last 10, 20 and 50 trades, in that order */
  windows: FormLine[];
  /** every trade, to hold each window against */
  all: FormLine;
}

/**
 * Recent form: win rate and average R over the last 10, 20 and 50 trades,
 * against the whole record. The trades are the ones every statistic counts
 * (closed, complete, not excluded), last by the time they closed. A window
 * with fewer trades than its size is not read at all; it says how many more
 * it needs.
 */
export function recentForm(trades: Trade[], windows: readonly number[] = FORM_WINDOWS): RecentForm {
  const closed = sortChronological(statTrades(trades));
  const line = (list: Trade[], size: number | null): FormLine => {
    const rs = list.map(rMultiple).filter((r): r is number => r != null);
    return {
      size,
      trades: list.length,
      needed: size == null ? 0 : Math.max(0, size - closed.length),
      winRate: list.length ? (list.filter((t) => netPnl(t) > 0).length / list.length) * 100 : null,
      avgR: rs.length ? mean(rs) : null,
      rTrades: rs.length,
    };
  };
  return {
    windows: windows.map((size) => line(closed.length >= size ? closed.slice(-size) : [], size)),
    all: line(closed, null),
  };
}
