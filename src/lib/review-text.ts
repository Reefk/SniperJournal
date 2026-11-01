import type { Goals, Setup, Trade } from './types';
import { tr } from './i18n';
import {
  formatDate,
  formatDuration,
  formatMoney,
  formatPrice,
  formatR,
  formatShortDate,
  formatSignedPct,
  weekdayName,
} from './format';
import { goalsSet, goalTargetText } from './goals';
import { mistakeName } from './mistakes';
import { ruleVerdict, rulesShown, tickOf } from './rules';
import {
  holdMinutes,
  isClosed,
  netPnl,
  outcome,
  rMultiple,
  settle,
  sortChronological,
  statTrades,
  tradeDay,
} from './trade-math';
import { sessionName } from './sessions';
import { parseLocal } from './utils';

/**
 * Copy for review: a trade, a day or a week as plain text, which the trader
 * pastes into any AI or sends to a mentor. The app sends nothing; this only
 * writes the text. It ends with the trader's own rules, mistakes and goals,
 * and instructions to grade each trade on its process against them, not
 * against general trading advice.
 */

/** what the trades are graded against, and how amounts are written */
export interface ReviewBook {
  setups: Setup[];
  /** the mistakes the trade form offers (lib/mistakes.ts) */
  mistakes: string[];
  goals?: Goals;
  currency: string;
  /** the trader's own instructions (Settings); empty or absent is the app's */
  note?: string;
}

export interface ReviewMoney {
  /** "Leave out money": no amounts, sizes or fees; R, and % of the balance the period began at */
  leaveOut: boolean;
  /** that balance, for the %; null with no starting balance */
  opening: number | null;
}

/** "-$20.00", or with amounts left out "-0.20% of my balance"; null when there is neither */
function amount(net: number, book: ReviewBook, money: ReviewMoney): string | null {
  if (!money.leaveOut) return formatMoney(net, book.currency, { sign: true });
  if (money.opening == null || money.opening <= 0) return null;
  return tr('review.pct', { pct: formatSignedPct((net / money.opening) * 100, 2) });
}

/** a trade's result: its R where it has a stop, and its amount; with neither, whether it won */
function resultText(t: Trade, book: ReviewBook, money: ReviewMoney): string {
  const net = netPnl(t);
  const r = rMultiple(t);
  const inR = r == null ? null : formatR(settle(r));
  const inMoney = amount(net, book, money);
  const either = inR ?? inMoney;
  if (either == null) {
    const won = outcome(t);
    return tr(won === 'WIN' ? 'review.win' : won === 'LOSS' ? 'review.loss' : 'review.even');
  }
  const text = inR != null && inMoney != null ? tr('review.rAndAmount', { r: inR, amount: inMoney }) : either;
  return !money.leaveOut && t.fees > 0
    ? tr('review.afterFees', { result: text, fees: formatMoney(t.fees, book.currency) })
    : text;
}

/** between the items of a list, in the app's language */
const comma = () => tr('format.comma');

const time = (at: string) => at.slice(11, 16);
/** a time, with its date too when the trade closed on another day */
const when = (at: string, day: string) => (at.slice(0, 10) === day ? time(at) : `${formatShortDate(at)} ${time(at)}`);

