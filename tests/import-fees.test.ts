import { describe, expect, it } from 'vitest';
import { importTradesFromCsv, noFeesNotice, zeroFeesNotice, type FeeRate, type ImportResult } from '@/lib/csv';
import { grossPnl, netPnl } from '@/lib/trade-math';

const NO_FEES = noFeesNotice();
const ZERO_FEES = zeroFeesNotice();
import type { Account, Setup, Trade } from '@/lib/types';

/**
 * A fee given in the import window (src/lib/fee-rate.ts): per trade, or per
 * contract on each side. Added to a file that has none of its own; a file
 * with fees keeps them, worked out as before, unless it is told to charge
 * the fee given in their place. Made-up trades only.
 */

const accounts: Account[] = [{ id: 'acc1', name: 'Main Portfolio', startingBalance: 0, createdAt: '' }];
const run = (csv: string, addFee?: FeeRate, existing: Trade[] = []) =>
  importTradesFromCsv(csv, { accountId: 'acc1', accounts, setups: [] as Setup[], existing, addFee });
/** the file's own fees replaced by `replaceFees` */
const replacing = (csv: string, replaceFees?: FeeRate, existing: Trade[] = []) =>
  importTradesFromCsv(csv, { accountId: 'acc1', accounts, setups: [] as Setup[], existing, replaceFees });
const PER_CONTRACT: FeeRate = { per: 'contract', amount: 0.95 };
const PER_TRADE: FeeRate = { per: 'trade', amount: 1.9 };
const cents = (n: number) => Math.round(n * 100) / 100;
const sum = (values: number[]) => cents(values.reduce((a, b) => a + b, 0));
const feeNotice = (r: ImportResult) => r.notices.find((n) => n === NO_FEES || n === ZERO_FEES);

const TRADES = 'symbol,side,qty,entry,exit,entry time,exit time';
/** one closed 2-lot and one 3-lot still open, no fees */
const closedAndOpen = [
  TRADES,
  'MESZ6,long,2,5000,5010,2026-03-02 10:00,2026-03-02 11:00',
  'MESZ6,short,3,5020,,2026-03-02 12:00,',
].join('\n');

/** the journal after pressing Import, as importTrades does it */
const apply = (journal: Trade[], r: ImportResult) => {
  const finished = new Map(r.finished.map((t) => [t.id, t]));
  return [...journal.map((t) => finished.get(t.id) ?? t), ...r.trades];
};

