import type { Account, Setup, Trade, TradeInput } from './types';
import { detectSession } from './sessions';
import { grossPnl, isClosed, isIncomplete, missingDetails, netPnl, rMultiple } from './trade-math';
import { decimalsOf, mergeIssue, mergeTrades } from './merge';
import { pad2, uid } from './utils';
import { planColumns, type ColumnPlan, type Role } from './import/columns';
import { findTable, parseCsv } from './import/table';
import {
  asClock,
  dateOrderOf,
  isTimeOfDay,
  parseAction,
  parseEffect,
  parseMoment,
  parseMoney,
  parseNumber,
  parseSide,
  parseStatus,
  parsePutCall,
  type DateOrder,
  type Moment,
} from './import/values';
import { fillsToPositions, summarise, type Fill } from './import/fills';
import { OPTION_MULTIPLIER, futuresPointValue, isOption, optionSymbol } from './import/instruments';

export { parseCsv } from './import/table';
export { ROLE_LABELS, type Role } from './import/columns';
export type { DateOrder } from './import/values';

export const CSV_COLUMNS = [
  'symbol',
  'side',
  'opened_at',
  'closed_at',
  'quantity',
  'entry_price',
  'exit_price',
  'stop_loss',
  'take_profit',
  'fees',
  'multiplier',
  'leverage',
  'session',
  'setup',
  'tags',
  'notes',
  'account',
] as const;

export function csvTemplate(): string {
  const today = new Date();
  const day = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  return [
    CSV_COLUMNS.join(','),
    `AAPL,LONG,${day} 09:35,${day} 10:12,100,187.40,189.10,186.20,190.00,1.30,1,,New York,Opening Range Breakout,breakout|planned,Took the first pullback,Main Portfolio`,
    `EURUSD,SHORT,${day} 11:05,${day} 11:48,10000,1.08640,1.08410,1.08790,1.08200,0.40,1,10,London,VWAP Reclaim,fx,Clean rejection at the session high,Main Portfolio`,
  ].join('\n');
}

/**
 * Spreadsheet formula injection: Excel and its kin run a cell that starts
 * with = + - @ (or a tab or carriage return) as a formula, so a note such as
 * =HYPERLINK(...) could do something when the export is opened. Free-text
 * cells that start that way get a leading apostrophe, which spreadsheets show
 * as plain text; the importer takes it off again. Numbers are never touched,
 * so -12.50 stays a number.
 */
const FORMULA_START = /^[=+\-@\t\r]/;
const formulaSafe = (v: string) => (FORMULA_START.test(v) ? `'${v}` : v);
const unescapeFormula = (v: string) => (v.startsWith("'") && FORMULA_START.test(v.slice(1)) ? v.slice(1) : v);

