import { describe, expect, it } from 'vitest';
import { detectLayout, missingSymbol, type LayoutChoices, type RowKind, type Sheet } from '@/lib/import/layout';
import { believable, createReader, fitReported, type Findings, type ImportTarget } from '@/lib/import/reader';
import { assembleTrade, combinePartials, parseTradeRow, tradesFromRows } from '@/lib/import/rows';
import { parseFillRow, tradesFromFills } from '@/lib/import/positions';
import type { Role } from '@/lib/import/columns';
import { collectMessages, rowsNote } from '@/lib/import/report';
import type { Table } from '@/lib/import/table';
import type { Account, Setup, Trade } from '@/lib/types';
import { trade } from './helpers';

/**
 * Each stage of a CSV import on its own (importTradesFromCsv in lib/csv.ts
 * runs them in this order): the layout of the file, reading a row's values,
 * rows of whole trades, rows of single fills, the messages, and combining a
 * position split over several rows. tests/csv.test.ts and
 * tests/import-formats.test.ts cover the whole import.
 */

const accounts: Account[] = [
  { id: 'acc1', name: 'Main Portfolio', startingBalance: 0, createdAt: '' },
  { id: 'acc2', name: 'Prop Challenge', startingBalance: 0, createdAt: '' },
];
const target = (extra: Partial<ImportTarget> = {}): ImportTarget => ({
  accountId: 'acc1',
  accounts,
  setups: [] as Setup[],
  ...extra,
});

function sheetOf(csv: string, choices: LayoutChoices = {}): Sheet {
  const sheet = detectLayout(csv, choices);
  if (!sheet) throw new Error('no data rows');
  return sheet;
}
const readerOf = (csv: string, choices: LayoutChoices = {}, extra: Partial<ImportTarget> = {}) =>
  createReader(sheetOf(csv, choices), target(extra));

