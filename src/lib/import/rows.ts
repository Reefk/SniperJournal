import type { Trade, TradeInput } from '../types';
import { detectSession } from '../sessions';
import { isClosed, isIncomplete } from '../trade-math';
import { mergeIssue, mergeTrades } from '../merge';
import { uid } from '../utils';
import type { Role } from './columns';
import { finishOpen, type Unsaid } from './finish';
import { fitReported, type Reader, type RowsRead } from './reader';
import { rowsNote } from './report';
import { parseMoney, parseSide, type Moment } from './values';

/**
 * Files with one row per trade (an entry and an exit), and Tradovate-style
 * files whose rows pair a buy fill with a sell fill. Each row is read, then
 * made into a trade; a broker that splits one position into several rows
 * that share an entry fill has them put back together at the end.
 */

/** one row, as read */
export interface TradeRow {
  symbol: string;
  /** null when the file doesn't say; imported as LONG */
  side: 'LONG' | 'SHORT' | null;
  opened: Moment | null;
  closed: Moment | null;
  entryPrice: number | null;
  exitPrice: number | null;
  quantity: number | null;
  fees: number | null;
  multiplier: number | null;
  /** a reported P&L that the prices can't reproduce, kept as written */
  manualPnl: number | null;
  /** the broker's ids of the buy and the sell fill, on a paired row; '' when not given */
  buyFill: string;
  sellFill: string;
  /** what the row is known by, so it is skipped when imported again */
  externalId: string | undefined;
  /** an entry or exit time the row writes but that could not be read, left blank; '' when none */
  unreadOpen: string;
  unreadClose: string;
}

/** A row read: its direction, times, prices and multiplier. Null when it has no symbol. */
export function parseTradeRow(row: string[], line: number, r: Reader): TradeRow | null {
  const { cell, paired } = r.sheet;
  const symbol = r.symbolOf(row);
  if (!symbol) return null;

  // ---- direction, times and prices -----------------------------------
  const rawSide = cell(row, 'side');
  let side = parseSide(rawSide);
  if (rawSide && !side) r.findings.unknownSides.set(rawSide, [...(r.findings.unknownSides.get(rawSide) ?? []), line]);
  // ATAS, Deepcharts and IG sign the size instead of naming a side: below zero is a short
  let quantity = parseMoney(cell(row, 'quantity'));
  if (r.sheet.signedQuantities && quantity != null) {
    side = quantity < 0 ? 'SHORT' : 'LONG';
    quantity = Math.abs(quantity);
  }
  let openedParts = r.moment(row, 'opened_at', 'opened_date') ?? r.moment(row, 'time', 'date');
  let closedParts = r.moment(row, 'closed_at', 'closed_date');
  let entryPrice = parseMoney(cell(row, 'entry_price')) ?? parseMoney(cell(row, 'price'));
  let exitPrice = parseMoney(cell(row, 'exit_price'));

  if (paired) {
    const buyPrice = parseMoney(cell(row, 'buy_price'));
    const sellPrice = parseMoney(cell(row, 'sell_price'));
    const boughtParts = r.moment(row, 'bought_at', 'date');
    const soldParts = r.moment(row, 'sold_at', 'date');

    // whichever fill happened first is the one that opened the position
    const soldFirst = boughtParts && soldParts ? soldParts.sortKey < boughtParts.sortKey : false;
    side = side ?? (soldFirst ? 'SHORT' : 'LONG');

    openedParts = openedParts ?? (soldFirst ? soldParts : boughtParts);
    closedParts = closedParts ?? (soldFirst ? boughtParts : soldParts);
    entryPrice = entryPrice ?? (soldFirst ? sellPrice : buyPrice);
    exitPrice = exitPrice ?? (soldFirst ? buyPrice : sellPrice);
  }

  // a time that is written but can't be read (31/02/2026) is left blank, and
  // the preview says so; a cell with no digits ("-", "N/A") gives no time at all
  const unread = (m: Moment | null, roles: Role[]) =>
    m ? '' : (roles.map((role) => cell(row, role)).find((v) => /\d/.test(v)) ?? '');
  const openingFill: Role[] = paired ? [side === 'SHORT' ? 'sold_at' : 'bought_at'] : [];
  const closingFill: Role[] = paired ? [side === 'SHORT' ? 'bought_at' : 'sold_at'] : [];
  const unreadOpen = unread(openedParts, ['opened_at', ...openingFill, 'time', 'opened_date', 'date']);
  const unreadClose = unread(closedParts, ['closed_at', ...closingFill, 'closed_date']);

  // a fee per contract is paid on the way in and again on the way out
  const fees = r.feeOf(row, exitPrice != null ? 2 : 1);
  // The P&L before commissions. A net column has them added back, so they
  // are not charged a second time through the fees column.
  const gross = parseMoney(cell(row, 'gross_pnl')) ?? parseMoney(cell(row, 'pnl'));
  const net = parseMoney(cell(row, 'net_pnl'));

  // ---- contract multiplier -------------------------------------------
  // When the file reports a P&L we can work out what one point is worth,
  // which keeps the prices and the P&L consistent if either is edited later.
  let multiplier = r.multiplierCell(row, line);
  let manualPnl: number | null = null;
  if (gross != null || net != null) {
    const direction = side === 'SHORT' ? -1 : 1;
    const move =
      entryPrice != null && exitPrice != null && quantity != null && quantity > 0
        ? (exitPrice - entryPrice) * quantity * direction
        : null;
    if (move == null || multiplier == null) {
      const expected = r.expectedMultiplier(symbol, row) ?? 1;
      const fit = fitReported((gross ?? net) as number, move, fees ?? 0, gross == null, expected);
      multiplier = multiplier ?? fit.multiplier;
      manualPnl = fit.manualPnl;
    }
  }
  // nothing in the row gave one, the P&L included: what the instrument is may
  if (multiplier == null && entryPrice != null) multiplier = r.knownMultiplier(symbol, row);

  const buyFill = cell(row, 'buy_fill_id');
  const sellFill = cell(row, 'sell_fill_id');
  const externalId = buyFill || sellFill ? `${buyFill}:${sellFill}` : cell(row, 'external_id') || undefined;

  return {
    symbol,
    side,
    opened: openedParts,
    closed: closedParts,
    entryPrice,
    exitPrice,
    quantity,
    fees,
    multiplier,
    manualPnl,
    buyFill,
    sellFill,
    externalId,
    unreadOpen,
    unreadClose,
  };
}

