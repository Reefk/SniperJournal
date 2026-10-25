import { describe, expect, it } from 'vitest';
import type { Settings, Setup, Trade } from '@/lib/types';
import {
  GOALS,
  GOAL_WEEKS,
  MIN_GOAL_DAYS,
  MIN_GOAL_TRADES,
  MIN_WEEK_DAYS,
  MIN_WEEK_TRADES,
  goalDef,
  goalReport,
  goalTarget,
  goalTargetText,
  goalValueText,
  goalsSet,
  judgeGoal,
  measureGoals,
  withGoal,
  type GoalContext,
  type GoalDef,
} from '@/lib/goals';
import { breakEvenWinRate, computeStats } from '@/lib/stats';
import { createDefaultData, normalize } from '@/lib/journal';
import { parseBackup } from '@/lib/backup';
import { cleanSettings } from '@/store/sanitize';
import { pnl } from './helpers';

const base: Settings = createDefaultData().settings;
const def = (key: string) => goalDef(key) as GoalDef;

/** a trade closed on `day` (YYYY-MM-DD) for `net` */
const on = (day: string, net: number, overrides: Partial<Trade> = {}): Trade =>
  pnl(net, { openedAt: `${day}T10:00`, closedAt: `${day}T11:00`, ...overrides });

const SETUP: Setup = { id: 's1', name: 'Breakout', rules: ['Wait for the close', 'Stop under the low'] };
const ctx = (over: Partial<GoalContext> = {}): GoalContext => ({
  setups: [SETUP],
  settings: { maxDailyLoss: null, maxTradesPerDay: null },
  mistakesSince: null,
  ...over,
});

/** `n` trades on `day`, each for `net` */
const many = (n: number, day: string, net: number, overrides: Partial<Trade> = {}) =>
  Array.from({ length: n }, () => on(day, net, overrides));

describe('a target', () => {
  it('a percentage from 0 to 100, anything else above 0', () => {
    const pct = def('winRate');
    expect(goalTarget(pct, 0)).toBe(0);
    expect(goalTarget(pct, 55.5)).toBe(55.5);
    expect(goalTarget(pct, 100)).toBe(100);
    expect(goalTarget(pct, 100.1)).toBeNull();
    expect(goalTarget(pct, -1)).toBeNull();
    const ratio = def('profitFactor');
    expect(goalTarget(ratio, 1.5)).toBe(1.5);
    expect(goalTarget(ratio, 250)).toBe(250);
    expect(goalTarget(ratio, 0)).toBeNull();
    expect(goalTarget(ratio, -2)).toBeNull();
  });

  it('only a finite number is one', () => {
    for (const bad of [NaN, Infinity, '50', null, undefined, true, {}]) {
      expect(goalTarget(def('winRate'), bad)).toBeNull();
      expect(goalTarget(def('expectancy'), bad)).toBeNull();
    }
  });

  it('kept to the decimals the card shows: a tenth of a percent, a hundredth of the rest', () => {
    const pct = def('winRate');
    expect(goalTarget(pct, 90.04)).toBe(90);
    expect(goalTarget(pct, 90.06)).toBe(90.1);
    expect(goalTarget(pct, 99.96)).toBe(100);
    // past either end before rounding is past it
    expect(goalTarget(pct, 100.04)).toBeNull();
    expect(goalTarget(pct, -0.04)).toBeNull();
    const ratio = def('winLossRatio');
    expect(goalTarget(ratio, 1.504)).toBe(1.5);
    expect(goalTarget(ratio, 1.506)).toBe(1.51);
    expect(goalTarget(def('expectancy'), 25.123)).toBe(25.12);
    // too small to show is no target
    expect(goalTarget(ratio, 0.004)).toBeNull();
    expect(goalTarget(ratio, 0.01)).toBe(0.01);
  });

  it('the goals set are listed in their own order, process goals first, whatever order they were saved in', () => {
    const set = goalsSet({ greenDayRate: 60, winRate: 50, rulesKept: 90 });
    expect(set.map((g) => g.def.key)).toEqual(['rulesKept', 'winRate', 'greenDayRate']);
    expect(set.map((g) => g.target)).toEqual([90, 50, 60]);
    // one the goal can't take is no goal
    expect(goalsSet({ winRate: 150, profitFactor: 0, avgR: 0.3 }).map((g) => g.def.key)).toEqual(['avgR']);
    expect(goalsSet(undefined)).toEqual([]);
    expect(GOALS.slice(0, 4).every((g) => g.kind === 'process')).toBe(true);
  });

  it('setting, changing and taking off a goal; none left is none', () => {
    const goals = { winRate: 50 };
    expect(withGoal(goals, 'avgR', 0.3)).toEqual({ winRate: 50, avgR: 0.3 });
    expect(withGoal(goals, 'winRate', 55)).toEqual({ winRate: 55 });
    expect(withGoal({ winRate: 50, avgR: 0.3 }, 'avgR', null)).toEqual({ winRate: 50 });
    expect(withGoal(goals, 'winRate', null)).toBeUndefined();
    expect(withGoal(undefined, 'winRate', 0)).toEqual({ winRate: 0 });
    // the goals it was given stay as they were
    expect(goals).toEqual({ winRate: 50 });
  });
});

