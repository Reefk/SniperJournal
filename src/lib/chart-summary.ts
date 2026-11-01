import { formatDate, formatMoney, formatSignedPct } from './format';
import { tr } from './i18n';
import type { DayAgg, EquityPoint, SniperScore } from './stats';

/**
 * The dashboard's charts in words, for a screen reader, which can't describe
 * the drawing: what each one plots, over which days, between which values,
 * and where it ends. Shown to nobody else (ChartContainer's `summary`).
 */

// not Math.min(...values): a long journal has more values than a call takes
// arguments. Callers pass at least one value.
const lowest = (values: number[]) => values.reduce((a, b) => (b < a ? b : a));
const highest = (values: number[]) => values.reduce((a, b) => (b > a ? b : a));

/**
 * the equity curve: the balance after every closed trade, from the opening balance;
 * `inPercent` for privacy mode's curve, its points already in % (equityInPercent)
 */
export function equitySummary(points: EquityPoint[], currency: string, inPercent = false): string {
  const amount = (v: number) => (inPercent ? formatSignedPct(v, 2) : formatMoney(v, currency));
  const start = points[0];
  const trades = points.slice(1);
  const last = trades.at(-1);
  if (!start || !last) {
    return tr('summary.equityEmpty', { money: amount(start?.equity ?? 0) });
  }
  const values = points.map((p) => p.equity);
  return tr('summary.equity', {
    count: trades.length,
    from: formatDate(trades[0].label),
    to: formatDate(last.label),
    start: amount(start.equity),
    end: amount(last.equity),
    low: amount(lowest(values)),
    high: amount(highest(values)),
  });
}

/** the daily P&L bars: one net result per trading day */
export function dailySummary(days: DayAgg[], currency: string): string {
  const last = days.at(-1);
  if (!last) return tr('summary.dailyEmpty');
  const nets = days.map((d) => d.net);
  const money = (v: number) => formatMoney(v, currency, { sign: true });
  return tr('summary.daily', {
    count: days.length,
    from: formatDate(days[0].day),
    to: formatDate(last.day),
    worst: money(lowest(nets)),
    best: money(highest(nets)),
    last: money(last.net),
  });
}

/** the Sniper Score radar: each axis out of 100, and the overall score */
export function scoreSummary(score: SniperScore): string {
  const rated = score.axes.filter((a) => a.rated);
  const unrated = score.axes.filter((a) => !a.rated).map((a) => a.axis);
  const comma = tr('format.comma');
  const parts = [
    rated.length
      ? tr('summary.score', {
          axes: rated.map((a) => tr('summary.scoreAxis', { axis: a.axis, score: Math.round(a.score) })).join(comma),
        })
      : tr('summary.scoreNone'),
    unrated.length ? tr('summary.unrated', { axes: unrated.join(comma) }) : '',
    score.overall == null ? '' : tr('summary.overall', { score: score.overall }),
  ];
  return parts.filter(Boolean).join(' ');
}