describe('stage 1: the layout of the file', () => {
  it('a file without data rows has none', () => {
    expect(detectLayout('', {})).toBeNull();
    expect(detectLayout('symbol,side\n', {})).toBeNull();
  });

  it('tells rows of whole trades, paired buy and sell fills, and single fills apart', () => {
    expect(sheetOf('symbol,side,entry,exit,qty\nAAPL,long,100,101,1').rowKind).toBe('trades');
    const paired = sheetOf('symbol,qty,buyPrice,sellPrice\nMNQ,1,18000,18010');
    expect([paired.rowKind, paired.paired]).toEqual(['paired', true]);
    expect(sheetOf('time,symbol,side,qty,price\n2026-03-02 10:00,AAPL,buy,1,100').rowKind).toBe('fills');
    // a quantity with a sign is a direction too
    expect(sheetOf('time,symbol,qty,price\n2026-03-02 10:00,AAPL,-1,100').rowKind).toBe('fills');
  });

  it('an Action column with a buy or a sell in it is the direction; a Type column needs half of its values to be', () => {
    const rows = ['Security Transfer', 'Sell Short', 'Stock Split', 'Dividend'].map(
      (v, i) => `2026-03-0${i + 2},AAPL,${v},1,100`,
    );
    const side = (name: string, values = rows) =>
      sheetOf(`date,symbol,${name},qty,price\n${values.join('\n')}`).has('side');
    expect([side('action'), side('trans code'), side('type')]).toEqual([true, true, false]);
    // one trade among twenty other lines is enough for an Action column
    const quiet = Array.from({ length: 19 }, (_, i) => `2026-03-${String(i + 2).padStart(2, '0')},AAPL,Dividend,1,1`);
    expect(side('action', [...quiet, '2026-03-30,AAPL,Sell Short,1,100'])).toBe(true);
    // a Type column half buys and sells is the direction
    expect(side('type', ['2026-03-02,AAPL,Buy,1,100', '2026-03-03,AAPL,Dividend,1,1'])).toBe(true);
    // beside one, an Action that names a buy on one row of four gives way
    const both = sheetOf(
      'date,symbol,action,type,qty,price\n' +
        ['Filled,Buy', 'Filled,Sell', 'Filled,Buy', 'Buy limit placed,Sell']
          .map((v, i) => `2026-03-0${i + 2},AAPL,${v},1,100`)
          .join('\n'),
    );
    expect(both.plan.roles.get('side')).toEqual([3]);
    // nothing in it is a buy or a sell
    expect(
      side(
        'action',
        rows.filter((row) => !row.includes('Sell')),
      ),
    ).toBe(false);
  });

  it('what was chosen in the preview wins, but only fills the columns allow', () => {
    const fills = 'time,symbol,side,qty,price\n2026-03-02 10:00,AAPL,buy,1,100';
    expect(sheetOf(fills, { rowKind: 'trades' }).rowKind).toBe('trades');
    const trades = 'symbol,side,entry,exit,qty\nAAPL,long,100,101,1';
    expect(sheetOf(trades, { rowKind: 'fills' }).rowKind).toBe('trades');
    expect(sheetOf(trades).layout.canBeFills).toBe(false);
  });

  it('one date order for the whole file: a day above 12 anywhere decides it; unclear when none does', () => {
    const csv = (second: string) => `symbol,entry time\nAAPL,03/04/2026 10:00\nAAPL,${second} 10:00`;
    expect(sheetOf(csv('25/04/2026')).order).toBe('dmy');
    expect(sheetOf(csv('04/25/2026')).order).toBe('mdy');
    const unclear = sheetOf(csv('05/04/2026'));
    expect(unclear.layout.ambiguousDates).toBe(true);
    expect(sheetOf(csv('05/04/2026'), { dateOrder: 'dmy' }).order).toBe('dmy');
  });

  it('describes the columns: what each is read as, a value from it, where the header is, and a signature', () => {
    const sheet = sheetOf('My broker export\n\nSymbol,Qty,Broker Note\n,1,\nAAPL,2,hello');
    expect(sheet.layout.headerLine).toBe(2);
    expect(sheet.layout.columns.map((c) => [c.header, c.role, c.sample])).toEqual([
      ['Symbol', 'symbol', 'AAPL'],
      ['Qty', 'quantity', '1'],
      ['Broker Note', '', 'hello'],
    ]);
    expect(sheet.recognised).toEqual(['symbol', 'quantity']);
    expect(sheet.ignored).toEqual(['Broker Note']);
    expect(sheet.layout.signature).toBe('symbol|qty|broker note');
  });

  it('a name read by its words is marked as guessed, and only takes a role no listed name took', () => {
    const sheet = sheetOf(
      'Symbol,Side,Qty,Exec Px,Price,Broker Charges,Commission,Trade Notes\nAAPL,buy,1,100,100.5,0.5,1,hello',
    );
    expect(sheet.layout.columns.map((c) => [c.header, c.role, c.guessed])).toEqual([
      ['Symbol', 'symbol', false],
      ['Side', 'side', false],
      ['Qty', 'quantity', false],
      // "Price" is a listed name, and "Commission" one, so the guesses give way
      ['Exec Px', '', false],
      ['Price', 'price', false],
      // nor is a guessed fee added to a listed one
      ['Broker Charges', '', false],
      ['Commission', 'fees', false],
      ['Trade Notes', 'notes', true],
    ]);
    expect(sheet.ignored).toEqual(['Exec Px', 'Broker Charges']);
  });

  it("a name read by its words needs nearly all of the column's values to fit", () => {
    const guessed = (csv: string) => sheetOf(csv).layout.columns.map((c) => c.role);
    // 4 of 5 values are prices, 3 of 5 are not enough
    expect(guessed('Symbol,Start Price\nA,1\nA,2\nA,3\nA,4\nA,n/a')).toEqual(['symbol', 'entry_price']);
    expect(guessed('Symbol,Start Price\nA,1\nA,2\nA,3\nA,n/a\nA,n/a')).toEqual(['symbol', '']);
    expect(guessed('Ticker Name,Qty\n1234.5,1')).toEqual(['', 'quantity']);
    expect(guessed('Symbol,Trade Direction\nAAPL,Market')).toEqual(['symbol', '']);
    expect(guessed('Symbol,End Day\nAAPL,yesterday')).toEqual(['symbol', '']);
    // a time of day is a fill's time, which joins the Date; an entry or exit
    // time needs its date, as nothing joins it to that column
    expect(guessed('Symbol,Date,Execution Timestamp\nAAPL,2026-03-02,09:31:05')).toEqual(['symbol', 'date', 'time']);
    expect(guessed('Symbol,Date,Final Time\nAAPL,2026-03-02,10:12')).toEqual(['symbol', 'date', '']);
    expect(guessed('Symbol,Final Time\nAAPL,2026-03-02 10:12')).toEqual(['symbol', 'closed_at']);
    // an empty column is no guess, even of notes
    expect(guessed('Symbol,Trade Notes,Qty\nAAPL,,1\nAAPL,,2')).toEqual(['symbol', '', 'quantity']);
  });

  it('guessed fee columns add up, and a guessed total is not one of them', () => {
    const sheet = sheetOf('Symbol,Broker Charges,Platform Levy,Total Charges\nAAPL,1,0.5,1.5');
    expect(sheet.layout.columns.map((c) => [c.role, c.guessed])).toEqual([
      ['symbol', false],
      ['fees', true],
      ['fees', true],
      ['', false],
    ]);
    expect(sheet.plan.roles.get('fees')).toEqual([1, 2]);
  });

  it('a guess stays out of what a listed column already says, and of what was switched off in the preview', () => {
    const roles = (csv: string, choices: LayoutChoices = {}) => sheetOf(csv, choices).layout.columns.map((c) => c.role);
    // next to a listed net P&L, a guessed one would change which is before fees
    expect(roles('Symbol,Net P&L,Realized Gain\nAAPL,9,10')).toEqual(['symbol', 'net_pnl', '']);
    // a guessed entry price would be read before the listed price
    expect(roles('Symbol,Price,Start Price\nAAPL,100,101')).toEqual(['symbol', 'price', '']);
    // Price switched off: nothing else becomes the price unless chosen
    expect(roles('Symbol,Price,Exec Px\nAAPL,100,101', { mapping: { 1: '' } })).toEqual(['symbol', '', '']);
    // nor when it was made something else: the fees stay unread, not guessed
    expect(roles('Symbol,Commission,Broker Charges\nAAPL,1,0.5', { mapping: { 1: 'notes' } })).toEqual([
      'symbol',
      'notes',
      '',
    ]);
    // a second Start Price of notes is not the exit price
    expect(roles('Symbol,Start Price,Start Price\nAAPL,100,see chart')).toEqual(['symbol', 'entry_price', '']);
  });

  it('guessed money carries no unit but a currency, and a guessed symbol looks like a ticker', () => {
    const roles = (csv: string) => sheetOf(csv).layout.columns.map((c) => c.role);
    expect(roles('Symbol,Realised P&L\nAAPL,1.5R')).toEqual(['symbol', '']);
    expect(roles('Symbol,Realised P&L\nAAPL,12 pips')).toEqual(['symbol', '']);
    expect(roles('Symbol,Realised P&L\nAAPL,170 USD')).toEqual(['symbol', 'pnl']);
    // a size can be in anything
    expect(roles('Symbol,Lots Traded\nBTC,0.5 BTC')).toEqual(['symbol', 'quantity']);
    expect(roles('Ticker Name,Qty\nApple Inc,1')).toEqual(['', 'quantity']);
    expect(roles('Ticker Name,Qty\n1234.5,1')).toEqual(['', 'quantity']);
    expect(roles('Ticker Name,Qty\nES 03-26,1\n/MESZ25:XCME,1\nBRK.B,1\nEUR/USD,1')).toEqual(['symbol', 'quantity']);
  });

  it('a guessed name written twice is the opening and the closing, like a listed one', () => {
    const roles = (csv: string) => sheetOf(csv).layout.columns.map((c) => [c.role, c.guessed]);
    expect(roles('Symbol,Exec Px,Exec Px\nAAPL,100,101')).toEqual([
      ['symbol', false],
      ['entry_price', true],
      ['exit_price', true],
    ]);
    expect(roles('Symbol,Deal Time,Deal Time\nAAPL,2026-03-02 09:31,2026-03-02 10:12')).toEqual([
      ['symbol', false],
      ['opened_at', true],
      ['closed_at', true],
    ]);
    // times of day alone stay the fill's time, which joins the Date
    expect(roles('Symbol,Date,Deal Time,Deal Time\nAAPL,2026-03-02,09:31,10:12')).toEqual([
      ['symbol', false],
      ['date', false],
      ['time', true],
      ['', false],
    ]);
    expect(roles('Symbol,Price,Price\nAAPL,100,101')).toEqual([
      ['symbol', false],
      ['entry_price', false],
      ['exit_price', false],
    ]);
  });

  it('a choice made in the preview wins over a guess, and is not a guess', () => {
    const csv = 'Symbol,Start Price\nAAPL,100';
    expect(sheetOf(csv, { mapping: { 1: '' } }).layout.columns[1]).toMatchObject({ role: '', guessed: false });
    expect(sheetOf(csv, { mapping: { 1: 'exit_price' } }).layout.columns[1]).toMatchObject({
      role: 'exit_price',
      guessed: false,
    });
  });

  it('reads a cell by role, trimmed, and nothing for a role no column has', () => {
    const sheet = sheetOf('symbol,qty\n  AAPL ,1');
    expect(sheet.cell(sheet.table.data[0], 'symbol')).toBe('AAPL');
    expect(sheet.cell(sheet.table.data[0], 'notes')).toBe('');
  });

  it('without a symbol column nothing can be read, unless a symbol is typed for every row', () => {
    expect(missingSymbol(sheetOf('company_name,qty\nAAPL,1'))).toMatch(
      /^No symbol column found\. The columns in this file are: company_name, qty\./,
    );
    const typed = sheetOf('company_name,qty\nAAPL,1', { defaultSymbol: ' nq ' });
    expect(typed.fallbackSymbol).toBe('NQ');
    expect(missingSymbol(typed)).toBeNull();
    expect(missingSymbol(sheetOf('underlying,qty\nAAPL,1'))).toBeNull();
  });

  it('a table in blocks, each under a contract and the header again: one table, the contract its Symbol', () => {
    const head = 'Entry Buy/Sell,Entry Price,Entry Time,Exit Price,Exit Time,Fill Size';
    const sheet = sheetOf(
      [
        'ACC-1',
        'ESZ6',
        head,
        'B,5000,2026-03-02 10:00,5001,2026-03-02 10:05,1',
        'NQZ6',
        head,
        'S,20000,2026-03-02 11:00,19990,2026-03-02 11:05,1',
      ].join('\n'),
    );
    expect(sheet.table.grouped).toBe(true);
    expect(sheet.table.data.map((row) => sheet.cell(row, 'symbol'))).toEqual(['ESZ6', 'NQZ6']);
    expect(missingSymbol(sheet)).toBeNull();
  });

  it('a block with no line of its own above the header again takes no symbol from the block before', () => {
    const head = 'Entry Buy/Sell,Entry Price,Entry Time,Exit Price,Exit Time,Fill Size';
    const csv = [
      'ACC-1',
      'ESZ6',
      head,
      'B,5000,2026-03-02 10:00,5001,2026-03-02 10:05,1',
      head,
      'S,20000,2026-03-02 11:00,19990,2026-03-02 11:05,1',
    ].join('\n');
    const sheet = sheetOf(csv);
    expect(sheet.table.data.map((row) => sheet.cell(row, 'symbol'))).toEqual(['ESZ6', '']);
    // so the row is skipped and said to have no symbol, not imported as ESZ6
    const r = readerOf(csv);
    expect(tradesFromRows(r).trades.map((t) => t.symbol)).toEqual(['ESZ6']);
    expect(r.findings.noSymbol).toEqual([6]);
  });

  it('a title above the header is not a symbol, nor a block line when the rows name their own', () => {
    const titled = sheetOf('TRADES\nEntry Price,Exit Price,Fill Size\n5000,5001,1');
    expect(titled.table.grouped).toBeUndefined();
    expect(missingSymbol(titled)).toMatch(/^No symbol column found/);
    const named = sheetOf(
      'ESZ6\nSymbol,Entry Price,Exit Price\nMNQZ6,1,2\nESZ6\nSymbol,Entry Price,Exit Price\nMESZ6,3,4',
    );
    expect(named.table.data.map((row) => named.cell(row, 'symbol'))).toEqual(['MNQZ6', 'MESZ6']);
  });

  it("thinkorswim: an execution's fees from the cash line of the same trade, at most 2 seconds apart", () => {
    const statement = (cashTime: string) =>
      [
        'Cash Balance',
        'DATE,TIME,TYPE,REF #,DESCRIPTION,Misc Fees,Commissions & Fees,AMOUNT,BALANCE',
        `10/14/26,${cashTime},TRD,1,SOLD -50 TSLA @248.60,-0.36,-0.65,"12,430.00","14,214.64"`,
        '',
        'Account Trade History',
        ',Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type',
        ',10/14/26 10:05:18,SINGLE,SELL,-50,TO OPEN,TSLA,,,STOCK,248.60,248.60,MKT',
      ].join('\n');
    const near = sheetOf(statement('10:05:20'));
    expect([near.table.cashFees, near.cell(near.table.data[0], 'fees')]).toEqual([1, '1.01']);
    const far = sheetOf(statement('10:05:21'));
    expect([far.table.cashFees, far.has('fees')]).toEqual([undefined, false]);
  });
});

