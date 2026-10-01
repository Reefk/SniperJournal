import type { Account, Setup, Trade, TradeInput } from './types';
import { detectSession } from './sessions';
import { grossPnl, isClosed, isIncomplete, missingDetails, netPnl, rMultiple } from './trade-math';
import { mergeIssue, mergeTrades } from './merge';
import { pad2, toNumberOrNull, uid } from './utils';

export const CSV_COLUMNS = [
  'symbol', 'side', 'opened_at', 'closed_at', 'quantity', 'entry_price', 'exit_price',
  'stop_loss', 'take_profit', 'fees', 'multiplier', 'leverage', 'session', 'setup', 'tags', 'notes', 'account',
] as const;

/**
 * Header aliases. Headers are lower-cased with spaces, dots, dashes and
 * underscores stripped before lookup, so `_tickSize` arrives as `ticksize`
 * and `Bought Timestamp` as `boughttimestamp`.
 */
const ALIASES: Record<string, string> = {
  symbol: 'symbol', ticker: 'symbol', pair: 'symbol', instrument: 'symbol', asset: 'symbol', market: 'symbol', contract: 'symbol',
  side: 'side', direction: 'side', type: 'side', action: 'side', buysell: 'side', position: 'side',

  openedat: 'opened_at', opentime: 'opened_at', entrytime: 'opened_at', entrydate: 'opened_at', date: 'opened_at',
  datetime: 'opened_at', time: 'opened_at', opendate: 'opened_at', entrytimestamp: 'opened_at',
  closedat: 'closed_at', closetime: 'closed_at', exittime: 'closed_at', exitdate: 'closed_at', closedate: 'closed_at',
  exittimestamp: 'closed_at',

  quantity: 'quantity', qty: 'quantity', size: 'quantity', volume: 'quantity', shares: 'quantity',
  contracts: 'quantity', lots: 'quantity', filledqty: 'quantity',

  entryprice: 'entry_price', entry: 'entry_price', openprice: 'entry_price', priceopen: 'entry_price', avgentryprice: 'entry_price',
  exitprice: 'exit_price', exit: 'exit_price', closeprice: 'exit_price', priceclose: 'exit_price', avgexitprice: 'exit_price',

  // paired buy/sell fill exports (Tradovate, NinjaTrader and similar)
  buyprice: 'buy_price', sellprice: 'sell_price', avgbuyprice: 'buy_price', avgsellprice: 'sell_price',
  boughttimestamp: 'bought_at', soldtimestamp: 'sold_at',
  buytimestamp: 'bought_at', selltimestamp: 'sold_at',
  buytime: 'bought_at', selltime: 'sold_at',
  buyfillid: 'buy_fill_id', sellfillid: 'sell_fill_id',
  ticksize: 'tick_size',

  stoploss: 'stop_loss', stop: 'stop_loss', sl: 'stop_loss',
  takeprofit: 'take_profit', target: 'take_profit', tp: 'take_profit',
  fees: 'fees', fee: 'fees', commission: 'fees', commissions: 'fees', cost: 'fees', charges: 'fees',
  multiplier: 'multiplier', contractsize: 'multiplier', pointvalue: 'multiplier',
  leverage: 'leverage', lev: 'leverage',
  session: 'session', marketsession: 'session',
  setup: 'setup', strategy: 'setup', playbook: 'setup', system: 'setup',
  tags: 'tags', tag: 'tags', labels: 'tags',
  notes: 'notes', note: 'notes', comment: 'notes', comments: 'notes', description: 'notes',
  account: 'account', portfolio: 'account',

  pnl: 'pnl', profit: 'pnl', netpnl: 'pnl', realizedpnl: 'pnl', grosspnl: 'pnl',
  'profit/loss': 'pnl', profitloss: 'pnl', result: 'pnl', gain: 'pnl',

  id: 'external_id', tradeid: 'external_id', orderid: 'external_id', positionid: 'external_id',
  duration: 'duration',
};

const normalizeHeader = (h: string) => ALIASES[h.trim().toLowerCase().replace(/[\s._\-/]/g, '')] ?? '';

export function csvTemplate(): string {
  const today = new Date();
  const day = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  return [
    CSV_COLUMNS.join(','),
    `AAPL,LONG,${day} 09:35,${day} 10:12,100,187.40,189.10,186.20,190.00,1.30,1,,New York,Opening Range Breakout,breakout|planned,Took the first pullback,Main Portfolio`,
    `EURUSD,SHORT,${day} 11:05,${day} 11:48,10000,1.08640,1.08410,1.08790,1.08200,0.40,1,10,London,VWAP Reclaim,fx,Clean rejection at the session high,Main Portfolio`,
  ].join('\n');
}

