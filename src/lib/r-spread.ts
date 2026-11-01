import type { Trade } from './types';
import { netPnl, rMultiple, settle, statTrades } from './trade-math';

/** the bars' ends: the first takes everything at −2R or worse, the last everything at +4R or better */
export const SPREAD_LOW = -2;
export const SPREAD_HIGH = 4;
/** trades the best tenth needs before it is worked out: a tenth of 10 is one trade */
export const TOP_SHARE_MIN = 10;

export interface RBar {
  /** the half R its trades ended nearest: −2 (or worse), −1.5, −1, … +4 (or better) */
  r: number;
  trades: number;
}

export interface TopShare {
  /** the best trades by net, a tenth of `of` (at least one) */
  count: number;
  of: number;
  /** what they made, and what all the others came to */
  best: number;
  rest: number;
  /** their share of the net, in %; null unless the net is above zero and the others didn't lose money */
  share: number | null;
}

export interface RSpread {
  bars: RBar[];
  /** trades with a stop, in the bars, and those with none, left out of them */
  rated: number;
  noStop: number;
  /** losses with a stop */
  losses: number;
  /** losses that ended past −1R (in a bar left of it), and how far past −1R they went in all, in R */
  pastStop: { count: number; beyond: number };
  /** the best tenth of the trades against the rest; null under TOP_SHARE_MIN trades */
  top: TopShare | null;
}

/** to the nearest half R, a quarter going away from 0: −0.75 is −1, +0.25 is +0.5 */
const nearestHalf = (r: number) => (Math.sign(r) * Math.round(Math.abs(r) * 2)) / 2;

/**
 * Reports → R spread: how many trades ended near each R, from −2R or worse to
 * +4R or better in half-R steps. Only trades with a stop have an R; the rest
 * are counted and left out. The best tenth of the trades by net is set
 * against the rest, R or not, and the losses past −1R are those in a bar
 * left of it (−1.5R or worse), so fees on a stop that held don't count.
 */
export function rSpread(trades: Trade[]): RSpread {
  const closed = statTrades(trades);
  const rs = closed.map(rMultiple).flatMap((r) => (r == null ? [] : [settle(r)]));
  const steps = (SPREAD_HIGH - SPREAD_LOW) * 2;
  const bars: RBar[] = Array.from({ length: steps + 1 }, (_, i) => ({ r: SPREAD_LOW + i / 2, trades: 0 }));
  for (const r of rs) {
    const at = Math.min(SPREAD_HIGH, Math.max(SPREAD_LOW, nearestHalf(r)));
    bars[(at - SPREAD_LOW) * 2].trades++;
  }
  const past = rs.filter((r) => nearestHalf(r) < -1);

  const byNet = closed.map(netPnl).sort((a, b) => b - a);
  const count = Math.max(1, Math.round(byNet.length / 10));
  const sum = (nets: number[]) => settle(nets.reduce((total, net) => total + net, 0));
  const best = sum(byNet.slice(0, count));
  const rest = sum(byNet.slice(count));
  // past 100% the others lost money: "made 140% of your net" says less than the two amounts
  const share = rest >= 0 && best + rest > 0 ? (best / settle(best + rest)) * 100 : null;
  return {
    bars,
    rated: rs.length,
    noStop: closed.length - rs.length,
    losses: rs.filter((r) => r < 0).length,
    pastStop: { count: past.length, beyond: sum(past.map((r) => r + 1)) },
    top: byNet.length >= TOP_SHARE_MIN ? { count, of: byNet.length, best, rest, share } : null,
  };
}
