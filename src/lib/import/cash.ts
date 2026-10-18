import type { Table } from './table';
import { parseMoney } from './values';

/**
 * thinkorswim's account statement keeps the fees of each execution in its
 * Cash Balance section (Futures Statements for futures), not in the Account
 * Trade History the trades are read from. Each cash line of a trade, "SOLD
 * -50 TSLA @248.60", is matched to its execution by symbol, side, size and
 * time (the two can be a second or two apart), and its fees become a column
 * of the table. A spread is one cash line, "BOT +1 VERTICAL SPY 100 17 OCT
 * 26 450/455 CALL @1.20", and one execution per leg: the first names the
 * spread and the time, the others follow it with neither.
 */

/** "10/14/26 13:48:09" as seconds, to compare two times; null when it isn't one */
function seconds(text: string): number | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})[\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text.trim());
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return Date.UTC(year, Number(m[1]) - 1, Number(m[2]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)) / 1000;
}

/** a cash line's description of a trade: "BOT +100 AAPL @232.15", "SOLD -1 /MESZ26 @6085.50" */
const TRADE = /^(BOT|SOLD)\s+[+-]?([\d,]*\.?\d+)\s+(\S+)(.*)@/i;
const symbolKey = (s: string) => s.trim().toUpperCase().replace(/^\//, '');

interface CashTrade {
  at: number;
  side: 'BUY' | 'SELL';
  quantity: number;
  symbol: string;
  /** what was traded, as written after the size: "VERTICAL SPY 100 17 OCT 26 450/455 CALL" */
  what: string;
  fees: number;
  used: boolean;
}

/**
 * Every trade line of the file's cash sections that has fees. thinkorswim
 * writes a charge below zero and money back (a rebate) above it. A statement
 * written the other way round charges more than it gives back, so the sign
 * most of its fee money has is the one a charge has; one that gave back more
 * than it charged would be read the other way round, with nothing else to
 * tell by.
 */
function cashTrades(rows: string[][]): CashTrade[] {
  const found: (Omit<CashTrade, 'fees'> & { values: number[] })[] = [];
  let cols: { date: number; time: number; description: number; fees: number[] } | null = null;
  for (const row of rows) {
    const names = row.map((c) => c.trim().toLowerCase());
    const description = names.indexOf('description');
    const fees = names.flatMap((n, i) => (n === 'misc fees' || n === 'commissions & fees' ? [i] : []));
    if (description >= 0 && fees.length) {
      const date = names.findIndex((n) => n === 'date' || n === 'exec date');
      const time = names.findIndex((n) => n === 'time' || n === 'exec time');
      cols = date >= 0 && time >= 0 ? { date, time, description, fees } : null;
      continue;
    }
    if (!cols) continue;
    // the next section's title ends this one
    if (row.filter((c) => c.trim()).length <= 1) {
      cols = null;
      continue;
    }
    const trade = TRADE.exec((row[cols.description] ?? '').trim());
    const at = seconds(`${row[cols.date] ?? ''} ${row[cols.time] ?? ''}`);
    const values = cols.fees.map((i) => parseMoney(row[i] ?? '') ?? 0).filter((v) => v !== 0);
    if (!trade || at == null || !values.length) continue;
    found.push({
      at,
      side: trade[1].toUpperCase() === 'BOT' ? 'BUY' : 'SELL',
      quantity: Number(trade[2].replace(/,/g, '')),
      symbol: symbolKey(trade[3]),
      what: `${trade[3]}${trade[4]}`
        .trim()
        .toUpperCase()
        .replace(/(^|\s)\//g, '$1'),
      values,
      used: false,
    });
  }
  const values = found.flatMap((c) => c.values);
  const below = values.reduce((a, v) => (v < 0 ? a - v : a), 0);
  const above = values.reduce((a, v) => (v > 0 ? a + v : a), 0);
  const charge = below >= above ? -1 : 1;
  return found.flatMap(({ values: own, ...c }) => {
    const fees = Math.round(own.reduce((sum, v) => sum + v * charge, 0) * 1e8) / 1e8;
    return fees ? [{ ...c, fees }] : [];
  });
}

/**
 * The execution each row of the Account Trade History belongs to: itself, or
 * for a spread's other legs (no time, no spread named) the spread's first leg
 * above them, whose time they were filled at.
 */
function spreadHeads(data: string[][], spread: number, time: number, side: number, symbol: number): number[] {
  const heads: number[] = [];
  const named = (row: string[]) => !/^(SINGLE|STOCK)?$/i.test((row[spread] ?? '').trim());
  data.forEach((row, i) => {
    const leg =
      i > 0 &&
      spread >= 0 &&
      !(row[time] ?? '').trim() &&
      !(row[spread] ?? '').trim() &&
      Boolean((row[side] ?? '').trim() && (row[symbol] ?? '').trim()) &&
      named(data[heads[i - 1]]);
    heads.push(leg ? heads[i - 1] : i);
  });
  return heads;
}

/**
 * The table with a Fees column from the file's cash sections, when its rows
 * are executions with no fees of their own (thinkorswim's Account Trade
 * History) and some cash line matches one; otherwise the table as it was.
 * A spread's other legs take its time, and its fees are shared between its
 * legs by their sizes. Cash lines with fees that match no execution are
 * counted in `cashFeesUnmatched`, so the preview says their fees were left out.
 */
export function withCashFees(rows: string[][], table: Table): Table {
  if (table.statement) return table;
  const names = table.header.map((h) => h.trim().toLowerCase());
  const time = names.indexOf('exec time');
  const side = names.indexOf('side');
  const qty = names.indexOf('qty');
  const symbol = names.indexOf('symbol');
  if ([time, side, qty, symbol].some((i) => i < 0)) return table;
  const spread = names.indexOf('spread');
  const heads = spreadHeads(table.data, spread, time, side, symbol);
  const legs = heads.some((h, i) => h !== i);
  // a leg's own copy of its row, with the spread's time (a short row is filled out first)
  const timed = (row: string[], at: string) =>
    Array.from({ length: Math.max(row.length, time + 1) }, (_, k) => (k === time ? at : (row[k] ?? '')));
  const data = legs
    ? table.data.map((row, i) => (heads[i] === i ? row : timed(row, table.data[heads[i]][time] ?? '')))
    : table.data;
  const dated = legs ? { ...table, data } : table;
  if (names.some((n) => n.includes('fee') || n.includes('commission'))) return dated;
  const cash = cashTrades(rows);
  if (!cash.length) return dated;

  const size = (row: string[]) => Math.abs(parseMoney(row[qty] ?? '') ?? 0);
  const sideOf = (row: string[]) => (row[side] ?? '').trim().toUpperCase();
  /** the rows of each execution: a spread's legs, or the row alone */
  const groups = new Map<number, number[]>();
  heads.forEach((h, k) => {
    const group = groups.get(h);
    if (group) group.push(k);
    else groups.set(h, [k]);
  });
  let matched = 0;
  const fees = data.map(() => '');
  data.forEach((row, i) => {
    const group = groups.get(i);
    if (!group) return;
    const at = seconds(row[time] ?? '');
    const sym = symbolKey(row[symbol] ?? '');
    const named = spread >= 0 ? (row[spread] ?? '').trim().toUpperCase() : '';
    if (at == null || !size(row)) return;
    let best: CashTrade | null = null;
    for (const c of cash) {
      if (c.used) continue;
      if (c.symbol !== sym && !(named && c.what.startsWith(`${named} ${sym} `))) continue;
      // bought or sold as the cash line says: the row itself, or for a spread any of its legs
      if (!group.some((k) => sideOf(data[k]) === c.side && Math.abs(size(data[k]) - c.quantity) <= 1e-9)) continue;
      const gap = Math.abs(c.at - at);
      if (gap <= 2 && (!best || gap < Math.abs(best.at - at))) best = c;
    }
    if (!best) return;
    best.used = true;
    const total = group.reduce((a, k) => a + size(data[k]), 0);
    for (const k of group) {
      const share = total > 0 ? size(data[k]) / total : 1 / group.length;
      fees[k] = String(Math.round(best.fees * share * 1e8) / 1e8);
      matched++;
    }
  });
  // fees the statement charged that no execution here takes: said, not lost
  const left = cash.filter((c) => !c.used);
  const unmatched = left.length
    ? { cashFeesUnmatched: { lines: left.length, fees: Math.round(left.reduce((a, c) => a + c.fees, 0) * 1e8) / 1e8 } }
    : {};
  if (!matched) return { ...dated, ...unmatched };
  const width = table.header.length;
  return {
    ...dated,
    ...unmatched,
    header: [...table.header, 'Fees'],
    data: data.map((row, i) => [
      ...row.slice(0, width),
      ...Array<string>(Math.max(0, width - row.length)).fill(''),
      fees[i],
    ]),
    cashFees: matched,
  };
}