/** a trade, a line for each thing it has; `n` numbers it in a day or a week */
function tradeLines(t: Trade, book: ReviewBook, money: ReviewMoney, n?: number): string[] {
  const day = tradeDay(t);
  const lines = [
    `${n ? `${n}. ` : ''}${tr('review.trade', { symbol: t.symbol, side: tr(`side.${t.side}`), date: formatDate(day) })}`,
  ];
  // a trade with only a date has no times to give
  if (time(t.openedAt)) {
    lines.push(
      isClosed(t) && t.closedAt
        ? tr('review.times', {
            open: when(t.openedAt, day),
            close: time(t.closedAt) || '—',
            hold: formatDuration(holdMinutes(t)),
          })
        : tr('review.stillOpen', { open: when(t.openedAt, day) }),
    );
  }
  const size = String(t.quantity);
  const entry = formatPrice(t.entryPrice);
  if (t.exitPrice == null) {
    lines.push(money.leaveOut ? tr('review.entry', { entry }) : tr('review.sizeEntry', { size, entry }));
  } else {
    const prices = { entry, exit: formatPrice(t.exitPrice) };
    lines.push(money.leaveOut ? tr('review.prices', prices) : tr('review.sizePrices', { size, ...prices }));
  }
  lines.push(
    t.stopLoss == null
      ? tr('review.noStop')
      : t.takeProfit == null
        ? tr('review.stop', { stop: formatPrice(t.stopLoss) })
        : tr('review.stopTarget', { stop: formatPrice(t.stopLoss), target: formatPrice(t.takeProfit) }),
  );
  if (isClosed(t)) lines.push(tr('review.result', { result: resultText(t, book, money) }));

  const setup = t.setupId ? book.setups.find((s) => s.id === t.setupId) : undefined;
  if (t.setupId) {
    lines.push(tr('review.setup', { name: setup?.name ?? tr('rep.unknownSetup') }));
    const rules = rulesShown(setup?.rules ?? [], t.ruleChecks);
    if (ruleVerdict(t.ruleChecks) === 'unchecked') {
      if (rules.length) lines.push(tr('review.noTicks'));
    } else {
      const by = (tick: boolean | null) =>
        rules.filter((rule) => tickOf(t.ruleChecks, rule) === tick).join(tr('review.ruleSep'));
      const kept = by(true);
      const broken = by(false);
      const unticked = by(null);
      if (kept) lines.push(tr('review.kept', { rules: kept }));
      if (broken) lines.push(tr('review.broken', { rules: broken }));
      if (unticked) lines.push(tr('review.unticked', { rules: unticked }));
    }
  }
  if (t.mistakes?.length) lines.push(tr('review.mistakes', { list: t.mistakes.map(mistakeName).join(comma()) }));
  if (t.tags.length) lines.push(tr('review.tags', { list: t.tags.join(comma()) }));
  const ratings = (['discipline', 'execution', 'patience'] as const)
    .filter((key) => t.review?.[key] != null)
    .map((key) => `${tr(`score.${key}`)} ${t.review?.[key]}`);
  if (ratings.length) lines.push(tr('review.ratings', { list: ratings.join(comma()) }));
  if (t.session?.trim()) lines.push(tr('review.session', { session: sessionName(t.session.trim()) }));
  if (t.notes?.trim()) lines.push(tr('review.notes', { notes: t.notes.trim() }));
  if (t.excluded) lines.push(tr('review.excluded'));
  return lines;
}

/** a day's or a week's numbers, from the trades every statistic counts */
function numberLines(trades: Trade[], book: ReviewBook, money: ReviewMoney): string[] {
  const closed = statTrades(trades);
  const won = closed.filter((t) => outcome(t) === 'WIN').length;
  const lost = closed.filter((t) => outcome(t) === 'LOSS').length;
  const lines = [tr('review.count', { count: closed.length, won, lost })];
  const net = amount(settle(closed.reduce((sum, t) => sum + netPnl(t), 0)), book, money);
  if (net) lines.push(tr('review.net', { result: net }));
  const rs = closed.map(rMultiple).filter((r) => r != null);
  if (rs.length) {
    lines.push(tr('review.rTotal', { count: rs.length, r: formatR(settle(rs.reduce((sum, r) => sum + r, 0))) }));
  }
  return lines;
}

/** the trader's own rules for the setups these trades used, their mistake list and goals, then the instructions */
function closing(trades: Trade[], book: ReviewBook, money: ReviewMoney): string[] {
  const used = new Set(trades.map((t) => t.setupId));
  const mine = book.setups
    .filter((s) => used.has(s.id))
    .map((s) => {
      const rules = s.rules.filter(Boolean);
      return `- ${rules.length ? tr('review.rules', { name: s.name, rules: rules.join(tr('review.ruleSep')) }) : tr('review.noRules', { name: s.name })}`;
    });
  if (book.mistakes.length)
    mine.push(`- ${tr('review.mistakeList', { list: book.mistakes.map(mistakeName).join(comma()) })}`);
  // a goal in money says how big the account is: left out with the amounts
  const goals = goalsSet(book.goals)
    .filter(({ def }) => !(money.leaveOut && def.unit === 'money'))
    .map(({ def, target }) => `${def.label} ${goalTargetText(def, target, book.currency)}`);
  if (goals.length) mine.push(`- ${tr('review.goals', { list: goals.join(comma()) })}`);
  return [...(mine.length ? ['', tr('review.mine'), ...mine] : []), '', book.note?.trim() || tr('review.note')];
}