/** The trade a row read makes, with what else the row says: stop, target, setup, tags, notes. */
export function assembleTrade(read: TradeRow, row: string[], r: Reader): Trade {
  const { cell } = r.sheet;
  const openedAt = read.opened?.value ?? '';
  const input: TradeInput = {
    accountId: r.accountIdFor(r.textCell(row, 'account')),
    symbol: read.symbol,
    side: read.side ?? 'LONG',
    openedAt,
    closedAt: read.closed?.value,
    quantity: read.quantity ?? 0,
    entryPrice: read.entryPrice ?? 0,
    exitPrice: read.exitPrice,
    stopLoss: parseMoney(cell(row, 'stop_loss')),
    takeProfit: parseMoney(cell(row, 'take_profit')),
    fees: read.fees ?? 0,
    multiplier: read.multiplier ?? 1,
    manualPnl: read.manualPnl,
    leverage: parseMoney(cell(row, 'leverage')),
    session: r.textCell(row, 'session') || (openedAt ? detectSession(openedAt) : undefined),
    setupId: r.setupIdFor(r.textCell(row, 'setup')),
    tags: r.tagsOf(row),
    notes: r.textCell(row, 'notes') || undefined,
    excluded: false,
    externalId: read.externalId,
  };

  const trade: Trade = { ...input, id: uid(), createdAt: r.now, updatedAt: r.now };
  trade.needsReview = isIncomplete(trade) || undefined;
  return trade;
}

/**
 * Every row made a trade, except those without a symbol and those already
 * imported. With `journal`, a row with the broker's id of a trade the journal
 * has open, now closed, finishes that trade (`finished`).
 */