describe('what each goal measures', () => {
  it('rules kept: of the trades ticked on their rules, the share that kept all of them', () => {
    const trades = [
      on('2026-10-05', 50, { setupId: 's1', ruleChecks: { 'Wait for the close': true, 'Stop under the low': true } }),
      on('2026-10-05', -20, { setupId: 's1', ruleChecks: { 'Wait for the close': true, 'Stop under the low': false } }),
      on('2026-10-06', 30, { setupId: 's1', ruleChecks: { 'Wait for the close': true, 'Stop under the low': true } }),
      // ticked, none broken, one left unticked: on neither side, as in the Playbook
      on('2026-10-06', 10, { setupId: 's1', ruleChecks: { 'Wait for the close': true, 'Stop under the low': null } }),
      // not ticked at all
      on('2026-10-07', 10, { setupId: 's1' }),
      // a setup that is no longer in the playbook, and a trade left out of the statistics
      on('2026-10-07', -10, { setupId: 'gone', ruleChecks: { Old: false } }),
      on('2026-10-07', -10, { setupId: 's1', ruleChecks: { 'Wait for the close': false }, excluded: true }),
    ];
    const m = measureGoals(trades, ctx()).rulesKept;
    expect(m.count).toBe(3);
    expect(m.value).toBeCloseTo(200 / 3, 10);
    expect(measureGoals([on('2026-10-05', 5)], ctx()).rulesKept).toEqual({ value: null, count: 0 });
  });

  it('clean trades: the share with no mistake, from the first day one was logged', () => {
    const trades = [
      on('2026-10-05', 20),
      on('2026-10-06', -30, { mistakes: ['Oversized'] }),
      on('2026-10-07', 15),
      on('2026-10-08', 10, { mistakes: ['Chased the entry', 'Oversized'] }),
      on('2026-10-08', 25),
    ];
    // the 10-05 trade is from before any mistake was logged, so it isn't counted as clean
    const m = measureGoals(trades, ctx({ mistakesSince: '2026-10-06' })).cleanTrades;
    expect(m).toEqual({ value: 50, count: 4 });
    // with no mistake logged at all there is nothing to tell a clean trade by
    expect(measureGoals(trades, ctx()).cleanTrades).toEqual({ value: null, count: 0, blocked: 'no-mistakes' });
  });

  it('days inside my limits: no more lost than the daily limit, no more trades than the limit', () => {
    const trades = [
      // lost exactly the limit: kept to it
      on('2026-10-05', -100),
      // a cent past it
      on('2026-10-06', -60),
      on('2026-10-06', -40.01),
      // three trades, one past the limit of two, though it made money
      ...many(3, '2026-10-07', 10),
      // exactly two
      ...many(2, '2026-10-08', -5),
      on('2026-10-09', 300),
    ];
    const settings = { maxDailyLoss: 100, maxTradesPerDay: 2 };
    expect(measureGoals(trades, ctx({ settings })).daysInLimits).toEqual({ value: 60, count: 5 });
    // only the loss limit: the three-trade day is inside
    expect(
      measureGoals(trades, ctx({ settings: { maxDailyLoss: 100, maxTradesPerDay: null } })).daysInLimits.value,
    ).toBe(80);
    // only the trade limit
    expect(measureGoals(trades, ctx({ settings: { maxDailyLoss: 0, maxTradesPerDay: 2 } })).daysInLimits.value).toBe(
      80,
    );
    // no limit, nothing to keep inside
    expect(measureGoals(trades, ctx()).daysInLimits).toEqual({ value: null, count: 5, blocked: 'no-limits' });
  });

  it('trades with a stop, and the average R over them', () => {
    const trades = [
      on('2026-10-05', 2, { stopLoss: 99 }),
      on('2026-10-05', -1, { stopLoss: 99 }),
      on('2026-10-06', 0.5, { stopLoss: 99 }),
      on('2026-10-06', 40),
    ];
    const m = measureGoals(trades, ctx());
    expect(m.withStop).toEqual({ value: 75, count: 4 });
    // risk of 1 a trade (entry 100, stop 99): 2R, -1R and 0.5R
    expect(m.avgR.count).toBe(3);
    expect(m.avgR.value).toBeCloseTo(0.5, 10);
  });

  it('the results are the statistics the Dashboard shows', () => {
    const trades = [on('2026-10-05', 100), on('2026-10-05', -50), on('2026-10-06', -25), on('2026-10-07', 75)];
    const stats = computeStats(trades);
    const m = measureGoals(trades, ctx());
    expect(m.winRate).toEqual({ value: stats.winRate, count: 4 });
    expect(m.profitFactor).toEqual({ value: stats.profitFactor, count: 4 });
    expect(m.expectancy).toEqual({ value: 25, count: 4 });
    expect(m.winLossRatio).toEqual({ value: stats.payoff, count: 4 });
    // green days are counted in days: two green of three
    expect(m.greenDayRate.count).toBe(3);
    expect(m.greenDayRate.value).toBeCloseTo(200 / 3, 10);
  });

  it('with no trade, nothing to measure', () => {
    const m = measureGoals([], ctx());
    for (const key of [
      'rulesKept',
      'withStop',
      'winRate',
      'profitFactor',
      'avgR',
      'expectancy',
      'winLossRatio',
    ] as const) {
      expect(m[key]).toEqual({ value: null, count: 0 });
    }
    expect(m.greenDayRate).toEqual({ value: null, count: 0 });
  });

  it('open trades and trades still missing details are not counted', () => {
    const trades = [
      on('2026-10-05', 10, { stopLoss: 99 }),
      { ...on('2026-10-05', 0, { stopLoss: 99 }), manualPnl: null, exitPrice: null },
      on('2026-10-05', -10, { needsReview: true, quantity: 0 }),
    ];
    const m = measureGoals(trades, ctx());
    expect(m.withStop).toEqual({ value: 100, count: 1 });
    expect(m.winRate).toEqual({ value: 100, count: 1 });
  });
});