describe('stage 2: reading the values of a row', () => {
  it('free text that the export guarded against spreadsheet formulas comes back as typed', () => {
    const r = readerOf(`symbol,notes\nAAPL,"'=HYPERLINK(""x"")"`);
    expect(r.textCell(r.sheet.table.data[0], 'notes')).toBe('=HYPERLINK("x")');
  });

  it('a moment from one column, or a date column and a time column; times with a zone and without are counted', () => {
    const r = readerOf('symbol,date,time,exit time\nAAPL,2026-03-02,10:05,2026-03-02T15:00:00Z');
    const row = r.sheet.table.data[0];
    expect(r.moment(row, 'time', 'date')?.value).toBe('2026-03-02T10:05');
    expect(r.findings).toMatchObject({ zoned: 0, unzoned: 1 });
    expect(r.moment(row, 'closed_at', 'closed_date')?.value).toBe('2026-03-02T15:00');
    expect(r.findings).toMatchObject({ zoned: 1, unzoned: 1 });
    // a date with no time of day has no zone to get wrong
    expect(r.moment(row, 'date', 'date')?.value).toBe('2026-03-02T00:00');
    expect(r.findings).toMatchObject({ zoned: 1, unzoned: 1 });
  });

  it('every fee column adds up, each read with its own sign; a fee in another currency is left out and noted', () => {
    const r = readerOf('symbol,price,commission,fee\nBTC,60000 USDT,-1.5,0.5\nBTC,60000 USDT,-2,0.0003BNB');
    const [a, b] = r.sheet.table.data;
    expect(r.feeOf(a)).toBe(2);
    expect(r.feeOf(b)).toBe(2);
    expect([...r.findings.foreignFees]).toEqual(['BNB']);
    expect(readerOf('symbol,qty\nAAPL,1').feeOf(['AAPL', '1'])).toBeNull();
  });

  it("the symbol, an option's own columns added to it, or the one typed for the file", () => {
    const r = readerOf('underlying,expiry,strike,put/call\naapl,20 MAR 26,180,C');
    expect(r.symbolOf(r.sheet.table.data[0])).toBe('AAPL 20 MAR 26 180 CALL');
    const typed = readerOf('qty\n1\n2', { defaultSymbol: 'es' });
    expect(typed.symbolOf(typed.sheet.table.data[0])).toBe('ES');
  });

  it('a setup the journal lacks is made once, whatever its case; an account is found by name or is the import one', () => {
    const own: Setup = { id: 'set1', name: 'Breakout', rules: [], description: '' };
    const r = readerOf('symbol\nAAPL', {}, { setups: [own] });
    expect(r.setupIdFor('breakout')).toBe('set1');
    const made = r.setupIdFor('VWAP Reclaim');
    expect(r.setupIdFor('vwap reclaim')).toBe(made);
    expect(r.newSetups.map((s) => [s.id, s.name])).toEqual([[made, 'VWAP Reclaim']]);
    expect(r.setupIdFor('')).toBeUndefined();
    expect([r.accountIdFor('prop challenge'), r.accountIdFor('Unknown'), r.accountIdFor('')]).toEqual([
      'acc2',
      'acc1',
      'acc1',
    ]);
  });

  it('tags split on | or ;', () => {
    const r = readerOf('symbol,tags\nAAPL,"a| b ;c||"');
    expect(r.tagsOf(r.sheet.table.data[0])).toEqual(['a', 'b', 'c']);
  });

  it('a multiplier of zero or less is left out and noted, with the first such value', () => {
    const r = readerOf('symbol,multiplier\nES,-50\nES,0\nES,50');
    const [a, b, c] = r.sheet.table.data;
    expect([r.multiplierCell(a, 2), r.multiplierCell(b, 3), r.multiplierCell(c, 4)]).toEqual([null, null, 50]);
    expect(r.findings.badMultipliers).toEqual({ rows: [2, 3], value: '-50' });
  });

  it('a point value from what the symbol is: a futures contract, an option; noted as worked out', () => {
    const r = readerOf('symbol\nESH6');
    const row = r.sheet.table.data[0];
    expect(r.knownMultiplier('ESH6', row)).toBe(50);
    expect(r.knownMultiplier('AAPL  260320C00180000', row)).toBe(100);
    expect(r.knownMultiplier('AAPL', row)).toBeNull();
    expect([...r.findings.inferred]).toEqual([
      ['ESH6', '50 a point (ES futures)'],
      ['AAPL  260320C00180000', '100 (an option contract)'],
    ]);
  });

  it('a reported P&L that fits the prices gives the point value; one that only fits net of fees was net', () => {
    expect(fitReported(100, 2, 0, false)).toEqual({ multiplier: 50, manualPnl: null });
    // 146 over a 3-point move fits no point value; 150, with the 4 of fees added back, does
    expect(fitReported(146, 3, 4, false)).toEqual({ multiplier: 50, manualPnl: null });
    expect(fitReported(146, 3, 4, true)).toEqual({ multiplier: 50, manualPnl: null });
    // no prices to check it against, or none that fit: kept as written
    expect(fitReported(120, null, 0, false)).toEqual({ multiplier: null, manualPnl: 120 });
    expect(fitReported(-30, 2, 0, false)).toEqual({ multiplier: null, manualPnl: -30 });
  });

  it('a ratio that is not a point value, close to the one expected, is not taken as one: the P&L holds something else', () => {
    // 0.5 BTC up 1000 is 500; a P&L of 475.60 has the fees taken off, and there is no fee column
    expect(fitReported(475.6, 500, 0, true)).toEqual({ multiplier: null, manualPnl: 475.6 });
    // 2 MNQ up 10.5 points is 21 points; 40.76 is after fees, against MNQ's 2 a point
    expect(fitReported(40.76, 21, 0, false, 2)).toEqual({ multiplier: null, manualPnl: 40.76 });
    // a P&L in pounds on dollar prices: 13.39 against 17
    expect(fitReported(13.39, 17, 0, false)).toEqual({ multiplier: null, manualPnl: 13.39 });
    // far from what is expected, an odd one is real: 0.3 of a unit a point
    expect(fitReported(30, 100, 0, false)).toEqual({ multiplier: 0.3, manualPnl: null });
  });
});

