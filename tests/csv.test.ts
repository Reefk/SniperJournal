import { describe, expect, it } from 'vitest';
import { importTradesFromCsv, parseCsv, tradesToCsv } from '@/lib/csv';
import { grossPnl, isClosed, netPnl } from '@/lib/trade-math';
import type { Account, Setup, Trade } from '@/lib/types';
import { trade } from './helpers';

const accounts: Account[] = [
  { id: 'acc1', name: 'Main Portfolio', startingBalance: 0, createdAt: '' },
  { id: 'acc2', name: 'Prop Challenge', startingBalance: 0, createdAt: '' },
];
const ctx = (extra: Partial<Parameters<typeof importTradesFromCsv>[1]> = {}) => ({
  accountId: 'acc1',
  accounts,
  setups: [] as Setup[],
  ...extra,
});
const one = (csv: string, extra = {}) => importTradesFromCsv(csv, ctx(extra)).trades[0];

describe('parseCsv', () => {
  it('handles quoted delimiters, escaped quotes and newlines inside quotes', () => {
    const rows = parseCsv('a,b,c\n"x, y","say ""hi""","line 1\nline 2"\n');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'line 1\nline 2'],
    ]);
  });

  it('strips a UTF-8 BOM and accepts Windows and old Mac line endings', () => {
    expect(parseCsv('﻿symbol,qty\r\nAAPL,1\rMSFT,2')).toEqual([
      ['symbol', 'qty'],
      ['AAPL', '1'],
      ['MSFT', '2'],
    ]);
  });

  it('detects a semicolon delimiter and drops blank lines', () => {
    expect(parseCsv('symbol;qty\n\nAAPL;"1,5"\n  \n')).toEqual([
      ['symbol', 'qty'],
      ['AAPL', '1,5'],
    ]);
  });

  it('a stray quote inside an unquoted field is kept as text instead of swallowing the rest of the file', () => {
    const rows = parseCsv('symbol,notes\nAAPL,12" monitor\nMSFT,ok\n');
    expect(rows).toEqual([
      ['symbol', 'notes'],
      ['AAPL', '12" monitor'],
      ['MSFT', 'ok'],
    ]);
  });
});

describe('import: structure of the file', () => {
  it('an empty file, or headers with no rows, is reported as having no data', () => {
    expect(importTradesFromCsv('', ctx()).errors).toEqual(['The file has no data rows.']);
    expect(importTradesFromCsv('symbol,side\n', ctx()).errors).toEqual(['The file has no data rows.']);
  });

  it('without a symbol column nothing is imported, and the columns found are listed', () => {
    const r = importTradesFromCsv('ticker_name,qty\nAAPL,1', ctx());
    expect(r.trades).toHaveLength(0);
    expect(r.errors[0]).toContain('ticker_name, qty');
  });

  it('reordered and aliased columns map to the same fields; unknown ones are listed as ignored', () => {
    const r = importTradesFromCsv(
      'Exit Price,Ticker,Qty,Entry Price,Direction,Entry Time,Exit Time,Commission,Broker Note\n110,aapl,10,100,Buy,2026-03-02 10:00,2026-03-02 11:00,1.5,x',
      ctx(),
    );
    const t = r.trades[0];
    expect([t.symbol, t.side, t.quantity, t.entryPrice, t.exitPrice, t.fees]).toEqual(['AAPL', 'LONG', 10, 100, 110, 1.5]);
    expect(netPnl(t)).toBeCloseTo(98.5, 10);
    expect(r.ignored).toEqual(['Broker Note']);
  });

  it('rows without a symbol are skipped with a reason; rows missing details are kept but flagged', () => {
    const r = importTradesFromCsv('symbol,side,qty,entry,exit\n,Buy,1,100,101\nAAPL,Buy,,100,101\nMSFT,Buy,-3,100,101', ctx());
    expect(r.errors).toEqual(['Row 2: no symbol, so the row was skipped.']);
    expect(r.trades.map((t) => t.symbol)).toEqual(['AAPL', 'MSFT']);
    expect(r.trades.every((t) => t.needsReview)).toBe(true);
    expect(r.incomplete).toBe(2);
  });

  it('suspicious-looking text is kept as plain text', () => {
    const t = one('symbol,notes\nAAPL,<script>alert(1)</script>');
    expect(t.notes).toBe('<script>alert(1)</script>');
  });

  it('maps rows to accounts by name and creates missing playbook setups once', () => {
    const r = importTradesFromCsv('symbol,account,setup\nA,prop challenge,ORB\nB,Unknown,orb', ctx());
    expect(r.trades.map((t) => t.accountId)).toEqual(['acc2', 'acc1']);
    expect(r.newSetups).toHaveLength(1);
    expect(r.trades[0].setupId).toBe(r.trades[1].setupId);
  });
});

