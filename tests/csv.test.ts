import { describe, expect, it } from 'vitest';
import { fileTooLarge, importTradesFromCsv, parseCsv, sheetTooLarge, tradesToCsv } from '@/lib/csv';
import { IMPORT_LIMIT } from '@/lib/import/size';
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

  // roadmap 2.3: 10 MB is about 60,000 trades or 100,000 fills, read in one to two seconds on a PC
  it('a file or a sheet over 10 MB is refused with what to do instead; one at the limit is read', () => {
    const split = 'Export a shorter period from your platform, or split the file, and import each part.';
    expect(IMPORT_LIMIT).toBe(10 * 1024 * 1024);
    expect(fileTooLarge(IMPORT_LIMIT)).toBeNull();
    expect(fileTooLarge(2_000_000)).toBeNull();
    // rounded up, so a file just past the limit never reads as "10.0 MB"
    expect(fileTooLarge(IMPORT_LIMIT + 1)).toBe(`This file is 10.1 MB, more than one import takes (10 MB). ${split}`);
    expect(fileTooLarge(3 * 1024 ** 3)).toBe(`This file is 3.00 GB, more than one import takes (10 MB). ${split}`);
    expect(sheetTooLarge('x'.repeat(IMPORT_LIMIT))).toBeNull();
    expect(sheetTooLarge('x'.repeat(15 * 1024 * 1024))).toBe(
      `This sheet holds 15.0 MB of data, more than one import takes (10 MB). ${split}`,
    );
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
    expect([t.symbol, t.side, t.quantity, t.entryPrice, t.exitPrice, t.fees]).toEqual([
      'AAPL',
      'LONG',
      10,
      100,
      110,
      1.5,
    ]);
    expect(netPnl(t)).toBeCloseTo(98.5, 10);
    expect(r.ignored).toEqual(['Broker Note']);
  });

  it('rows without a symbol are skipped with a reason; rows missing details are kept but flagged', () => {
    const r = importTradesFromCsv(
      'symbol,side,qty,entry,exit\n,Buy,1,100,101\nAAPL,Buy,,100,101\nMSFT,Buy,-3,100,101',
      ctx(),
    );
    expect(r.errors).toEqual([
      'Row 2: no symbol, so the row was skipped.',
      'Row 3 and 1 more: no size above 0, so the trades were marked needs details.',
    ]);
    expect(r.trades.map((t) => t.symbol)).toEqual(['AAPL', 'MSFT']);
    expect(r.trades.every((t) => t.needsReview)).toBe(true);
    expect(r.incomplete).toBe(2);
  });

  // roadmap 2.4: until 2026-10-16 these rows came in blank, or marked needs
  // details, without a word of why
  it('a time written but unreadable, or no size, is reported by row; the trade is imported all the same', () => {
    const r = importTradesFromCsv(
      [
        'symbol,side,opened_at,closed_at,qty,entry,exit',
        'AAPL,long,2026-02-30 10:00,2026-03-02 11:00,1,100,101', // 30 February
        'MSFT,long,2026-03-02 10:00,2026-03-02 25:10,1,100,101', // 25:10
        'NVDA,long,2026-03-02 10:00,2026-03-02 11:00,0,100,101',
        'TSLA,long,2026-03-02 10:00,2026-13-45,2,100,', // still open, so its exit time counts for nothing
        'AMD,long,n/a,-,1,100,101', // no digits: no time given, nothing misread
      ].join('\n'),
      ctx(),
    );
    expect(r.trades.map((t) => t.symbol)).toEqual(['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMD']);
    expect(r.errors).toEqual([
      'Row 2: the entry time "2026-02-30 10:00" could not be read, so it was left blank and the trade marked needs details.',
      'Row 3: the exit time "2026-03-02 25:10" could not be read, so it was left blank: until it is filled in, the trade counts on the day it was opened.',
      'Row 4: no size above 0, so the trade was marked needs details.',
    ]);
    const msft = r.trades[1];
    expect([msft.closedAt, isClosed(msft), msft.needsReview]).toEqual([undefined, true, undefined]);
    expect(r.trades.filter((t) => t.needsReview).map((t) => t.symbol)).toEqual(['AAPL', 'NVDA', 'AMD']);

    const many = importTradesFromCsv(
      'symbol,side,opened_at,qty,entry\nA,long,31/02/2026,1,1\nB,long,32/01/2026,1,1',
      ctx(),
    );
    expect(many.errors).toEqual([
      'Row 2 and 1 more: the entry time could not be read (the first is "31/02/2026"), so it was left blank and the trades marked needs details.',
    ]);
    // a paired export: the fill that closed the position is the exit
    const paired = importTradesFromCsv(
      'symbol,qty,buyPrice,sellPrice,boughtTimestamp,soldTimestamp\nMNQH6,1,100,101,03/02/2026 09:31:05,03/02/2026 25:00:00',
      ctx(),
    );
    expect(paired.errors).toEqual([
      'Row 2: the exit time "03/02/2026 25:00:00" could not be read, so it was left blank: until it is filled in, the trade counts on the day it was opened.',
    ]);
  });

  it('a file with no size column says every trade needs one, once', () => {
    expect(importTradesFromCsv('symbol,side,entry,exit\nAAPL,long,100,101\nMSFT,short,50,49', ctx()).errors).toEqual([
      'There is no size column, so every trade was marked needs details. Fill in the sizes after importing.',
    ]);
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

  it('a zone suffix is read as that zone and converted to local time (UTC in these tests, so unchanged)', () => {
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
    const r = importTradesFromCsv('symbol,qty,entry,exit\nAAPL,1,100,101', ctx());
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

  it('a P&L with the fees already taken off and no fee column keeps it as written, at the point value expected', () => {
    // 0.5 BTC up 1000 is 500 before fees; this used to give a point value of 0.9512
    const btc = one('symbol,side,qty,entry,exit,net pnl\nBTCUSDT,Long,0.5,60000,61000,475.60');
    expect([btc.multiplier, btc.manualPnl, netPnl(btc)]).toEqual([1, 475.6, 475.6]);
    // 2 MNQ up 10.5 points is 42 before fees; this used to give 1.9410 a point
    const r = importTradesFromCsv('symbol,side,qty,entry,exit,net pnl\nMNQH6,Long,2,21000.25,21010.75,40.76', ctx());
    expect([r.trades[0].multiplier, r.trades[0].manualPnl]).toEqual([2, 40.76]);
    expect(r.notices.join(' ')).toMatch(/MNQH6: one point taken as worth 2 a point \(MNQ futures\)/);
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

  // SJ-27: with no ids, a trade imported before is told by its fields (same
  // account, symbol, side, entry time and size) and left out, unless asked for
  // (import/likely.ts). Until 2026-10-16 every trade was added again, without a word.
  it('a file without trade ids imported again adds nothing: every trade is a likely duplicate', () => {
    const csv =
      'symbol,side,opened_at,qty,entry,exit\nAAPL,long,2026-03-02 10:00,1,100,101\nMSFT,short,2026-03-02 11:00,2,50,49';
    const first = importTradesFromCsv(csv, ctx());
    const again = importTradesFromCsv(csv, ctx({ existing: first.trades }));
    expect(again.trades).toHaveLength(0);
    expect(again.likelyDuplicates.map((t) => t.symbol)).toEqual(['AAPL', 'MSFT']);
    expect(again.duplicates).toBe(0);
    expect(again.errors).toEqual([]);
    expect(again.notices).toEqual([
      "Times in this file carry no time zone, so they were taken as written, in this device's local time.",
    ]);
  });

  it("a daily export overlapping yesterday's adds only the new day's trades", () => {
    const head = 'symbol,side,opened_at,closed_at,qty,entry,exit';
    const monday = 'AAPL,long,2026-03-02 10:00,2026-03-02 10:30,1,100,101';
    const tuesday = ['MSFT,short,2026-03-03 11:00,2026-03-03 11:20,2,50,49', 'NVDA,long,2026-03-03 14:05,,3,120,'];
    const first = importTradesFromCsv([head, monday].join('\n'), ctx());
    const again = importTradesFromCsv([head, monday, ...tuesday].join('\n'), ctx({ existing: first.trades }));
    expect(again.trades.map((t) => t.symbol)).toEqual(['MSFT', 'NVDA']);
    expect(again.likelyDuplicates.map((t) => t.symbol)).toEqual(['AAPL']);
  });

  it('a trade first logged by hand is recognised in the broker file, ids or not', () => {
    const byHand = trade({ symbol: 'AAPL', openedAt: '2026-03-02T10:00', quantity: 10 });
    const r = importTradesFromCsv(
      'symbol,side,opened_at,qty,entry,exit,id\nAAPL,long,2026-03-02 10:00:41,10,100,101,77',
      ctx({ existing: [byHand] }),
    );
    expect(r.trades).toHaveLength(0);
    expect(r.likelyDuplicates).toHaveLength(1);
  });

  it('a trade the journal has open, which the file closes, is imported and flagged', () => {
    const open = trade({ symbol: 'AAPL', exitPrice: null, closedAt: undefined });
    const r = importTradesFromCsv(
      'symbol,side,opened_at,closed_at,qty,entry,exit\nAAPL,long,2026-03-02 10:00,2026-03-02 11:00,1,100,104',
      ctx({ existing: [open] }),
    );
    expect(r.trades).toHaveLength(1);
    expect(r.likelyDuplicates).toHaveLength(0);
    expect(r.errors).toEqual([
      '1 trade closes a position your journal still has as open. Both are kept: delete the open copy once you have checked.',
    ]);
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
    trade({
      symbol: 'AAPL',
      entryPrice: 187.4,
      exitPrice: 189.1,
      quantity: 100,
      fees: 1.3,
      setupId: 's1',
      tags: ['a', 'b'],
      notes: 'Took it, "early"\nsecond line ₪ שלום',
    }),
    trade({
      symbol: 'ES',
      side: 'SHORT',
      entryPrice: 5002.25,
      exitPrice: 4995.5,
      quantity: 2,
      multiplier: 50,
      stopLoss: 5010,
    }),
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
