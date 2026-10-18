import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importTradesFromCsv } from '@/lib/csv';
import { grossPnl, netPnl } from '@/lib/trade-math';
import type { Account } from '@/lib/types';

/**
 * Sixteen exports from eight platforms, laid out as the platforms write them
 * (column names and layout from real exports, values made up), in
 * tests/fixtures/import-samples. The futures files all hold the same day:
 *
 *   T1   MNQZ6  long  2  21450.25 -> 21462.75   +50.00
 *   T2   MESZ6  short 1   6085.50 ->  6088.00   -12.50
 *   T3a  MNQZ6  short 2  21480.00 -> 21471.50   +34.00
 *   T3b  MNQZ6  short 1  21480.00 -> 21468.25   +23.50
 *
 * +95.00 gross, 7.44 of fees ($0.62 a contract a side), +87.56 net. A file of
 * fills makes T3 one trade (short 3, scaled out); a file of trades keeps its
 * two rows. The stock files hold AAPL and TSLA (+252.50 gross), the forex
 * ones EURUSD and XAUUSD (+159.50 gross).
 */

const accounts: Account[] = [{ id: 'acc1', name: 'Main', startingBalance: 0, createdAt: '' }];
const read = (file: string) =>
  importTradesFromCsv(readFileSync(join(__dirname, 'fixtures', 'import-samples', file), 'utf8'), {
    accountId: 'acc1',
    accounts,
    setups: [],
  });
const cents = (v: number) => Math.round(v * 100) / 100;

const NO_FEES = /^There are no fees in this file/;
/** TradingView's paper trading writes a commission of 0 on every order */
const ZERO_FEES = /^Every fee in this file is 0/;
const FUTURES = { gross: 95, fees: 7.44, net: 87.56 };
const FUTURES_NO_FEES = { gross: 95, fees: 0, net: 95 };
const STOCKS = { gross: 252.5, fees: 4, net: 248.5 };
const FOREX = { gross: 159.5, fees: 16.55, net: 142.95 };

const SAMPLES: Array<[string, string, number, { gross: number; fees: number; net: number }, RegExp?]> = [
  ['ninjatrader8_trades.csv', 'NinjaTrader 8, trades', 4, FUTURES],
  ['ninjatrader8_executions.csv', 'NinjaTrader 8, executions', 3, FUTURES],
  ['tradovate_performance.csv', 'Tradovate, performance report', 3, FUTURES_NO_FEES, NO_FEES],
  ['tradovate_orders.csv', 'Tradovate, orders', 3, FUTURES_NO_FEES, NO_FEES],
  ['rithmic_rtraderpro_orders.csv', 'Rithmic R | Trader Pro, completed orders', 3, FUTURES],
  [
    'rithmic_rtraderpro_performance.csv',
    'Rithmic R | Trader Pro, trade performance',
    4,
    FUTURES,
    /^Each block's symbol/,
  ],
  [
    'rithmic_rtraderpro_performance_2026.csv',
    'Rithmic R | Trader Pro, trade performance',
    4,
    FUTURES,
    /^Each block's symbol/,
  ],
  ['topstepx_trades.csv', 'TopstepX, trades', 4, FUTURES],
  ['tradingview_paper_history.csv', 'TradingView, order history', 3, FUTURES_NO_FEES, ZERO_FEES],
  ['metatrader5_positions.csv', 'MetaTrader 4 and 5, positions', 3, FOREX],
  ['metatrader5_deals.csv', 'MetaTrader 4 and 5, deals', 3, FOREX],
  ['metatrader4_account_history.csv', 'MetaTrader 4 and 5, account history', 3, FOREX],
  ['interactivebrokers_activity_statement.csv', 'Interactive Brokers, activity statement', 2, STOCKS],
  ['interactivebrokers_flex_trades.csv', 'Interactive Brokers, Flex Query', 2, STOCKS],
  [
    'thinkorswim_account_statement.csv',
    'Thinkorswim, account statement',
    2,
    { gross: 252.5, fees: 1.03, net: 251.47 },
    /^The fees of 2 executions were taken from the statement's Cash Balance section/,
  ],
];

