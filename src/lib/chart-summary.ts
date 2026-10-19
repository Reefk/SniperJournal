import { formatDate, formatMoney } from './format';
import type { DayAgg, EquityPoint, SniperScore } from './stats';

/**
 * The dashboard's charts in words, for a screen reader, which can't describe
 * the drawing: what each one plots, over which days, between which values,
 * and where it ends. Shown to nobody else (ChartContainer's `summary`).
 */

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
// not Math.min(...values): a long journal has more values than a call takes
// arguments. Callers pass at least one value.
const lowest = (values: number[]) => values.reduce((a, b) => (b < a ? b : a));
const highest = (values: number[]) => values.reduce((a, b) => (b > a ? b : a));

/** the equity curve: the balance after every closed trade, from the opening balance */
export function equitySummary(points: EquityPoint[], currency: string): string {
  const start = points[0];
  const trades = points.slice(1);
  const last = trades.at(-1);
  if (!start || !last) {
    return `Account balance: no closed trades in this range yet, so it stays at ${formatMoney(start?.equity ?? 0, currency)}.`;
  }
  const values = points.map((p) => p.equity);
  return (
    `Account balance after each of ${count(trades.length, 'closed trade', 'closed trades')}, ` +
    `${formatDate(trades[0].label)} to ${formatDate(last.label)}: ` +
    `from ${formatMoney(start.equity, currency)} to ${formatMoney(last.equity, currency)}, ` +
    `lowest ${formatMoney(lowest(values), currency)}, highest ${formatMoney(highest(values), currency)}.`
  );
}

/** the daily P&L bars: one net result per trading day */
export function dailySummary(days: DayAgg[], currency: string): string {
  const last = days.at(-1);
  if (!last) return 'Daily P&L: no closed trades in this range yet.';
  const nets = days.map((d) => d.net);
  const money = (v: number) => formatMoney(v, currency, { sign: true });
  return (
    `Net P&L of each of ${count(days.length, 'trading day', 'trading days')}, ` +
    `${formatDate(days[0].day)} to ${formatDate(last.day)}: ` +
    `worst ${money(lowest(nets))}, best ${money(highest(nets))}, ` +
    `last day ${money(last.net)}.`
  );
}

/** the Sniper Score radar: each axis out of 100, and the overall score */
export function scoreSummary(score: SniperScore): string {
  const rated = score.axes.filter((a) => a.rated);
  const unrated = score.axes.filter((a) => !a.rated).map((a) => a.axis);
  const parts = [
    rated.length
      ? `Sniper Score out of 100 on each axis: ${rated.map((a) => `${a.axis} ${Math.round(a.score)}`).join(', ')}.`
      : 'Sniper Score: no axis rated yet.',
    unrated.length ? `Not yet rated: ${unrated.join(', ')}.` : '',
    score.overall == null ? '' : `Overall ${score.overall} out of 100.`,
  ];
  return parts.filter(Boolean).join(' ');
}