describe('import: numbers', () => {
  it.each([
    ['plain', '1234.5', 1234.5],
    ['US thousands', '1,234.50', 1234.5],
    ['currency sign', '$1,234.50', 1234.5],
    ['accounting negative', '(120)', -120],
    ['negative currency', '-$80', -80],
    ['European thousands and decimals', '1.234,50', 1234.5],
    ['European decimal comma', '1234,5', 1234.5],
    ['European forex price', '1,08640', 1.0864],
    ['European thousands only', '1.234.567', 1234567],
  ])('%s: %s', (_, raw, expected) => {
    const t = one(`symbol;entry_price\nEURUSD;"${raw}"`);
    expect(t.entryPrice).toBeCloseTo(expected, 8);
  });

  it('text that is not a number leaves the field empty and the trade flagged', () => {
    const t = one('symbol,entry_price,quantity\nAAPL,abc,NaN');
    expect(t.entryPrice).toBe(0);
    expect(t.quantity).toBe(0);
    expect(t.needsReview).toBe(true);
  });

  it('a multiplier of zero or less is not used, and is reported (the trade form refuses it too)', () => {
    const res = importTradesFromCsv(
      'symbol,side,quantity,entry_price,exit_price,multiplier\nES,Buy,1,100,110,-2\nNQ,Buy,1,100,110,0\nYM,Buy,1,100,110,5',
      ctx(),
    );
    // a winning long must not turn into a loss because of a sign typo
    expect(res.trades.map((t) => t.multiplier)).toEqual([1, 1, 5]);
    expect(res.trades.map((t) => netPnl(t))).toEqual([10, 10, 50]);
    expect(res.errors.join('\n')).toMatch(/Row 2 and 1 more: the multiplier "-2" has to be more than 0/);
  });

  it('when the multiplier is unusable, a reported P&L still sets it', () => {
    const t = one('symbol,side,quantity,entry_price,exit_price,multiplier,pnl\nES,Buy,1,5000,5010,-50,500');
    expect(t.multiplier).toBe(50);
    expect(netPnl(t)).toBe(500);
  });
});

describe('import: dates and times', () => {
  it.each([
    ['ISO with seconds', '2026-03-04 13:05:12', '2026-03-04T13:05'],
    ['ISO with T', '2026-03-04T09:30', '2026-03-04T09:30'],
    ['US with seconds (Tradovate)', '03/04/2026 13:05:12', '2026-03-04T13:05'],
    ['US with PM', '3/4/2026 1:05 PM', '2026-03-04T13:05'],
    ['ISO with PM', '2026-03-04 1:05 PM', '2026-03-04T13:05'],
    ['midnight AM', '3/4/2026 12:10 AM', '2026-03-04T00:10'],
    ['day first, unambiguous', '25/03/2026 10:00', '2026-03-25T10:00'],
    ['date only', '2026-03-04', '2026-03-04T00:00'],
  ])('%s: %s', (_, raw, expected) => {
    expect(one(`symbol,opened_at\nAAPL,${raw}`).openedAt).toBe(expected);
  });

  it('a zone suffix is ignored: times are kept as the wall-clock time written in the file', () => {
    expect(one('symbol,opened_at\nAAPL,2026-03-04T14:30:00Z').openedAt).toBe('2026-03-04T14:30');
  });

  it('an impossible date is rejected rather than stored, so the trade is flagged', () => {
    for (const raw of ['2026-13-45 10:00', '2026-02-30', '31/02/2026', '2026-03-04 25:61']) {
      const t = one(`symbol,opened_at,quantity,entry_price\nAAPL,${raw},1,100`);
      expect(t.openedAt, raw).toBe('');
      expect(t.needsReview, raw).toBe(true);
    }
  });

  it('one file is read with one date order: a day above 12 anywhere makes the whole file day-first', () => {
    const r = importTradesFromCsv('symbol,opened_at\nA,13/04/2026 10:00\nB,03/04/2026 10:00', ctx());
    expect(r.trades.map((t) => t.openedAt)).toEqual(['2026-04-13T10:00', '2026-04-03T10:00']);
  });
});

