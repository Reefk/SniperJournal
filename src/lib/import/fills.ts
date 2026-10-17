import type { Moment } from './values';

/**
 * Most brokers export executions, one row per fill, not trades. This puts
 * them back together the way the position actually moved: fills of one
 * symbol in one account add up until the position is flat again, and that is
 * one trade. Scaling in and out stays one trade; a fill that goes through
 * zero (long 2, sell 5) closes the trade and opens the opposite one with the
 * rest. Files that number their trades (TradingView) are grouped by number.
 *
 * A file can begin in the middle of a position an earlier export opened. A
 * trade the journal has for it is then carried in as that position's entry
 * (see `Carry`), so the file's closing fills finish it.
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
  /** not a row of the file: the entry of the journal trade with this id, carried in */
  carried?: string;
}

/** a trade in the journal that a file's fills may continue */
export interface Carry {
  /** its entry as a fill: side, size, price, time and fees, with `carried` set to its id */
  fill: Fill;
  /** when the journal has it closed; null while it is open */
  closedAt: Moment | null;
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
 * When the fills alone can't show which way the file runs (a buy and a sell on
 * one day, with no time), `newestFirst` says, from every dated row of the file.
 */
function chronological(fills: Fill[], newestFirst: boolean): Fill[] {
  const timed = fills.filter((f) => f.time);
  let ordered = [...fills];
  const first = timed[0]?.time?.sortKey;
  const last = timed[timed.length - 1]?.time?.sortKey;
  if (timed.length >= 2 && first !== last ? (first as string) > (last as string) : newestFirst) {
    ordered.reverse();
  }
  if (timed.length === fills.length) {
    ordered = ordered.sort((a, b) =>
      (a.time as Moment).sortKey < (b.time as Moment).sortKey
        ? -1
        : (a.time as Moment).sortKey > (b.time as Moment).sortKey
          ? 1
          : 0,
    );
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
function byTradeNumber(fills: Fill[], newestFirst: boolean): Position[] {
  const groups = new Map<string, Fill[]>();
  for (const f of chronological(fills, newestFirst)) {
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

/** a before b: to the minute, or to the day when either has no time of day */
const earlier = (a: Moment, b: Moment) =>
  a.timed && b.timed ? a.value < b.value : a.value.slice(0, 10) < b.value.slice(0, 10);

/**
 * The journal trade that a symbol's first fill in the file continues: one on
 * the other side (the fill reduces it), opened before the fill and still open
 * at it. A trade the journal already has closed comes first, as that is a
 * file imported again; two that fit either way are too uncertain to choose.
 * A first fill on the same side starts a position of its own, so a trade
 * left open by mistake is never mixed into a new one.
 */
function carryFor(carries: readonly Carry[] | undefined, fill: Fill): Fill | null {
  const at = fill.time;
  if (!carries || !at) return null;
  const fits = carries.filter(
    (c) =>
      c.fill.side !== fill.side &&
      c.fill.time != null &&
      earlier(c.fill.time, at) &&
      (!c.closedAt || !earlier(c.closedAt, at)),
  );
  const closed = fits.filter((c) => c.closedAt);
  const pick = closed.length ? closed : fits;
  return pick.length === 1 ? pick[0].fill : null;
}

/** fills followed position by position, per account and symbol */
function byPosition(fills: Fill[], newestFirst: boolean, carries?: ReadonlyMap<string, readonly Carry[]>): Position[] {
  const done: Position[] = [];
  const open = new Map<string, { position: Position; signed: number }>();
  const started = new Set<string>();

  for (const fill of chronological(fills, newestFirst)) {
    const signed = fill.side === 'BUY' ? fill.quantity : -fill.quantity;
    let state = open.get(fill.key);

    // the file begins in the middle of a position the journal has
    if (carries && !started.has(fill.key)) {
      const carried = carryFor(carries.get(fill.key), fill);
      if (carried) {
        state = {
          position: {
            key: fill.key,
            side: carried.side === 'BUY' ? 'LONG' : 'SHORT',
            entries: [part(carried, carried.quantity, false)],
            exits: [],
            orphan: false,
          },
          signed: carried.side === 'BUY' ? carried.quantity : -carried.quantity,
        };
        open.set(fill.key, state);
      }
    }
    started.add(fill.key);

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
        position: {
          key: fill.key,
          side: signed > 0 ? 'LONG' : 'SHORT',
          entries: [part(fill, fill.quantity, false)],
          exits: [],
          orphan: false,
        },
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
        done.push({
          key: fill.key,
          side: signed < 0 ? 'LONG' : 'SHORT',
          entries: [],
          exits: [part(fill, rest, false)],
          orphan: true,
        });
      } else {
        open.set(fill.key, {
          position: {
            key: fill.key,
            side: signed > 0 ? 'LONG' : 'SHORT',
            entries: [part(fill, rest, false)],
            exits: [],
            orphan: false,
          },
          signed: Math.sign(signed) * rest,
        });
      }
    }
  }

  // still open when the file ends
  for (const { position } of open.values()) done.push(position);
  return done;
}

/**
 * `carries` holds, per account and symbol, the journal's trades that the
 * file's fills may continue. Files that number their trades never need them.
 */
export function fillsToPositions(
  fills: Fill[],
  newestFirst = false,
  carries?: ReadonlyMap<string, readonly Carry[]>,
): Position[] {
  if (!fills.length) return [];
  const positions = fills.every((f) => f.tradeNo)
    ? byTradeNumber(fills, newestFirst)
    : byPosition(fills, newestFirst, carries);
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
  /** the journal trade carried in as its entry, by id */
  carried?: string;
  /** the first of its fills in the file */
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
  // the file's own fills: a carried-in entry is the journal's, not a row
  const own = (parts: Part[]) => parts.filter((x) => !x.fill.carried);
  const inFile = own([...p.entries, ...p.exits]);
  const carried = p.entries.find((x) => x.fill.carried)?.fill.carried;
  const ids = [...new Set(inFile.map((x) => x.fill.id).filter((id): id is string => Boolean(id)))];
  const fills = new Set(inFile.map((x) => x.fill)).size;
  const entryFees = p.entries.reduce((a, x) => a + x.fees, 0);
  const exitFees = p.exits.reduce((a, x) => a + x.fees, 0);
  const times = (parts: Part[]) => parts.map((x) => x.fill.time).filter((t): t is Moment => t != null);
  const first = (parts: Part[]) => times(parts).sort((a, b) => a.sortKey.localeCompare(b.sortKey))[0] ?? null;
  const last = (parts: Part[]) =>
    times(parts)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .at(-1) ?? null;
  const base = {
    key: p.key,
    side: p.side,
    entryPrice,
    openedAt: first(p.entries) ?? first(p.exits),
    ids,
    fillCount: fills,
    orphan: p.orphan,
    ...(carried ? { carried } : {}),
    firstLine: inFile[0].fill.line,
    lines: [...new Set(inFile.map((x) => x.fill.line))],
    entryPrices: p.entries.map((x) => x.fill.price),
    exitPrices: p.exits.map((x) => x.fill.price),
  };

  if (p.orphan) {
    return [
      {
        ...base,
        quantity: exited,
        exitPrice,
        closedAt: last(p.exits),
        fees: exitFees,
        reportedPnl: reported,
        move: null,
        closed: true,
      },
    ];
  }

  const moveOf = (q: number) =>
    entryPrice != null && exitPrice != null ? (exitPrice - entryPrice) * q * direction : null;
  if (exited < EPS) {
    return [
      {
        ...base,
        quantity: entered,
        exitPrice: null,
        closedAt: null,
        fees: entryFees,
        reportedPnl: null,
        move: null,
        closed: false,
      },
    ];
  }
  if (Math.abs(entered - exited) < EPS) {
    return [
      {
        ...base,
        quantity: entered,
        exitPrice,
        closedAt: last(p.exits),
        fees: entryFees + exitFees,
        reportedPnl: reported,
        move: moveOf(entered),
        closed: true,
      },
    ];
  }

  // partly closed: split the entry (and its fees) between the two
  const share = exited / entered;
  return [
    {
      ...base,
      quantity: exited,
      exitPrice,
      closedAt: last(p.exits),
      fees: entryFees * share + exitFees,
      reportedPnl: reported,
      move: moveOf(exited),
      closed: true,
    },
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
      fillCount: own(p.entries).length,
      lines: own(p.entries).map((x) => x.fill.line),
    },
  ];
}
