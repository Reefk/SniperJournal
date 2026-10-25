import type { GoalKey, Goals, Settings, Setup, Trade } from './types';
import { computeStats } from './stats';
import { ruleVerdict } from './rules';
import { mistakesSince } from './mistakes';
import { formatMoney, formatRatio, wholePct } from './format';
import { rMultiple, statTrades, tradeDay } from './trade-math';
import { dateKey, parseDateKey } from './utils';

/**
 * Goals I set myself (Settings → Limits and goals). None is set to start
 * with: a goal shows on the Dashboard once it has a target, measured over the
 * Dashboard's range for the account shown. Every goal is "at least": a number
 * at or above its target is met. Process goals come first, as they are the
 * ones I control on the day.
 */

export type GoalUnit = 'pct' | 'ratio' | 'r' | 'money';

export interface GoalDef {
  key: GoalKey;
  label: string;
  kind: 'process' | 'result';
  unit: GoalUnit;
  /** what it rests on: closed trades, trades ticked on their rules, trades with a stop, or trading days */
  basis: 'trades' | 'checked' | 'stops' | 'days';
  /** what it measures, for the ⓘ */
  info: string;
}

export const GOALS: readonly GoalDef[] = [
  {
    key: 'rulesKept',
    label: 'Rules kept',
    kind: 'process',
    unit: 'pct',
    basis: 'checked',
    info: "Of the trades you ticked against their setup's rules, the share that kept every one. A trade with a rule left unticked and none broken counts on neither side.",
  },
  {
    key: 'cleanTrades',
    label: 'Clean trades',
    kind: 'process',
    unit: 'pct',
    basis: 'trades',
    info: 'The share of trades with no mistake, counted from the first day you marked a trade with one.',
  },
  {
    key: 'daysInLimits',
    label: 'Days inside my limits',
    kind: 'process',
    unit: 'pct',
    basis: 'days',
    info: 'The share of trading days that lost no more than your daily loss limit and took no more trades than your daily limit, as they are set now.',
  },
  {
    key: 'withStop',
    label: 'Trades with a stop',
    kind: 'process',
    unit: 'pct',
    basis: 'trades',
    info: 'The share of trades logged with a stop loss.',
  },
  {
    key: 'winRate',
    label: 'Win rate',
    kind: 'result',
    unit: 'pct',
    basis: 'trades',
    info: 'The share of trades that ended above zero, after fees.',
  },
  {
    key: 'profitFactor',
    label: 'Profit factor',
    kind: 'result',
    unit: 'ratio',
    basis: 'trades',
    info: 'What the winners made divided by what the losers lost.',
  },
  {
    key: 'avgR',
    label: 'Average R',
    kind: 'result',
    unit: 'r',
    basis: 'stops',
    info: 'The average result in units of the risk your stop defined, over the trades with a stop.',
  },
  {
    key: 'expectancy',
    label: 'Expectancy',
    kind: 'result',
    unit: 'money',
    basis: 'trades',
    info: 'What an average trade made, after fees.',
  },
  {
    key: 'winLossRatio',
    label: 'Average win ÷ average loss',
    kind: 'result',
    unit: 'ratio',
    basis: 'trades',
    info: 'The size of your average winner against your average loser.',
  },
  {
    key: 'greenDayRate',
    label: 'Green days',
    kind: 'result',
    unit: 'pct',
    basis: 'days',
    info: 'The share of trading days that ended above zero, after fees.',
  },
];

const BY_KEY = new Map<string, GoalDef>(GOALS.map((def) => [def.key, def]));

export const goalDef = (key: string): GoalDef | undefined => BY_KEY.get(key);

/** a goal is met or not once it rests on this many trades, or trading days for a day goal; under it, it "needs" more */
export const MIN_GOAL_TRADES = 10;
export const MIN_GOAL_DAYS = 5;
/** the same for one week's dot */
export const MIN_WEEK_TRADES = 5;
export const MIN_WEEK_DAYS = 3;
/** the weeks of dots under each goal, this one included */
export const GOAL_WEEKS = 8;

/** the decimals a target keeps: as many as the card shows it with, so what is judged is what is read */
const targetDecimals = (def: GoalDef) => (def.unit === 'pct' ? 1 : 2);

/**
 * A target as a goal takes it: a percentage from 0 to 100, anything else above
 * 0, rounded to targetDecimals (90.04% is 90%); null for no goal.
 */
export function goalTarget(def: GoalDef, value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (def.unit === 'pct' ? value < 0 || value > 100 : value <= 0) return null;
  const scale = 10 ** targetDecimals(def);
  const target = Math.round(value * scale) / scale;
  // 0.004 rounds to a target of 0, which every goal but a percentage refuses
  return def.unit === 'pct' || target > 0 ? target : null;
}

