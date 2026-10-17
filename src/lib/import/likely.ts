import type { Trade } from '../types';
import { isClosed } from '../trade-math';
import { finishOpen, type Unsaid } from './finish';

/** an import's trades, split by whether the journal seems to have them already */
export interface LikelySplit {
  /** not in the journal: imported */
  fresh: Trade[];
  /** looks like a trade already in the journal: left out unless asked for */
  likely: Trade[];
  /** imported closed, while the journal has the same trade still open (when not finishing) */
  closesOpen: number;
  /** the journal's open trades the file has closed, finished (when finishing) */
  finished: Trade[];
}

const matchable = (t: Trade) => Boolean(t.symbol && t.openedAt && t.quantity > 0) && !t.isSample;
const key = (t: Trade) =>
  [t.accountId, t.symbol.toUpperCase(), t.side, t.openedAt.slice(0, 16), Number(t.quantity.toFixed(8))].join('|');

/**
 * The last stage of an import (see importTradesFromCsv in lib/csv.ts): trades
 * that look like ones already in the journal, so a daily export that overlaps
 * the last one adds nothing twice. Files with the broker's ids are already
 * matched on those while the rows are read; this is for everything else.
 *
 * A trade looks like one in the journal when the account, symbol, side, entry
 * time (to the minute, as the trade form keeps it) and size are the same.
 *  - Each trade in the journal stands for one trade in the file: two identical
 *    rows against one journal trade leave one of them in.
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

  const split: LikelySplit = { fresh: [], likely: [], closesOpen: 0, finished: [] };
  for (const t of trades) {
    const same = matchable(t) ? journal.get(key(t)) : undefined;
    const at =
      same?.findIndex((j) => !(j.externalId && t.externalId) && (isClosed(t) || !justFinished.has(j.id))) ?? -1;
    if (!same || at < 0) {
      split.fresh.push(t);
      continue;
    }
    const [match] = same.splice(at, 1);
    if (isClosed(t) && !isClosed(match)) {
      // the file has the whole trade, its entry fills included
      if (finish) split.finished.push(finishOpen(match, t, t.fillCount ?? match.fillCount, unsaid.get(t.id)));
      else {
        split.fresh.push(t);
        split.closesOpen++;
      }
    } else split.likely.push(t);
  }
  return split;
}
