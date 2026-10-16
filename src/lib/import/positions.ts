import type { Trade, TradeInput } from '../types';
import { detectSession } from '../sessions';
import { isIncomplete } from '../trade-math';
import { decimalsOf } from '../merge';
import { uid } from '../utils';
import { fillsToPositions, summarise, type Fill, type Summary } from './fills';
import { fitReported, type Reader, type RowsRead } from './reader';
import { rowsNote } from './report';
import { parseAction, parseEffect, parseMoment, parseMoney, parseStatus } from './values';

/**
 * Files with one row per fill: each row is read as a fill, the fills are put
 * back together into positions (fills.ts), and each position becomes a trade.
 */

/** a fill read, with the row it came from */
export interface FillRow {
  fill: Fill;
  row: string[];
  symbol: string;
  accountId: string;
}

/** why a row is not a fill to import */
export type FillSkip =
  | { skip: 'unfilled' }
  /** deposits, dividends, balance lines: `what` the side column said */
  | { skip: 'not a trade'; what: string }
  | { skip: 'no symbol' }
  | { skip: 'no quantity' }
  | { skip: 'no price' }
  /** the same execution listed twice */
  | { skip: 'duplicate' };

/**
 * A row read as a fill, or why it isn't one. `seen` holds the ids of the
 * fills read so far; this one's is added. `net` says the file's P&L column
 * is after fees; `cashSigned` that its prices carry the sign of the cash, a
 * buy's below zero (tastytrade).
 */
export function parseFillRow(
  row: string[],
  line: number,
  r: Reader,
  seen: Set<string>,
  net: boolean,
  cashSigned = false,
): FillRow | FillSkip {
  const { has, cell } = r.sheet;
  if (has('status') && parseStatus(cell(row, 'status')) === 'unfilled') return { skip: 'unfilled' };
  const symbol = r.symbolOf(row);
  const rawQuantity = parseMoney(cell(row, 'quantity'));
  // without a side column, the sign of the quantity is the direction, and there is none
  if (!has('side') && !rawQuantity) return { skip: 'no quantity' };
  let action = has('side')
    ? parseAction(cell(row, 'side'))
    : { side: (rawQuantity as number) < 0 ? ('SELL' as const) : ('BUY' as const) };
  if (!action) return { skip: 'not a trade', what: cell(row, 'side') || 'blank' };
  if (!symbol) return { skip: 'no symbol' };
  const effect = parseEffect(cell(row, 'effect')) ?? action.effect;
  action = { ...action, effect: effect ?? undefined };
  const quantity = rawQuantity == null ? null : Math.abs(rawQuantity);
  if (!quantity) return { skip: 'no quantity' };
  let price = parseMoney(cell(row, 'price')) ?? parseMoney(cell(row, 'entry_price'));
  if (price == null) return { skip: 'no price' };
  if (cashSigned) price = Math.abs(price);
  // tastytrade's price of an option is per contract (4.25 a share is 425):
  // the price times the size makes the amount without the multiplier
  const multiplier = parseMoney(cell(row, 'multiplier'));
  const amount = Math.abs(parseMoney(cell(row, 'notional')) ?? 0);
  const near = (a: number, b: number) => Math.abs(a - b) <= b * 0.005;
  if (
    multiplier &&
    multiplier > 1 &&
    amount &&
    near(price * quantity, amount) &&
    !near(price * quantity * multiplier, amount)
  )
    price = price / multiplier;
  const id = cell(row, 'external_id') || undefined;
  if (id) {
    if (seen.has(id)) return { skip: 'duplicate' };
    seen.add(id);
  }
  const accountId = r.accountIdFor(r.textCell(row, 'account'));
  const reported = parseMoney(cell(row, net ? 'net_pnl' : has('gross_pnl') ? 'gross_pnl' : 'pnl'));
  return {
    fill: {
      line,
      key: `${accountId}|${symbol}`,
      side: action.side,
      quantity,
      price,
      time: r.moment(row, 'time', 'date') ?? r.moment(row, 'opened_at', 'opened_date'),
      fees: r.feeOf(row) ?? 0,
      pnl: reported,
      id,
      effect: action.effect,
      tradeNo: cell(row, 'trade_no') || undefined,
    },
    row,
    symbol,
    accountId,
  };
}

/** a multiplier worked out from data, if it is a believable one */
export function believable(m: number): number | null {
  if (!Number.isFinite(m) || m <= 0) return null;
  if (m >= 0.95) {
    const r = Math.round(m);
    return Math.abs(m - r) / r < 0.01 ? r : null;
  }
  return [0.1, 0.25, 0.5].find((c) => Math.abs(m - c) / c < 0.01) ?? null;
}

/**
 * The trade one position makes. `read` holds every fill read, by file line;
 * `net` says the file's P&L column is after fees.
 */
