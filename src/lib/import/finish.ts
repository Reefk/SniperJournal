import type { Trade } from '../types';
import { isIncomplete } from '../trade-math';

/**
 * A trade the journal has open, and a file that closes it. The file's trade
 * says how the position went (size, prices, the close, fees, point value);
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

/** the journal's open trade, closed as the file says; `fillCount` is every fill in it now */
export function finishOpen(open: Trade, closed: Trade, fillCount: number | undefined): Trade {
  const ids = idsOf(open, closed);
  const done: Trade = {
    ...open,
    quantity: closed.quantity,
    entryPrice: closed.entryPrice,
    exitPrice: closed.exitPrice,
    closedAt: closed.closedAt,
    fees: closed.fees,
    multiplier: closed.multiplier,
    manualPnl: closed.manualPnl,
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
