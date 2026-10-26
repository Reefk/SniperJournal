import type { Trade } from './types';
import { mean } from './utils';
import { formatPct, formatRatio } from './format';
import { decimalMark, isolate, tr } from './i18n';
import {
  grossPnl,
  holdMinutes,
  isClosed,
  netPnl,
  rMultiple,
  settle,
  sortChronological,
  statTrades,
  tradeDay,
} from './trade-math';

export interface DayAgg {
  day: string;
  net: number;
  trades: number;
  wins: number;
  losses: number;
}

/** net P&L per calendar day, chronological */
export function aggregateDays(trades: Trade[]): DayAgg[] {
  const map = new Map<string, DayAgg>();
  for (const t of statTrades(trades)) {
    const day = tradeDay(t);
    const agg = map.get(day) ?? { day, net: 0, trades: 0, wins: 0, losses: 0 };
    const p = netPnl(t);
    // settled like each trade, so +0.10, +0.20 and -0.30 make a day of 0, not a green one of 0.00000000000000006
    agg.net = settle(agg.net + p);
    agg.trades += 1;
    if (p > 0) agg.wins += 1;
    else if (p < 0) agg.losses += 1;
    map.set(day, agg);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export interface EquityPoint {
  index: number;
  label: string;
  equity: number;
  net: number;
  peak: number;
}

export interface Stats {
  total: number;
  wins: number;
  losses: number;
  breakeven: number;
  open: number;
  winRate: number;
  lossRate: number;
  net: number;
  gross: number;
  grossProfit: number;
  grossLoss: number;
  fees: number;
  profitFactor: number | null;
  avgWin: number;
  avgLoss: number;
  payoff: number | null;
  expectancy: number;
  avgR: number | null;
  sqn: number | null;
  maxWinStreak: number;
  maxLossStreak: number;
  currentStreak: number;
  bestDay: DayAgg | null;
  worstDay: DayAgg | null;
  activeDays: number;
  /** days that ended above zero, counted as the dashboard counts them */
  greenDays: number;
  /** green days ÷ trading days, 0–100 */
  greenDayRate: number;
  /** the best day ÷ every green day added up, 0–100; null with no green day */
  bestDayShare: number | null;
  /** every other day added up; null with no green day to take out */
  netWithoutBestDay: number | null;
  avgDaily: number;
  largestWin: number;
  largestLoss: number;
  maxDrawdown: number;
  maxDrawdownPct: number | null;
  /** net ÷ max drawdown; Infinity for a gain with no drawdown, null with neither */
  recoveryFactor: number | null;
  avgHoldMinutes: number | null;
  avgWinHold: number | null;
  avgLossHold: number | null;
  equity: EquityPoint[];
  days: DayAgg[];
}

/** half a cent: less than that is what is left over from adding up cents, not money */
const HALF_CENT = 0.005;

const EMPTY_STATS = (startingBalance: number): Stats => ({
  total: 0,
  wins: 0,
  losses: 0,
  breakeven: 0,
  open: 0,
  winRate: 0,
  lossRate: 0,
  net: 0,
  gross: 0,
  grossProfit: 0,
  grossLoss: 0,
  fees: 0,
  profitFactor: null,
  avgWin: 0,
  avgLoss: 0,
  payoff: null,
  expectancy: 0,
  avgR: null,
  sqn: null,
  maxWinStreak: 0,
  maxLossStreak: 0,
  currentStreak: 0,
  bestDay: null,
  worstDay: null,
  activeDays: 0,
  greenDays: 0,
  greenDayRate: 0,
  bestDayShare: null,
  netWithoutBestDay: null,
  avgDaily: 0,
  largestWin: 0,
  largestLoss: 0,
  maxDrawdown: 0,
  maxDrawdownPct: null,
  recoveryFactor: null,
  avgHoldMinutes: null,
  avgWinHold: null,
  avgLossHold: null,
  equity: [{ index: 0, label: 'Start', equity: startingBalance, net: 0, peak: startingBalance }],
  days: [],
});

/**
 * Every headline number on the dashboard comes from here.
 * Only closed, non-excluded trades count.
 */
export function computeStats(allTrades: Trade[], startingBalance = 0): Stats {
  const closed = sortChronological(statTrades(allTrades));
  // positions still open; a closed trade that is merely incomplete is not one
  const open = allTrades.filter((t) => !t.excluded && !isClosed(t)).length;
  if (closed.length === 0) return { ...EMPTY_STATS(startingBalance), open: Math.max(0, open) };

  const pnls = closed.map(netPnl);
  const winPnls = pnls.filter((p) => p > 0);
  const lossPnls = pnls.filter((p) => p < 0);
  const breakeven = pnls.filter((p) => p === 0).length;

  const net = pnls.reduce((a, b) => a + b, 0);
  const grossProfit = winPnls.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(lossPnls.reduce((a, b) => a + b, 0));
  const fees = closed.reduce((a, t) => a + (t.fees || 0), 0);

  const avgWin = winPnls.length ? mean(winPnls) : 0;
  const avgLoss = lossPnls.length ? Math.abs(mean(lossPnls)) : 0;
  const winRate = (winPnls.length / closed.length) * 100;

  // streaks
  let maxWinStreak = 0,
    maxLossStreak = 0,
    run = 0,
    currentStreak = 0;
  for (const p of pnls) {
    if (p > 0) run = run > 0 ? run + 1 : 1;
    else if (p < 0) run = run < 0 ? run - 1 : -1;
    else run = 0;
    maxWinStreak = Math.max(maxWinStreak, run);
    maxLossStreak = Math.min(maxLossStreak, run);
    currentStreak = run;
  }

  // equity curve and drawdown, walked trade by trade
  let equity = startingBalance;
  let peak = startingBalance;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  const points: EquityPoint[] = [{ index: 0, label: 'Start', equity, net: 0, peak }];
  closed.forEach((t, i) => {
    const p = netPnl(t);
    equity += p;
    peak = Math.max(peak, equity);
    const dd = peak - equity;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, (dd / peak) * 100);
    points.push({ index: i + 1, label: tradeDay(t), equity, net: p, peak });
  });

  // R statistics, only from trades that recorded a stop
  const rs = closed.map(rMultiple).filter((r): r is number => r != null);
  const avgR = rs.length ? mean(rs) : null;

  // SQN prefers R units; falls back to money when no stops were logged.
  // Van Tharp: mean / sample standard deviation * sqrt(n), where n is the
  // number of values the mean and deviation came from.
  const basis = rs.length >= Math.max(5, closed.length * 0.5) ? rs : pnls;
  const basisMean = mean(basis);
  const sd = basis.length > 1 ? Math.sqrt(basis.reduce((a, v) => a + (v - basisMean) ** 2, 0) / (basis.length - 1)) : 0;
  const sqn = sd > 0 ? (basisMean / sd) * Math.sqrt(basis.length) : null;

  const days = aggregateDays(allTrades);
  const sortedDays = [...days].sort((a, b) => a.net - b.net);
  const bestDay = sortedDays.length ? sortedDays[sortedDays.length - 1] : null;
  // is the record carried by one day? its best green day against all of them
  const green = days.filter((d) => d.net > 0);
  const topGreen = bestDay && bestDay.net > 0 ? bestDay : null;
  const greenNet = green.reduce((a, d) => a + d.net, 0);
  // under half a cent either way is nothing made, not a crumb to divide or to show as -$0.00
  const made = Math.abs(net) < HALF_CENT ? 0 : net;

  const holds = closed.map(holdMinutes).filter((m): m is number => m != null);
  const winHolds = closed
    .filter((t) => netPnl(t) > 0)
    .map(holdMinutes)
    .filter((m): m is number => m != null);
  const lossHolds = closed
    .filter((t) => netPnl(t) < 0)
    .map(holdMinutes)
    .filter((m): m is number => m != null);

  return {
    total: closed.length,
    wins: winPnls.length,
    losses: lossPnls.length,
    breakeven,
    open: Math.max(0, open),
    winRate,
    lossRate: (lossPnls.length / closed.length) * 100,
    net,
    gross: closed.reduce((a, t) => a + grossPnl(t), 0),
    grossProfit,
    grossLoss,
    fees,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null,
    avgWin,
    avgLoss,
    payoff: avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : null,
    expectancy: net / closed.length,
    avgR,
    sqn,
    maxWinStreak,
    maxLossStreak: Math.abs(maxLossStreak),
    currentStreak,
    bestDay,
    worstDay: sortedDays.length ? sortedDays[0] : null,
    activeDays: days.length,
    greenDays: green.length,
    greenDayRate: (green.length / days.length) * 100,
    bestDayShare: topGreen ? (topGreen.net / greenNet) * 100 : null,
    netWithoutBestDay: topGreen ? settle(net - topGreen.net) : null,
    avgDaily: days.length ? net / days.length : 0,
    largestWin: winPnls.length ? Math.max(...winPnls) : 0,
    largestLoss: lossPnls.length ? Math.min(...lossPnls) : 0,
    maxDrawdown,
    maxDrawdownPct: startingBalance > 0 ? maxDrawdownPct : null,
    // a drawdown under half a cent is a sub-cent trade, not a fall: dividing by it would read in the millions
    recoveryFactor: maxDrawdown >= HALF_CENT ? made / maxDrawdown : made > 0 ? Number.POSITIVE_INFINITY : null,
    avgHoldMinutes: holds.length ? mean(holds) : null,
    avgWinHold: winHolds.length ? mean(winHolds) : null,
    avgLossHold: lossHolds.length ? mean(lossHolds) : null,
    equity: points,
    days,
  };
}

/** the win rate at which the average win and loss break even, 0–100; null without a win and a loss */
export function breakEvenWinRate(stats: Pick<Stats, 'avgWin' | 'avgLoss'>): number | null {
  return stats.avgWin > 0 && stats.avgLoss > 0 ? (stats.avgLoss / (stats.avgWin + stats.avgLoss)) * 100 : null;
}

export function sqnLabel(sqn: number | null): string {
  if (sqn == null) return tr('sqn.none');
  if (sqn < 1.6) return tr('sqn.below');
  if (sqn < 2) return tr('sqn.average');
  if (sqn < 2.5) return tr('sqn.good');
  if (sqn < 3) return tr('sqn.excellent');
  if (sqn < 5) return tr('sqn.superb');
  return tr('sqn.exceptional');
}

export interface ScoreAxis {
  axis: string;
  score: number;
  /** false when you haven't logged the data this axis needs */
  rated: boolean;
  detail: string;
}

export interface SniperScore {
  axes: ScoreAxis[];
  overall: number | null;
  unrated: string[];
}

const clamp100 = (v: number) => Math.max(0, Math.min(100, v));

/**
 * The radar on the dashboard. Axes you haven't supplied data for are
 * reported as unrated rather than silently scored zero.
 *
 * Where the weights come from: they are this app's own calibration, not a
 * published standard. Each axis is a straight line from a result the app
 * treats as poor (0) to one it treats as excellent (100), clamped to 0–100:
 *
 *   Win rate       winRate × 1.4         0% → 0, 50% → 70, about 71% or more → 100
 *   Profit factor  pf / 3 × 100          break-even (1.0) → 33, 3.0 or more → 100;
 *                                        no losing trade at all → 100
 *   Risk:reward    (avgR + 0.5) × 50     −0.5R → 0, 0R → 25, +1.5R or more → 100
 *   Consistency    green-day share × 60  every day green → 60 of the 100
 *                  + steadiness × 0.4    steadiness = mean day ÷ its standard
 *                                        deviation × 60, so a ratio of about
 *                                        1.67 or more → 100 (40 of the 100);
 *                                        identical winning days → 60 (24 of
 *                                        the 100); a mean day at or below
 *                                        zero → 0
 *   Discipline,    average rating ÷ 5    1 of 5 → 20, 5 of 5 → 100
 *   execution,     × 100
 *   patience
 *
 * The overall score is the plain average of the rated axes. Steadiness is
 * for steady gains: days that lose about the same every time are steady, but
 * not in a way worth scoring (until 1.1 they earned it as fully as winning
 * days did).
 */
export function sniperScore(trades: Trade[], stats: Stats): SniperScore {
  const closed = statTrades(trades);
  const axes: ScoreAxis[] = [];

  const enough = stats.total >= 5;

  axes.push({
    axis: tr('score.winRate'),
    score: enough ? clamp100(stats.winRate * 1.4) : 0,
    rated: enough,
    detail: enough ? tr('score.winRate.detail', { pct: formatPct(stats.winRate) }) : tr('score.needsTrades'),
  });

  const pf = stats.profitFactor;
  axes.push({
    axis: tr('score.profitFactor'),
    score: enough && pf != null ? clamp100(Number.isFinite(pf) ? (pf / 3) * 100 : 100) : 0,
    rated: enough && pf != null,
    detail: pf == null ? tr('score.needsTrades') : tr('score.profitFactor.detail', { pf: formatRatio(pf) }),
  });

  const withStops = closed.filter((t) => t.stopLoss != null);
  const rRated = withStops.length >= 5 && stats.avgR != null;
  axes.push({
    axis: tr('score.riskReward'),
    score: rRated ? clamp100(((stats.avgR as number) + 0.5) * 50) : 0,
    rated: rRated,
    detail: rRated
      ? tr('score.riskReward.detail', { r: isolate(`${decimalMark((stats.avgR as number).toFixed(2))}R`) })
      : tr('score.needsStops'),
  });

  // consistency: how steady the daily results are
  const dayNets = stats.days.map((d) => d.net);
  const consistencyRated = dayNets.length >= 5;
  let consistency = 0;
  if (consistencyRated) {
    const m = mean(dayNets);
    const sd = Math.sqrt(mean(dayNets.map((v) => (v - m) ** 2)));
    const greenDays = stats.days.filter((d) => d.net > 0).length / stats.days.length;
    // steady gains, not steady results: an average day at or below zero earns none, however steady
    const steadiness = m <= 0 ? 0 : sd > 0 ? clamp100((m / sd) * 60) : 60;
    consistency = clamp100(greenDays * 60 + steadiness * 0.4);
  }
  axes.push({
    axis: tr('score.consistency'),
    score: consistency,
    rated: consistencyRated,
    detail: consistencyRated
      ? tr('score.consistency.detail', {
          green: stats.days.filter((d) => d.net > 0).length,
          count: stats.days.length,
        })
      : tr('score.needsDays'),
  });

  for (const key of ['discipline', 'execution', 'patience'] as const) {
    const values = closed.map((t) => t.review?.[key]).filter((v): v is number => typeof v === 'number');
    axes.push({
      axis: tr(`score.${key}`),
      score: values.length ? clamp100((mean(values) / 5) * 100) : 0,
      rated: values.length >= 3,
      detail:
        values.length >= 3
          ? tr('score.rating.detail', { avg: decimalMark(mean(values).toFixed(1)), count: values.length })
          : tr('score.needsRatings'),
    });
  }

  const rated = axes.filter((a) => a.rated);
  return {
    axes,
    overall: rated.length ? Math.round(mean(rated.map((a) => a.score))) : null,
    unrated: axes.filter((a) => !a.rated).map((a) => a.axis),
  };
}

/**
 * How far a table row of `trades` trades can be gone by: under 3 is 'few'
 * (greyed), under 10 'thin' (marked), 10 or more null.
 */
export function thinMark(trades: number): 'few' | 'thin' | null {
  return trades < 3 ? 'few' : trades < 10 ? 'thin' : null;
}

export interface GroupStat {
  key: string;
  label: string;
  trades: number;
  net: number;
  wins: number;
  winRate: number;
  avg: number;
  profitFactor: number | null;
}

/** Break results down by symbol, session, weekday, setup or tag */
export function groupTrades(
  trades: Trade[],
  keyOf: (t: Trade) => string | string[] | undefined,
  labelOf?: (key: string) => string,
): GroupStat[] {
  const map = new Map<string, Trade[]>();
  for (const t of statTrades(trades)) {
    const raw = keyOf(t);
    const keys = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
    for (const k of keys) {
      if (!k) continue;
      const list = map.get(k) ?? [];
      list.push(t);
      map.set(k, list);
    }
  }
  return [...map.entries()]
    .map(([key, list]) => {
      const pnls = list.map(netPnl);
      const wins = pnls.filter((p) => p > 0);
      const lossSum = Math.abs(pnls.filter((p) => p < 0).reduce((a, b) => a + b, 0));
      const winSum = wins.reduce((a, b) => a + b, 0);
      const net = pnls.reduce((a, b) => a + b, 0);
      return {
        key,
        label: labelOf ? labelOf(key) : key,
        trades: list.length,
        net,
        wins: wins.length,
        winRate: (wins.length / list.length) * 100,
        avg: net / list.length,
        profitFactor: lossSum > 0 ? winSum / lossSum : winSum > 0 ? Infinity : null,
      };
    })
    .sort((a, b) => b.net - a.net);
}