describe('stage 3: rows of whole trades, or of paired fills', () => {
  it('a row is read for its direction, times, prices and fees; one with no symbol is not', () => {
    const r = readerOf(
      'symbol,side,entry time,exit time,entry,exit,qty,fees\nAAPL,short,2026-03-02 10:00,2026-03-02 11:00,101,100,10,1.5\n,long,,,1,2,1,',
    );
    const [row, blank] = r.sheet.table.data;
    expect(parseTradeRow(blank, 3, r)).toBeNull();
    expect(parseTradeRow(row, 2, r)).toMatchObject({
      symbol: 'AAPL',
      side: 'SHORT',
      opened: { value: '2026-03-02T10:00' },
      closed: { value: '2026-03-02T11:00' },
      entryPrice: 101,
      exitPrice: 100,
      quantity: 10,
      fees: 1.5,
      multiplier: null,
      manualPnl: null,
      externalId: undefined,
      unreadOpen: '',
      unreadClose: '',
    });
  });

  it('a time written but unreadable is kept, to be reported; one with no digits is no time at all', () => {
    const r = readerOf(
      'symbol,side,date,time,exit time,qty,entry\nAAPL,long,2026-03-02,25:61,2026-02-30 11:00,1,100\nMSFT,long,2026-03-02,10:00,N/A,1,100',
    );
    const [bad, fine] = r.sheet.table.data;
    expect(parseTradeRow(bad, 2, r)).toMatchObject({
      opened: null,
      closed: null,
      unreadOpen: '25:61',
      unreadClose: '2026-02-30 11:00',
    });
    expect(parseTradeRow(fine, 3, r)).toMatchObject({ closed: null, unreadOpen: '', unreadClose: '' });
  });

  it('a direction that means nothing is noted, with its rows', () => {
    const r = readerOf('symbol,side\nAAPL,sideways\nMSFT,sideways\nTSLA,long');
    r.sheet.table.data.forEach((row, i) => parseTradeRow(row, i + 2, r));
    expect([...r.findings.unknownSides]).toEqual([['sideways', [2, 3]]]);
  });

  it('a paired row: the fill that came first opened it, and the fill ids name it', () => {
    const r = readerOf(
      'symbol,qty,buyPrice,sellPrice,boughtTimestamp,soldTimestamp,buyFillId,sellFillId\nMNQ,1,18040,18050,03/04/2026 11:00:05,03/04/2026 11:00:00,B3,S3',
    );
    expect(parseTradeRow(r.sheet.table.data[0], 2, r)).toMatchObject({
      side: 'SHORT',
      entryPrice: 18050,
      exitPrice: 18040,
      opened: { value: '2026-03-04T11:00' },
      buyFill: 'B3',
      sellFill: 'S3',
      externalId: 'B3:S3',
    });
  });

  it('a P&L next to the prices gives the point value; with nothing to go on, the symbol may', () => {
    const r = readerOf('symbol,side,entry,exit,qty,pnl\nMES,long,5000,5002,1,10\nESM6,long,5000,5001,1,');
    const [mes, es] = r.sheet.table.data;
    expect(parseTradeRow(mes, 2, r)).toMatchObject({ multiplier: 5, manualPnl: null });
    expect(parseTradeRow(es, 3, r)).toMatchObject({ multiplier: 50 });
  });

  it('a row read becomes a trade with what else it says; missing details flag it', () => {
    const r = readerOf(
      'symbol,side,entry time,exit time,entry,exit,qty,stop,target,setup,tags,notes,account\n' +
        'AAPL,long,2026-03-02 15:00,2026-03-02 16:00,100,110,10,95,120,Breakout,a|b,first,Prop Challenge\n' +
        'MSFT,,,,,,,,,,,,',
    );
    const [row, bare] = r.sheet.table.data;
    const t = assembleTrade(parseTradeRow(row, 2, r)!, row, r);
    expect(t).toMatchObject({
      accountId: 'acc2',
      symbol: 'AAPL',
      side: 'LONG',
      openedAt: '2026-03-02T15:00',
      closedAt: '2026-03-02T16:00',
      quantity: 10,
      entryPrice: 100,
      exitPrice: 110,
      stopLoss: 95,
      takeProfit: 120,
      fees: 0,
      multiplier: 1,
      session: 'New York',
      setupId: r.newSetups[0].id,
      tags: ['a', 'b'],
      notes: 'first',
      excluded: false,
      createdAt: r.now,
    });
    expect(t.needsReview).toBeUndefined();
    const flagged = assembleTrade(parseTradeRow(bare, 3, r)!, bare, r);
    expect([flagged.side, flagged.quantity, flagged.entryPrice, flagged.needsReview]).toEqual(['LONG', 0, 0, true]);
  });

  it('every row made a trade, except rows with no symbol and those already imported or listed twice', () => {
    const r = readerOf(
      'symbol,qty,entry,exit,id\nAAPL,1,100,101,7\n,1,1,1,8\nAAPL,1,100,101,7\nMSFT,1,10,11,9',
      {},
      {
        existing: [trade({ externalId: '9' })],
      },
    );
    const read = tradesFromRows(r);
    expect(read.trades.map((t) => t.externalId)).toEqual(['7']);
    expect(r.findings.noSymbol).toEqual([3]);
    expect(r.findings.duplicates).toBe(2);
    expect(read.errors).toEqual(['There is no direction column, so every row was imported as LONG. Check any shorts.']);
  });

  it('a paired row remembers the fill that opened it: the buy on a long, the sell on a short', () => {
    const r = readerOf(
      'symbol,qty,buyPrice,sellPrice,boughtTimestamp,soldTimestamp,buyFillId,sellFillId\n' +
        'MNQ,1,18000,18010,03/04/2026 10:00:00,03/04/2026 10:05:00,B1,S1\n' +
        'MNQ,1,18050,18040,03/04/2026 11:00:05,03/04/2026 11:00:00,B3,S3',
    );
    const read = tradesFromRows(r);
    expect(read.errors).toEqual([]);
    expect([...read.openingFill!.values()]).toEqual(['B1', 'S3']);
  });
});

