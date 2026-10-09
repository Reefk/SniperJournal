import type { Moment } from './values';

/**
 * Most brokers export executions, one row per fill, not trades. This puts
 * them back together the way the position actually moved: fills of one
 * symbol in one account add up until the position is flat again, and that is
 * one trade. Scaling in and out stays one trade; a fill that goes through
 * zero (long 2, sell 5) closes the trade and opens the opposite one with the
 * rest. Files that number their trades (TradingView) are grouped by number.
 */

export interface Fill {
  /** file line, for messages */
  line: number;
  /** fills with the same key share one position: account and symbol */
  key: string;
  side: 'BUY' | 'SELL';
  /** always more than 0 */
  quantity: number;
  price: number;
  time: Moment | null;
  /** cost of this fill; already the right sign (a rebate is negative) */
  fees: number;
  /** realised P&L the file reports on this fill, if it does */
  pnl: number | null;
  id?: string;
  /** the file says this fill opened or closed a position */
  effect?: 'open' | 'close';
  tradeNo?: string;
}

export interface Part {
  fill: Fill;
  quantity: number;
  fees: number;
  /** the part of the fill's reported P&L that belongs here */
  pnl: number | null;
}

export interface Position {
  key: string;
  side: 'LONG' | 'SHORT';
  entries: Part[];
  exits: Part[];
  /** closes a position this file never opened, so its entry is unknown */
  orphan: boolean;
}

const EPS = 1e-9;
const tidy = (q: number) => Math.round(q * 1e8) / 1e8;
const sumQty = (parts: Part[]) => tidy(parts.reduce((a, p) => a + p.quantity, 0));

/**
 * Chronological order. Most exports list oldest first, many newest first
 * (TradingView, Robinhood); with times on every fill they are sorted, and a
 * file that runs backwards keeps fills sharing a timestamp in their real order.
 */
function chronological(fills: Fill[]): Fill[] {
  const timed = fills.filter((f) => f.time);
  let ordered = [...fills];
  if (timed.length >= 2 && (timed[0].time as Moment).sortKey > (timed[timed.length - 1].time as Moment).sortKey) {
    ordered.reverse();
  }
  if (timed.length === fills.length) {
    ordered = ordered.sort((a, b) => ((a.time as Moment).sortKey < (b.time as Moment).sortKey ? -1 : (a.time as Moment).sortKey > (b.time as Moment).sortKey ? 1 : 0));
  }
  return ordered;
}

const part = (fill: Fill, quantity: number, withPnl: boolean): Part => ({
  fill,
  quantity: tidy(quantity),
  fees: fill.fees * (quantity / fill.quantity),
  pnl: withPnl ? fill.pnl : null,
});

/** fills grouped by the trade number the file gives them */
function byTradeNumber(fills: Fill[]): Position[] {
  const groups = new Map<string, Fill[]>();
  for (const f of chronological(fills)) {
    const id = `${f.key}|${f.tradeNo}`;
    groups.set(id, [...(groups.get(id) ?? []), f]);
  }
  return [...groups.values()].map((group) => {
    const opener = group.find((f) => f.effect === 'open') ?? group[0];
    const entries = group.filter((f) => (f.effect ? f.effect === 'open' : f.side === opener.side));
    const exits = group.filter((f) => !entries.includes(f));
    return {
      key: opener.key,
      side: opener.side === 'BUY' ? 'LONG' : 'SHORT',
      entries: entries.map((f) => part(f, f.quantity, false)),
      // the trade's P&L is reported on its exit (and repeated on the entry by some)
      exits: exits.map((f) => part(f, f.quantity, true)),
      orphan: false,
    };
  });
}

/** fills followed position by position, per account and symbol */
function byPosition(fills: Fill[]): Position[] {
  const done: Position[] = [];
  const open = new Map<string, { position: Position; signed: number }>();

  for (const fill of chronological(fills)) {
    const signed = fill.side === 'BUY' ? fill.quantity : -fill.quantity;
    const state = open.get(fill.key);

    // nothing open: this fill opens a position, unless the file says it closes one
    if (!state || Math.abs(state.signed) < EPS) {
      if (fill.effect === 'close') {
        done.push({
          key: fill.key,
          side: fill.side === 'SELL' ? 'LONG' : 'SHORT',
          entries: [],
          exits: [part(fill, fill.quantity, true)],
          orphan: true,
        });
        continue;
      }
      open.set(fill.key, {
        position: { key: fill.key, side: signed > 0 ? 'LONG' : 'SHORT', entries: [part(fill, fill.quantity, false)], exits: [], orphan: false },
        signed,
      });
      continue;
    }

    // adding to the position
    if (Math.sign(signed) === Math.sign(state.signed)) {
      state.position.entries.push(part(fill, fill.quantity, false));
      state.signed = tidy(state.signed + signed);
      continue;
    }

    // reducing it: up to flat closes this position
    const closing = Math.min(fill.quantity, Math.abs(state.signed));
    state.position.exits.push(part(fill, closing, true));
    state.signed = tidy(state.signed + Math.sign(signed) * closing);
    if (Math.abs(state.signed) < EPS) {
      done.push(state.position);
      open.delete(fill.key);
    }

    // anything past flat opens the other way (or, if the file says this fill
    // only closes, closed a position from before this file)
    const rest = tidy(fill.quantity - closing);
    if (rest > EPS) {
      if (fill.effect === 'close') {
        done.push({ key: fill.key, side: signed < 0 ? 'LONG' : 'SHORT', entries: [], exits: [part(fill, rest, false)], orphan: true });
      } else {
        open.set(fill.key, {
          position: { key: fill.key, side: signed > 0 ? 'LONG' : 'SHORT', entries: [part(fill, rest, false)], exits: [], orphan: false },
          signed: Math.sign(signed) * rest,
        });
      }
    }
  }

  // still open when the file ends
  for (const { position } of open.values()) done.push(position);
  return done;
}