describe('met or not', () => {
  const need = MIN_GOAL_TRADES;
  it('at or above the target is met; below it, not', () => {
    expect(judgeGoal(60, { value: 60, count: need }, need)).toBe('met');
    expect(judgeGoal(60, { value: 61, count: need }, need)).toBe('met');
    expect(judgeGoal(60, { value: 59.99, count: need }, need)).toBe('missed');
  });

  it('the dust of dividing does not decide it: 57 of 100 meets 57%', () => {
    expect((57 / 100) * 100).toBeLessThan(57);
    expect(judgeGoal(57, { value: (57 / 100) * 100, count: need }, need)).toBe('met');
    expect(judgeGoal(0.3, { value: 0.1 + 0.2 - 1e-12, count: need }, need)).toBe('met');
  });

  it('too few trades or days: short of them, whatever the number', () => {
    expect(judgeGoal(50, { value: 100, count: need - 1 }, need)).toBe('short');
    expect(judgeGoal(50, { value: 100, count: need }, need)).toBe('met');
  });

  it("what can't be measured is neither", () => {
    expect(judgeGoal(80, { value: null, count: 0, blocked: 'no-mistakes' }, need)).toBe('none');
    expect(judgeGoal(80, { value: null, count: 40, blocked: 'no-limits' }, need)).toBe('none');
    // every trade at break-even: no profit factor
    expect(judgeGoal(1.5, { value: null, count: 12 }, need)).toBe('none');
  });

  it('a profit factor with no loss meets any target', () => {
    expect(judgeGoal(250, { value: Infinity, count: need }, need)).toBe('met');
  });
});