describe('a file with no fees of its own', () => {
  it('brings its trades in with fees of 0, and says the file has none', () => {
    const r = run(closedAndOpen);
    expect(r.feesMissing).toBe('none');
    expect(r.trades.map((t) => t.fees)).toEqual([0, 0]);
    expect(feeNotice(r)).toBe(NO_FEES);
  });

  it('a fee per contract is charged on the way in and again on the way out; an open trade pays its way in', () => {
    const r = run(closedAndOpen, PER_CONTRACT);
    expect(r.trades.map((t) => t.fees)).toEqual([3.8, 2.85]);
    // 10 points × 2 contracts × $5, less 0.95 × 2 contracts × 2 sides
    expect(netPnl(r.trades[0])).toBe(96.2);
    // the trades now have their fees, so they aren't said to have none
    expect(feeNotice(r)).toBeUndefined();
    expect(r.feesMissing).toBe('none');
  });

  it('a fee per trade is the amount once on every trade, open or closed, whatever its size', () => {
    const r = run(closedAndOpen, PER_TRADE);
    expect(r.trades.map((t) => t.fees)).toEqual([1.9, 1.9]);
    expect(netPnl(r.trades[0])).toBe(98.1);
  });

  // the 2026-10-22 case, with made-up trades: a Performance export with no
  // fees came in $72.20 above the broker's balance, $0.95 a side on 38 contracts
  it('38 contracts at 0.95 a side is 72.20 in fees, taken off the P&L', () => {
    const csv = [
      TRADES,
      'MESZ6,long,10,5000,5000.25,2026-03-02 09:31,2026-03-02 09:40',
      'MESZ6,short,10,5010,5010.5,2026-03-02 10:02,2026-03-02 10:11',
      'MESZ6,long,8,5020,5021,2026-03-02 10:30,2026-03-02 10:52',
      'MESZ6,long,6,5030,5030.75,2026-03-02 11:15,2026-03-02 11:20',
      'MESZ6,short,4,5040,5040.25,2026-03-02 13:05,2026-03-02 13:30',
    ].join('\n');
    const before = run(csv);
    expect(sum(before.trades.map(netPnl))).toBe(45);
    const r = run(csv, PER_CONTRACT);
    expect(sum(r.trades.map((t) => t.fees))).toBe(72.2);
    expect(sum(r.trades.map(grossPnl))).toBe(45);
    expect(sum(r.trades.map(netPnl))).toBe(-27.2);
  });

  it('a file of fills: every fill pays its side, so scaling in and out costs the same per contract', () => {
    const csv = [
      'time,symbol,side,qty,price',
      '2026-03-02 10:00,MESZ6,buy,1,5000',
      '2026-03-02 10:05,MESZ6,buy,1,5002',
      '2026-03-02 10:30,MESZ6,sell,2,5010',
      // still open at the end of the file
      '2026-03-02 14:00,MESZ6,buy,3,5030',
    ].join('\n');
    const r = run(csv, PER_CONTRACT);
    expect(r.trades.map((t) => [t.quantity, t.fees])).toEqual([
      [2, 3.8],
      [3, 2.85],
    ]);
  });

  it('every fee in the file 0: the fee given is charged, as for a file with none', () => {
    const csv = [`${TRADES},fee`, 'MESZ6,long,2,5000,5010,2026-03-02 10:00,2026-03-02 11:00,0'].join('\n');
    expect(run(csv).feesMissing).toBe('zero');
    expect(feeNotice(run(csv))).toBe(ZERO_FEES);
    expect(run(csv, PER_CONTRACT).trades.map((t) => t.fees)).toEqual([3.8]);
  });

  it('no amount, or one not above 0, adds nothing, and the file is still said to have none', () => {
    for (const amount of [0, -1]) {
      const r = run(closedAndOpen, { per: 'contract', amount });
      expect(r.trades.map((t) => t.fees)).toEqual([0, 0]);
      expect(feeNotice(r)).toBe(NO_FEES);
    }
  });

  it('trades left out as likely duplicates get it too, for when they are imported anyway', () => {
    const first = run(closedAndOpen);
    const again = run(closedAndOpen, PER_CONTRACT, first.trades);
    expect(again.trades).toEqual([]);
    expect(again.likelyDuplicates.map((t) => t.fees)).toEqual([3.8, 2.85]);
  });
});

describe('a file with fees of its own keeps them, worked out from the file', () => {
  it('a fee column: the fee given is not added', () => {
    const csv = [`${TRADES},fee`, 'MESZ6,long,2,5000,5010,2026-03-02 10:00,2026-03-02 11:00,2.5'].join('\n');
    const r = run(csv, PER_CONTRACT);
    expect(r.feesMissing).toBeNull();
    expect(r.trades.map((t) => t.fees)).toEqual([2.5]);
    expect(feeNotice(r)).toBeUndefined();
  });

  it("a fee per contract column: the file's own rate, times the size, in and out", () => {
    const csv = [
      `${TRADES},commission fill rate`,
      'MESZ6,long,2,5000,5010,2026-03-02 10:00,2026-03-02 11:00,0.62',
    ].join('\n');
    const r = run(csv, PER_CONTRACT);
    expect(r.feesMissing).toBeNull();
    expect(r.trades.map((t) => t.fees)).toEqual([2.48]);
  });

  it('a P&L after fees says what they were: none is missing', () => {
    const csv = [`${TRADES},net p&l`, 'MESZ6,long,2,5000,5010,2026-03-02 10:00,2026-03-02 11:00,97.5'].join('\n');
    const r = run(csv, PER_CONTRACT);
    expect(r.feesMissing).toBeNull();
    expect(netPnl(r.trades[0])).toBe(97.5);
  });

  it('one fee in the file is enough: the rows without one stay at 0', () => {
    const csv = [
      `${TRADES},fee`,
      'MESZ6,long,2,5000,5010,2026-03-02 10:00,2026-03-02 11:00,2.5',
      'MESZ6,long,2,5000,5010,2026-03-02 12:00,2026-03-02 13:00,',
    ].join('\n');
    const r = run(csv, PER_CONTRACT);
    expect(r.feesMissing).toBeNull();
    expect(r.trades.map((t) => t.fees)).toEqual([2.5, 0]);
  });
});

