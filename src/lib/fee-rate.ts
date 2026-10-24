import type { Trade } from './types';
import { isClosed } from './trade-math';

/**
 * A fee typed in once for many trades: an amount for every trade, or for
 * every contract on each side. The import window charges it on a file with
 * no fees of its own, or in place of the file's when asked (csv.ts); Add
 * details charges it on the trades selected.
 */
export interface FeeRate {
  per: 'trade' | 'contract';
  amount: number;
}

/**
 * The fees a trade gets: the amount once, open or closed; or the amount for
 * each contract on the way in, and again on the way out once it is closed,
 * as a fee per contract column is read (import/reader.ts).
 */
export function feeAtRate(trade: Trade, rate: FeeRate): number {
  if (rate.per === 'trade') return rate.amount;
  const sides = isClosed(trade) ? 2 : 1;
  return Math.round(rate.amount * Math.abs(trade.quantity || 0) * sides * 1e8) / 1e8;
}