export function assemblePosition(s: Summary, read: ReadonlyMap<number, FillRow>, r: Reader, net: boolean): Trade {
  const { at, cell, plan } = r.sheet;
  const first = read.get(s.firstLine) as FillRow;
  const rows = s.lines.map((l) => read.get(l)?.row).filter((row): row is string[] => Boolean(row));

  // ---- what one point is worth -----------------------------------
  const fillWorth = (row: string[]) => {
    const notional = parseMoney(cell(row, 'notional'));
    const q = Math.abs(parseMoney(cell(row, 'quantity')) ?? 0);
    const p = parseMoney(cell(row, 'price')) ?? parseMoney(cell(row, 'entry_price'));
    return notional && q && p ? believable(Math.abs(notional) / (q * p)) : null;
  };
  // every row's multiplier is read, so each one that can't be used is noted
  let multiplier =
    s.lines
      .map((l) => {
        const fill = read.get(l);
        return fill ? r.multiplierCell(fill.row, l) : null;
      })
      .find((m) => m != null) ?? null;
  // a reported P&L that fits the prices says it best: TradingView's position
  // value leaves the point value out (2 MNQ at 21000 is "42000")
  const fit =
    multiplier == null && s.reportedPnl != null && s.closed && !s.orphan
      ? fitReported(s.reportedPnl, s.move, s.fees, net)
      : null;
  if (fit?.multiplier != null) multiplier = fit.multiplier;
  if (multiplier == null) {
    const worth = [...new Set(rows.map(fillWorth))];
    if (worth.length === 1 && worth[0] != null) {
      multiplier = worth[0];
      if (multiplier !== 1) r.findings.inferred.set(first.symbol, `${multiplier} (from the amount against the price)`);
    }
  }
  let manualPnl: number | null = null;
  if (multiplier == null && fit) manualPnl = fit.manualPnl;
  if (multiplier == null) multiplier = r.knownMultiplier(first.symbol, first.row) ?? 1;

  // averages rounded to the precision of the prices, and the exact P&L
  // kept as written when the rounded averages cannot reproduce it
  const round = (v: number | null, prices: number[]) => (v == null ? null : Number(v.toFixed(decimalsOf(prices))));
  const entryPrice = round(s.entryPrice, s.entryPrices);
  const exitPrice = round(s.exitPrice, s.exitPrices);
  const direction = s.side === 'LONG' ? 1 : -1;
  if (s.orphan) {
    if (s.reportedPnl != null) manualPnl = net ? s.reportedPnl + s.fees : s.reportedPnl;
  } else if (manualPnl == null && s.closed && s.move != null && entryPrice != null && exitPrice != null) {
    const exact = s.move * multiplier;
    if (Math.abs((exitPrice - entryPrice) * s.quantity * direction * multiplier - exact) >= 0.005) manualPnl = exact;
  }

  const openedAt = s.openedAt?.value ?? '';
  const input: TradeInput = {
    accountId: first.accountId,
    symbol: first.symbol,
    side: s.side,
    openedAt: s.orphan ? '' : openedAt,
    closedAt: s.closedAt?.value,
    quantity: s.quantity,
    entryPrice: s.orphan ? 0 : (entryPrice ?? 0),
    exitPrice: s.closed ? exitPrice : null,
    stopLoss: null,
    takeProfit: null,
    fees: Math.round(s.fees * 1e8) / 1e8,
    multiplier,
    manualPnl,
    leverage: parseMoney(cell(first.row, 'leverage')),
    session: r.textCell(first.row, 'session') || (openedAt ? detectSession(openedAt) : undefined),
    setupId: r.setupIdFor(r.textCell(first.row, 'setup')),
    tags: [...new Set(rows.flatMap(r.tagsOf))],
    // a broker's description column describes the instrument, not the trade
    notes:
      (at('notes') != null && plan.columns[at('notes') as number].header.toLowerCase() !== 'description'
        ? r.textCell(first.row, 'notes')
        : '') || undefined,
    excluded: false,
    externalId: s.ids.length ? s.ids.join('|') : undefined,
    fillCount: s.fillCount,
  };
  const trade: Trade = { ...input, id: uid(), createdAt: r.now, updatedAt: r.now };
  trade.needsReview = isIncomplete(trade) || undefined;
  return trade;
}

/**
 * Whether the prices carry the sign of the cash, as tastytrade writes them:
 * every price below zero is a buy's, and some sell's is above it. A price
 * that is really negative (oil in April 2020) is below zero on sells too.
 */
function cashSignedPrices(r: Reader): boolean {
  const { cell } = r.sheet;
  let buysBelow = 0;
  let sellsAbove = 0;
  for (const row of r.sheet.table.data) {
    const price = parseMoney(cell(row, 'price')) ?? parseMoney(cell(row, 'entry_price'));
    const side = parseAction(cell(row, 'side'))?.side;
    if (price == null || !side || price === 0) continue;
    if (side === 'BUY' && price < 0) buysBelow++;
    else if (side === 'SELL' && price > 0) sellsAbove++;
    else return false;
  }
  return buysBelow > 0 && sellsAbove > 0;
}