describe('sample exports of eight platforms', () => {
  it.each(SAMPLES)('%s: %s, %i trades, the known totals', (file, platform, count, totals, notice) => {
    const r = read(file);
    expect(r.platform && `${r.platform.name}, ${r.platform.file}`).toBe(platform);
    expect(r.errors).toEqual([]);
    expect(r.trades).toHaveLength(count);
    expect(r.trades.filter((t) => t.needsReview)).toEqual([]);
    expect({
      gross: cents(r.trades.reduce((a, t) => a + grossPnl(t), 0)),
      fees: cents(r.trades.reduce((a, t) => a + t.fees, 0)),
      net: cents(r.trades.reduce((a, t) => a + netPnl(t), 0)),
    }).toEqual(totals);
    if (notice) expect(r.notices.some((n) => notice.test(n))).toBe(true);
    // a file with fees never says it has none
    if (totals.fees) expect(r.notices.some((n) => NO_FEES.test(n) || ZERO_FEES.test(n))).toBe(false);
  });

  it('no column of these files is read by the words of its name', () => {
    const guessed = SAMPLES.flatMap(([file]) =>
      (read(file).layout?.columns ?? []).filter((c) => c.guessed).map((c) => `${file}: ${c.header}`),
    );
    expect(guessed).toEqual([]);
  });

  it('every futures file has the same day: T1, T2, and T3 as one trade or two', () => {
    const shape = (file: string) =>
      read(file).trades.map((t) => [t.side, t.quantity, t.entryPrice, t.exitPrice, t.multiplier]);
    const asTrades = [
      ['LONG', 2, 21450.25, 21462.75, 2],
      ['SHORT', 1, 6085.5, 6088, 5],
      ['SHORT', 2, 21480, 21471.5, 2],
      ['SHORT', 1, 21480, 21468.25, 2],
    ];
    const asFills = [...asTrades.slice(0, 2), ['SHORT', 3, 21480, 21470.42, 2]];
    const sorted = (rows: unknown[][]) => [...rows].sort((a, b) => String(a).localeCompare(String(b)));
    for (const file of ['ninjatrader8_trades.csv', 'topstepx_trades.csv', 'rithmic_rtraderpro_performance.csv']) {
      expect(sorted(shape(file))).toEqual(sorted(asTrades));
    }
    for (const file of ['ninjatrader8_executions.csv', 'tradovate_orders.csv', 'rithmic_rtraderpro_orders.csv']) {
      expect(sorted(shape(file))).toEqual(sorted(asFills));
    }
  });

  it("Rithmic's trade performance report: each block's symbol, from the line above it", () => {
    for (const file of ['rithmic_rtraderpro_performance.csv', 'rithmic_rtraderpro_performance_2026.csv']) {
      expect(read(file).trades.map((t) => t.symbol)).toEqual(['MESZ6', 'MNQZ6', 'MNQZ6', 'MNQZ6']);
    }
  });

  it("Rithmic's Completed Orders: the commission is a rate for each contract", () => {
    expect(read('rithmic_rtraderpro_orders.csv').trades.map((t) => t.fees)).toEqual([2.48, 1.24, 3.72]);
  });

  it("thinkorswim: each execution's fees from the Cash Balance section", () => {
    const r = read('thinkorswim_account_statement.csv');
    expect(r.trades.map((t) => [t.symbol, t.fees])).toEqual([
      ['AAPL', 0.67],
      ['TSLA', 0.36],
    ]);
  });

  it("TradingView's Account History holds no trades, and says which export does", () => {
    const r = read('tradingview_paper_account_history.csv');
    expect(r.trades).toEqual([]);
    expect(r.platform).toEqual({ name: 'TradingView', file: 'account history' });
    expect(r.errors).toEqual([expect.stringMatching(/^This is TradingView's Account History.*Order History instead/)]);
  });
});
