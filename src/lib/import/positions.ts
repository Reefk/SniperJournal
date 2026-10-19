import type { Trade, TradeInput } from '../types';
import { detectSession } from '../sessions';
import { isClosed, isIncomplete } from '../trade-math';
import { decimalsOf } from '../merge';
import { uid } from '../utils';
import { fillsToPositions, summarise, type Carry, type Fill, type Summary } from './fills';
import { finishOpen, openRest, type Unsaid } from './finish';
import { headerInfo } from './columns';
import { believable, fitReported, type Reader, type RowsRead } from './reader';
import { rowsNote } from './report';
import { parseAction, parseEffect, parseMoment, parseMoney, parseStatus, type Moment } from './values';

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
 * A row read as a fill, or why it isn't one. `seen` holds the fills with an id
 * read so far, and this one is added; with none, no row is taken for another
 * listed twice (the ids number orders). `net` says the file's P&L column
 * is after fees; `cashSigned` that its prices carry the sign of the cash, a
 * buy's below zero (tastytrade).
 */
export function parseFillRow(
  row: string[],
  line: number,
  r: Reader,
  seen: Set<string> | null,
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
  const accountId = r.accountIdFor(r.textCell(row, 'account'));
  if (id && seen) {
    // the same execution listed twice is the same id with the same everything
    // else; rows that share only the id are fills of one order: a spread's
    // legs, a roll, a partial fill
    const when = (['time', 'date', 'opened_at', 'opened_date'] as const).map((role) => cell(row, role));
    const fill = [id, accountId, symbol, action.side, quantity, price, ...when].join('\u0000');
    if (seen.has(fill)) return { skip: 'duplicate' };
    seen.add(fill);
  }
  const reported = parseMoney(cell(row, net ? 'net_pnl' : has('gross_pnl') ? 'gross_pnl' : 'pnl'));
  // no fee column, but a P&L before fees and one after them: the fees are the
  // difference, unless the one after is the larger (then they aren't those two)
  const before = net ? null : reported;
  const after = parseMoney(cell(row, 'net_pnl'));
  let fees = r.feeOf(row, 1, line);
  if (fees == null && before != null && after != null) {
    if (before >= after) fees = Math.round((before - after) * 1e8) / 1e8;
    else r.findings.netAboveGross.push(line);
  }
  return {
    fill: {
      line,
      key: `${accountId}|${symbol}`,
      side: action.side,
      quantity,
      price,
      time: r.moment(row, 'time', 'date') ?? r.moment(row, 'opened_at', 'opened_date'),
      fees: fees ?? 0,
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

/**
 * The trade one position makes. `read` holds every fill read, by file line;
 * `net` says the file's P&L column is after fees; `from` is the journal trade
 * carried in as its entry, if one was. `unsaid` says when neither the file,
 * that trade nor the instrument gave a point value, so it is 1 (see Unsaid).
 */
export function assemblePosition(
  s: Summary,
  read: ReadonlyMap<number, FillRow>,
  r: Reader,
  net: boolean,
  from?: Trade,
): { trade: Trade; unsaid: Unsaid } {
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
  /** the file names the point value: a multiplier column, or the amount against the price */
  let given = multiplier != null;
  // a reported P&L that fits the prices says it best: TradingView's position
  // value leaves the point value out (2 MNQ at 21000 is "42000"). Never over
  // the point value the instrument is known to have: a broker's realised P&L
  // can be against shares bought before the file (IBKR's statement), and a
  // stock's point value is 1 however far off that P&L is.
  const expected = r.expectedMultiplier(first.symbol, first.row);
  const fit =
    multiplier == null && s.reportedPnl != null && s.closed && !s.orphan
      ? fitReported(s.reportedPnl, s.move, s.fees, net, expected ?? 1)
      : null;
  if (fit?.multiplier != null) {
    if (expected == null || fit.multiplier === expected) multiplier = fit.multiplier;
    else r.findings.pnlSetAside.add(first.symbol);
  }
  if (multiplier == null) {
    const worth = [...new Set(rows.map(fillWorth))];
    if (worth.length === 1 && worth[0] != null) {
      multiplier = worth[0];
      given = true;
      if (multiplier !== 1) r.findings.inferred.set(first.symbol, `${multiplier} (from the amount against the price)`);
    }
  }
  let manualPnl: number | null = null;
  if (multiplier == null && fit) manualPnl = fit.manualPnl;
  // nothing in the file says: the journal trade it continues does, or what the instrument is
  multiplier ??= from?.multiplier ?? r.knownMultiplier(first.symbol, first.row);
  const unsaid: Unsaid = { multiplier: multiplier == null };
  multiplier ??= 1;
  // a P&L with no point value named beside it: the journal's trade it may
  // finish can tell whether it is before fees or after them (finishOpen)
  if (!given && s.closed && !s.orphan && s.reportedPnl != null && s.move != null && s.move !== 0)
    unsaid.reported = { pnl: s.reportedPnl, move: s.move };

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
    // the P&L follows from the prices alone, at whatever point value finishing keeps (finishOpen)
    if (unsaid.multiplier) unsaid.move = s.move;
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
  return { trade, unsaid };
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

const ORDER_IDS = new Set(['orderid', 'orderno', 'ordernumber']);
/**
 * Whether the id column numbers orders (tastytrade's Order #), not fills: an
 * order fills in as many rows as it takes, two of them alike when it filled
 * in equal lots at one price in the same second.
 */
function numbersOrders(r: Reader): boolean {
  const i = r.sheet.at('external_id');
  return i != null && ORDER_IDS.has(headerInfo(r.sheet.table.header[i] ?? '').key);
}

/** Whether the file lists its newest rows first, judged by every dated row in it, trades or not. */
function runsNewestFirst(r: Reader): boolean {
  const { cell, order, table } = r.sheet;
  const dated = table.data
    .map((row) => parseMoment(cell(row, 'time') || cell(row, 'date'), order)?.sortKey)
    .filter((k): k is string => Boolean(k));
  return dated.length >= 2 && dated[0] > dated[dated.length - 1];
}

/** a journal time ('2026-03-04T13:05') as the file's are read */
const journalMoment = (at: string): Moment => ({
  value: at.slice(0, 16),
  sortKey: `${at.slice(0, 16)}:00`,
  zoned: false,
  timed: at.length >= 16,
});

/**
 * The journal's trades a file's fills may continue, per account and symbol:
 * those with a size, an entry price and an entry time (and, if closed, a close
 * time). Which ones a file continues, its fills decide (fills.ts): the oldest
 * that fits, from the first fill in the symbol and again after each one closes.
 */
function carriesFrom(journal: readonly Trade[]): Map<string, Carry[]> {
  const carries = new Map<string, Carry[]>();
  for (const t of journal) {
    if (t.isSample || !(t.quantity > 0) || !(t.entryPrice > 0) || !t.openedAt) continue;
    const closed = isClosed(t);
    if (closed && !t.closedAt) continue;
    const key = `${t.accountId}|${t.symbol.toUpperCase()}`;
    const carry: Carry = {
      fill: {
        line: 0,
        key,
        side: t.side === 'LONG' ? 'BUY' : 'SELL',
        quantity: t.quantity,
        price: t.entryPrice,
        time: journalMoment(t.openedAt),
        fees: t.fees || 0,
        pnl: null,
        carried: t.id,
      },
      closedAt: closed ? journalMoment(t.closedAt as string) : null,
    };
    carries.set(key, [...(carries.get(key) ?? []), carry]);
  }
  return carries;
}

/** a closed journal trade carried in, closed by the file the same way: the file has it again */
const sameClose = (s: Summary, t: Trade) =>
  s.closed &&
  Math.abs(s.quantity - t.quantity) < 1e-9 &&
  s.closedAt != null &&
  s.closedAt.value === (t.closedAt ?? '').slice(0, 16);

/**
 * Every row read as a fill, the fills put back together, and each position
 * made a trade.
 *
 * With `journal`, the file continues it: fills it already has (by the
 * broker's ids) are left out, and a position the file begins in the middle of
 * starts from the journal's trade for it, which the file's fills then finish
 * (`finished`). Without it, every file starts from nothing, as it once did.
 * A trade made from the file's fills alone may still finish one the journal
 * has open (likely.ts): `unsaid` says what the file left out for it.
 */
export function tradesFromFills(r: Reader, journal?: readonly Trade[]): RowsRead {
  const { sheet, findings } = r;
  const net = !sheet.has('gross_pnl') && !sheet.has('pnl') && sheet.has('net_pnl');
  // no fee anywhere in the file: no fee column, no rate, and no P&L after fees
  // (one alone has them taken off already; beside one before them, it gives them)
  const feesUnsaid = !sheet.has('fees') && !sheet.has('fee_rate') && !sheet.has('net_pnl');
  // a P&L that says neither, beside no fees: maybe before them, maybe after
  const unlabelled = feesUnsaid && sheet.has('pnl') && !sheet.has('gross_pnl');
  const unsaid = new Map<string, Unsaid>();
  const cashSigned = cashSignedPrices(r);
  const fills: Fill[] = [];
  const read = new Map<number, FillRow>();
  const seen = numbersOrders(r) ? null : new Set<string>();
  /** a fill read was a sell, the journal's own included */
  let sold = false;
  const notTrades = new Map<string, number>();
  let unfilled = 0;
  const noQuantity: number[] = [];
  const noPrice: number[] = [];
  /** the broker's ids of fills left out because the journal has them */
  const known = new Set<string>();

  sheet.table.data.forEach((row, index) => {
    const line = sheet.table.lines[index];
    const got = parseFillRow(row, line, r, seen, net, cashSigned);
    if ('fill' in got) {
      if (got.fill.side === 'SELL') sold = true;
      if (journal && got.fill.id && r.existingIds.has(got.fill.id)) {
        known.add(got.fill.id);
        return;
      }
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

  // the positions, from the journal's where the file continues one; a closed
  // trade carried in that the file doesn't close the same way isn't the file's
  // to continue, so it is ruled out and the fills followed again
  const newestFirst = runsNewestFirst(r);
  const byId = new Map((journal ?? []).map((t) => [t.id, t]));
  const carries = journal ? carriesFrom(journal) : undefined;
  const ruledOut = new Set<string>();
  let summaries: Summary[];
  for (;;) {
    const usable =
      carries &&
      new Map([...carries].map(([key, list]) => [key, list.filter((c) => !ruledOut.has(c.fill.carried as string))]));
    summaries = fillsToPositions(fills, newestFirst, usable).flatMap(summarise);
    const wrong = summaries.filter((s) => {
      const from = s.carried ? byId.get(s.carried) : undefined;
      return from && isClosed(from) && !sameClose(s, from);
    });
    if (!wrong.length) break;
    for (const s of wrong) ruledOut.add(s.carried as string);
  }

  const trades: Trade[] = [];
  const finished: Trade[] = [];
  /** journal trades the file has again, by id */
  const again = new Set<string>();
  let open = 0;
  let orphans = 0;
  let overlapping = 0;
  for (const s of summaries) {
    if (!read.has(s.firstLine)) continue;
    const from = s.carried ? byId.get(s.carried) : undefined;
    if (from && isClosed(from)) {
      again.add(from.id);
      continue;
    }
    // already imported: every fill of it is in the journal
    if (s.ids.length && s.ids.every((id) => r.existingIds.has(id))) {
      findings.duplicates++;
      continue;
    }
    if (s.ids.some((id) => r.existingIds.has(id))) overlapping++;
    if (s.orphan) orphans++;
    if (!s.closed) open++;
    const position = assemblePosition(s, read, r, net, from);
    const { trade } = position;
    if (!from) {
      trades.push(trade);
      // only a P&L that doesn't say whether it is after fees, beside none, is one to tell
      const { reported, ...rest } = position.unsaid;
      const left: Unsaid = { ...rest, fees: feesUnsaid, ...(unlabelled && reported ? { reported } : {}) };
      if (left.fees || left.multiplier) unsaid.set(trade.id, left);
    } else if (s.closed) finished.push(finishOpen(from, trade, (from.fillCount ?? 1) + s.fillCount));
    else trades.push(openRest(from, trade));
  }
  if (journal) {
    // a journal trade whose fills the file has again, unless the file finished it
    const done = new Set(finished.map((t) => t.id));
    for (const t of journal) {
      if (!done.has(t.id) && t.externalId?.split('|').some((id) => known.has(id))) again.add(t.id);
    }
    findings.duplicates += again.size;
  }

  const errors: string[] = [];
  const notices: string[] = [];
  const fillCount = fills.length + known.size;
  const made = trades.length + finished.length;
  notices.push(
    `Each row is one fill: ${fillCount} ${fillCount === 1 ? 'fill was' : 'fills were'} put back together into ${made} ${made === 1 ? 'trade' : 'trades'}, following the position in each symbol.`,
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
  // with no direction column, a size below zero is a sell and any other a buy:
  // when no fill read has one, nothing in the file said any fill was a sell
  if (!sheet.has('side') && fills.length && !sold)
    errors.push(
      'There is no direction column and no fill has a size below zero, so every fill was read as a buy. Check any sells.',
    );
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
  // ids that number orders keep two rows alike (an order filled in equal lots
  // in one second), but a file that lists its fills twice would count them twice
  if (!seen) {
    const rows = new Set<string>();
    let alike = 0;
    for (const f of fills) {
      const same = [f.id, f.key, f.side, f.quantity, f.price, f.time?.value].join('\u0000');
      if (rows.has(same)) alike++;
      else rows.add(same);
    }
    if (alike)
      errors.push(
        `${alike} ${alike === 1 ? 'fill is' : 'fills are'} the same as another of the same order (time, size and price), so ${alike === 1 ? 'it was' : 'they were'} kept as more of that order. If the file lists fills twice, check those trades' sizes.`,
      );
  }
  return { trades, errors, notices, finished, unsaid };
}