/** the line saying amounts were left out, under the first */
const leftOut = (money: ReviewMoney) =>
  money.leaveOut ? [tr(money.opening != null && money.opening > 0 ? 'review.leftOut' : 'review.leftOutNoBalance')] : [];

/** one trade, for review */
export function tradeReview(t: Trade, book: ReviewBook, money: ReviewMoney): string {
  return [
    tr('review.head.trade', { symbol: t.symbol, date: formatDate(tradeDay(t)) }),
    ...leftOut(money),
    '',
    ...tradeLines(t, book, money),
    ...closing([t], book, money),
  ].join('\n');
}

/** a day ('YYYY-MM-DD') and its trades, each in full */
export function dayReview(day: string, trades: Trade[], book: ReviewBook, money: ReviewMoney): string {
  const weekday = weekdayName((parseLocal(day).getDay() + 6) % 7, 'long');
  const uncounted = trades.length - statTrades(trades).length;
  return [
    tr('review.head.day', { day: weekday, date: formatDate(day) }),
    ...leftOut(money),
    '',
    ...numberLines(trades, book, money),
    ...(uncounted ? [tr('review.uncounted.day', { count: uncounted })] : []),
    ...sortChronological(trades).flatMap((t, i) => ['', ...tradeLines(t, book, money, i + 1)]),
    ...closing(trades, book, money),
  ].join('\n');
}

/**
 * A week, from `from` to `to` ('YYYY-MM-DD'): its numbers, a line a day, and
 * in full only the trades that broke a rule or had a mistake, so it stays short.
 */
export function weekReview(from: string, to: string, trades: Trade[], book: ReviewBook, money: ReviewMoney): string {
  const inWeek = trades.filter((t) => tradeDay(t) >= from && tradeDay(t) <= to);
  const counted = new Set(statTrades(inWeek));
  const byDay = new Map<string, Trade[]>();
  for (const t of counted) byDay.set(tradeDay(t), [...(byDay.get(tradeDay(t)) ?? []), t]);
  const dayLines = [...byDay]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, ofDay]) => {
      const weekday = weekdayName((parseLocal(day).getDay() + 6) % 7);
      const net = amount(settle(ofDay.reduce((sum, t) => sum + netPnl(t), 0)), book, money);
      const rs = ofDay.map(rMultiple).filter((r) => r != null);
      // with no amount, its R; with no stop either, what it won and lost
      const result =
        net ??
        (rs.length
          ? formatR(settle(rs.reduce((sum, r) => sum + r, 0)))
          : tr('review.wonLost', {
              won: ofDay.filter((t) => outcome(t) === 'WIN').length,
              lost: ofDay.filter((t) => outcome(t) === 'LOSS').length,
            }));
      return `- ${tr('review.dayLine', {
        day: `${weekday} ${formatShortDate(day)}`,
        trades: tr('common.trades', { count: ofDay.length }),
        result,
      })}`;
    });
  const flagged = sortChronological(inWeek).filter(
    (t) => ruleVerdict(t.ruleChecks) === 'broken' || (t.mistakes?.length ?? 0) > 0,
  );
  // the counted trades not given in full are in the day lines; the others are only in the count under the numbers
  const rest = [...counted].filter((t) => !flagged.includes(t)).length;
  const uncounted = inWeek.length - counted.size;
  return [
    tr('review.head.week', { from: formatShortDate(from), to: formatDate(to) }),
    ...leftOut(money),
    '',
    ...numberLines(inWeek, book, money),
    ...(uncounted ? [tr('review.uncounted.week', { count: uncounted })] : []),
    ...(dayLines.length ? ['', tr('review.days'), ...dayLines] : []),
    '',
    flagged.length ? tr('review.flagged') : tr('review.flagged.none'),
    ...flagged.flatMap((t, i) => ['', ...tradeLines(t, book, money, i + 1)]),
    ...(flagged.length && rest ? ['', tr('review.flagged.rest', { count: rest })] : []),
    ...closing(flagged.length ? flagged : inWeek, book, money),
  ].join('\n');
}