describe('stage 4: rows of single fills', () => {
  const fills = (rows: string, head = 'time,symbol,side,qty,price,fee,id') => readerOf(`${head}\n${rows}`);

  it('a row read as a fill, keyed by account and symbol', () => {
    const r = fills('2026-03-02 10:00,aapl,buy,5,100,1,F1');
    const got = parseFillRow(r.sheet.table.data[0], 2, r, new Set(), false);
    expect(got).toMatchObject({
      symbol: 'AAPL',
      accountId: 'acc1',
      fill: {
        line: 2,
        key: 'acc1|AAPL',
        side: 'BUY',
        quantity: 5,
        price: 100,
        fees: 1,
        id: 'F1',
        time: { value: '2026-03-02T10:00' },
      },
    });
  });

  it('says why a row is not a fill to import', () => {
    const r = fills(
      [
        '2026-03-02 10:00,AAPL,buy,1,100,0,F1,cancelled',
        '2026-03-02 10:00,,deposit,,,,,filled',
        '2026-03-02 10:00,,buy,1,100,0,F2,filled',
        '2026-03-02 10:00,AAPL,buy,0,100,0,F3,filled',
        '2026-03-02 10:00,AAPL,buy,1,,0,F4,filled',
        '2026-03-02 10:00,AAPL,buy,1,100,0,F5,filled',
        '2026-03-02 10:00,AAPL,buy,1,100,0,F5,filled',
      ].join('\n'),
      'time,symbol,side,qty,price,fee,id,status',
    );
    const seen = new Set<string>();
    const why = r.sheet.table.data.map((row, i) => {
      const got = parseFillRow(row, i + 2, r, seen, false);
      return 'fill' in got ? 'fill' : got.skip;
    });
    expect(why).toEqual(['unfilled', 'not a trade', 'no symbol', 'no quantity', 'no price', 'fill', 'duplicate']);
  });

  it('rows that share an id are one execution listed twice only when all the rest is the same too', () => {
    const r = fills(
      [
        // a spread's two legs, one order
        '2026-03-02 10:00,SPY 260320P00500000,sell,1,2.5,0,9001',
        '2026-03-02 10:00,SPY 260320P00495000,buy,1,1,0,9001',
        // the first leg with one thing changed: the price, the time, the
        // account, the size, the side, the symbol
        '2026-03-02 10:00,SPY 260320P00500000,sell,1,2.45,0,9001',
        '2026-03-02 10:01,SPY 260320P00500000,sell,1,2.5,0,9001',
        '2026-03-02 10:00,SPY 260320P00500000,sell,1,2.5,0,9001,Prop Challenge',
        '2026-03-02 10:00,SPY 260320P00500000,sell,2,2.5,0,9001',
        '2026-03-02 10:00,SPY 260320P00500000,buy,1,2.5,0,9001',
        '2026-03-02 10:00,SPY 260320P00495000,sell,1,2.5,0,9001',
        // the first leg again, its numbers written another way
        '2026-03-02 10:00,SPY 260320P00500000,sell,1.0,2.50,0,9001',
      ].join('\n'),
      'time,symbol,side,qty,price,fee,id,account',
    );
    const seen = new Set<string>();
    const why = r.sheet.table.data.map((row, i) => {
      const got = parseFillRow(row, i + 2, r, seen, false);
      return 'fill' in got ? 'fill' : got.skip;
    });
    expect(why).toEqual([...Array(8).fill('fill'), 'duplicate']);
    // a file of dates alone: the same order on another day is another fill
    const days = fills(
      '2026-03-02,AAPL,buy,1,100,0,7\n2026-03-03,AAPL,buy,1,100,0,7',
      'date,symbol,side,qty,price,fee,id',
    );
    const dated = new Set<string>();
    expect(days.sheet.table.data.map((row, i) => 'fill' in parseFillRow(row, i + 2, days, dated, false))).toEqual([
      true,
      true,
    ]);
  });

  it('a signed quantity is the direction when there is no side column', () => {
    const r = fills('2026-03-02 10:00,AAPL,-3,100', 'time,symbol,qty,price');
    expect(parseFillRow(r.sheet.table.data[0], 2, r, new Set(), false)).toMatchObject({
      fill: { side: 'SELL', quantity: 3 },
    });
  });

  it('fills put back together into one trade per position, with what was left out said', () => {
    const r = fills(
      [
        '2026-03-02 10:00,AAPL,buy,2,100,1,F1',
        '2026-03-02 10:05,AAPL,buy,2,102,1,F2',
        '2026-03-02 10:30,AAPL,sell,4,105,1,F3',
        '2026-03-02 11:00,MSFT,buy,1,50,0,F4',
        '2026-03-02 11:00,TSLA,sell,1,,0,F5',
      ].join('\n'),
    );
    const read = tradesFromFills(r);
    expect(
      read.trades.map((t) => [t.symbol, t.quantity, t.entryPrice, t.exitPrice, t.fees, t.fillCount, t.externalId]),
    ).toEqual([
      ['AAPL', 4, 101, 105, 3, 3, 'F1|F2|F3'],
      ['MSFT', 1, 50, null, 0, 1, 'F4'],
    ]);
    expect(read.notices).toEqual([
      'Each row is one fill: 4 fills were put back together into 2 trades, following the position in each symbol.',
      '1 position was still open at the end of the file, so it was imported as open trade.',
    ]);
    expect(read.errors).toEqual(['Row 6: no price, so the fill was left out.']);
  });

  it('a sell that the file says closed a position, with no buy before it: opened before the file, no entry, flagged', () => {
    const read = tradesFromFills(
      fills('2026-03-02 10:30,AAPL,sell,4,105,1,F3,close', 'time,symbol,side,qty,price,fee,id,effect'),
    );
    expect(read.trades[0]).toMatchObject({
      side: 'LONG',
      openedAt: '',
      entryPrice: 0,
      exitPrice: 105,
      needsReview: true,
    });
    expect(read.errors[0]).toMatch(/^1 trade closes a position opened before this file starts/);
  });

  it('a position already imported is a duplicate; one that shares only some fills is imported and said', () => {
    const csv = ['2026-03-02 10:00,AAPL,buy,1,100,0,F1', '2026-03-02 10:30,AAPL,sell,1,105,0,F2'].join('\n');
    const again = fills(csv);
    again.existingIds.add('F1');
    again.existingIds.add('F2');
    expect(tradesFromFills(again).trades).toEqual([]);
    expect(again.findings.duplicates).toBe(1);

    const overlap = fills(csv);
    overlap.existingIds.add('F1');
    const read = tradesFromFills(overlap);
    expect(read.trades).toHaveLength(1);
    expect(read.errors).toEqual([
      '1 trade shares fills with trades already in your journal (a position that runs across two exports). Check for doubles.',
    ]);
  });

  it('a point value from the amount against the price, when every fill agrees on one', () => {
    const r = fills(
      ['2026-03-02 10:00,ESH6,buy,1,5000,0,F1,250000', '2026-03-02 10:30,ESH6,sell,1,5002,0,F2,250100'].join('\n'),
      'time,symbol,side,qty,price,fee,id,notional',
    );
    expect(tradesFromFills(r).trades[0].multiplier).toBe(50);
    expect([...r.findings.inferred]).toEqual([['ESH6', '50 (from the amount against the price)']]);
    expect([believable(49.97), believable(0.1), believable(3.3), believable(-1)]).toEqual([50, 0.1, null, null]);
  });
});

