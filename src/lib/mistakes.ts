import type { Settings, Trade } from './types';
import type { EditedRule } from './rules';
import { wholePct } from './format';
import { netPnl, statTrades, tradeDay } from './trade-math';
import { dateKey } from './utils';

/**
 * Mistakes, kept apart from tags. A trade carries the mistakes it made, picked
 * from my own list (Settings → Mistakes). What a mistake cost is not the P&L
 * of the trades that made it, as a FOMO entry can still win: it is how much
 * less they made than the clean trades, the ones with no mistake at all.
 *
 * Only trades from the day of the first one with a mistake count, on either
 * side. Before that no mistake was logged on any trade, so every one of them
 * would pass for a clean trade.
 */

/** the list a journal starts with, until it is changed in Settings */
export const STARTING_MISTAKES: readonly string[] = [
  'Entered early (FOMO)',
  'Chased the entry',
  'Moved my stop',
  'No stop',
  'Oversized',
  'Revenge trade',
  'Exited too early',
  'Held a loser too long',
  'Outside my plan',
];

/** below this many trades with a mistake, or clean ones, what it cost is not worked out */
export const MIN_MISTAKE_SIDE = 4;

/** the mistakes the trade form offers */
export function mistakeList(settings: Pick<Settings, 'mistakes'>): string[] {
  return [...(settings.mistakes ?? STARTING_MISTAKES)];
}

const spaced = (name: string) => name.trim().replace(/\s+/g, ' ');
const sameName = (a: string, b: string) => spaced(a).toLowerCase() === spaced(b).toLowerCase();

/**
 * A mistake typed in: the one of `known` it already is, whatever its capitals
 * or spaces ("oversized " is "Oversized"), or else the name trimmed. Null when
 * nothing but spaces was typed.
 */
export function matchMistake(typed: string, known: Iterable<string>): string | null {
  const name = spaced(typed);
  if (!name) return null;
  for (const k of known) if (sameName(k, name)) return k;
  return name;
}

/**
 * What the list editor in Settings saves: the names trimmed, without blank
 * ones or one another row already has whatever its capitals, and each row
 * whose name changed as old name → the name it is kept under. Renames go by
 * row, all at once, so A → B with B → C moves each mistake's trades one step,
 * and two rows swapping names swap their trades. Of two rows with one name,
 * the spelling of a row left as it was is kept, or else the first.
 */
export function editedMistakes(rows: EditedRule[]): { list: string[]; renamed: Map<string, string> } {
  const unchanged = rows.filter((r) => r.was != null && spaced(r.text) === r.was).map((r) => r.was as string);
  const list: string[] = [];
  for (const { text } of rows) {
    const name = spaced(text);
    if (name && !list.some((m) => sameName(m, name))) list.push(unchanged.find((m) => sameName(m, name)) ?? name);
  }
  const renamed = new Map<string, string>();
  for (const { text, was } of rows) {
    const now = list.find((m) => sameName(m, text));
    if (was != null && now && now !== was) renamed.set(was, now);
  }
  return { list, renamed };
}

/** the chips the trade form shows: the list, then any the trade has that the list no longer does */
export function mistakesShown(list: string[], own: string[] | undefined): string[] {
  return [...new Set([...list, ...(own ?? [])])];
}

/** the mistakes of several partial fills merged into one trade: each one made in any part */
export function combineMistakes(parts: Array<string[] | undefined>): string[] | undefined {
  const all = [...new Set(parts.flatMap((m) => m ?? []))];
  return all.length ? all : undefined;
}

/**
 * Mistakes renamed in Settings (old name → new): each trade's goes with its
 * new name. A trade renamed onto a mistake it already has keeps it once.
 */
export function renameMistakes(trades: Trade[], renamed: ReadonlyMap<string, string>): Trade[] {
  if (!renamed.size) return trades;
  return trades.map((t) =>
    t.mistakes?.some((m) => renamed.has(m))
      ? { ...t, mistakes: [...new Set(t.mistakes.map((m) => renamed.get(m) ?? m))] }
      : t,
  );
}

const made = (t: Trade) => Boolean(t.mistakes?.length);

/** the Trades page's filter: '' is every trade, 'clean' none made, 'any' at least one, 'm:' and a name that one */
export type MistakeFilter = '' | 'clean' | 'any' | `m:${string}`;

export function matchesMistakeFilter(t: Trade, filter: MistakeFilter): boolean {
  if (filter === '') return true;
  if (filter === 'clean') return !made(t);
  if (filter === 'any') return made(t);
  return t.mistakes?.includes(filter.slice(2)) ?? false;
}

/** the day mistakes started being logged: the first day a counted trade has one; null when none has */
export function mistakesSince(trades: Trade[]): string | null {
  let first: string | null = null;
  for (const t of statTrades(trades)) {
    const day = tradeDay(t);
    if (made(t) && (first == null || day < first)) first = day;
  }
  return first;
}

export interface MistakeSide {
  trades: number;
  net: number;
  /** net P&L per trade */
  avg: number;
  winRate: number;
}

