import type { Trade } from './types';
import { grossPnl, isClosed, netPnl } from './trade-math';

/**
 * Scaling out of a position leaves one entry matched against several exits,
 * which a broker exports as several rows. Merging them puts the position back
 * together: one trade, the full size, a weighted average price at each end.
 */

/** Why these trades cannot be merged, or null when they can */
export function mergeIssue(trades: Trade[]): string | null {
  if (trades.length < 2) return 'Select at least two trades to merge.';
  const [first] = trades;
  if (trades.some((t) => t.symbol !== first.symbol)) return 'They have to be the same symbol.';
  if (trades.some((t) => t.side !== first.side)) return 'They have to be the same direction.';
  if (trades.some((t) => t.accountId !== first.accountId)) return 'They have to be in the same account.';
  if (trades.some((t) => !(t.quantity > 0))) return 'Every part needs a quantity before they can be merged.';
  if (trades.some((t) => !t.entryPrice)) return 'Every part needs an entry price before they can be merged.';

  const closed = trades.filter(isClosed).length;
  if (closed !== 0 && closed !== trades.length) {
    return 'Some of these are still open. Merge the closed ones, or close the rest first.';
  }
  return null;
}

/** how many decimals the legs actually use, so the average is not noisier than the data */
function decimalsOf(values: number[]): number {
  return Math.min(8, Math.max(2, ...values.map((v) => (String(v).split('.')[1] ?? '').length)));
}

function weightedAverage(parts: Array<{ price: number; quantity: number }>, decimals: number): number {
  const qty = parts.reduce((a, p) => a + p.quantity, 0);
  if (qty <= 0) return parts[0]?.price ?? 0;
  const raw = parts.reduce((a, p) => a + p.price * p.quantity, 0) / qty;
  return Number(raw.toFixed(decimals));
}

/**
 * Combines several partial fills into one trade. The quantities add up, the
 * prices become size-weighted averages, and the P&L stays exactly the sum of
 * the parts — if rounding the average would change it, the total is kept
 * verbatim instead.
 */
export function mergeTrades(trades: Trade[]): Trade {
  const legs = [...trades].sort((a, b) => (a.openedAt || '').localeCompare(b.openedAt || ''));
  const first = legs[0];
  const quantity = legs.reduce((a, t) => a + t.quantity, 0);
  const allClosed = legs.every(isClosed);

  const entryDecimals = decimalsOf(legs.map((t) => t.entryPrice));
  const entryPrice = weightedAverage(
    legs.map((t) => ({ price: t.entryPrice, quantity: t.quantity })),
    entryDecimals,
  );

  const exitLegs = legs.filter((t) => t.exitPrice != null);
  const everyLegHasExit = allClosed && exitLegs.length === legs.length;
  const exitDecimals = exitLegs.length ? decimalsOf(exitLegs.map((t) => t.exitPrice as number)) : entryDecimals;
  const exitPrice = everyLegHasExit
    ? weightedAverage(
        exitLegs.map((t) => ({ price: t.exitPrice as number, quantity: t.quantity })),
        exitDecimals,
      )
    : null;

  const fees = legs.reduce((a, t) => a + (t.fees || 0), 0);
  const grossTotal = allClosed ? legs.reduce((a, t) => a + grossPnl(t), 0) : 0;

  const multipliers = [...new Set(legs.map((t) => t.multiplier || 1))];
  const multiplier = multipliers.length === 1 ? multipliers[0] : null;

  // keep the merged P&L identical to the sum of the parts
  let manualPnl: number | null = null;
  if (allClosed) {
    const reproducible =
      exitPrice != null &&
      multiplier != null &&
      legs.every((t) => t.manualPnl == null) &&
      Math.abs((exitPrice - entryPrice) * quantity * multiplier * (first.side === 'LONG' ? 1 : -1) - grossTotal) <
        0.005;
    if (!reproducible) manualPnl = grossTotal;
  }

  const closedAt = allClosed
    ? legs
        .map((t) => t.closedAt)
        .filter(Boolean)
        .sort()
        .at(-1)
    : undefined;

  const withReview = legs.find((t) => t.review && Object.values(t.review).some((v) => v != null));
  const notes = [...new Set(legs.map((t) => t.notes?.trim()).filter(Boolean))].join(' / ');
  const externalIds = legs.flatMap((t) => (t.externalId ? t.externalId.split('|') : []));

  return {
    ...first,
    quantity,
    entryPrice,
    exitPrice,
    closedAt: closedAt ?? undefined,
    openedAt:
      legs
        .map((t) => t.openedAt)
        .filter(Boolean)
        .sort()[0] ?? first.openedAt,
    fees,
    multiplier: multiplier ?? first.multiplier ?? 1,
    manualPnl,
    stopLoss: legs.find((t) => t.stopLoss != null)?.stopLoss ?? null,
    takeProfit: legs.find((t) => t.takeProfit != null)?.takeProfit ?? null,
    setupId: legs.find((t) => t.setupId)?.setupId,
    session: legs.find((t) => t.session)?.session,
    leverage: legs.find((t) => t.leverage != null)?.leverage ?? null,
    tags: [...new Set(legs.flatMap((t) => t.tags))],
    notes: notes || undefined,
    review: withReview?.review,
    screenshotUrl: legs.find((t) => t.screenshotUrl)?.screenshotUrl,
    screenshotFile: legs.find((t) => t.screenshotFile)?.screenshotFile,
    excluded: legs.every((t) => t.excluded) ? true : false,
    isSample: legs.every((t) => t.isSample) ? true : undefined,
    externalId: externalIds.length ? [...new Set(externalIds)].join('|') : undefined,
    fillCount: legs.reduce((a, t) => a + (t.fillCount ?? 1), 0),
    needsReview: undefined,
    updatedAt: new Date().toISOString(),
  };
}

/** A one-line summary of what a merge would produce, for the confirmation */
export function describeMerge(trades: Trade[], currency: string, format: (v: number, c: string) => string): string {
  const merged = mergeTrades(trades);
  const pnl = isClosed(merged) ? format(netPnl(merged), currency) : 'still open';
  return `${trades.length} parts become one ${merged.symbol} ${merged.side.toLowerCase()} of ${merged.quantity}, worth ${pnl}.`;
}