/** Whether the file lists its newest rows first, judged by every dated row in it, trades or not. */
function runsNewestFirst(r: Reader): boolean {
  const { cell, order, table } = r.sheet;
  const dated = table.data
    .map((row) => parseMoment(cell(row, 'time') || cell(row, 'date'), order)?.sortKey)
    .filter((k): k is string => Boolean(k));
  return dated.length >= 2 && dated[0] > dated[dated.length - 1];
}

/** Every row read as a fill, the fills put back together, and each position made a trade. */
export function tradesFromFills(r: Reader): RowsRead {
  const { sheet, findings } = r;
  const net = !sheet.has('gross_pnl') && !sheet.has('pnl') && sheet.has('net_pnl');
  const cashSigned = cashSignedPrices(r);
  const fills: Fill[] = [];
  const read = new Map<number, FillRow>();
  const seen = new Set<string>();
  const notTrades = new Map<string, number>();
  let unfilled = 0;
  const noQuantity: number[] = [];
  const noPrice: number[] = [];

  sheet.table.data.forEach((row, index) => {
    const line = sheet.table.lines[index];
    const got = parseFillRow(row, line, r, seen, net, cashSigned);
    if ('fill' in got) {
      fills.push(got.fill);
      read.set(line, got);
      return;
    }
    switch (got.skip) {
      case 'unfilled':
        unfilled++;
        break;
      case 'not a trade':
        notTrades.set(got.what, (notTrades.get(got.what) ?? 0) + 1);
        break;
      case 'no symbol':
        findings.noSymbol.push(line);
        break;
      case 'no quantity':
        noQuantity.push(line);
        break;
      case 'no price':
        noPrice.push(line);
        break;
      case 'duplicate':
        findings.duplicates++;
        break;
    }
  });

  const trades: Trade[] = [];
  let open = 0;
  let orphans = 0;
  let overlapping = 0;
  for (const s of fillsToPositions(fills, runsNewestFirst(r)).flatMap(summarise)) {
    if (!read.has(s.firstLine)) continue;
    // already imported: every fill of it is in the journal
    if (s.ids.length && s.ids.every((id) => r.existingIds.has(id))) {
      findings.duplicates++;
      continue;
    }
    if (s.ids.some((id) => r.existingIds.has(id))) overlapping++;
    if (s.orphan) orphans++;
    if (!s.closed) open++;
    trades.push(assemblePosition(s, read, r, net));
  }

  const errors: string[] = [];
  const notices: string[] = [];
  notices.push(
    `Each row is one fill: ${fills.length} ${fills.length === 1 ? 'fill was' : 'fills were'} put back together into ${trades.length} ${trades.length === 1 ? 'trade' : 'trades'}, following the position in each symbol.`,
  );
  if (unfilled)
    notices.push(
      `${unfilled} ${unfilled === 1 ? 'order that was' : 'orders that were'} cancelled or never filled ${unfilled === 1 ? 'was' : 'were'} left out.`,
    );
  if (notTrades.size) {
    const total = [...notTrades.values()].reduce((a, b) => a + b, 0);
    const examples = [...notTrades.keys()]
      .slice(0, 3)
      .map((v) => `"${v}"`)
      .join(', ');
    notices.push(
      `${total} ${total === 1 ? 'row is' : 'rows are'} not a buy or a sell (${examples}), so ${total === 1 ? 'it was' : 'they were'} left out.`,
    );
  }
  if (noQuantity.length)
    errors.push(rowsNote(noQuantity, 'no quantity, so the fill was left out.', 'no quantity, so they were left out.'));
  if (noPrice.length)
    errors.push(rowsNote(noPrice, 'no price, so the fill was left out.', 'no price, so they were left out.'));
  if (open) {
    notices.push(
      `${open} ${open === 1 ? 'position was' : 'positions were'} still open at the end of the file, so ${open === 1 ? 'it was' : 'they were'} imported as open ${open === 1 ? 'trade' : 'trades'}.`,
    );
  }
  if (orphans) {
    errors.push(
      `${orphans} ${orphans === 1 ? 'trade closes a position' : 'trades close positions'} opened before this file starts, so the entry is unknown and ${orphans === 1 ? 'it is' : 'they are'} marked needs details.`,
    );
  }
  if (overlapping) {
    errors.push(
      `${overlapping} ${overlapping === 1 ? 'trade shares' : 'trades share'} fills with trades already in your journal (a position that runs across two exports). Check for doubles.`,
    );
  }
  return { trades, errors, notices };
}