export interface MistakeLine extends MistakeSide {
  mistake: string;
  /** on the list in Settings; false for one that only trades still have */
  listed: boolean;
  /**
   * (the clean trades' average − this mistake's trades' average) × its
   * trades: what they would have made more had they done as well as the
   * clean ones. Null below MIN_MISTAKE_SIDE trades on either side; below zero
   * while the trades with it have done better.
   */
  cost: number | null;
}

export interface MistakeReport {
  /** the day mistakes started being logged (see mistakesSince); null when none has been */
  since: string | null;
  /** the first day counted: `since`, or the start of the range when that is later; null when none is */
  from: string | null;
  /** the closed trades counted, from `from` on */
  trades: number;
  /** the counted trades with no mistake */
  clean: MistakeSide | null;
  /** the counted trades with at least one */
  withMistake: MistakeSide | null;
  /** the same cost over every trade with a mistake, each counted once however many it made */
  cost: number | null;
  /** each mistake made: the costliest first, then the ones not costed yet, the most made first */
  lines: MistakeLine[];
  /** the mistake that cost the most, when one cost money */
  costliest: MistakeLine | null;
}

function side(trades: Trade[]): MistakeSide | null {
  if (!trades.length) return null;
  const pnls = trades.map(netPnl);
  const net = pnls.reduce((a, b) => a + b, 0);
  return {
    trades: trades.length,
    net,
    avg: net / trades.length,
    winRate: (pnls.filter((p) => p > 0).length / trades.length) * 100,
  };
}

/** (clean average − the other side's average) × its trades, given MIN_MISTAKE_SIDE trades on each side */
function costOf(clean: MistakeSide | null, other: MistakeSide | null): number | null {
  return clean && other && clean.trades >= MIN_MISTAKE_SIDE && other.trades >= MIN_MISTAKE_SIDE
    ? (clean.avg - other.avg) * other.trades
    : null;
}

const byCost = (a: MistakeLine, b: MistakeLine) =>
  a.cost != null && b.cost != null
    ? b.cost - a.cost
    : a.cost != null
      ? -1
      : b.cost != null
        ? 1
        : b.trades - a.trades || a.mistake.localeCompare(b.mistake);

/**
 * What each mistake cost (Reports, Insights). `trades` are all of the
 * account's, so that when mistakes started being logged is known whatever the
 * range; `from` is the first day of the range, inclusive, or null for all of it.
 */
export function mistakeReport(trades: Trade[], list: string[], from: string | null = null): MistakeReport {
  const since = mistakesSince(trades);
  const start = since && from && from > since ? from : since;
  const counted = start ? statTrades(trades).filter((t) => tradeDay(t) >= start) : [];
  const clean = side(counted.filter((t) => !made(t)));
  const withOne = counted.filter(made);

  const byMistake = new Map<string, Trade[]>();
  for (const t of withOne) {
    for (const mistake of new Set(t.mistakes)) {
      const own = byMistake.get(mistake);
      if (own) own.push(t);
      else byMistake.set(mistake, [t]);
    }
  }
  const lines = [...byMistake.entries()]
    .map(([mistake, own]): MistakeLine => {
      const s = side(own) as MistakeSide;
      return { ...s, mistake, listed: list.includes(mistake), cost: costOf(clean, s) };
    })
    .sort(byCost);
  const withMistake = side(withOne);
  const [first] = lines;

  return {
    since,
    from: start,
    trades: counted.length,
    clean,
    withMistake,
    cost: costOf(clean, withMistake),
    lines,
    // half a cent at least, so what is left over from adding up cents is never named the costliest
    costliest: first?.cost != null && first.cost >= 0.005 ? first : null,
  };
}

/**
 * A share as a whole percentage that reads true: 249 of 250 is 99%, not 100%,
 * and 1 of 250 is 1%, not 0%. Only all of them is 100, and none 0.
 */
export function wholeShare(part: number, whole: number): number {
  return whole <= 0 ? 0 : wholePct((part / whole) * 100);
}

export interface CleanMonth {
  /** 'YYYY-MM', by the day a trade closed */
  month: string;
  trades: number;
  clean: number;
  /** clean ÷ trades, 0–100 */
  rate: number;
}

/** the share of clean trades in each month since mistakes started being logged, the latest first */
export function cleanMonths(trades: Trade[]): CleanMonth[] {
  const since = mistakesSince(trades);
  if (!since) return [];
  const months = new Map<string, { trades: number; clean: number }>();
  for (const t of statTrades(trades)) {
    const day = tradeDay(t);
    if (day < since) continue;
    const month = months.get(day.slice(0, 7)) ?? { trades: 0, clean: 0 };
    month.trades += 1;
    if (!made(t)) month.clean += 1;
    months.set(day.slice(0, 7), month);
  }
  return [...months.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, { trades: n, clean }]) => ({ month, trades: n, clean, rate: (clean / n) * 100 }));
}

/** this month and the one before, as cleanMonths has them; null for a month with no trade counted */
export function thisAndLastMonth(
  months: CleanMonth[],
  now = new Date(),
): { thisMonth: CleanMonth | null; lastMonth: CleanMonth | null } {
  const key = (d: Date) => dateKey(d).slice(0, 7);
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    thisMonth: months.find((m) => m.month === key(now)) ?? null,
    lastMonth: months.find((m) => m.month === key(last)) ?? null,
  };
}