export function tradesToCsv(trades: Trade[], setups: Setup[], accounts: Account[]): string {
  const setupNames = new Map(setups.map((s) => [s.id, s.name]));
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [...CSV_COLUMNS, 'gross_pnl', 'net_pnl', 'r_multiple'];
  const rows = trades.map((t) =>
    [
      t.symbol, t.side, t.openedAt.replace('T', ' '), t.closedAt?.replace('T', ' ') ?? '',
      t.quantity, t.entryPrice, t.exitPrice ?? '', t.stopLoss ?? '', t.takeProfit ?? '',
      t.fees ?? 0, t.multiplier ?? 1, t.leverage ?? '', t.session ?? '',
      t.setupId ? setupNames.get(t.setupId) ?? '' : '', t.tags.join('|'), t.notes ?? '',
      accountNames.get(t.accountId) ?? '',
      isClosed(t) ? grossPnl(t).toFixed(2) : '',
      isClosed(t) ? netPnl(t).toFixed(2) : '',
      rMultiple(t)?.toFixed(2) ?? '',
    ].map(esc).join(','),
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
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Tolerant number parsing: $1,234.50 / (120) / 1.234,50 / -$80 */
function parseMoney(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/[$€£₪¥\s]/g, '');
  if (/^-/.test(s)) { negative = true; s = s.slice(1); }
  if (/,\d{1,2}$/.test(s) && !/\.\d/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/**
 * Accepts ISO, US and European dates, with or without a time and seconds.
 * Returns the minute-precision value the journal stores plus a
 * second-precision key, which is what decides which fill came first.
 */
function parseDateTimeParts(raw: string): { value: string; sortKey: string } | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const day = `${iso[1]}-${pad2(Number(iso[2]))}-${pad2(Number(iso[3]))}`;
    const hh = pad2(Number(iso[4] ?? 0));
    const mm = pad2(Number(iso[5] ?? 0));
    return { value: `${day}T${hh}:${mm}`, sortKey: `${day}T${hh}:${mm}:${pad2(Number(iso[6] ?? 0))}` };
  }

  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(AM|PM|am|pm)?/);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    // a value above 12 in the first slot can only be the day; otherwise
    // assume the month-first order most broker exports use
    const [day, month] = a > 12 ? [a, b] : [b, a];
    let hour = Number(dmy[4] ?? 0);
    const meridiem = dmy[7]?.toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    const date = `${dmy[3]}-${pad2(month)}-${pad2(day)}`;
    const hh = pad2(hour);
    const mm = pad2(Number(dmy[5] ?? 0));
    return { value: `${date}T${hh}:${mm}`, sortKey: `${date}T${hh}:${mm}:${pad2(Number(dmy[6] ?? 0))}` };
  }

  const fallback = new Date(s);
  if (Number.isNaN(fallback.getTime())) return null;
  const day = `${fallback.getFullYear()}-${pad2(fallback.getMonth() + 1)}-${pad2(fallback.getDate())}`;
  const hh = pad2(fallback.getHours());
  const mm = pad2(fallback.getMinutes());
  return { value: `${day}T${hh}:${mm}`, sortKey: `${day}T${hh}:${mm}:${pad2(fallback.getSeconds())}` };
}

