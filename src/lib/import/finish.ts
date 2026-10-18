import type { Trade } from '../types';
import { isIncomplete } from '../trade-math';

/**
 * A trade the journal has open, and a file that closes it. The file's trade
 * says how the position went (size, prices, the close, and the fees and point
 * value when it gives them);
 * what you wrote about the trade (notes, setup, tags, stop, target, chart,
 * review) stays as it is. Used by every kind of file: fills that continue it
 * (positions.ts), the same trade again with its exit (likely.ts, rows.ts).
 */

const idsOf = (...trades: Trade[]) => [
  ...new Set(trades.flatMap((t) => (t.externalId ? t.externalId.split('|') : []))),
];

/** what describes the trade rather than the fills, from the journal's when it has it */
const described = (open: Trade, file: Trade) => ({
  setupId: open.setupId ?? file.setupId,
  tags: [...new Set([...open.tags, ...file.tags])],
  notes: open.notes || file.notes,
  session: open.session || file.session,
  leverage: open.leverage ?? file.leverage,
});

/**
 * What a file's trade left unsaid, whether a row has the whole trade or its
 * fills make it: fees when the file has none at all (no fee column, no rate,
 * no P&L after fees), the point value when neither the file nor the
 * instrument gives one. The file's trade then has 0 and 1 for them, which are
 * not the trade's, so the journal's are kept.
 */
export interface Unsaid {
  fees?: boolean;
  multiplier?: boolean;
  /**
   * the price move (points × size, in the trade's direction) its P&L follows
   * from, when nothing gave the point value: worked out again at the journal's
   */
  move?: number;
  /**
   * the file's own P&L beside no fees, which may be before them or after
   * them, with the price move it came from (see fitsJournal)
   */
  reported?: { pnl: number; move: number };
}

/**
 * Whether a file's own P&L is what the journal's trade comes to at its point
 * value, before its fees or after them: then that point value and those fees
 * are the trade's, whatever the P&L alone seemed to say.
 */
function fitsJournal(open: Trade, { pnl, move }: { pnl: number; move: number }): boolean {
  // a trade closed where it opened fits any point value
  if (Math.abs(move) < 1e-9) return false;
  const gross = move * (open.multiplier || 1);
  return Math.abs(gross - pnl) < 0.01 || Math.abs(gross - (open.fees || 0) - pnl) < 0.01;
}

/** the P&L of a price move, kept as written only when the prices shown can't give it to the cent */
function exactPnl(t: Trade, move: number, multiplier: number): number | null {
  if (t.exitPrice == null) return null;
  const exact = move * multiplier;
  const shown = (t.exitPrice - t.entryPrice) * t.quantity * (t.side === 'SHORT' ? -1 : 1) * multiplier;
  return Math.abs(shown - exact) >= 0.005 ? exact : null;
}

/** the journal's open trade, closed as the file says; `fillCount` is every fill in it now */
export function finishOpen(open: Trade, closed: Trade, fillCount: number | undefined, unsaid: Unsaid = {}): Trade {
  const ids = idsOf(open, closed);
  const fits = Boolean(unsaid.fees && unsaid.reported && fitsJournal(open, unsaid.reported));
  const multiplier = unsaid.multiplier || fits ? open.multiplier : closed.multiplier;
  // a P&L that follows from the prices, at the point value the trade keeps;
  // when the file's own P&L fits the journal's trade, that P&L as written
  // (taken for one before fees) is set aside on purpose
  const move = fits ? unsaid.reported?.move : unsaid.multiplier ? unsaid.move : undefined;
  const done: Trade = {
    ...open,
    quantity: closed.quantity,
    entryPrice: closed.entryPrice,
    exitPrice: closed.exitPrice,
    closedAt: closed.closedAt,
    fees: unsaid.fees ? open.fees : closed.fees,
    multiplier,
    manualPnl: move != null ? exactPnl(closed, move, multiplier || 1) : closed.manualPnl,
    ...described(open, closed),
    externalId: ids.length ? ids.join('|') : undefined,
    fillCount,
    updatedAt: closed.updatedAt,
  };
  done.needsReview = isIncomplete(done) || undefined;
  return done;
}

/**
 * What a file leaves open of a trade it closes only part of: a trade of its
 * own, opened when that one was and described the same way, so the export
 * that closes the rest finishes it in turn.
 */
export function openRest(open: Trade, rest: Trade): Trade {
  const ids = idsOf(open, rest);
  const trade: Trade = {
    ...rest,
    openedAt: open.openedAt,
    stopLoss: open.stopLoss,
    takeProfit: open.takeProfit,
    ...described(open, rest),
    externalId: ids.length ? ids.join('|') : undefined,
    fillCount: open.fillCount,
  };
  trade.needsReview = isIncomplete(trade) || undefined;
  return trade;
}
