import { describe, expect, it } from 'vitest';
import { splitLikelyDuplicates } from '@/lib/import/likely';
import { importTradesFromCsv, type ImportResult } from '@/lib/csv';
import type { Account, Setup, Trade } from '@/lib/types';
import { trade } from './helpers';

/** the stage on its own: trades that look like ones already in the journal */
describe('likely duplicates', () => {
  const inJournal = trade({ symbol: 'AAPL', side: 'LONG', openedAt: '2026-03-02T10:00', quantity: 10 });
  const symbols = (ts: { symbol: string }[]) => ts.map((t) => t.symbol);

  it('the same account, symbol, side, entry minute and size is a likely duplicate', () => {
    const split = splitLikelyDuplicates([trade({ ...inJournal, id: 'new', exitPrice: 105 })], [inJournal]);
    expect(split.likely).toHaveLength(1);
    expect(split.fresh).toHaveLength(0);
  });

  it('any one of them different makes a new trade', () => {
    const others = [
      trade({ ...inJournal, id: 'a', accountId: 'acc2' }),
      trade({ ...inJournal, id: 'b', symbol: 'MSFT' }),
      trade({ ...inJournal, id: 'c', side: 'SHORT' }),
      trade({ ...inJournal, id: 'd', openedAt: '2026-03-02T10:01' }),
      trade({ ...inJournal, id: 'e', openedAt: '2026-03-03T10:00' }),
      trade({ ...inJournal, id: 'f', quantity: 11 }),
    ];
    const split = splitLikelyDuplicates(others, [inJournal]);
    expect(split.fresh).toHaveLength(6);
    expect(split.likely).toHaveLength(0);
  });

  it('seconds, letter case and floating-point dust in the size do not matter', () => {
    const t = trade({ ...inJournal, id: 'x', symbol: 'aapl', openedAt: '2026-03-02T10:00:59', quantity: 0.1 + 0.2 });
    const split = splitLikelyDuplicates([t], [{ ...inJournal, quantity: 0.3 }]);
    expect(split.likely).toHaveLength(1);
  });

  it('each journal trade stands for one: two identical rows against one leave one in', () => {
    const rows = [trade({ ...inJournal, id: 'r1' }), trade({ ...inJournal, id: 'r2' })];
    const split = splitLikelyDuplicates(rows, [inJournal]);
    expect(split.likely.map((t) => t.id)).toEqual(['r1']);
    expect(split.fresh.map((t) => t.id)).toEqual(['r2']);
  });

  it('two trades with different broker ids are different trades, whatever their fields', () => {
    const split = splitLikelyDuplicates(
      [trade({ ...inJournal, id: 'n', externalId: 'B' })],
      [{ ...inJournal, externalId: 'A' }],
    );
    expect(split.fresh).toHaveLength(1);
  });

  it('an id on one side only still matches on the fields', () => {
    const fromFile = trade({ ...inJournal, id: 'n', externalId: 'B' });
    expect(splitLikelyDuplicates([fromFile], [inJournal]).likely).toHaveLength(1);
    expect(
      splitLikelyDuplicates([trade({ ...inJournal, id: 'm' })], [{ ...inJournal, externalId: 'A' }]).likely,
    ).toHaveLength(1);
  });

  it('test data, and trades missing their entry time or size, match nothing', () => {
    expect(
      splitLikelyDuplicates([trade({ ...inJournal, id: 'n' })], [{ ...inJournal, isSample: true }]).fresh,
    ).toHaveLength(1);
    const gaps = [trade({ ...inJournal, id: 'p', openedAt: '' }), trade({ ...inJournal, id: 'q', quantity: 0 })];
    const journal = [
      { ...inJournal, openedAt: '' },
      { ...inJournal, quantity: 0 },
    ];
    expect(splitLikelyDuplicates(gaps, journal).fresh).toHaveLength(2);
  });

  it('open in the journal and closed in the file: imported, and counted so the open copy can go', () => {
    const open = { ...inJournal, exitPrice: null, closedAt: undefined };
    const split = splitLikelyDuplicates([trade({ ...inJournal, id: 'n', exitPrice: 104 })], [open]);
    expect(symbols(split.fresh)).toEqual(['AAPL']);
    expect(split.closesOpen).toBe(1);
  });

  it('the same when finishing: the journal’s open trade is finished with the file’s exit instead', () => {
    const open = { ...inJournal, exitPrice: null, closedAt: undefined, notes: 'mine' };
    const closed = trade({ ...inJournal, id: 'n', exitPrice: 104, closedAt: '2026-03-02T12:00' });
    const split = splitLikelyDuplicates([closed], [open], true);
    expect([split.fresh.length, split.likely.length, split.closesOpen]).toEqual([0, 0, 0]);
    expect(split.finished.map((t) => [t.id, t.exitPrice, t.closedAt, t.notes])).toEqual([
      [inJournal.id, 104, '2026-03-02T12:00', 'mine'],
    ]);
  });

  it('closed in the journal and open in the file, or open in both: a likely duplicate', () => {
    const openRow = trade({ ...inJournal, id: 'n', exitPrice: null, closedAt: undefined });
    expect(splitLikelyDuplicates([openRow], [inJournal]).likely).toHaveLength(1);
    expect(splitLikelyDuplicates([openRow], [{ ...inJournal, exitPrice: null }]).likely).toHaveLength(1);
  });

  it('with nothing in the journal, everything is new', () => {
    const split = splitLikelyDuplicates([trade(), trade()]);
    expect([split.fresh.length, split.likely.length, split.closesOpen]).toEqual([2, 0, 0]);
  });
});

