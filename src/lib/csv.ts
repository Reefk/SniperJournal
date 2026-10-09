import type { Account, Setup, Trade, TradeInput } from './types';
import { detectSession } from './sessions';
import { grossPnl, isClosed, isIncomplete, missingDetails, netPnl, rMultiple } from './trade-math';
import { mergeIssue, mergeTrades } from './merge';
import { pad2, parseDecimal, uid } from './utils';

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

/**
 * Header aliases. Headers are lower-cased with spaces, dots, dashes and
 * underscores stripped before lookup, so `_tickSize` arrives as `ticksize`
 * and `Bought Timestamp` as `boughttimestamp`.
 */
const ALIASES: Record<string, string> = {
  symbol: 'symbol',
  ticker: 'symbol',
  pair: 'symbol',
  instrument: 'symbol',
  asset: 'symbol',
  market: 'symbol',
  contract: 'symbol',
  side: 'side',
  direction: 'side',
  type: 'side',
  action: 'side',
  buysell: 'side',
  position: 'side',

  openedat: 'opened_at',
  opentime: 'opened_at',
  entrytime: 'opened_at',
  entrydate: 'opened_at',
  date: 'opened_at',
  datetime: 'opened_at',
  time: 'opened_at',
  opendate: 'opened_at',
  entrytimestamp: 'opened_at',
  closedat: 'closed_at',
  closetime: 'closed_at',
  exittime: 'closed_at',
  exitdate: 'closed_at',
  closedate: 'closed_at',
  exittimestamp: 'closed_at',

  quantity: 'quantity',
  qty: 'quantity',
  size: 'quantity',
  volume: 'quantity',
  shares: 'quantity',
  contracts: 'quantity',
  lots: 'quantity',
  filledqty: 'quantity',

  entryprice: 'entry_price',
  entry: 'entry_price',
  openprice: 'entry_price',
  priceopen: 'entry_price',
  avgentryprice: 'entry_price',
  exitprice: 'exit_price',
  exit: 'exit_price',
  closeprice: 'exit_price',
  priceclose: 'exit_price',
  avgexitprice: 'exit_price',

  // paired buy/sell fill exports (Tradovate, NinjaTrader and similar)
  buyprice: 'buy_price',
  sellprice: 'sell_price',
  avgbuyprice: 'buy_price',
  avgsellprice: 'sell_price',
  boughttimestamp: 'bought_at',
  soldtimestamp: 'sold_at',
  buytimestamp: 'bought_at',
  selltimestamp: 'sold_at',
  buytime: 'bought_at',
  selltime: 'sold_at',
  buyfillid: 'buy_fill_id',
  sellfillid: 'sell_fill_id',
  ticksize: 'tick_size',

  stoploss: 'stop_loss',
  stop: 'stop_loss',
  sl: 'stop_loss',
  takeprofit: 'take_profit',
  target: 'take_profit',
  tp: 'take_profit',
  fees: 'fees',
  fee: 'fees',
  commission: 'fees',
  commissions: 'fees',
  cost: 'fees',
  charges: 'fees',
  multiplier: 'multiplier',
  contractsize: 'multiplier',
  pointvalue: 'multiplier',
  leverage: 'leverage',
  lev: 'leverage',
  session: 'session',
  marketsession: 'session',
  setup: 'setup',
  strategy: 'setup',
  playbook: 'setup',
  system: 'setup',
  tags: 'tags',
  tag: 'tags',
  labels: 'tags',
  notes: 'notes',
  note: 'notes',
  comment: 'notes',
  comments: 'notes',
  description: 'notes',
  account: 'account',
  portfolio: 'account',

  // a P&L column that does not say is taken as gross, before commissions;
  // one that says "net" already has them taken off
  pnl: 'pnl',
  profit: 'pnl',
  netpnl: 'net_pnl',
  netprofit: 'net_pnl',
  netprofitloss: 'net_pnl',
  realizedpnl: 'pnl',
  grosspnl: 'gross_pnl',
  grossprofit: 'gross_pnl',
  'profit/loss': 'pnl',
  profitloss: 'pnl',
  result: 'pnl',
  gain: 'pnl',

  id: 'external_id',
  tradeid: 'external_id',
  orderid: 'external_id',
  positionid: 'external_id',
  duration: 'duration',
};

const normalizeHeader = (h: string) =>
  ALIASES[
    h
      .trim()
      .toLowerCase()
      .replace(/[\s._\-/]/g, '')
  ] ?? '';

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

/** RFC-ish CSV parser: quotes, embedded newlines, comma or semicolon */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const firstLine = clean.slice(0, clean.indexOf('\n') === -1 ? clean.length : clean.indexOf('\n'));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    // a quote only opens a quoted field at its start; one in the middle of an
    // unquoted field (12" monitor) is just a character, and must not swallow
    // every delimiter and line after it
    if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Tolerant number parsing: $1,234.50 / (120) / 1.234,50 / 1,08640 / -$80 */