describe('stage 5: the messages', () => {
  const findings = (extra: Partial<Findings> = {}): Findings => ({
    noSymbol: [],
    unknownSides: new Map(),
    badMultipliers: { rows: [], value: '' },
    inferred: new Map(),
    foreignFees: new Set(),
    feesWritten: false,
    feesFound: false,
    rateNoSize: [],
    netAboveGross: [],
    pnlSetAside: new Set(),
    zoned: 0,
    unzoned: 0,
    duplicates: 0,
    ...extra,
  });
  const table = (extra: Partial<Table> = {}): Table => ({
    header: [],
    data: [],
    lines: [],
    preamble: 0,
    skipped: 0,
    statement: false,
    ...extra,
  });

  it('rows without a symbol first, then what the rows turned up, then what was left out', () => {
    const { errors } = collectMessages(
      findings({
        noSymbol: [4, 9],
        unknownSides: new Map([['x', [5]]]),
        badMultipliers: { rows: [6], value: '-2' },
        foreignFees: new Set(['BNB']),
      }),
      table(),
      { errors: ['from the rows'], notices: [] },
    );
    expect(errors).toEqual([
      'Row 4 and 1 more: no symbol, so they were skipped.',
      'from the rows',
      'Row 5: the direction "x" was not recognised, so it was imported as LONG. Check it.',
      'Row 6: the multiplier "-2" has to be more than 0, so it was left out. Check it.',
      'Fees paid in BNB were left out: they are not in the currency of the prices.',
    ]);
  });

  it('notices: what the rows said, values worked out, then how the table was found', () => {
    const { notices } = collectMessages(
      findings({ inferred: new Map([['ESH6', '50 a point (ES futures)']]), zoned: 2 }),
      table({ preamble: 3, skipped: 1 }),
      {
        errors: [],
        notices: ['from the rows'],
      },
    );
    expect(notices).toEqual([
      'from the rows',
      'ESH6: one point taken as worth 50 a point (ES futures). Check it if that is not right.',
      'The column names are on line 4; the lines above them were left out.',
      '1 total, summary or repeated header line was left out.',
      "Times in this file carry a time zone, so they were converted to this device's local time.",
    ]);
    expect(
      collectMessages(findings(), table({ statement: true, preamble: 3 }), { errors: [], notices: [] }).notices,
    ).toEqual(['Read the Trades section of this Interactive Brokers statement.']);
  });

  it('columns read from the words of their names come first of the notices, named with what they were read as', () => {
    const column = (index: number, header: string, role: Role | '', guessed: boolean) => ({
      index,
      header,
      role,
      suggested: role,
      guessed,
    });
    const notices = (columns: ReturnType<typeof column>[], kindFromGuesses = false, rowKind: RowKind = 'trades') =>
      collectMessages(
        findings(),
        table({ preamble: 3 }),
        { errors: [], notices: ['from the rows'] },
        { columns: columns.map((c) => ({ ...c, sample: '' })), rowKind, kindFromGuesses },
      ).notices;
    expect(notices([column(0, 'Symbol', 'symbol', false), column(1, 'Start Price', 'entry_price', true)])).toEqual([
      '"Start Price" was read as Entry price, from the words in its name. Check it under Columns if that is not right.',
      'from the rows',
      'The column names are on line 4; the lines above them were left out.',
    ]);
    expect(
      notices([column(0, 'Start Price', 'entry_price', true), column(1, 'Lots Traded', 'quantity', true)])[0],
    ).toBe(
      'Read from the words in their names: "Start Price" as Entry price, "Lots Traded" as Quantity. Check them under Columns if that is not right.',
    );
    expect(notices([column(0, 'Symbol', 'symbol', false)])).toEqual([
      'from the rows',
      'The column names are on line 4; the lines above them were left out.',
    ]);
    // and when they decided how the rows are read, that is said too
    expect(notices([column(0, 'Exec Px', 'price', true)], true, 'fills')[0]).toBe(
      '"Exec Px" was read as Fill price, from the words in its name. Because of it, each row was read as one fill; if each row is a whole trade, choose that under "Each row is". Check it under Columns if that is not right.',
    );
    expect(notices([column(0, 'End Price', 'exit_price', true)], true, 'trades')[0]).toMatch(
      /Because of it, each row was read as a whole trade; if each row is one fill, choose that under "Each row is"\./,
    );
  });

  it('times with no time zone are said to be taken as local; with some zoned, both are said in one notice', () => {
    const notices = (zoned: number, unzoned: number) =>
      collectMessages(findings({ zoned, unzoned }), table(), { errors: [], notices: [] }).notices;
    expect(notices(0, 3)).toEqual([
      "Times in this file carry no time zone, so they were taken as written, in this device's local time.",
    ]);
    expect(notices(2, 3)).toEqual([
      "Some times in this file carry a time zone, so they were converted to this device's local time; the others carry none and were taken as written.",
    ]);
    expect(notices(0, 0)).toEqual([]);
  });

  it('nothing to say when nothing turned up, and what the rows said is not changed', () => {
    const read = { errors: ['a'], notices: ['b'] };
    expect(collectMessages(findings(), table(), read)).toEqual({ errors: ['a'], notices: ['b'] });
    expect(read).toEqual({ errors: ['a'], notices: ['b'] });
    expect(rowsNote([3], 'one.', 'many.')).toBe('Row 3: one.');
    expect(rowsNote([3, 4, 5], 'one.', 'many.')).toBe('Row 3 and 2 more: many.');
  });
});