export function tradesFromRows(r: Reader, journal?: readonly Trade[]): RowsRead {
  const { sheet, findings } = r;
  const trades: Trade[] = [];
  const finished: Trade[] = [];
  const openingFill = new Map<string, string>();
  const unsaid = new Map<string, Unsaid>();
  // no fee anywhere in the file: no fee column, no rate, and no P&L the fees are already taken from
  const netOnly = sheet.has('net_pnl') && !sheet.has('pnl') && !sheet.has('gross_pnl');
  const feesUnsaid = !sheet.has('fees') && !sheet.has('fee_rate') && !netOnly;
  const unsaidOf = (read: TradeRow): Unsaid => ({ fees: feesUnsaid, multiplier: read.multiplier == null });
  const seenIds = new Set(r.existingIds);
  /** the journal's open trades, by the broker's id, until a row finishes one */
  const openById = new Map(
    (journal ?? []).filter((t) => t.externalId && !isClosed(t) && !t.isSample).map((t) => [t.externalId, t]),
  );

  // a deposit or a balance line among the trades (MetaTrader, IG) has no price
  // and no size; a file where most rows have none is one to fill in by hand
  const PRICED: Role[] = ['entry_price', 'exit_price', 'price', 'buy_price', 'sell_price', 'quantity'];
  const priced = (row: string[]) => PRICED.some((role) => parseMoney(sheet.cell(row, role)) != null);
  const mostlyPriced = sheet.table.data.filter(priced).length * 2 >= sheet.table.data.length;
  const notTrades: string[] = [];
  // rows imported with a gap the file didn't mean to leave: lines, and the first value
  const unreadOpen = { rows: [] as number[], value: '' };
  const unreadClose = { rows: [] as number[], value: '' };
  const noSize: number[] = [];
  const note = (u: { rows: number[]; value: string }, value: string, line: number) => {
    if (!u.rows.length) u.value = value;
    u.rows.push(line);
  };

  sheet.table.data.forEach((row, index) => {
    const line = sheet.table.lines[index];
    if (mostlyPriced && !priced(row)) {
      notTrades.push(sheet.cell(row, 'side') || r.symbolOf(row) || 'blank');
      return;
    }
    const read = parseTradeRow(row, line, r);
    if (!read) {
      findings.noSymbol.push(line);
      return;
    }

    // ---- skip anything already imported, or finish it -------------------
    if (read.externalId && seenIds.has(read.externalId)) {
      const open = openById.get(read.externalId);
      const now = open && assembleTrade(read, row, r);
      if (open && now && isClosed(now)) {
        openById.delete(read.externalId);
        finished.push(finishOpen(open, now, now.fillCount ?? open.fillCount, unsaidOf(read)));
      } else findings.duplicates += 1;
      return;
    }
    if (read.externalId) seenIds.add(read.externalId);

    const trade = assembleTrade(read, row, r);
    if (read.unreadOpen) note(unreadOpen, read.unreadOpen, line);
    // an open trade's exit time counts for nothing, so only a closed one's is worth saying
    if (read.unreadClose && isClosed(trade)) note(unreadClose, read.unreadClose, line);
    if (sheet.has('quantity') && !(trade.quantity > 0)) noSize.push(line);
    // the fill that opened the position is the buy on a long and the sell on a short
    const opener = trade.side === 'LONG' ? read.buyFill : read.sellFill;
    if (opener) openingFill.set(trade.id, opener);
    if (feesUnsaid || read.multiplier == null) unsaid.set(trade.id, unsaidOf(read));
    trades.push(trade);
  });

  const errors: string[] = [];
  const notices: string[] = [];
  if (unreadOpen.rows.length)
    errors.push(
      rowsNote(
        unreadOpen.rows,
        `the entry time "${unreadOpen.value}" could not be read, so it was left blank and the trade marked needs details.`,
        `the entry time could not be read (the first is "${unreadOpen.value}"), so it was left blank and the trades marked needs details.`,
      ),
    );
  if (unreadClose.rows.length)
    errors.push(
      rowsNote(
        unreadClose.rows,
        `the exit time "${unreadClose.value}" could not be read, so it was left blank: until it is filled in, the trade counts on the day it was opened.`,
        `the exit time could not be read (the first is "${unreadClose.value}"), so it was left blank: until it is filled in, the trades count on the day they were opened.`,
      ),
    );
  if (!sheet.has('quantity') && trades.length) {
    errors.push('There is no size column, so every trade was marked needs details. Fill in the sizes after importing.');
  } else if (noSize.length) {
    errors.push(
      rowsNote(
        noSize,
        'no size above 0, so the trade was marked needs details.',
        'no size above 0, so the trades were marked needs details.',
      ),
    );
  }
  if (!sheet.has('side') && !sheet.paired && !sheet.signedQuantities && trades.length) {
    errors.push('There is no direction column, so every row was imported as LONG. Check any shorts.');
  }
  if (notTrades.length) {
    const n = notTrades.length;
    const examples = [...new Set(notTrades)]
      .slice(0, 3)
      .map((v) => `"${v}"`)
      .join(', ');
    notices.push(
      `${n} ${n === 1 ? 'row has' : 'rows have'} no price and no size (${examples}), so ${n === 1 ? 'it is not a trade and was' : 'they are not trades and were'} left out.`,
    );
  }
  return { trades, errors, notices, openingFill, finished, unsaid };
}

/**
 * Scaled-out positions put back together: rows that share the fill that
 * opened them (a broker writing one row per exit) become one trade, unless
 * they can't be merged (see mergeIssue). How many rows were folded in is
 * `combined`. A merged trade leaves a value `unsaid` only when every row did.
 */
export function combinePartials(
  trades: Trade[],
  openingFill: ReadonlyMap<string, string>,
  unsaid: ReadonlyMap<string, Unsaid> = new Map(),
): { trades: Trade[]; combined: number; unsaid: Map<string, Unsaid> } {
  const left = new Map(unsaid);
  if (!openingFill.size) return { trades, combined: 0, unsaid: left };
  const groups = new Map<string, Trade[]>();
  const loose: Trade[] = [];

  for (const t of trades) {
    const opener = openingFill.get(t.id);
    if (!opener) {
      loose.push(t);
      continue;
    }
    const key = `${t.accountId}|${t.symbol}|${t.side}|${opener}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  let combined = 0;
  const merged: Trade[] = [];
  for (const group of groups.values()) {
    if (group.length > 1 && mergeIssue(group) === null) {
      const one = mergeTrades(group);
      const fees = group.every((t) => left.get(t.id)?.fees);
      const multiplier = group.every((t) => left.get(t.id)?.multiplier);
      for (const t of group) left.delete(t.id);
      if (fees || multiplier) left.set(one.id, { fees, multiplier });
      merged.push(one);
      combined += group.length;
    } else {
      merged.push(...group);
    }
  }
  return { trades: [...merged, ...loose], combined, unsaid: left };
}