describe('import: direction', () => {
  it.each([
    ['Buy', 'LONG'],
    ['long', 'LONG'],
    ['Sell', 'SHORT'],
    ['SHORT', 'SHORT'],
    ['Sell Short', 'SHORT'],
    ['Short Sell', 'SHORT'],
  ])('%s -> %s', (raw, expected) => {
    expect(one(`symbol,side\nAAPL,${raw}`).side).toBe(expected);
  });

  it('a direction the importer does not recognise is reported, not silently guessed', () => {
    const r = importTradesFromCsv('symbol,side\nAAPL,Stock', ctx());
    expect(r.errors.join(' ')).toMatch(/Row 2.*"Stock"/);
  });

  it('a file with no direction column says that every row was taken as a long', () => {
    const r = importTradesFromCsv('symbol,entry,exit\nAAPL,100,101', ctx());
    expect(r.errors).toEqual(['There is no direction column, so every row was imported as LONG. Check any shorts.']);
  });
});

describe('import: P&L columns and fees', () => {
  it('derives the contract multiplier from a gross P&L column', () => {
    const t = one('symbol,side,qty,entry,exit,pnl\nES,Buy,1,5000,5002,100');
    expect(t.multiplier).toBe(50);
    expect(t.manualPnl).toBeNull();
    expect(grossPnl(t)).toBe(100);
  });

  it('a net P&L column next to a commission column counts the commission once', () => {
    // 1 ES contract, +2 points = $100 gross, $4.50 commission, $95.50 net
    const t = one('symbol,side,qty,entry,exit,commission,net pnl\nES,Buy,1,5000,5002,4.5,95.5');
    expect(t.fees).toBe(4.5);
    expect(netPnl(t)).toBeCloseTo(95.5, 10);
    expect(t.multiplier).toBe(50);
  });

  it('a P&L with no prices to check it against becomes the manual P&L', () => {
    const t = one('symbol,pnl\nAAPL,-42.5');
    expect(t.manualPnl).toBe(-42.5);
    expect(isClosed(t)).toBe(true);
  });
});