describe('a file with fees of its own, told to charge yours in their place', () => {
  const withFees = [
    `${TRADES},fee`,
    'MESZ6,long,2,5000,5010,2026-03-02 10:00,2026-03-02 11:00,2.5',
    'MESZ6,short,3,5020,,2026-03-02 12:00,,1.2',
  ].join('\n');

  it('a fee per contract replaces each trade fee: in and out, and an open trade its way in', () => {
    const r = replacing(withFees, PER_CONTRACT);
    expect(r.feesMissing).toBeNull();
    expect(r.trades.map((t) => t.fees)).toEqual([3.8, 2.85]);
    expect(netPnl(r.trades[0])).toBe(96.2);
    expect(feeNotice(r)).toBeUndefined();
  });

  it('a fee per trade replaces them with the amount once on every trade', () => {
    expect(replacing(withFees, PER_TRADE).trades.map((t) => t.fees)).toEqual([1.9, 1.9]);
  });

  it('a P&L after fees: the fees it says are replaced too, so the P&L is the gross less yours', () => {
    const csv = [
      `${TRADES},gross p&l,net p&l`,
      'MESZ6,long,2,5000,5010,2026-03-02 10:00,2026-03-02 11:00,100,97.5',
    ].join('\n');
    expect(replacing(csv).trades.map((t) => [t.fees, netPnl(t)])).toEqual([[2.5, 97.5]]);
    const r = replacing(csv, PER_TRADE);
    expect(r.trades.map((t) => t.fees)).toEqual([1.9]);
    expect(netPnl(r.trades[0])).toBe(98.1);
  });

  it('no amount, or one not above 0, leaves the file its own fees', () => {
    for (const amount of [0, -1]) {
      expect(replacing(withFees, { per: 'contract', amount }).trades.map((t) => t.fees)).toEqual([2.5, 1.2]);
    }
  });

  it('only a file with fees is changed by it: one with none still comes in at 0, and is said to have none', () => {
    const r = replacing(closedAndOpen, PER_CONTRACT);
    expect(r.trades.map((t) => t.fees)).toEqual([0, 0]);
    expect(feeNotice(r)).toBe(NO_FEES);
  });

  it('an open trade the file finishes is charged yours for the whole trade, in place of both fills', () => {
    const FILLS = 'time,symbol,side,qty,price,id,commission';
    const journal = apply([], replacing([FILLS, '2026-03-02 15:50,MESZ6,buy,4,5000,F1,2.48'].join('\n')));
    expect(journal.map((t) => t.fees)).toEqual([2.48]);
    const close = [FILLS, '2026-03-03 09:45,MESZ6,sell,4,5010,F2,2.48'].join('\n');
    // left alone, the file's fee for the way out is added to the journal's
    expect(replacing(close, undefined, journal).finished.map((t) => t.fees)).toEqual([4.96]);
    const r = replacing(close, PER_CONTRACT, journal);
    expect(r.finished.map((t) => [t.id, t.fees])).toEqual([[journal[0].id, 7.6]]);
  });
});

describe('a trade the journal has open, finished by a file with no fees', () => {
  const FILLS = 'time,symbol,side,qty,price,id';
  const day1 = [FILLS, '2026-03-02 15:50,MESZ6,buy,4,5000,F1'].join('\n');

  it('is charged for the whole trade: the way in and the way out', () => {
    const opened = run(day1, PER_CONTRACT);
    expect(opened.trades.map((t) => t.fees)).toEqual([3.8]);
    const journal = apply([], opened);
    const r = run([FILLS, '2026-03-03 09:45,MESZ6,sell,4,5010,F2'].join('\n'), PER_CONTRACT, journal);
    expect(r.trades).toEqual([]);
    expect(r.finished.map((t) => [t.id, t.quantity, t.fees])).toEqual([[journal[0].id, 4, 7.6]]);
    // the file is said to have none even though the trade it finishes has some
    expect(r.feesMissing).toBe('none');
  });

  it('with no fee given, keeps the fees the journal had for it, as before', () => {
    const journal = apply([], run(day1, PER_CONTRACT));
    const r = run([FILLS, '2026-03-03 09:45,MESZ6,sell,4,5010,F2'].join('\n'), undefined, journal);
    expect(r.finished.map((t) => t.fees)).toEqual([3.8]);
    expect(feeNotice(r)).toBe(NO_FEES);
  });

  it('closed in part: the part closed pays both sides, the rest still open pays its way in', () => {
    const journal = apply([], run(day1, PER_CONTRACT));
    const r = run([FILLS, '2026-03-03 09:45,MESZ6,sell,1,5010,F2'].join('\n'), PER_CONTRACT, journal);
    expect(r.finished.map((t) => [t.quantity, t.fees])).toEqual([[1, 1.9]]);
    expect(r.trades.map((t) => [t.quantity, t.exitPrice, t.fees])).toEqual([[3, null, 2.85]]);
  });
});
