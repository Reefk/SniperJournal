import type { Trade } from './types';
import { mean } from './utils';
import { holdMinutes, netPnl, rMultiple, sortChronological, statTrades } from './trade-math';

/** what a dot measures: the trade's R (it needs a stop), or its net in money */
export type HoldMeasure = 'R' | 'net';

export interface HoldDot {
  trade: Trade;
  /** how long it was held, in minutes */
  minutes: number;
  /** its result, in the measure */
  value: number;
}

export interface HoldSide {
  trades: number;
  /** the average result a trade, in the measure */
  avg: number;
}

export interface HoldReport {
  measure: HoldMeasure;
  /** one a trade, oldest first */
  dots: HoldDot[];
  /** trades with no hold time to show: no time it closed, or closed before it opened */
  noTime: number;
  /** in R, the trades with no stop, so no R */
  noStop: number;
  /**
   * The trades held up to the median hold against those held longer, once
   * each side has HOLD_SIDE_MIN trades; null before.
   */
  split: { minutes: number; shorter: HoldSide; longer: HoldSide } | null;
}

/** trades each side needs before the two are compared: fewer is too thin to say anything */
export const HOLD_SIDE_MIN = 10;

/** the hold times the chart's axis may mark: a minute, 5 and 15 minutes, an hour, 4 hours, a day, a week */
export const HOLD_MARKS = [1, 5, 15, 60, 240, 1440, 10080];

/** a log axis can't place 0: a trade closed the minute it opened sits at half a minute */
export const HOLD_SHORTEST = 0.5;

/**
 * The chart's log axis for these holds (in minutes, none under HOLD_SHORTEST):
 * a little room either side, and the marks in between, at least two, so the
 * axis shows its scale; it reaches out to the next mark for them, later ones first.
 */
export function holdAxis(holds: number[]): { lo: number; hi: number; marks: number[] } {
  let lo = holds.reduce((a, b) => (b < a ? b : a), Infinity) / 1.5;
  let hi = holds.reduce((a, b) => (b > a ? b : a), HOLD_SHORTEST) * 1.5;
  if (!Number.isFinite(lo)) lo = HOLD_SHORTEST / 1.5;
  const within = () => HOLD_MARKS.filter((m) => m >= lo && m <= hi);
  while (within().length < 2) {
    const up = HOLD_MARKS.find((m) => m > hi);
    const down = [...HOLD_MARKS].reverse().find((m) => m < lo);
    if (up != null) hi = up;
    else if (down != null) lo = down;
    else break;
  }
  return { lo, hi, marks: within() };
}

/** R while at least half the trades with a hold time have a stop; the net otherwise */
export function defaultHoldMeasure(trades: Trade[]): HoldMeasure {
  const timed = statTrades(trades).filter((t) => holdMinutes(t) != null);
  const withStop = timed.filter((t) => rMultiple(t) != null).length;
  return timed.length > 0 && withStop * 2 >= timed.length ? 'R' : 'net';
}

/**
 * Hold time against result: a dot for each trade that counts towards the
 * statistics, how long it was held against how it did, and whether holding
 * longer paid: the trades held up to the median against the ones held longer.
 */
export function holdReport(trades: Trade[], measure: HoldMeasure): HoldReport {
  const dots: HoldDot[] = [];
  let noTime = 0;
  let noStop = 0;
  for (const trade of sortChronological(statTrades(trades))) {
    const minutes = holdMinutes(trade);
    if (minutes == null) {
      noTime++;
      continue;
    }
    const value = measure === 'R' ? rMultiple(trade) : netPnl(trade);
    if (value == null) {
      noStop++;
      continue;
    }
    dots.push({ trade, minutes, value });
  }

  let split: HoldReport['split'] = null;
  if (dots.length >= HOLD_SIDE_MIN * 2) {
    const holds = dots.map((d) => d.minutes).sort((a, b) => a - b);
    const mid = holds.length / 2;
    const median = holds.length % 2 ? holds[Math.floor(mid)] : (holds[mid - 1] + holds[mid]) / 2;
    const shorter = dots.filter((d) => d.minutes <= median).map((d) => d.value);
    const longer = dots.filter((d) => d.minutes > median).map((d) => d.value);
    if (shorter.length >= HOLD_SIDE_MIN && longer.length >= HOLD_SIDE_MIN) {
      split = {
        minutes: median,
        shorter: { trades: shorter.length, avg: mean(shorter) },
        longer: { trades: longer.length, avg: mean(longer) },
      };
    }
  }
  return { measure, dots, noTime, noStop, split };
}