describe('import: duplicates and partial fills', () => {
  const paired =
    'symbol,qty,buyPrice,sellPrice,boughtTimestamp,soldTimestamp,buyFillId,sellFillId,pnl\n' +
    'MNQ,1,18000,18010,03/04/2026 10:00:00,03/04/2026 10:05:00,B1,S1,20\n' +
    'MNQ,1,18000,18020,03/04/2026 10:00:00,03/04/2026 10:09:00,B1,S2,40\n' +
    'MNQ,1,18050,18040,03/04/2026 11:00:05,03/04/2026 11:00:00,B3,S3,20';

  it('pairs buy and sell fills, works out the direction, and folds partial exits together', () => {
    const r = importTradesFromCsv(paired, ctx());
    expect(r.pairedFills).toBe(true);
    expect(r.combined).toBe(2);
    expect(r.trades).toHaveLength(2);
    const long = r.trades.find((t) => t.side === 'LONG') as Trade;
    expect(long.quantity).toBe(2);
    expect(grossPnl(long)).toBeCloseTo(60, 8);
    expect(long.multiplier).toBe(2);
    const short = r.trades.find((t) => t.side === 'SHORT') as Trade;
    expect(grossPnl(short)).toBeCloseTo(20, 8); // sold first at 18050, bought back at 18040
  });

  it('importing the same fills again adds nothing', () => {
    const first = importTradesFromCsv(paired, ctx());
    const again = importTradesFromCsv(paired, ctx({ existing: first.trades }));
    expect(again.trades).toHaveLength(0);
    expect(again.duplicates).toBe(3);
  });

  it('a file overlapping an earlier import only adds the new fills', () => {
    const first = importTradesFromCsv(paired.split('\n').slice(0, 3).join('\n'), ctx());
    const again = importTradesFromCsv(paired, ctx({ existing: first.trades }));
    expect(again.duplicates).toBe(2);
    expect(again.trades).toHaveLength(1);
  });

  it('two genuine trades with identical fields and no ids are both kept', () => {
    const r = importTradesFromCsv('symbol,qty,entry,exit\nAAPL,1,100,101\nAAPL,1,100,101', ctx());
    expect(r.trades).toHaveLength(2);
  });

  it('a repeated id inside one file is imported once', () => {
    const r = importTradesFromCsv('symbol,id\nAAPL,7\nAAPL,7', ctx());
    expect(r.trades).toHaveLength(1);
    expect(r.duplicates).toBe(1);
  });
});

describe('export', () => {
  const setups: Setup[] = [{ id: 's1', name: 'Opening Range, v2', rules: [] }];
  const trades = [
    trade({ symbol: 'AAPL', entryPrice: 187.4, exitPrice: 189.1, quantity: 100, fees: 1.3, setupId: 's1', tags: ['a', 'b'], notes: 'Took it, "early"\nsecond line ₪ שלום' }),
    trade({ symbol: 'ES', side: 'SHORT', entryPrice: 5002.25, exitPrice: 4995.5, quantity: 2, multiplier: 50, stopLoss: 5010 }),
    trade({ symbol: 'EURUSD', manualPnl: -42.35, exitPrice: null, fees: 0.5 }),
    trade({ symbol: 'NQ', exitPrice: null, closedAt: undefined }),
  ];

  it('round-trips through import with every trading value intact', () => {
    const csv = tradesToCsv(trades, setups, accounts);
    const back = importTradesFromCsv(csv, ctx({ setups })).trades;
    expect(back).toHaveLength(trades.length);
    back.forEach((b, i) => {
      const a = trades[i];
      expect(b.symbol).toBe(a.symbol);
      expect(b.side).toBe(a.side);
      expect(b.openedAt).toBe(a.openedAt);
      expect(b.closedAt).toBe(a.closedAt);
      expect(b.quantity).toBe(a.quantity);
      expect(b.fees).toBe(a.fees);
      expect(b.tags).toEqual(a.tags);
      expect(b.notes).toBe(a.notes);
      expect(b.setupId).toBe(a.setupId);
      expect(isClosed(b)).toBe(isClosed(a));
      expect(netPnl(b)).toBeCloseTo(netPnl(a), 8);
    });
  });

  it('text that a spreadsheet would run as a formula is neutralised, and restored on re-import', () => {
    const risky = trade({ symbol: 'AAPL', notes: '=HYPERLINK("http://example.invalid","x")', tags: ['+cmd', '@sum'] });
    const csv = tradesToCsv([risky], [], accounts);
    const row = parseCsv(csv)[1];
    expect(row[15]).toBe(`'=HYPERLINK("http://example.invalid","x")`);
    expect(row[14]).toBe(`'+cmd|@sum`);
    const back = importTradesFromCsv(csv, ctx()).trades[0];
    expect(back.notes).toBe(risky.notes);
    expect(back.tags).toEqual(['+cmd', '@sum']);
  });

  it('negative numbers are not treated as formulas', () => {
    const csv = tradesToCsv([trade({ manualPnl: -12.5, exitPrice: null })], [], accounts);
    expect(parseCsv(csv)[1].at(-2)).toBe('-12.50');
  });
});