/** the goals with a target, in the order they are listed */
export function goalsSet(goals: Goals | undefined): Array<{ def: GoalDef; target: number }> {
  return GOALS.flatMap((def) => {
    const target = goalTarget(def, goals?.[def.key]);
    return target == null ? [] : [{ def, target }];
  });
}

/** the goals with one target changed; null takes the goal off, and no goal left is none */
export function withGoal(goals: Goals | undefined, key: GoalKey, target: number | null): Goals | undefined {
  const next: Goals = { ...goals };
  if (target == null) delete next[key];
  else next[key] = target;
  return Object.keys(next).length ? next : undefined;
}

export interface Measure {
  /** null when there is nothing to work it out from (no checked trade, every trade at break-even…) */
  value: number | null;
  /** the trades or trading days it rests on */
  count: number;
  /** why it can't be measured at all, whatever the count */
  blocked?: 'no-limits' | 'no-mistakes';
}

export interface GoalContext {
  setups: Setup[];
  settings: Pick<Settings, 'maxDailyLoss' | 'maxTradesPerDay'>;
  /** the first day a trade of the account had a mistake (mistakesSince), whatever the range */
  mistakesSince: string | null;
}

const positive = (v: number | null | undefined) => (v != null && v > 0 ? v : null);

/** every goal's number over these trades */
export function measureGoals(trades: Trade[], ctx: GoalContext): Record<GoalKey, Measure> {
  const closed = statTrades(trades);
  const stats = computeStats(trades);
  const n = closed.length;
  const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : null);

  // the setups' rules, as the Playbook counts them: partly ticked trades on neither side
  const setupIds = new Set(ctx.setups.map((s) => s.id));
  let kept = 0;
  let broken = 0;
  for (const t of closed) {
    if (!t.setupId || !setupIds.has(t.setupId)) continue;
    const verdict = ruleVerdict(t.ruleChecks);
    if (verdict === 'kept') kept += 1;
    else if (verdict === 'broken') broken += 1;
  }

  // mistakes, as Reports counts them: from the first day one was logged
  const since = ctx.mistakesSince;
  const counted = since ? closed.filter((t) => tradeDay(t) >= since) : [];
  const clean = counted.filter((t) => !t.mistakes?.length).length;

  // a day that lost exactly its limit, or took exactly its number of trades, kept to it
  const maxLoss = positive(ctx.settings.maxDailyLoss);
  const maxTrades = positive(ctx.settings.maxTradesPerDay);
  const inside = stats.days.filter(
    (d) => (maxLoss == null || -d.net <= maxLoss) && (maxTrades == null || d.trades <= maxTrades),
  ).length;

  const withR = closed.filter((t) => rMultiple(t) != null).length;
  const days = stats.activeDays;

  return {
    rulesKept: { value: pct(kept, kept + broken), count: kept + broken },
    cleanTrades: since
      ? { value: pct(clean, counted.length), count: counted.length }
      : { value: null, count: 0, blocked: 'no-mistakes' },
    daysInLimits:
      maxLoss == null && maxTrades == null
        ? { value: null, count: days, blocked: 'no-limits' }
        : { value: pct(inside, days), count: days },
    withStop: { value: pct(closed.filter((t) => t.stopLoss != null).length, n), count: n },
    winRate: { value: n ? stats.winRate : null, count: n },
    profitFactor: { value: stats.profitFactor, count: n },
    avgR: { value: stats.avgR, count: withR },
    expectancy: { value: n ? stats.expectancy : null, count: n },
    winLossRatio: { value: stats.payoff, count: n },
    greenDayRate: { value: days ? stats.greenDayRate : null, count: days },
  };
}

/** met, below target, not enough trades or days yet ("short"), or not measurable */
export type GoalStatus = 'met' | 'missed' | 'short' | 'none';

/** at or above, give or take the dust of dividing (57 of 100 is 56.99999999999999%) */
const reaches = (value: number, target: number) => value >= target - 1e-9 * Math.max(1, Math.abs(target));

/** the trades or trading days a goal needs, on the card (`week` false) or in a week's dot */
export function goalNeed(def: GoalDef, week = false): number {
  if (def.basis === 'days') return week ? MIN_WEEK_DAYS : MIN_GOAL_DAYS;
  return week ? MIN_WEEK_TRADES : MIN_GOAL_TRADES;
}

export function judgeGoal(target: number, measure: Measure, need: number): GoalStatus {
  if (measure.blocked) return 'none';
  if (measure.count < need) return 'short';
  if (measure.value == null) return 'none';
  return reaches(measure.value, target) ? 'met' : 'missed';
}

export interface GoalPeriod {
  measure: Measure;
  status: GoalStatus;
}

export interface GoalWeek extends GoalPeriod {
  /** the week's Monday, 'YYYY-MM-DD' */
  start: string;
}

