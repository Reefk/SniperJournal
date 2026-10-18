import type { Trade } from '../types';
import { isClosed } from '../trade-math';
import { uid } from '../utils';
import { finishOpen, openRest, type Unsaid } from './finish';

/** an import's trades, split by whether the journal seems to have them already */
export interface LikelySplit {
  /** not in the journal: imported */
  fresh: Trade[];
  /** looks like a trade already in the journal: left out unless asked for */
  likely: Trade[];
  /** imported closed, while the journal has the same trade still open (when not finishing) */
  closesOpen: number;
  /**
   * closed trades that close part of one the journal has open: finished for
   * that part with the rest left open (when finishing), or imported beside it
   */
  closesPart: number;
  /** the journal's open trades the file has closed, finished (when finishing) */
  finished: Trade[];
}

const matchable = (t: Trade) => Boolean(t.symbol && t.openedAt && t.quantity > 0) && !t.isSample;
/** the account, symbol, side and entry minute: the position a trade is of */
const entryOf = (t: Trade) => [t.accountId, t.symbol.toUpperCase(), t.side, t.openedAt.slice(0, 16)].join('|');
const sized = (q: number) => Number(q.toFixed(8));
const key = (t: Trade) => `${entryOf(t)}|${sized(t.quantity)}`;
/** two trades that both carry a broker id are told apart by them */
const bothIds = (a: Trade, b: Trade) => Boolean(a.externalId && b.externalId);
const closedAtMinute = (t: Trade) => (t.closedAt ?? '').slice(0, 16);

/**
 * The last stage of an import (see importTradesFromCsv in lib/csv.ts): trades
 * that look like ones already in the journal, so a daily export that overlaps
 * the last one adds nothing twice. Files with the broker's ids are already
 * matched on those while the rows are read; this is for everything else.
 *
 * A trade looks like one in the journal when the account, symbol, side, entry
 * time (to the minute, as the trade form keeps it) and size are the same.
 *  - Each trade in the journal stands for one trade in the file: two identical
 *    rows against one journal trade leave one of them in. Of several that fit,
 *    a closed trade is the one closed at the same minute if there is one, then
 *    one still open; an open trade is one still open.
 *  - Two trades that both carry a broker id are told apart by their ids, never
 *    by their fields: different ids are different trades.
 *  - Test data, and trades still missing their entry time or size, match nothing.
 *  - A trade the journal still has as open, which the file closes, is not left
 *    out. With `finish`, the journal's trade is finished with the file's exit
 *    (`finished`). Without, the closed one is imported and counted in
 *    `closesOpen`, so the open copy can be deleted by hand.
 *  - `justFinished` are the journal's trades this same file has closed. A trade
 *    the file leaves open is never one of them: closed in half, the open rest
 *    has the entry time and size of the half just closed.
 *  - `unsaid` is what each row left out (see finishOpen): a finished trade keeps
 *    the journal's fees and point value where the file has none.
 *  - A closed trade with the entry of one the journal has open, but a smaller
 *    size, closes part of it (see closeParts).
 */
export function splitLikelyDuplicates(
  trades: Trade[],
  existing: readonly Trade[] = [],
  finish = false,
  justFinished: ReadonlySet<string> = new Set(),
  unsaid: ReadonlyMap<string, Unsaid> = new Map(),
): LikelySplit {
  const journal = new Map<string, Trade[]>();
  for (const t of existing) {
    if (!matchable(t)) continue;
    const k = key(t);
    const same = journal.get(k);
    if (same) same.push(t);
    else journal.set(k, [t]);
  }

  /** how well a journal trade with the same key fits the file's: lower is better, null not at all */
  const fit = (j: Trade, t: Trade): number | null => {
    if (bothIds(j, t)) return null;
    if (!isClosed(t)) return justFinished.has(j.id) ? null : isClosed(j) ? 1 : 0;
    if (!isClosed(j)) return 1;
    return closedAtMinute(j) === closedAtMinute(t) ? 0 : 2;
  };

  const split: LikelySplit = { fresh: [], likely: [], closesOpen: 0, closesPart: 0, finished: [] };
  /** the journal's trades a file's trade has matched */
  const taken = new Set<string>();
  for (const t of trades) {
    const same = matchable(t) ? journal.get(key(t)) : undefined;
    let at = -1;
    let best = Infinity;
    same?.forEach((j, i) => {
      const f = fit(j, t);
      if (f != null && f < best) [at, best] = [i, f];
    });
    if (!same || at < 0) {
      split.fresh.push(t);
      continue;
    }
    const [match] = same.splice(at, 1);
    taken.add(match.id);
    if (isClosed(t) && !isClosed(match)) {
      // the file has the whole trade, its entry fills included
      if (finish) split.finished.push(finishOpen(match, t, t.fillCount ?? match.fillCount, unsaid.get(t.id)));
      else {
        split.fresh.push(t);
        split.closesOpen++;
      }
    } else split.likely.push(t);
  }
  closeParts(split, existing, taken, finish, unsaid);
  return split;
}