function parseMoney(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$€£₪¥\s]/g, '');
  if (/^-/.test(s)) {
    negative = true;
    s = s.slice(1);
  }
  const n = parseDecimal(s);
  if (n == null) return null;
  return negative ? -n : n;
}

/**
 * Accepts ISO, US and European dates, with or without a time and seconds.
 * Returns the minute-precision value the journal stores plus a
 * second-precision key, which is what decides which fill came first.
 */
/** day-month or month-day, decided once for a whole file (see dateOrderOf) */
type DateOrder = 'dmy' | 'mdy';

const ISO_DATE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(AM|PM|am|pm)?/;
const SLASH_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(AM|PM|am|pm)?/;

/**
 * Builds the stored value from parts, or null when they do not make a real
 * moment: month 13, 30 February and 25:61 are refused rather than stored.
 */
function fromParts(
  year: number,
  month: number,
  day: number,
  hourRaw: string | undefined,
  minuteRaw: string | undefined,
  secondRaw: string | undefined,
  meridiemRaw: string | undefined,
): { value: string; sortKey: string } | null {
  let hour = Number(hourRaw ?? 0);
  const minute = Number(minuteRaw ?? 0);
  const second = Number(secondRaw ?? 0);
  const meridiem = meridiemRaw?.toUpperCase();
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const date = `${year}-${pad2(month)}-${pad2(day)}`;
  const hm = `${pad2(hour)}:${pad2(minute)}`;
  return { value: `${date}T${hm}`, sortKey: `${date}T${hm}:${pad2(second)}` };
}

function parseDateTimeParts(raw: string, order?: DateOrder): { value: string; sortKey: string } | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = s.match(ISO_DATE);
  if (iso) return fromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]), iso[4], iso[5], iso[6], iso[7]);

  const dmy = s.match(SLASH_DATE);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    // the file's own order when it is known; otherwise a value above 12 in
    // the first slot can only be the day, and month-first is the default
    // most broker exports use
    const dayFirst = order ? order === 'dmy' : a > 12;
    const [day, month] = dayFirst ? [a, b] : [b, a];
    return fromParts(Number(dmy[3]), month, day, dmy[4], dmy[5], dmy[6], dmy[7]);
  }

  const fallback = new Date(s);
  if (Number.isNaN(fallback.getTime())) return null;
  const day = `${fallback.getFullYear()}-${pad2(fallback.getMonth() + 1)}-${pad2(fallback.getDate())}`;
  const hh = pad2(fallback.getHours());
  const mm = pad2(fallback.getMinutes());
  return { value: `${day}T${hh}:${mm}`, sortKey: `${day}T${hh}:${mm}:${pad2(fallback.getSeconds())}` };
}

/**
 * One file is read with one date order. 03/04 on its own could be either, so
 * if any date in the file has a day above 12 in the first slot, every date in
 * it is day-first; above 12 in the second slot, month-first. Mixed or no
 * evidence leaves each date to the per-date rule.
 */
function dateOrderOf(values: string[]): DateOrder | undefined {
  let dayFirst = false;
  let monthFirst = false;
  for (const v of values) {
    const m = v.trim().match(SLASH_DATE);
    if (!m) continue;
    if (Number(m[1]) > 12) dayFirst = true;
    if (Number(m[2]) > 12) monthFirst = true;
  }
  if (dayFirst && !monthFirst) return 'dmy';
  if (monthFirst && !dayFirst) return 'mdy';
  return undefined;
}

function parseSide(raw: string): 'LONG' | 'SHORT' | null {
  const s = raw.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (!s) return null;
  if (['long', 'buy', 'b', 'bought', 'l', '1', 'buy long', 'long buy', 'buy to open'].includes(s)) return 'LONG';
  if (['short', 'sell', 's', 'sold', 'sht', '-1', 'sell short', 'short sell', 'sellshort', 'ss', 'sell to open'].includes(s))
    return 'SHORT';
  return null;
}

export interface ImportResult {
  trades: Trade[];
  newSetups: Setup[];
  errors: string[];
  /** rows already in the journal, matched on the broker's fill ids */
  duplicates: number;
  /** imported, but still missing something the statistics need */
  incomplete: number;
  /** true when the file pairs a buy fill with a sell fill instead of naming a side */
  pairedFills: boolean;
  /** how many rows were folded into a larger position because they shared an entry fill */
  combined: number;
  recognised: string[];
  ignored: string[];
}

/**
 * Reads a CSV into trades. Only a symbol column is genuinely required:
 * anything else that is missing is left blank for you to fill in afterwards,
 * and the trade is flagged so it stays out of the statistics until you do.
 */