export interface GoalLine {
  def: GoalDef;
  target: number;
  measure: Measure;
  status: GoalStatus;
  /** the trades or days it needs before it is met or not */
  need: number;
  /** the same length of time just before the range, judged the same way; null when the range is all time */
  before: GoalPeriod | null;
  /** the last GOAL_WEEKS weeks, Monday to Sunday, the oldest first and this one last */
  weeks: GoalWeek[];
}

function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** the trades from the day `from` to the day `to`, both included */
const between = (trades: Trade[], from: string, to: string) =>
  trades.filter((t) => {
    const day = tradeDay(t);
    return day >= from && day <= to;
  });

/**
 * The Dashboard's Goals card. `trades` are every trade of the account shown,
 * so the period before the range, the weeks and when mistakes started being
 * logged are known whatever the range; `from` is the range's first day, or
 * null for all time. Empty when no goal is set.
 */
export function goalReport({
  trades,
  setups,
  settings,
  from,
  now = new Date(),
}: {
  trades: Trade[];
  setups: Setup[];
  settings: Settings;
  from: string | null;
  now?: Date;
}): GoalLine[] {
  const set = goalsSet(settings.goals);
  if (!set.length) return [];
  const ctx: GoalContext = { setups, settings, mistakesSince: mistakesSince(trades) };
  const today = dateKey(now);

  // as the Dashboard splits them: from the range's first day on, and before it
  const current = measureGoals(from ? trades.filter((t) => tradeDay(t) >= from) : trades, ctx);
  let before: Record<GoalKey, Measure> | null = null;
  if (from) {
    // the range runs from `from` to today; the period before is as many days, ending the day before it
    const length = Math.round((parseDateKey(today).getTime() - parseDateKey(from).getTime()) / 86_400_000) + 1;
    before = measureGoals(between(trades, addDays(from, -length), addDays(from, -1)), ctx);
  }

  const monday = addDays(today, -((now.getDay() + 6) % 7));
  const weeks = Array.from({ length: GOAL_WEEKS }, (_, i) => {
    const start = addDays(monday, -7 * (GOAL_WEEKS - 1 - i));
    return { start, measures: measureGoals(between(trades, start, addDays(start, 6)), ctx) };
  });

  return set.map(({ def, target }) => {
    const need = goalNeed(def);
    const measure = current[def.key];
    const prior = before?.[def.key];
    return {
      def,
      target,
      measure,
      status: judgeGoal(target, measure, need),
      need,
      before: prior ? { measure: prior, status: judgeGoal(target, prior, need) } : null,
      weeks: weeks.map(({ start, measures }) => ({
        start,
        measure: measures[def.key],
        status: judgeGoal(target, measures[def.key], goalNeed(def, true)),
      })),
    };
  });
}

/** `value` rounded down to `decimals`, the dust of dividing put back first (2.01 × 100 is 200.99999999999997) */
const floorTo = (value: number, decimals: number) => {
  const scale = 10 ** decimals;
  return Math.floor(value * scale + 1e-9) / scale;
};

/** a share to a tenth, as wholePct does it to a whole: 0 and 100 only when it is all or nothing */
const tenthPct = (pct: number) =>
  pct <= 0 ? 0 : pct >= 100 ? 100 : Math.min(99.9, Math.max(0.1, Number(pct.toFixed(1))));

/**
 * A goal's number as the card shows it. Rounded as everywhere else, except
 * that a number below its target is never rounded up to it: 89.6% against 90%
 * reads 89%, not a 90% that wasn't met. A percentage is shown to a tenth when
 * its target has one, so 60.4% that meets 60.3% doesn't read as 60%.
 */
export function goalValueText(def: GoalDef, value: number | null, target: number, currency: string): string {
  if (value == null) return '—';
  const missed = !reaches(value, target);
  switch (def.unit) {
    case 'pct': {
      const tenths = !Number.isInteger(target);
      const shown = tenths ? tenthPct(value) : wholePct(value);
      return `${missed && shown >= target ? floorTo(value, tenths ? 1 : 0) : shown}%`;
    }
    case 'ratio': {
      if (!Number.isFinite(value)) return formatRatio(value);
      return formatRatio(missed && Number(value.toFixed(2)) >= target ? floorTo(value, 2) : value);
    }
    case 'r': {
      const r = missed && Number(value.toFixed(2)) >= target ? floorTo(value, 2) : value;
      return `${r >= 0 ? '+' : ''}${formatRatio(r)}R`;
    }
    case 'money': {
      const cents = missed && Number(value.toFixed(2)) >= target ? floorTo(value, 2) : value;
      return formatMoney(cents, currency, { sign: true });
    }
  }
}

/** a target as the card and Settings show it */
export function goalTargetText(def: GoalDef, target: number, currency: string): string {
  switch (def.unit) {
    case 'pct':
      return `${Number(target.toFixed(1))}%`;
    case 'ratio':
      return formatRatio(target);
    case 'r':
      return `+${formatRatio(target)}R`;
    case 'money':
      return formatMoney(target, currency, { sign: true });
  }
}