export function fillsToPositions(fills: Fill[]): Position[] {
  if (!fills.length) return [];
  const positions = fills.every((f) => f.tradeNo) ? byTradeNumber(fills) : byPosition(fills);
  const firstTime = (p: Position) => (p.entries[0] ?? p.exits[0]).fill.time?.sortKey ?? '';
  const firstLine = (p: Position) => (p.entries[0] ?? p.exits[0]).fill.line;
  return positions.sort((a, b) => firstTime(a).localeCompare(firstTime(b)) || firstLine(a) - firstLine(b));
}

export interface Summary {
  key: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  /** size-weighted, exact; null when no fill gives one */
  entryPrice: number | null;
  exitPrice: number | null;
  openedAt: Moment | null;
  closedAt: Moment | null;
  fees: number;
  /** sum of the realised P&L the file reports on the exits, if it reports any */
  reportedPnl: number | null;
  /** exits × price − entries × price, in the trade's direction, before any multiplier */
  move: number | null;
  ids: string[];
  fillCount: number;
  closed: boolean;
  orphan: boolean;
  firstLine: number;
  /** file lines of every fill in it */
  lines: number[];
  /** the prices the averages came from, for rounding them sensibly */
  entryPrices: number[];
  exitPrices: number[];
}

const average = (parts: Part[]) => {
  const q = parts.reduce((a, p) => a + p.quantity, 0);
  return q > EPS ? parts.reduce((a, p) => a + p.quantity * p.fill.price, 0) / q : null;
};

/**
 * One position as one or two trades. A position the file leaves partly
 * closed becomes a closed trade for the part that was sold and an open one
 * for the rest, so the realised part counts in the statistics already.
 */
export function summarise(p: Position): Summary[] {
  const entered = sumQty(p.entries);
  const exited = sumQty(p.exits);
  const direction = p.side === 'LONG' ? 1 : -1;
  const entryPrice = average(p.entries);
  const exitPrice = average(p.exits);
  const reported = p.exits.some((x) => x.pnl != null) ? p.exits.reduce((a, x) => a + (x.pnl ?? 0), 0) : null;
  const ids = [...new Set([...p.entries, ...p.exits].map((x) => x.fill.id).filter((id): id is string => Boolean(id)))];
  const fills = new Set([...p.entries, ...p.exits].map((x) => x.fill)).size;
  const entryFees = p.entries.reduce((a, x) => a + x.fees, 0);
  const exitFees = p.exits.reduce((a, x) => a + x.fees, 0);
  const times = (parts: Part[]) => parts.map((x) => x.fill.time).filter((t): t is Moment => t != null);
  const first = (parts: Part[]) => times(parts).sort((a, b) => a.sortKey.localeCompare(b.sortKey))[0] ?? null;
  const last = (parts: Part[]) => times(parts).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).at(-1) ?? null;
  const base = {
    key: p.key,
    side: p.side,
    entryPrice,
    openedAt: first(p.entries) ?? first(p.exits),
    ids,
    fillCount: fills,
    orphan: p.orphan,
    firstLine: (p.entries[0] ?? p.exits[0]).fill.line,
    lines: [...new Set([...p.entries, ...p.exits].map((x) => x.fill.line))],
    entryPrices: p.entries.map((x) => x.fill.price),
    exitPrices: p.exits.map((x) => x.fill.price),
  };

  if (p.orphan) {
    return [{ ...base, quantity: exited, exitPrice, closedAt: last(p.exits), fees: exitFees, reportedPnl: reported, move: null, closed: true }];
  }

  const moveOf = (q: number) => (entryPrice != null && exitPrice != null ? (exitPrice - entryPrice) * q * direction : null);
  if (exited < EPS) {
    return [{ ...base, quantity: entered, exitPrice: null, closedAt: null, fees: entryFees, reportedPnl: null, move: null, closed: false }];
  }
  if (Math.abs(entered - exited) < EPS) {
    return [{ ...base, quantity: entered, exitPrice, closedAt: last(p.exits), fees: entryFees + exitFees, reportedPnl: reported, move: moveOf(entered), closed: true }];
  }

  // partly closed: split the entry (and its fees) between the two
  const share = exited / entered;
  return [
    { ...base, quantity: exited, exitPrice, closedAt: last(p.exits), fees: entryFees * share + exitFees, reportedPnl: reported, move: moveOf(exited), closed: true },
    // the open rest keeps its entry fills' ids, so importing the file again skips it too
    {
      ...base,
      quantity: tidy(entered - exited),
      exitPrice: null,
      closedAt: null,
      fees: entryFees * (1 - share),
      reportedPnl: null,
      move: null,
      closed: false,
      ids: [...new Set(p.entries.map((x) => x.fill.id).filter((id): id is string => Boolean(id)))],
      fillCount: p.entries.length,
      lines: p.entries.map((x) => x.fill.line),
    },
  ];
}