describe('the Goals card', () => {
  // Wednesday 21 October 2026: the week started on Monday the 19th
  const now = new Date(2026, 9, 21, 12);
  const report = (trades: Trade[], goals: Settings['goals'], from: string | null, over: Partial<Settings> = {}) =>
    goalReport({ trades, setups: [SETUP], settings: { ...base, goals, ...over }, from, now });

  it('with no goal set: nothing', () => {
    expect(report([on('2026-10-20', 10)], undefined, null)).toEqual([]);
    expect(report([on('2026-10-20', 10)], {}, null)).toEqual([]);
  });

  it('a goal over the range, met once it has its trades', () => {
    const trades = [...many(6, '2026-10-19', 10), ...many(4, '2026-10-20', -10)];
    const [line] = report(trades, { winRate: 60 }, null);
    expect(line.def.key).toBe('winRate');
    expect(line.target).toBe(60);
    expect(line.measure).toEqual({ value: 60, count: 10 });
    expect(line.need).toBe(MIN_GOAL_TRADES);
    expect(line.status).toBe('met');
    // all time: no period before it
    expect(line.before).toBeNull();
    const [short] = report(trades.slice(1), { winRate: 50 }, null);
    expect(short.status).toBe('short');
  });

  it('a day goal needs trading days, not trades', () => {
    const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'];
    const trades = days.flatMap((day) => many(5, day, 10));
    const [four] = report(trades, { greenDayRate: 50 }, null);
    expect(four.need).toBe(MIN_GOAL_DAYS);
    expect(four.status).toBe('short');
    const [five] = report([...trades, on('2026-10-16', -3)], { greenDayRate: 50 }, null);
    expect(five.measure).toEqual({ value: 80, count: 5 });
    expect(five.status).toBe('met');
  });

  it("only the range's trades; the period before is as long, and ends the day before it", () => {
    // 7D on 21 October runs from the 15th; the 7 days before, the 8th to the 14th
    const inRange = many(10, '2026-10-15', 10);
    const justBefore = [...many(5, '2026-10-08', 10), ...many(5, '2026-10-14', -10)];
    const tooEarly = many(10, '2026-10-07', -10);
    const [line] = report([...tooEarly, ...justBefore, ...inRange], { winRate: 60 }, '2026-10-15');
    expect(line.measure).toEqual({ value: 100, count: 10 });
    expect(line.before?.measure).toEqual({ value: 50, count: 10 });
    expect(line.before?.status).toBe('missed');
  });

  it('this year: the period before is as many days, ending on the 31st of December', () => {
    // 1 January to 21 October is 294 days; as many before runs from 13 March 2025
    const trades = [
      ...many(10, '2026-01-01', 10),
      ...many(4, '2025-12-31', 10),
      ...many(6, '2025-03-13', -10),
      on('2025-03-12', 500),
    ];
    const [line] = report(trades, { winRate: 50 }, '2026-01-01');
    expect(line.measure.count).toBe(10);
    expect(line.before?.measure).toEqual({ value: 40, count: 10 });
  });

  it('30 days: the 30 before run from 23 August to 21 September', () => {
    const trades = [
      ...many(10, '2026-09-22', 10),
      ...many(5, '2026-09-21', -10),
      ...many(5, '2026-08-23', 10),
      ...many(10, '2026-08-22', -10),
    ];
    const [line] = report(trades, { winRate: 50 }, '2026-09-22');
    expect(line.measure).toEqual({ value: 100, count: 10 });
    expect(line.before?.measure).toEqual({ value: 50, count: 10 });
  });

  it('on a Sunday the week is the one that began on Monday; the next Monday begins another', () => {
    const late = on('2026-10-25', 10, { openedAt: '2026-10-25T23:00', closedAt: '2026-10-25T23:30' });
    const weeksOn = (now: Date) =>
      goalReport({ trades: [late], setups: [SETUP], settings: { ...base, goals: { winRate: 50 } }, from: null, now })[0]
        .weeks;
    for (const now of [new Date(2026, 9, 25, 0, 0), new Date(2026, 9, 25, 23, 59)]) {
      const sunday = weeksOn(now);
      expect(sunday.at(-1)).toMatchObject({ start: '2026-10-19', measure: { count: 1 } });
      expect(sunday[0].start).toBe('2026-08-31');
    }
    const monday = weeksOn(new Date(2026, 9, 26, 0, 0));
    expect(monday.at(-1)).toMatchObject({ start: '2026-10-26', measure: { count: 0 } });
    expect(monday.at(-2)).toMatchObject({ start: '2026-10-19', measure: { count: 1 } });
  });

  it('a dot for each of the last 8 weeks, Monday to Sunday, this one last', () => {
    const [line] = report(
      [
        // Sunday 18 October: the week before this one
        ...many(5, '2026-10-18', 10),
        // this week, up to today
        ...many(5, '2026-10-19', -10),
        // Monday 31 August, the first of the 8 weeks; the Sunday before it is not in any
        ...many(5, '2026-08-31', 10),
        ...many(5, '2026-08-30', 10),
      ],
      { winRate: 50 },
      null,
    );
    expect(line.weeks).toHaveLength(GOAL_WEEKS);
    expect(line.weeks.map((w) => w.start)).toEqual([
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ]);
    expect(line.weeks.map((w) => w.status)).toEqual([
      'met',
      'short',
      'short',
      'short',
      'short',
      'short',
      'met',
      'missed',
    ]);
    expect(line.weeks[0].measure.count).toBe(5);
  });

  it('a week counts with fewer trades than the card: 5, or 3 trading days', () => {
    const [trades] = report(many(MIN_WEEK_TRADES - 1, '2026-10-19', 10), { winRate: 50 }, null);
    expect(trades.weeks.at(-1)?.status).toBe('short');
    const [days] = report(
      [on('2026-10-12', 10), on('2026-10-13', 10), on('2026-10-14', -10), on('2026-10-19', 10), on('2026-10-20', 10)],
      { greenDayRate: 60 },
      null,
    );
    expect(MIN_WEEK_DAYS).toBe(3);
    // three days the week before: judged; two this week: not yet
    expect(days.weeks.at(-2)).toMatchObject({ status: 'met', measure: { count: 3 } });
    expect(days.weeks.at(-1)?.status).toBe('short');
  });

  it('clean trades count from the first mistake ever logged, whatever the range', () => {
    const trades = [
      on('2026-09-01', -10, { mistakes: ['Oversized'] }),
      ...many(8, '2026-10-16', 10),
      ...many(2, '2026-10-17', -10, { mistakes: ['Revenge trade'] }),
    ];
    const [line] = report(trades, { cleanTrades: 80 }, '2026-10-15');
    expect(line.measure).toEqual({ value: 80, count: 10 });
    expect(line.status).toBe('met');
    // the week of the first mistake is counted from that day too
    expect(line.weeks[0].measure).toEqual({ value: 0, count: 1 });
  });

  it('days inside my limits, with the limits as they are set now', () => {
    const trades = [
      ...['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'].map((day) => on(day, -50)),
      on('2026-10-19', -150),
    ];
    const [line] = report(trades, { daysInLimits: 80 }, null, { maxDailyLoss: 100 });
    expect(line.measure).toEqual({ value: 80, count: 5 });
    expect(line.status).toBe('met');
    const [none] = report(trades, { daysInLimits: 80 }, null);
    expect(none.status).toBe('none');
    expect(none.weeks.every((w) => w.status === 'none')).toBe(true);
  });

  it('an excluded trade neither starts the clean count with its mistake nor fills a day of the limits', () => {
    const tenClean = many(10, '2026-10-16', 10);
    const [clean] = report(
      [on('2026-10-01', -10, { excluded: true, mistakes: ['Oversized'] }), ...tenClean],
      { cleanTrades: 80 },
      null,
    );
    expect(clean.measure.blocked).toBe('no-mistakes');
    const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];
    const [limits] = report(
      [...days.map((day) => on(day, 10)), on('2026-10-16', -500, { excluded: true })],
      { daysInLimits: 100 },
      null,
      { maxDailyLoss: 100, maxTradesPerDay: 1 },
    );
    expect(limits.measure).toEqual({ value: 100, count: 5 });
  });

  it('every goal set, in order', () => {
    const goals = Object.fromEntries(GOALS.map((g) => [g.key, 1]));
    expect(report([], goals, null).map((l) => l.def.key)).toEqual(GOALS.map((g) => g.key));
  });
});