describe('stage 6: a position split over several rows put back together', () => {
  const part = (id: string, extra: Partial<Trade> = {}) =>
    trade({
      id,
      symbol: 'MNQ',
      quantity: 1,
      entryPrice: 18000,
      exitPrice: 18010,
      closedAt: '2026-03-04T10:05',
      ...extra,
    });

  it('rows that share the fill that opened them become one trade', () => {
    const trades = [part('a'), part('b', { exitPrice: 18020 }), part('c')];
    const out = combinePartials(
      trades,
      new Map([
        ['a', 'B1'],
        ['b', 'B1'],
      ]),
    );
    expect(out.combined).toBe(2);
    expect(out.trades).toHaveLength(2);
    expect(out.trades[0]).toMatchObject({ quantity: 2, entryPrice: 18000, exitPrice: 18015 });
    expect(out.trades[1].id).toBe('c');
  });

  it('a merged trade leaves a fee or point value unsaid only when every row did', () => {
    const trades = [part('a'), part('b', { exitPrice: 18020 }), part('c')];
    const opener = new Map([
      ['a', 'B1'],
      ['b', 'B1'],
    ]);
    const unsaid = new Map([
      ['a', { fees: true, multiplier: true }],
      ['b', { fees: true, multiplier: false }],
      ['c', { fees: true, multiplier: true }],
    ]);
    const out = combinePartials(trades, opener, unsaid);
    expect(out.trades[0].id).toBe('a');
    expect(Object.fromEntries(out.unsaid)).toEqual({
      a: { fees: true, multiplier: false },
      c: { fees: true, multiplier: true },
    });
    expect(unsaid.get('b')).toEqual({ fees: true, multiplier: false });
  });

  it('rows that cannot be merged stay apart, and nothing changes without opening fills', () => {
    const open = [part('a'), part('b', { exitPrice: null, closedAt: undefined })];
    expect(
      combinePartials(
        open,
        new Map([
          ['a', 'B1'],
          ['b', 'B1'],
        ]),
      ),
    ).toEqual({ trades: open, combined: 0, unsaid: new Map() });
    const trades = [part('a')];
    expect(combinePartials(trades, new Map()).trades).toBe(trades);
  });
});