/** the whole import: a file that closes only part of a trade the journal has open */
describe('a part of an open trade, closed by a file without its ids', () => {
  const accounts: Account[] = [{ id: 'acc1', name: 'Main Portfolio', startingBalance: 0, createdAt: '' }];
  const run = (rows: string[], existing: Trade[], extra = {}) =>
    importTradesFromCsv(rows.join('\n'), { accountId: 'acc1', accounts, setups: [] as Setup[], existing, ...extra });
  const apply = (journal: Trade[], r: ImportResult) => {
    const finished = new Map(r.finished.map((t) => [t.id, t]));
    return [...journal.map((t) => finished.get(t.id) ?? t), ...r.trades];
  };
  const ROWS = 'symbol,side,qty,entry price,exit price,entry time,exit time';
  /** typed in by hand: long 4 MES, with fees and a note */
  const open = trade({
    symbol: 'MES',
    quantity: 4,
    entryPrice: 5000,
    exitPrice: null,
    closedAt: undefined,
    openedAt: '2026-03-04T10:00',
    fees: 4,
    multiplier: 5,
    notes: 'Held for the open',
  });

  it('a row closing 2 of the 4: that part is finished, the other 2 stay open, nothing counted twice', () => {
    const r = run([ROWS, 'MES,LONG,2,5000,5010,2026-03-04 10:00,2026-03-04 11:00'], [open]);
    expect(r.finished.map((t) => [t.id, t.quantity, t.exitPrice, t.closedAt, t.fees, t.notes])).toEqual([
      [open.id, 2, 5010, '2026-03-04T11:00', 2, 'Held for the open'],
    ]);
    expect(r.trades.map((t) => [t.quantity, t.exitPrice, t.openedAt, t.fees, t.multiplier, t.notes])).toEqual([
      [2, null, '2026-03-04T10:00', 2, 5, 'Held for the open'],
    ]);
    expect(r.trades[0].id).not.toBe(open.id);
    expect([r.likelyDuplicates.length, r.errors]).toEqual([0, []]);

    // the next export has that row again and the one closing the rest
    const after = apply([open], r);
    const next = run(
      [
        ROWS,
        'MES,LONG,2,5000,5010,2026-03-04 10:00,2026-03-04 11:00',
        'MES,LONG,2,5000,5020,2026-03-04 10:00,2026-03-04 12:00',
      ],
      after,
    );
    expect(next.trades).toEqual([]);
    expect(next.likelyDuplicates).toHaveLength(1);
    expect(next.finished.map((t) => [t.id, t.quantity, t.exitPrice])).toEqual([[r.trades[0].id, 2, 5020]]);
  });

  it('two rows closing it in parts, in one file: each part finished, nothing left open', () => {
    const r = run(
      [
        ROWS,
        'MES,LONG,1,5000,5010,2026-03-04 10:00,2026-03-04 11:00',
        'MES,LONG,3,5000,5020,2026-03-04 10:00,2026-03-04 12:00',
      ],
      [open],
    );
    expect(r.finished.map((t) => [t.id, t.quantity, t.exitPrice])).toEqual([[open.id, 1, 5010]]);
    expect(r.trades.map((t) => [t.quantity, t.exitPrice, t.notes])).toEqual([[3, 5020, 'Held for the open']]);
  });

  it('a fills file that repeats the buy of 4 and sells 2: finished in part, the rest the file’s own', () => {
    const NO_IDS = 'time,symbol,side,qty,price,fee';
    const r = run([NO_IDS, '2026-03-04 10:00,MES,buy,4,5000,2', '2026-03-04 11:00,MES,sell,2,5010,1'], [open]);
    expect(r.finished.map((t) => [t.id, t.quantity, t.exitPrice, t.fees])).toEqual([[open.id, 2, 5010, 2]]);
    expect(r.trades.map((t) => [t.quantity, t.exitPrice, t.fees, t.notes])).toEqual([
      [2, null, 1, 'Held for the open'],
    ]);
    expect(r.likelyDuplicates).toEqual([]);
  });

  it('asked not to finish trades: both kept, and said', () => {
    const r = run([ROWS, 'MES,LONG,2,5000,5010,2026-03-04 10:00,2026-03-04 11:00'], [open], { finishOpen: false });
    expect([r.finished.length, r.trades.length]).toEqual([0, 1]);
    expect(r.errors).toEqual([
      '1 trade closes part of a position your journal still has as open. Both are kept: make the open trade smaller once you have checked.',
    ]);
  });

  it('said in the preview, as the open trade changes size', () => {
    const r = run([ROWS, 'MES,LONG,2,5000,5010,2026-03-04 10:00,2026-03-04 11:00'], [open]);
    expect(r.notices).toContain(
      '1 trade closes part of a position your journal had open: that part was finished, and the rest stays open as a trade of its own.',
    );
  });

  it('two open trades with the same entry, each closed in part: both rests stay, nothing lost', () => {
    const a = { ...open, quantity: 5 };
    const b = { ...open, id: 'b', quantity: 5 };
    const r = run(
      [
        ROWS,
        'MES,LONG,2,5000,5010,2026-03-04 10:00,2026-03-04 11:00',
        'MES,LONG,2,5000,5012,2026-03-04 10:00,2026-03-04 11:30',
      ],
      [a, b],
    );
    expect(r.finished.map((t) => [t.id, t.quantity, t.exitPrice])).toEqual([
      [a.id, 2, 5010],
      [b.id, 2, 5012],
    ]);
    expect(r.trades.map((t) => [t.quantity, t.exitPrice])).toEqual([
      [3, null],
      [3, null],
    ]);
  });

  it('imported again with the rest listed before the part closed: each row is matched to its own', () => {
    const first = run([ROWS, 'MES,LONG,2,5000,5010,2026-03-04 10:00,2026-03-04 11:00'], [open]);
    const after = apply([open], first).reverse();
    const next = run(
      [
        ROWS,
        'MES,LONG,2,5000,5010,2026-03-04 10:00,2026-03-04 11:00',
        'MES,LONG,2,5000,5020,2026-03-04 10:00,2026-03-04 12:00',
      ],
      after,
    );
    expect(next.likelyDuplicates.map((t) => t.exitPrice)).toEqual([5010]);
    expect(next.finished.map((t) => [t.id, t.exitPrice])).toEqual([[first.trades[0].id, 5020]]);
  });

  it('the file’s own row for the rest keeps the journal’s fees and point value when the file has none', () => {
    const xyz = { ...open, symbol: 'XYZ' };
    const r = run(
      [ROWS, 'XYZ,LONG,2,5000,5010,2026-03-04 10:00,2026-03-04 11:00', 'XYZ,LONG,2,5000,,2026-03-04 10:00,'],
      [xyz],
    );
    expect(r.finished.map((t) => [t.id, t.quantity, t.fees, t.multiplier])).toEqual([[xyz.id, 2, 2, 5]]);
    expect(r.trades.map((t) => [t.quantity, t.exitPrice, t.fees, t.multiplier, t.notes])).toEqual([
      [2, null, 2, 5, 'Held for the open'],
    ]);
  });

  it('a larger size, another minute, or both with broker ids: not part of it', () => {
    for (const row of [
      'MES,LONG,5,5000,5010,2026-03-04 10:00,2026-03-04 11:00',
      'MES,LONG,2,5000,5010,2026-03-04 10:01,2026-03-04 11:00',
    ]) {
      const r = run([ROWS, row], [open]);
      expect([r.finished.length, r.trades.length]).toEqual([0, 1]);
    }
    const r = run(
      [`${ROWS},id`, 'MES,LONG,2,5000,5010,2026-03-04 10:00,2026-03-04 11:00,B'],
      [{ ...open, externalId: 'A' }],
    );
    expect([r.finished.length, r.trades.length]).toEqual([0, 1]);
  });
});