describe("a goal's number as the card shows it", () => {
  it('a percentage below its target is never rounded up to it', () => {
    const pct = def('winRate');
    expect(goalValueText(pct, 89.6, 90, 'USD')).toBe('89%');
    expect(goalValueText(pct, 89.4, 90, 'USD')).toBe('89%');
    expect(goalValueText(pct, 90, 90, 'USD')).toBe('90%');
    expect(goalValueText(pct, 90.6, 90, 'USD')).toBe('91%');
    expect(goalValueText(pct, 89.6, 85, 'USD')).toBe('90%');
    // whole percentages that read true, as on Reports
    expect(goalValueText(pct, 99.6, 99, 'USD')).toBe('99%');
    expect(goalValueText(pct, 99.6, 100, 'USD')).toBe('99%');
    expect(goalValueText(pct, 0.4, 0, 'USD')).toBe('1%');
    expect(goalValueText(pct, 0.4, 1, 'USD')).toBe('0%');
    expect(goalValueText(pct, (57 / 100) * 100, 57, 'USD')).toBe('57%');
  });

  it('against a target with a tenth, a percentage is shown to a tenth', () => {
    const pct = def('winRate');
    expect(goalValueText(pct, 66.4, 66.5, 'USD')).toBe('66.4%');
    // not the 66.5% it rounds to
    expect(goalValueText(pct, 66.46, 66.5, 'USD')).toBe('66.4%');
    expect(goalValueText(pct, 66.5, 66.5, 'USD')).toBe('66.5%');
    // met reads at or above the target, not a whole 99%
    expect(goalValueText(pct, 99.7, 99.7, 'USD')).toBe('99.7%');
    // short of all of them: never 100
    expect(goalValueText(pct, 99.96, 99.5, 'USD')).toBe('99.9%');
    expect(goalValueText(pct, 100, 99.5, 'USD')).toBe('100%');
    expect(goalValueText(pct, 70, 66.5, 'USD')).toBe('70%');
    expect(goalValueText(pct, 0.02, 0.5, 'USD')).toBe('0.1%');
  });

  it('ratios, R and money the same way, to two decimals', () => {
    expect(goalValueText(def('profitFactor'), 1.996, 2, 'USD')).toBe('1.99');
    expect(goalValueText(def('profitFactor'), 2, 2, 'USD')).toBe('2.00');
    expect(goalValueText(def('profitFactor'), 1.996, 1.5, 'USD')).toBe('2.00');
    expect(goalValueText(def('winLossRatio'), Infinity, 2, 'USD')).toBe('∞');
    expect(goalValueText(def('winLossRatio'), 1.496, 1.5, 'USD')).toBe('1.49');
    expect(goalValueText(def('avgR'), 0.296, 0.3, 'USD')).toBe('+0.29R');
    expect(goalValueText(def('avgR'), 0.3, 0.3, 'USD')).toBe('+0.30R');
    expect(goalValueText(def('avgR'), -0.5, 0.3, 'USD')).toBe('-0.50R');
    expect(goalValueText(def('expectancy'), 24.996, 25, 'USD')).toBe('+$24.99');
    expect(goalValueText(def('expectancy'), 25, 25, 'USD')).toBe('+$25.00');
    expect(goalValueText(def('expectancy'), -3, 25, 'USD')).toBe('-$3.00');
    expect(goalValueText(def('expectancy'), null, 25, 'USD')).toBe('—');
  });

  it('the targets', () => {
    expect(goalTargetText(def('rulesKept'), 90, 'USD')).toBe('90%');
    expect(goalTargetText(def('rulesKept'), 55.5, 'USD')).toBe('55.5%');
    expect(goalTargetText(def('profitFactor'), 1.5, 'USD')).toBe('1.50');
    expect(goalTargetText(def('avgR'), 0.3, 'USD')).toBe('+0.30R');
    expect(goalTargetText(def('expectancy'), 25, 'EUR')).toBe('+€25.00');
  });
});