export function tradesToCsv(trades: Trade[], setups: Setup[], accounts: Account[]): string {
  const setupNames = new Map(setups.map((s) => [s.id, s.name]));
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [...CSV_COLUMNS, 'gross_pnl', 'net_pnl', 'r_multiple'];
  const rows = trades.map((t) =>
    [
      formulaSafe(t.symbol),
      t.side,
      t.openedAt.replace('T', ' '),
      t.closedAt?.replace('T', ' ') ?? '',
      t.quantity,
      t.entryPrice,
      t.exitPrice ?? '',
      t.stopLoss ?? '',
      t.takeProfit ?? '',
      t.fees ?? 0,
      t.multiplier ?? 1,
      t.leverage ?? '',
      formulaSafe(t.session ?? ''),
      formulaSafe(t.setupId ? (setupNames.get(t.setupId) ?? '') : ''),
      formulaSafe(t.tags.join('|')),
      formulaSafe(t.notes ?? ''),
      formulaSafe(accountNames.get(t.accountId) ?? ''),
      isClosed(t) ? grossPnl(t).toFixed(2) : '',
      isClosed(t) ? netPnl(t).toFixed(2) : '',
      rMultiple(t)?.toFixed(2) ?? '',
    ]
      .map(esc)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

/** how the rows of a file are read: whole trades, paired buy/sell fills, or one fill each */
export type RowKind = 'trades' | 'paired' | 'fills';

export interface ImportOptions {
  accountId: string;
  accounts: Account[];
  setups: Setup[];
  existing?: Trade[];
  combinePartials?: boolean;
  /** column index -> role, as chosen in the import preview */
  mapping?: Record<number, Role | ''>;
  /** read every row as a whole trade, or as one fill; worked out when not given */
  rowKind?: 'trades' | 'fills';
  /** day-month or month-day for dates like 03/04/2026; worked out when not given */
  dateOrder?: DateOrder;
  /** the symbol for every row of a file that has no symbol column (TradingView's list of trades) */
  defaultSymbol?: string;
}

export interface ImportLayout {
  rowKind: RowKind;
  /** the columns allow reading each row as one fill */
  canBeFills: boolean;
  /** 1-based line of the header in the file (blank lines not counted) */
  headerLine: number;
  /** every column, what it is read as, and a value from it to recognise it by */
  columns: Array<ColumnPlan['columns'][number] & { sample: string }>;
  dateOrder?: DateOrder;
  /** dates like 03/04/2026 appear and nothing in the file shows which order they are in */
  ambiguousDates: boolean;
  /** identifies this layout of columns, so a mapping chosen for it can be remembered */
  signature: string;
}

export interface ImportResult {
  trades: Trade[];
  newSetups: Setup[];
  /** things to check: rows skipped, values that could not be read */
  errors: string[];
  /** how the file was read: worth knowing, nothing wrong */
  notices: string[];
  /** rows already in the journal, matched on the broker's ids */
  duplicates: number;
  /** imported, but still missing something the statistics need */
  incomplete: number;
  /** true when the file pairs a buy fill with a sell fill instead of naming a side */
  pairedFills: boolean;
  /** how many rows were folded into a larger position because they shared an entry fill */
  combined: number;
  recognised: string[];
  ignored: string[];
  layout: ImportLayout | null;
}

/** "Row 4" or "Row 4 and 6 more" */
const rowsLabel = (rows: number[]) => (rows.length === 1 ? `Row ${rows[0]}` : `Row ${rows[0]} and ${rows.length - 1} more`);

/** "Row 4: ..." or "Row 4 and 6 more: ..." */
function rowsNote(rows: number[], one: string, many: string): string {
  return `${rowsLabel(rows)}: ${rows.length === 1 ? one : many}`;
}

/** a multiplier worked out from data, if it is a believable one */
function believable(m: number): number | null {
  if (!Number.isFinite(m) || m <= 0) return null;
  if (m >= 0.95) {
    const r = Math.round(m);
    return Math.abs(m - r) / r < 0.01 ? r : null;
  }
  return [0.1, 0.25, 0.5].find((c) => Math.abs(m - c) / c < 0.01) ?? null;
}

/**
 * Reads a broker's CSV into trades. Only a symbol is genuinely required:
 * anything else that is missing is left blank for you to fill in afterwards,
 * and the trade is flagged so it stays out of the statistics until you do.
 *
 * Three kinds of file are understood: one row per trade (entry and exit),
 * Tradovate-style rows pairing a buy fill with a sell fill, and one row per
 * fill, which is put back together into trades (see import/fills.ts).
 */
export function importTradesFromCsv(text: string, ctx: ImportOptions): ImportResult {
  const empty: ImportResult = {
    trades: [],
    newSetups: [],
    errors: [],
    notices: [],
    duplicates: 0,
    incomplete: 0,
    pairedFills: false,
    combined: 0,
    recognised: [],
    ignored: [],
    layout: null,
  };

  const rows = parseCsv(text);
  if (rows.length < 2) return { ...empty, errors: ['The file has no data rows.'] };
  const table = findTable(rows);
  if (!table.data.length) return { ...empty, errors: ['The file has no data rows.'] };

  const plan = planColumns(table.header, table.data.slice(0, 50), ctx.mapping);
  const has = (role: Role) => plan.roles.has(role);
  const at = (role: Role) => plan.roles.get(role)?.[0];
  const cell = (row: string[], role: Role): string => {
    const i = at(role);
    return i == null ? '' : (row[i] ?? '').trim();
  };
  // free text: a value tradesToCsv escaped against spreadsheet formulas comes back as typed
  const textCell = (row: string[], role: Role) => unescapeFormula(cell(row, role));

  const recognised = [...plan.roles.keys()];
  const ignored = plan.columns.filter((c) => !c.role && c.header).map((c) => c.header);

  // ---- which rows are which ------------------------------------------------
  const paired = has('buy_price') && has('sell_price');
  const timed = has('time') || has('date') || has('opened_at') || has('opened_date');
  const signedQuantities = has('quantity') && !has('side') && table.data.some((r) => (parseMoney(cell(r, 'quantity')) ?? 0) < 0);
  const canBeFills = !paired && (has('price') || has('entry_price')) && (has('side') || signedQuantities) && has('quantity') && timed;
  const looksLikeFills =
    canBeFills &&
    !has('exit_price') &&
    !has('closed_at') &&
    !has('closed_date') &&
    (has('price') || has('trade_no') || has('effect') || has('status') || signedQuantities);
  const rowKind: RowKind = paired
    ? 'paired'
    : ctx.rowKind === 'fills' && canBeFills
      ? 'fills'
      : ctx.rowKind === 'trades'
        ? 'trades'
        : looksLikeFills
          ? 'fills'
          : 'trades';

  // ---- one date order for the whole file, from every date in it -------------
  const dateRoles: Role[] = ['opened_at', 'opened_date', 'closed_at', 'closed_date', 'time', 'date', 'bought_at', 'sold_at'];
  const detected = dateOrderOf(table.data.flatMap((row) => dateRoles.map((r) => cell(row, r))));
  const order = ctx.dateOrder ?? detected.order;

  const layout: ImportLayout = {
    rowKind,
    canBeFills,
    headerLine: table.preamble + 1,
    columns: plan.columns.map((c) => ({
      ...c,
      sample:
        table.data
          .slice(0, 20)
          .map((r) => (r[c.index] ?? '').trim())
          .find(Boolean) ?? '',
    })),
    dateOrder: order,
    ambiguousDates: detected.ambiguous,
    signature: table.header.map((h) => h.trim().toLowerCase()).join('|'),
  };

  const fallbackSymbol = (ctx.defaultSymbol ?? '').trim().toUpperCase();
  if (!has('symbol') && !has('underlying') && !fallbackSymbol) {
    return {
      ...empty,
      recognised,
      ignored,
      layout,
      errors: [
        `No symbol column found. The columns in this file are: ${table.header.join(', ')}. Choose which column holds the symbol under "Columns" below, or type the symbol for every row.`,
      ],
    };
  }

  // ---- shared readers ----------------------------------------------------
  let zoned = 0;
  const offsetOf = (role: Role) => {
    const i = at(role);
    return i == null ? null : plan.offsets[i];
  };
  /** a moment from a date-and-time column, or a date column plus a time-of-day column */
  const moment = (row: string[], atRole: Role, dateRole: Role): Moment | null => {
    const when = cell(row, atRole);
    const day = cell(row, dateRole);
    const offset = offsetOf(atRole) ?? offsetOf(dateRole);
    const m =
      when && day && isTimeOfDay(when)
        ? parseMoment(`${day} ${asClock(when)}`, order, offset)
        : ((when ? parseMoment(when, order, offset) : null) ?? (day ? parseMoment(day, order, offset) : null));
    if (m?.zoned) zoned++;
    return m;
  };

  // fees: every fee column adds up. Some brokers write costs as negatives
  // (IBKR, MetaTrader), others as positives; each column is read its own way.
  const feeColumns = plan.roles.get('fees') ?? [];
  const feeSign = new Map(
    feeColumns.map((c) => {
      let negative = 0;
      let positive = 0;
      for (const row of table.data) {
        const v = parseMoney(row[c] ?? '');
        if (v) v < 0 ? negative++ : positive++;
      }
      return [c, negative > positive ? -1 : 1] as const;
    }),
  );
  // a fee in another currency than the prices (Binance charges BNB) cannot be added to them
  const valueUnits = new Set<string>();
  for (const row of table.data.slice(0, 200)) {
    for (const role of ['price', 'entry_price', 'exit_price', 'notional', 'pnl', 'net_pnl', 'gross_pnl'] as Role[]) {
      const unit = parseNumber(cell(row, role))?.unit;
      if (unit) valueUnits.add(unit);
    }
  }
  const foreignFees = new Set<string>();
  const feeOf = (row: string[]): number | null => {
    let total: number | null = null;
    for (const c of feeColumns) {
      const n = parseNumber(row[c] ?? '');
      if (!n) continue;
      if (n.unit && valueUnits.size && !valueUnits.has(n.unit)) {
        foreignFees.add(n.unit);
        continue;
      }
      total = (total ?? 0) + n.value * (feeSign.get(c) ?? 1);
    }
    return total;
  };

  /** the symbol, with an option's expiry, strike and call/put when they come in their own columns */
  const symbolOf = (row: string[]) => {
    const base = (textCell(row, 'symbol') || textCell(row, 'underlying')).toUpperCase() || fallbackSymbol;
    const putCall = parsePutCall(cell(row, 'put_call'));
    if (!putCall || !base) return base;
    return optionSymbol(base, cell(row, 'expiry'), cell(row, 'strike'), putCall === 'C' ? 'CALL' : 'PUT');
  };

  const now = new Date().toISOString();
  const setupsByName = new Map(ctx.setups.map((s) => [s.name.toLowerCase(), s]));
  const accountsByName = new Map(ctx.accounts.map((a) => [a.name.toLowerCase(), a]));
  const existingIds = new Set((ctx.existing ?? []).flatMap((t) => (t.externalId ? t.externalId.split('|') : [])));
  const newSetups: Setup[] = [];
  const setupIdFor = (name: string): string | undefined => {
    if (!name) return undefined;
    const key = name.toLowerCase();
    let setup = setupsByName.get(key);
    if (!setup) {
      setup = { id: uid(), name, rules: [], description: 'Created during a CSV import.' };
      setupsByName.set(key, setup);
      newSetups.push(setup);
    }
    return setup.id;
  };
  const accountIdFor = (name: string) => (name && accountsByName.get(name.toLowerCase())?.id) || ctx.accountId;
  const tagsOf = (row: string[]) =>
    textCell(row, 'tags')
      .split(/[|;]/)
      .map((t) => t.trim())
      .filter(Boolean);

  const errors: string[] = [];
  const notices: string[] = [];
  const trades: Trade[] = [];
  const noSymbol: number[] = [];
  /** direction values that meant nothing: value -> rows */
  const unknownSides = new Map<string, number[]>();
  /** multipliers of zero or less, which the trade form refuses: rows and the first value */
  const badMultipliers: { rows: number[]; value: string } = { rows: [], value: '' };
  /** point values worked out rather than read: symbol -> how */
  const inferred = new Map<string, string>();
  let duplicates = 0;

  const multiplierCell = (row: string[], line: number): number | null => {
    const m = parseMoney(cell(row, 'multiplier'));
    if (m != null && m <= 0) {
      // a negative one would turn every win into a loss; leave it out and say so
      if (!badMultipliers.rows.length) badMultipliers.value = cell(row, 'multiplier');
      badMultipliers.rows.push(line);
      return null;
    }
    return m;
  };

  /** a point value from what the symbol is, when nothing in the row gives one */
  const knownMultiplier = (symbol: string, row: string[]): number | null => {
    const assetClass = cell(row, 'asset_class');
    const future = futuresPointValue(symbol, assetClass);
    if (future) {
      inferred.set(symbol, `${future.value} a point (${future.root} futures)`);
      return future.value;
    }
    if (isOption(symbol, assetClass, cell(row, 'put_call'))) {
      inferred.set(symbol, `${OPTION_MULTIPLIER} (an option contract)`);
      return OPTION_MULTIPLIER;
    }
    return null;
  };

  /**
   * Whether a reported P&L fits the prices, and so what one point is worth.
   * An unlabelled P&L is read as gross; if it only fits once the fees are
   * added back, it was net after all.
   */
  const fitReported = (
    reported: number,
    move: number | null,
    fees: number,
    net: boolean,
  ): { multiplier: number | null; manualPnl: number | null } => {
    const gross = net ? reported + fees : reported;
    if (move == null) return { multiplier: null, manualPnl: gross };
    if (Math.abs(move) <= 1e-9) return { multiplier: null, manualPnl: gross };
    const snap = (d: number) => (Math.abs(d - Math.round(d)) < 0.005 ? Math.round(d) : Number(d.toFixed(4)));
    let snapped = snap(gross / move);
    let total = gross;
    if (!net && fees && !Number.isInteger(snapped)) {
      const asNet = snap((reported + fees) / move);
      if (Number.isInteger(asNet) && asNet > 0) {
        snapped = asNet;
        total = reported + fees;
      }
    }
    if (snapped > 0 && Math.abs(move * snapped - total) < 0.01) return { multiplier: snapped, manualPnl: null };
    return { multiplier: null, manualPnl: total };
  };

  // ======================================================================
  // one row per trade, or per paired buy and sell fill
  // ======================================================================
  const openingFill = new Map<string, string>();
  if (rowKind !== 'fills') {
    const seenIds = new Set(existingIds);
    table.data.forEach((row, index) => {
      const line = table.lines[index];
      const symbol = symbolOf(row);
      if (!symbol) {
        noSymbol.push(line);
        return;
      }

      // ---- direction, times and prices -----------------------------------
      const rawSide = cell(row, 'side');
      let side = parseSide(rawSide);
      if (rawSide && !side) unknownSides.set(rawSide, [...(unknownSides.get(rawSide) ?? []), line]);
      let openedParts = moment(row, 'opened_at', 'opened_date') ?? moment(row, 'time', 'date');
      let closedParts = moment(row, 'closed_at', 'closed_date');
      let entryPrice = parseMoney(cell(row, 'entry_price')) ?? parseMoney(cell(row, 'price'));
      let exitPrice = parseMoney(cell(row, 'exit_price'));

      if (paired) {
        const buyPrice = parseMoney(cell(row, 'buy_price'));
        const sellPrice = parseMoney(cell(row, 'sell_price'));
        const boughtParts = moment(row, 'bought_at', 'date');
        const soldParts = moment(row, 'sold_at', 'date');

        // whichever fill happened first is the one that opened the position
        const soldFirst = boughtParts && soldParts ? soldParts.sortKey < boughtParts.sortKey : false;
        side = side ?? (soldFirst ? 'SHORT' : 'LONG');

        openedParts = openedParts ?? (soldFirst ? soldParts : boughtParts);
        closedParts = closedParts ?? (soldFirst ? boughtParts : soldParts);
        entryPrice = entryPrice ?? (soldFirst ? sellPrice : buyPrice);
        exitPrice = exitPrice ?? (soldFirst ? buyPrice : sellPrice);
      }

      const quantity = parseMoney(cell(row, 'quantity'));
      const fees = feeOf(row);
      // The P&L before commissions. A net column has them added back, so they
      // are not charged a second time through the fees column.
      const gross = parseMoney(cell(row, 'gross_pnl')) ?? parseMoney(cell(row, 'pnl'));
      const net = parseMoney(cell(row, 'net_pnl'));

      // ---- contract multiplier -------------------------------------------
      // When the file reports a P&L we can work out what one point is worth,
      // which keeps the prices and the P&L consistent if either is edited later.
      let multiplier = multiplierCell(row, line);
      let manualPnl: number | null = null;
      if (gross != null || net != null) {
        const direction = side === 'SHORT' ? -1 : 1;
        const move =
          entryPrice != null && exitPrice != null && quantity != null && quantity > 0
            ? (exitPrice - entryPrice) * quantity * direction
            : null;
        if (move == null || multiplier == null) {
          const fit = fitReported((gross ?? net) as number, move, fees ?? 0, gross == null);
          multiplier = multiplier ?? fit.multiplier;
          manualPnl = fit.manualPnl;
        }
      } else if (multiplier == null && entryPrice != null) {
        multiplier = knownMultiplier(symbol, row);
      }

      // ---- skip anything already imported --------------------------------
      const buyFill = cell(row, 'buy_fill_id');
      const sellFill = cell(row, 'sell_fill_id');
      const externalId = buyFill || sellFill ? `${buyFill}:${sellFill}` : cell(row, 'external_id') || undefined;
      if (externalId && seenIds.has(externalId)) {
        duplicates += 1;
        return;
      }
      if (externalId) seenIds.add(externalId);

      const openedAt = openedParts?.value ?? '';
      const input: TradeInput = {
        accountId: accountIdFor(textCell(row, 'account')),
        symbol,
        side: side ?? 'LONG',
        openedAt,
        closedAt: closedParts?.value,
        quantity: quantity ?? 0,
        entryPrice: entryPrice ?? 0,
        exitPrice,
        stopLoss: parseMoney(cell(row, 'stop_loss')),
        takeProfit: parseMoney(cell(row, 'take_profit')),
        fees: fees ?? 0,
        multiplier: multiplier ?? 1,
        manualPnl,
        leverage: parseMoney(cell(row, 'leverage')),
        session: textCell(row, 'session') || (openedAt ? detectSession(openedAt) : undefined),
        setupId: setupIdFor(textCell(row, 'setup')),
        tags: tagsOf(row),
        notes: textCell(row, 'notes') || undefined,
        excluded: false,
        externalId,
      };

      const trade: Trade = { ...input, id: uid(), createdAt: now, updatedAt: now };
      trade.needsReview = isIncomplete(trade) || undefined;

      // the fill that opened the position is the buy on a long and the sell on a short
      const opener = trade.side === 'LONG' ? buyFill : sellFill;
      if (opener) openingFill.set(trade.id, opener);

      trades.push(trade);
    });

    if (!has('side') && !paired && trades.length) {
      errors.push('There is no direction column, so every row was imported as LONG. Check any shorts.');
    }
  }

  // ======================================================================
  // one row per fill: put the positions back together
  // ======================================================================
  if (rowKind === 'fills') {
    const fills: Fill[] = [];
    const meta = new Map<number, { row: string[]; symbol: string; accountId: string }>();
    const notTrades = new Map<string, number>();
    let unfilled = 0;
    const noQuantity: number[] = [];
    const noPrice: number[] = [];
    const seenFills = new Set<string>();
    const net = !has('gross_pnl') && !has('pnl') && has('net_pnl');

    table.data.forEach((row, index) => {
      const line = table.lines[index];
      if (has('status') && parseStatus(cell(row, 'status')) === 'unfilled') {
        unfilled++;
        return;
      }
      const symbol = symbolOf(row);
      const rawQuantity = parseMoney(cell(row, 'quantity'));
      if (!has('side') && !rawQuantity) {
        // the sign of the quantity is the direction, and there is none
        noQuantity.push(line);
        return;
      }
      let action = has('side') ? parseAction(cell(row, 'side')) : { side: (rawQuantity as number) < 0 ? ('SELL' as const) : ('BUY' as const) };
      if (!action) {
        // deposits, dividends, balance lines: not trades
        const what = cell(row, 'side') || 'blank';
        notTrades.set(what, (notTrades.get(what) ?? 0) + 1);
        return;
      }
      if (!symbol) {
        noSymbol.push(line);
        return;
      }
      const effect = parseEffect(cell(row, 'effect')) ?? action.effect;
      action = { ...action, effect: effect ?? undefined };
      const quantity = rawQuantity == null ? null : Math.abs(rawQuantity);
      if (!quantity) {
        noQuantity.push(line);
        return;
      }
      const price = parseMoney(cell(row, 'price')) ?? parseMoney(cell(row, 'entry_price'));
      if (price == null) {
        noPrice.push(line);
        return;
      }
      const id = cell(row, 'external_id') || undefined;
      if (id) {
        // the same execution listed twice
        if (seenFills.has(id)) {
          duplicates++;
          return;
        }
        seenFills.add(id);
      }
      const accountId = accountIdFor(textCell(row, 'account'));
      const reported = parseMoney(cell(row, net ? 'net_pnl' : has('gross_pnl') ? 'gross_pnl' : 'pnl'));
      fills.push({
        line,
        key: `${accountId}|${symbol}`,
        side: action.side,
        quantity,
        price,
        time: moment(row, 'time', 'date') ?? moment(row, 'opened_at', 'opened_date'),
        fees: feeOf(row) ?? 0,
        pnl: reported,
        id,
        effect: action.effect,
        tradeNo: cell(row, 'trade_no') || undefined,
      });
      meta.set(line, { row, symbol, accountId });
    });

    const positions = fillsToPositions(fills);
    let open = 0;
    let orphans = 0;
    let overlapping = 0;

    for (const s of positions.flatMap(summarise)) {
      const first = meta.get(s.firstLine);
      if (!first) continue;
      const rows = s.lines.map((l) => meta.get(l)?.row).filter((r): r is string[] => Boolean(r));

      // already imported: every fill of it is in the journal
      if (s.ids.length && s.ids.every((id) => existingIds.has(id))) {
        duplicates++;
        continue;
      }
      if (s.ids.some((id) => existingIds.has(id))) overlapping++;

      // ---- what one point is worth -----------------------------------
      const fillWorth = (row: string[]) => {
        const notional = parseMoney(cell(row, 'notional'));
        const q = Math.abs(parseMoney(cell(row, 'quantity')) ?? 0);
        const p = parseMoney(cell(row, 'price')) ?? parseMoney(cell(row, 'entry_price'));
        return notional && q && p ? believable(Math.abs(notional) / (q * p)) : null;
      };
      let multiplier = s.lines.map((l) => { const m = meta.get(l); return m ? multiplierCell(m.row, l) : null; }).find((m) => m != null) ?? null;
      if (multiplier == null) {
        const worth = [...new Set(rows.map(fillWorth))];
        if (worth.length === 1 && worth[0] != null) {
          multiplier = worth[0];
          if (multiplier !== 1) inferred.set(first.symbol, `${multiplier} (from the amount against the price)`);
        }
      }
      let manualPnl: number | null = null;
      if (multiplier == null && s.reportedPnl != null && s.closed && !s.orphan) {
        const fit = fitReported(s.reportedPnl, s.move, s.fees, net);
        multiplier = fit.multiplier;
        manualPnl = fit.manualPnl;
      }
      if (multiplier == null) multiplier = knownMultiplier(first.symbol, first.row) ?? 1;

      // averages rounded to the precision of the prices, and the exact P&L
      // kept as written when the rounded averages cannot reproduce it
      const round = (v: number | null, prices: number[]) => (v == null ? null : Number(v.toFixed(decimalsOf(prices))));
      const entryPrice = round(s.entryPrice, s.entryPrices);
      const exitPrice = round(s.exitPrice, s.exitPrices);
      const direction = s.side === 'LONG' ? 1 : -1;
      if (s.orphan) {
        orphans++;
        if (s.reportedPnl != null) manualPnl = net ? s.reportedPnl + s.fees : s.reportedPnl;
      } else if (manualPnl == null && s.closed && s.move != null && entryPrice != null && exitPrice != null) {
        const exact = s.move * multiplier;
        if (Math.abs((exitPrice - entryPrice) * s.quantity * direction * multiplier - exact) >= 0.005) manualPnl = exact;
      }
      if (!s.closed) open++;

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
        session: textCell(first.row, 'session') || (openedAt ? detectSession(openedAt) : undefined),
        setupId: setupIdFor(textCell(first.row, 'setup')),
        tags: [...new Set(rows.flatMap(tagsOf))],
        // a broker's description column describes the instrument, not the trade
        notes: (at('notes') != null && plan.columns[at('notes') as number].header.toLowerCase() !== 'description' ? textCell(first.row, 'notes') : '') || undefined,
        excluded: false,
        externalId: s.ids.length ? s.ids.join('|') : undefined,
        fillCount: s.fillCount,
      };
      const trade: Trade = { ...input, id: uid(), createdAt: now, updatedAt: now };
      trade.needsReview = isIncomplete(trade) || undefined;
      trades.push(trade);
    }

    notices.push(
      `Each row is one fill: ${fills.length} ${fills.length === 1 ? 'fill was' : 'fills were'} put back together into ${trades.length} ${trades.length === 1 ? 'trade' : 'trades'}, following the position in each symbol.`,
    );
    if (unfilled) notices.push(`${unfilled} ${unfilled === 1 ? 'order that was' : 'orders that were'} cancelled or never filled ${unfilled === 1 ? 'was' : 'were'} left out.`);
    if (notTrades.size) {
      const total = [...notTrades.values()].reduce((a, b) => a + b, 0);
      const examples = [...notTrades.keys()].slice(0, 3).map((v) => `"${v}"`).join(', ');
      notices.push(`${total} ${total === 1 ? 'row is' : 'rows are'} not a buy or a sell (${examples}), so ${total === 1 ? 'it was' : 'they were'} left out.`);
    }
    if (noQuantity.length) errors.push(rowsNote(noQuantity, 'no quantity, so the fill was left out.', 'no quantity, so they were left out.'));
    if (noPrice.length) errors.push(rowsNote(noPrice, 'no price, so the fill was left out.', 'no price, so they were left out.'));
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
  }

  // ---- what to check, and how the file was read ------------------------------
  if (noSymbol.length) errors.unshift(rowsNote(noSymbol, 'no symbol, so the row was skipped.', 'no symbol, so they were skipped.'));
  for (const [value, rowsWith] of unknownSides) {
    const many = rowsWith.length > 1;
    errors.push(
      `${rowsLabel(rowsWith)}: the direction "${value}" was not recognised, so ${many ? 'they were' : 'it was'} imported as LONG. Check ${many ? 'them' : 'it'}.`,
    );
  }
  if (badMultipliers.rows.length) {
    const many = badMultipliers.rows.length > 1;
    errors.push(
      `${rowsLabel(badMultipliers.rows)}: the multiplier "${badMultipliers.value}" has to be more than 0, so it was left out. Check ${many ? 'them' : 'it'}.`,
    );
  }
  if (foreignFees.size) {
    errors.push(`Fees paid in ${[...foreignFees].join(', ')} were left out: they are not in the currency of the prices.`);
  }
  for (const [symbol, how] of inferred) {
    notices.push(`${symbol}: one point taken as worth ${how}. Check it if that is not right.`);
  }
  if (table.statement) notices.push('Read the Trades section of this Interactive Brokers statement.');
  else if (table.preamble) notices.push(`The column names are on line ${table.preamble + 1}; the lines above them were left out.`);
  if (table.skipped) notices.push(`${table.skipped} total, summary or repeated header ${table.skipped === 1 ? 'line was' : 'lines were'} left out.`);
  if (zoned) notices.push("Times in this file carry a time zone, so they were converted to this device's local time.");

  // ---- put scaled-out positions back together ------------------------------
  let finalTrades = trades;
  let combined = 0;

  if (ctx.combinePartials !== false && openingFill.size > 0) {
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

    const merged: Trade[] = [];
    for (const group of groups.values()) {
      if (group.length > 1 && mergeIssue(group) === null) {
        merged.push(mergeTrades(group));
        combined += group.length;
      } else {
        merged.push(...group);
      }
    }
    finalTrades = [...merged, ...loose];
  }

  return {
    trades: finalTrades,
    newSetups,
    errors,
    notices,
    duplicates,
    incomplete: finalTrades.filter((t) => t.needsReview).length,
    pairedFills: paired,
    combined,
    recognised,
    ignored,
    layout,
  };
}

/** Human-readable list of what a row still needs, for the import preview */
export function describeGaps(trade: Trade): string {
  const gaps = missingDetails(trade);
  if (!gaps.length) return '';
  return `needs ${gaps.join(', ')}`;
}