function parseSide(raw: string): 'LONG' | 'SHORT' | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (['long', 'buy', 'b', 'bought', 'l', '1'].includes(s)) return 'LONG';
  if (['short', 'sell', 's', 'sold', 'sht', '-1'].includes(s)) return 'SHORT';
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
    trades: [], newSetups: [], errors: [], duplicates: 0, incomplete: 0,
    pairedFills: false, combined: 0, recognised: [], ignored: [],
  };

  const rows = parseCsv(text);
  if (rows.length < 2) return { ...empty, errors: ['The file has no data rows.'] };

  const rawHeaders = rows[0];
  const headers = rawHeaders.map(normalizeHeader);
  const recognised = [...new Set(headers.filter(Boolean))];
  const ignored = rawHeaders.filter((_, i) => !headers[i]).map((h) => h.trim()).filter(Boolean);

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

  const now = new Date().toISOString();
  const setupsByName = new Map(ctx.setups.map((s) => [s.name.toLowerCase(), s]));
  const accountsByName = new Map(ctx.accounts.map((a) => [a.name.toLowerCase(), a]));
  const seenIds = new Set(
    (ctx.existing ?? []).flatMap((t) => (t.externalId ? t.externalId.split('|') : [])),
  );

  const errors: string[] = [];
  const newSetups: Setup[] = [];
  const trades: Trade[] = [];
  /** trade id -> the fill that opened the position, used to regroup partial exits */
  const openingFill = new Map<string, string>();
  let duplicates = 0;

  rows.slice(1).forEach((row, index) => {
    const line = index + 2;
    const symbol = col(row, 'symbol').toUpperCase();
    if (!symbol) { errors.push(`Row ${line}: no symbol, so the row was skipped.`); return; }

    // ---- direction, times and prices -------------------------------------
    let side = parseSide(col(row, 'side'));
    let openedParts = parseDateTimeParts(col(row, 'opened_at'));
    let closedParts = parseDateTimeParts(col(row, 'closed_at'));
    let entryPrice = parseMoney(col(row, 'entry_price'));
    let exitPrice = parseMoney(col(row, 'exit_price'));

    if (pairedFills) {
      const buyPrice = parseMoney(col(row, 'buy_price'));
      const sellPrice = parseMoney(col(row, 'sell_price'));
      const boughtParts = parseDateTimeParts(col(row, 'bought_at'));
      const soldParts = parseDateTimeParts(col(row, 'sold_at'));

      // whichever fill happened first is the one that opened the position
      const soldFirst =
        boughtParts && soldParts ? soldParts.sortKey < boughtParts.sortKey : false;
      side = side ?? (soldFirst ? 'SHORT' : 'LONG');

      openedParts = openedParts ?? (soldFirst ? soldParts : boughtParts);
      closedParts = closedParts ?? (soldFirst ? boughtParts : soldParts);
      entryPrice = entryPrice ?? (soldFirst ? sellPrice : buyPrice);
      exitPrice = exitPrice ?? (soldFirst ? buyPrice : sellPrice);
    }

    const quantity = parseMoney(col(row, 'quantity'));
    const reportedPnl = parseMoney(col(row, 'pnl'));

    // ---- contract multiplier ---------------------------------------------
    // When the file reports a P&L we can work out what one point is worth,
    // which keeps the prices and the P&L consistent if either is edited later.
    let multiplier = parseMoney(col(row, 'multiplier'));
    let manualPnl: number | null = null;

    if (reportedPnl != null) {
      const direction = side === 'SHORT' ? -1 : 1;
      const move =
        entryPrice != null && exitPrice != null && quantity != null && quantity > 0
          ? (exitPrice - entryPrice) * quantity * direction
          : null;

      if (multiplier == null && move != null && Math.abs(move) > 1e-9) {
        const derived = reportedPnl / move;
        const snapped = Math.abs(derived - Math.round(derived)) < 0.005 ? Math.round(derived) : Number(derived.toFixed(4));
        if (snapped > 0 && Math.abs(move * snapped - reportedPnl) < 0.01) multiplier = snapped;
        else manualPnl = reportedPnl;
      } else if (multiplier == null) {
        manualPnl = reportedPnl;
      }
    }

    // ---- playbook setup and account --------------------------------------
    const setupName = col(row, 'setup');
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

    const accountName = col(row, 'account');
    const accountId = (accountName && accountsByName.get(accountName.toLowerCase())?.id) || ctx.accountId;

    // ---- skip anything already imported ----------------------------------
    const buyFill = col(row, 'buy_fill_id');
    const sellFill = col(row, 'sell_fill_id');
    const externalId =
      buyFill || sellFill ? `${buyFill}:${sellFill}` : col(row, 'external_id') || undefined;
    if (externalId && seenIds.has(externalId)) { duplicates += 1; return; }
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
      fees: parseMoney(col(row, 'fees')) ?? 0,
      multiplier: multiplier ?? 1,
      manualPnl,
      leverage: parseMoney(col(row, 'leverage')),
      session: col(row, 'session') || (openedAt ? detectSession(openedAt) : undefined),
      setupId,
      tags: col(row, 'tags').split(/[|;]/).map((t) => t.trim()).filter(Boolean),
      notes: col(row, 'notes') || undefined,
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

  // ---- put scaled-out positions back together ---------------------------
  let finalTrades = trades;
  let combined = 0;

  if (ctx.combinePartials !== false && openingFill.size > 0) {
    const groups = new Map<string, Trade[]>();
    const loose: Trade[] = [];

    for (const t of trades) {
      const opener = openingFill.get(t.id);
      if (!opener) { loose.push(t); continue; }
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