describe('the win rate the numbers break even at', () => {
  it('the average loss over the average win and loss together', () => {
    // win 300 on average, lose 100: one win in four breaks even
    expect(breakEvenWinRate({ avgWin: 300, avgLoss: 100 })).toBe(25);
    expect(breakEvenWinRate({ avgWin: 0, avgLoss: 100 })).toBeNull();
    expect(breakEvenWinRate({ avgWin: 100, avgLoss: 0 })).toBeNull();
  });
});

describe('goals in the journal file', () => {
  it('keeps well-formed goals exactly as they are', () => {
    const goals = { rulesKept: 90, winRate: 0, profitFactor: 1.5, expectancy: 25 };
    expect(cleanSettings({ goals }, base).goals).toEqual(goals);
  });

  it('a target a goal cannot take is no goal; a goal of a newer version is kept as it is', () => {
    expect(
      cleanSettings(
        {
          goals: {
            winRate: 150,
            cleanTrades: '80',
            avgR: -1,
            profitFactor: null,
            greenDayRate: 60,
            exitEfficiency: { target: 70 },
          },
        },
        base,
      ).goals,
    ).toEqual({ greenDayRate: 60, exitEfficiency: { target: 70 } });
  });

  it('a target written finer than the card shows is kept as the card shows it; one not a number, dropped', () => {
    const goals = {
      winRate: 90.04,
      profitFactor: 1.506,
      rulesKept: 100,
      avgR: Infinity,
      expectancy: NaN,
      withStop: { target: 90 },
    };
    expect(cleanSettings({ goals }, base).goals).toEqual({ winRate: 90, profitFactor: 1.51, rulesKept: 100 });
  });

  it('absent, or not a record, is none', () => {
    expect(cleanSettings({}, base).goals).toBeUndefined();
    expect(cleanSettings({ goals: [90] }, base).goals).toBeUndefined();
    expect(cleanSettings({ goals: 'winRate' }, base).goals).toBeUndefined();
    expect(cleanSettings({ goals: {} }, base).goals).toEqual({});
  });

  it('a journal from before goals opens with none; a backup keeps them', () => {
    const old = normalize(JSON.parse(JSON.stringify(createDefaultData())));
    expect(old.settings.goals).toBeUndefined();
    const journal = { ...createDefaultData(), settings: { ...base, goals: { winRate: 55, avgR: 0.25 } } };
    const restored = normalize(parseBackup(JSON.stringify(journal, null, 2)).data);
    expect(restored.settings.goals).toEqual({ winRate: 55, avgR: 0.25 });
  });
});