export function importTradesFromCsv(
  text: string,
  ctx: { accountId: string; accounts: Account[]; setups: Setup[]; existing?: Trade[]; combinePartials?: boolean },
): ImportResult {
  const empty: ImportResult = {
    trades: [],
    newSetups: [],
    errors: [],
    duplicates: 0,
    incomplete: 0,
    pairedFills: false,
    combined: 0,
    recognised: [],
    ignored: [],
  };

  const rows = parseCsv(text);
  if (rows.length < 2) return { ...empty, errors: ['The file has no data rows.'] };

  const rawHeaders = rows[0];
  const headers = rawHeaders.map(normalizeHeader);
  const recognised = [...new Set(headers.filter(Boolean))];
  const ignored = rawHeaders
    .filter((_, i) => !headers[i])
    .map((h) => h.trim())
    .filter(Boolean);

  if (!headers.includes('symbol')) {
    return {
      ...empty,
      recognised,
      ignored,
      errors: [`No symbol column found. The columns in this file are: ${rawHeaders.join(', ')}.`],
    };
  }

  const has = (name: string) => headers.includes(name);
  const pairedFills = has('buy_price') && has('sell_price');

  const col = (row: string[], name: string): string => {
    const i = headers.indexOf(name);
    return i === -1 ? '' : (row[i] ?? '').trim();
  };
  // free text: a value tradesToCsv escaped against spreadsheet formulas comes back as typed
  const textCol = (row: string[], name: string) => unescapeFormula(col(row, name));
  // one date order for the whole file, from every date in it
  const order = dateOrderOf(
    rows.slice(1).flatMap((row) => ['opened_at', 'closed_at', 'bought_at', 'sold_at'].map((c) => col(row, c))),
  );
  const date = (row: string[], name: string) => parseDateTimeParts(col(row, name), order);
  /** direction values that meant nothing to parseSide: value -> first row and count */
  const unknownSides = new Map<string, { row: number; count: number }>();
  /** multipliers of zero or less, which the trade form refuses: first row, its value and count */
  let badMultiplier: { row: number; value: string; count: number } | null = null;

  const now = new Date().toISOString();
  const setupsByName = new Map(ctx.setups.map((s) => [s.name.toLowerCase(), s]));
  const accountsByName = new Map(ctx.accounts.map((a) => [a.name.toLowerCase(), a]));
  const seenIds = new Set((ctx.existing ?? []).flatMap((t) => (t.externalId ? t.externalId.split('|') : [])));

  const errors: string[] = [];
  const newSetups: Setup[] = [];
  const trades: Trade[] = [];
  /** trade id -> the fill that opened the position, used to regroup partial exits */
  const openingFill = new Map<string, string>();
  let duplicates = 0;

  rows.slice(1).forEach((row, index) => {
    const line = index + 2;
    const symbol = textCol(row, 'symbol').toUpperCase();
    if (!symbol) {
      errors.push(`Row ${line}: no symbol, so the row was skipped.`);
      return;
    }

    // ---- direction, times and prices -------------------------------------
    const rawSide = col(row, 'side');
    let side = parseSide(rawSide);
    if (rawSide && !side) {
      const seen = unknownSides.get(rawSide);
      unknownSides.set(rawSide, seen ? { ...seen, count: seen.count + 1 } : { row: line, count: 1 });
    }
    let openedParts = date(row, 'opened_at');
    let closedParts = date(row, 'closed_at');
    let entryPrice = parseMoney(col(row, 'entry_price'));
    let exitPrice = parseMoney(col(row, 'exit_price'));

    if (pairedFills) {
      const buyPrice = parseMoney(col(row, 'buy_price'));
      const sellPrice = parseMoney(col(row, 'sell_price'));
      const boughtParts = date(row, 'bought_at');
      const soldParts = date(row, 'sold_at');

      // whichever fill happened first is the one that opened the position
      const soldFirst = boughtParts && soldParts ? soldParts.sortKey < boughtParts.sortKey : false;
      side = side ?? (soldFirst ? 'SHORT' : 'LONG');

      openedParts = openedParts ?? (soldFirst ? soldParts : boughtParts);
      closedParts = closedParts ?? (soldFirst ? boughtParts : soldParts);
      entryPrice = entryPrice ?? (soldFirst ? sellPrice : buyPrice);
      exitPrice = exitPrice ?? (soldFirst ? buyPrice : sellPrice);
    }

    const quantity = parseMoney(col(row, 'quantity'));
    const fees = parseMoney(col(row, 'fees'));
    // The P&L before commissions. A net column has them added back, so they
    // are not charged a second time through the fees column.
    const netReported = parseMoney(col(row, 'net_pnl'));
    const reportedPnl =
      parseMoney(col(row, 'gross_pnl')) ??
      parseMoney(col(row, 'pnl')) ??
      (netReported != null ? netReported + (fees ?? 0) : null);

    // ---- contract multiplier ---------------------------------------------
    // When the file reports a P&L we can work out what one point is worth,
    // which keeps the prices and the P&L consistent if either is edited later.
    let multiplier = parseMoney(col(row, 'multiplier'));
    if (multiplier != null && multiplier <= 0) {
      // a negative one would turn every win into a loss; leave it out and say so
      badMultiplier = badMultiplier
        ? { ...badMultiplier, count: badMultiplier.count + 1 }
        : { row: line, value: col(row, 'multiplier'), count: 1 };
      multiplier = null;
    }
    let manualPnl: number | null = null;

    if (reportedPnl != null) {
      const direction = side === 'SHORT' ? -1 : 1;
      const move =
        entryPrice != null && exitPrice != null && quantity != null && quantity > 0
          ? (exitPrice - entryPrice) * quantity * direction
          : null;

      if (move == null) {
        // no prices to check it against: the reported figure is the result
        manualPnl = reportedPnl;
      } else if (multiplier == null && Math.abs(move) > 1e-9) {
        const derived = reportedPnl / move;
        const snapped =
          Math.abs(derived - Math.round(derived)) < 0.005 ? Math.round(derived) : Number(derived.toFixed(4));
        if (snapped > 0 && Math.abs(move * snapped - reportedPnl) < 0.01) multiplier = snapped;
        else manualPnl = reportedPnl;
      } else if (multiplier == null) {
        manualPnl = reportedPnl;
      }
    }

    // ---- playbook setup and account --------------------------------------
    const setupName = textCol(row, 'setup');
    let setupId: string | undefined;
    if (setupName) {
      const key = setupName.toLowerCase();
      let setup = setupsByName.get(key);
      if (!setup) {
        setup = { id: uid(), name: setupName, rules: [], description: 'Created during a CSV import.' };
        setupsByName.set(key, setup);
        newSetups.push(setup);
      }
      setupId = setup.id;
    }

    const accountName = textCol(row, 'account');
    const accountId = (accountName && accountsByName.get(accountName.toLowerCase())?.id) || ctx.accountId;

    // ---- skip anything already imported ----------------------------------
    const buyFill = col(row, 'buy_fill_id');
    const sellFill = col(row, 'sell_fill_id');
    const externalId = buyFill || sellFill ? `${buyFill}:${sellFill}` : col(row, 'external_id') || undefined;
    if (externalId && seenIds.has(externalId)) {
      duplicates += 1;
      return;
    }
    if (externalId) seenIds.add(externalId);

    const openedAt = openedParts?.value ?? '';

    const input: TradeInput = {
      accountId,
      symbol,
      side: side ?? 'LONG',
      openedAt,
      closedAt: closedParts?.value,
      quantity: quantity ?? 0,
      entryPrice: entryPrice ?? 0,
      exitPrice,
      stopLoss: parseMoney(col(row, 'stop_loss')),
      takeProfit: parseMoney(col(row, 'take_profit')),
      fees: fees ?? 0,
      multiplier: multiplier ?? 1,
      manualPnl,
      leverage: parseMoney(col(row, 'leverage')),
      session: textCol(row, 'session') || (openedAt ? detectSession(openedAt) : undefined),
      setupId,
      tags: textCol(row, 'tags')
        .split(/[|;]/)
        .map((t) => t.trim())
        .filter(Boolean),
      notes: textCol(row, 'notes') || undefined,
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

  // ---- say where the direction was assumed ------------------------------
  // a short read as a long has its P&L the wrong way round, so never guess quietly
  for (const [value, { row, count }] of unknownSides) {
    const more = count > 1 ? ` and ${count - 1} more` : '';
    errors.push(
      `Row ${row}${more}: the direction "${value}" was not recognised, so ${count > 1 ? 'they were' : 'it was'} imported as LONG. Check ${count > 1 ? 'them' : 'it'}.`,
    );
  }
  if (badMultiplier) {
    const { row, value, count } = badMultiplier;
    errors.push(
      `Row ${row}${count > 1 ? ` and ${count - 1} more` : ''}: the multiplier "${value}" has to be more than 0, so it was left out. Check ${count > 1 ? 'them' : 'it'}.`,
    );
  }
  if (!has('side') && !pairedFills && trades.length) {
    errors.push('There is no direction column, so every row was imported as LONG. Check any shorts.');
  }

  // ---- put scaled-out positions back together ---------------------------
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
    duplicates,
    incomplete: finalTrades.filter((t) => t.needsReview).length,
    pairedFills,
    combined,
    recognised,
    ignored,
  };
}

/** Human-readable list of what a row still needs, for the import preview */
export function describeGaps(trade: Trade): string {
  const gaps = missingDetails(trade);
  if (!gaps.length) return '';
  return `needs ${gaps.join(', ')}`;
}