/**
 * The file's closed trades that close part of one the journal has open (same
 * entry, smaller size), once every trade has been matched whole. With
 * `finish`, the journal's trade is finished for that part, with its share of
 * the journal's fees, and the rest stays open: the file's own open trade for
 * it if the file has one, otherwise what is left of the journal's. Either
 * keeps what was written about the trade, and the file's next rows may finish
 * it in turn. Without, the closed trade is imported beside the open one.
 */
function closeParts(
  split: LikelySplit,
  existing: readonly Trade[],
  taken: ReadonlySet<string>,
  finish: boolean,
  unsaid: ReadonlyMap<string, Unsaid>,
): void {
  /** open trades by entry: the journal's not matched yet, and the rests left here */
  const open = new Map<string, Trade[]>();
  for (const j of existing) {
    if (!matchable(j) || isClosed(j) || taken.has(j.id)) continue;
    open.set(entryOf(j), [...(open.get(entryOf(j)) ?? []), j]);
  }
  /** the import's trades as they will be: a slot is emptied when its trade is part of a journal one */
  const out: (Trade | null)[] = [...split.fresh];
  /** the slot of each rest left here, by id: it is finished there, as it isn't in the journal */
  const restAt = new Map<string, number>();
  /** the slots of the file's own open trades, any of which may be a rest */
  const fileOpen = new Set(split.fresh.flatMap((t, i) => (matchable(t) && !isClosed(t) ? [i] : [])));

  split.fresh.forEach((t, i) => {
    if (!matchable(t) || !isClosed(t)) return;
    const candidates = open.get(entryOf(t));
    const at = candidates?.findIndex((c) => !bothIds(c, t) && sized(c.quantity) >= sized(t.quantity)) ?? -1;
    if (!candidates || at < 0) return;
    const [openTrade] = candidates.splice(at, 1);
    const left = sized(openTrade.quantity - t.quantity);
    if (!finish) {
      split.closesPart++;
      return;
    }

    const share = t.quantity / openTrade.quantity;
    const scaled = { ...openTrade, fees: openTrade.fees * share };
    const closedPart = finishOpen(scaled, t, t.fillCount ?? openTrade.fillCount, unsaid.get(t.id));
    out[i] = null;
    const slot = restAt.get(openTrade.id);
    if (slot != null) out[slot] = closedPart;
    else split.finished.push(closedPart);
    if (left <= 0) return;

    split.closesPart++;
    // the file's own open trade for the rest, if it has one; else what is left of the journal's
    const ownAt = [...fileOpen].find((k) => {
      const o = out[k] as Trade;
      return entryOf(o) === entryOf(t) && sized(o.quantity) === left && !bothIds(o, openTrade);
    });
    const fees = openTrade.fees * (1 - share);
    let rest: Trade;
    if (ownAt != null) {
      const own = out[ownAt] as Trade;
      const said = unsaid.get(own.id);
      rest = openRest(openTrade, {
        ...own,
        fees: said?.fees ? fees : own.fees,
        multiplier: said?.multiplier ? openTrade.multiplier : own.multiplier,
      });
      fileOpen.delete(ownAt);
      out[ownAt] = rest;
      restAt.set(rest.id, ownAt);
    } else {
      rest = openRest(openTrade, {
        ...openTrade,
        id: uid(),
        quantity: left,
        fees,
        manualPnl: null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      });
      restAt.set(rest.id, out.length);
      out.push(rest);
    }
    candidates.push(rest);
  });
  split.fresh = out.filter((t): t is Trade => t !== null);
}
