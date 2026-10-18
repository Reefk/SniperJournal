import type { Table } from './table';
import { parseMoney } from './values';

/**
 * thinkorswim's account statement keeps the fees of each execution in its
 * Cash Balance section (Futures Statements for futures), not in the Account
 * Trade History the trades are read from. Each cash line of a trade, "SOLD
 * -50 TSLA @248.60", is matched to its execution by symbol, side, size and
 * time (the two can be a second or two apart), and its fees become a column
 * of the table.
 */

/** "10/14/26 13:48:09" as seconds, to compare two times; null when it isn't one */
function seconds(text: string): number | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})[\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text.trim());
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return Date.UTC(year, Number(m[1]) - 1, Number(m[2]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)) / 1000;
}

/** a cash line's description of a trade: "BOT +100 AAPL @232.15", "SOLD -1 /MESZ26 @6085.50" */
const TRADE = /^(BOT|SOLD)\s+[+-]?([\d,]*\.?\d+)\s+(\S+).*@/i;
const symbolKey = (s: string) => s.trim().toUpperCase().replace(/^\//, '');

interface CashTrade {
  at: number;
  side: 'BUY' | 'SELL';
  quantity: number;
  symbol: string;
  fees: number;
  used: boolean;
}

/** every trade line of the file's cash sections that has fees */
function cashTrades(rows: string[][]): CashTrade[] {
  const found: CashTrade[] = [];
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
    const fee = cols.fees.reduce((sum, i) => sum + Math.abs(parseMoney(row[i] ?? '') ?? 0), 0);
    if (!trade || at == null || !fee) continue;
    found.push({
      at,
      side: trade[1].toUpperCase() === 'BOT' ? 'BUY' : 'SELL',
      quantity: Number(trade[2].replace(/,/g, '')),
      symbol: symbolKey(trade[3]),
      fees: Math.round(fee * 1e8) / 1e8,
      used: false,
    });
  }
  return found;
}

/**
 * The table with a Fees column from the file's cash sections, when its rows
 * are executions with no fees of their own (thinkorswim's Account Trade
 * History) and some cash line matches one; otherwise the table as it was.
 * Cash lines with fees that match no execution are counted in
 * `cashFeesUnmatched`, so the preview says their fees were left out.
 */
export function withCashFees(rows: string[][], table: Table): Table {
  if (table.statement) return table;
  const names = table.header.map((h) => h.trim().toLowerCase());
  if (names.some((n) => n.includes('fee') || n.includes('commission'))) return table;
  const time = names.indexOf('exec time');
  const side = names.indexOf('side');
  const qty = names.indexOf('qty');
  const symbol = names.indexOf('symbol');
  if ([time, side, qty, symbol].some((i) => i < 0)) return table;
  const cash = cashTrades(rows);
  if (!cash.length) return table;

  let matched = 0;
  const fees = table.data.map((row) => {
    const at = seconds(row[time] ?? '');
    const s = (row[side] ?? '').trim().toUpperCase();
    const q = Math.abs(parseMoney(row[qty] ?? '') ?? 0);
    const sym = symbolKey(row[symbol] ?? '');
    if (at == null || !q) return '';
    let best: CashTrade | null = null;
    for (const c of cash) {
      if (c.used || c.side !== s || c.symbol !== sym || Math.abs(c.quantity - q) > 1e-9) continue;
      const gap = Math.abs(c.at - at);
      if (gap <= 2 && (!best || gap < Math.abs(best.at - at))) best = c;
    }
    if (!best) return '';
    best.used = true;
    matched++;
    return String(best.fees);
  });
  // fees the statement charged that no execution here takes: said, not lost
  const left = cash.filter((c) => !c.used);
  const unmatched = left.length
    ? { cashFeesUnmatched: { lines: left.length, fees: Math.round(left.reduce((a, c) => a + c.fees, 0) * 1e8) / 1e8 } }
    : {};
  if (!matched) return { ...table, ...unmatched };
  const width = table.header.length;
  return {
    ...table,
    ...unmatched,
    header: [...table.header, 'Fees'],
    data: table.data.map((row, i) => [
      ...row.slice(0, width),
      ...Array<string>(Math.max(0, width - row.length)).fill(''),
      fees[i],
    ]),
    cashFees: matched,
  };
}
