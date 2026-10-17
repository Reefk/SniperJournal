import { describe, expect, it } from 'vitest';
import { importTradesFromCsv, type ImportResult } from '@/lib/csv';
import { netPnl } from '@/lib/trade-math';
import type { Account, Setup, Trade } from '@/lib/types';
import { trade } from './helpers';

/**
 * Positions that run across two exports: a file that closes a trade the
 * journal has open finishes that trade, and importing it again changes
 * nothing. Made-up fills only.
 */

const accounts: Account[] = [
  { id: 'acc1', name: 'Main Portfolio', startingBalance: 0, createdAt: '' },
  { id: 'acc2', name: 'Prop Challenge', startingBalance: 0, createdAt: '' },
];
const WITH_IDS = 'time,symbol,side,qty,price,fee,id';
const NO_IDS = 'time,symbol,side,qty,price,fee';

const run = (head: string, rows: string[], existing: Trade[] = [], extra = {}) =>
  importTradesFromCsv([head, ...rows].join('\n'), {
    accountId: 'acc1',
    accounts,
    setups: [] as Setup[],
    existing,
    ...extra,
  });

/** the journal after pressing Import, as importTrades does it */
const apply = (journal: Trade[], r: ImportResult) => {
  const finished = new Map(r.finished.map((t) => [t.id, t]));
  return [...journal.map((t) => finished.get(t.id) ?? t), ...r.trades];
};

/** an export with an open position, imported, and described in the journal */
const openedOn = (head: string, rows: string[]) => {
  const first = run(head, rows);
  return apply([], first).map((t) =>
    t.closedAt ? t : { ...t, notes: 'Held for the open', setupId: 's1', tags: ['swing'], stopLoss: 20950 },
  );
};

const day1 = ['2026-03-02 15:50,MNQZ6,buy,2,21000,1.5,F1'];
const day2 = ['2026-03-03 09:45,MNQZ6,sell,2,21010,1.5,F2'];
const noIds = (rows: string[]) => rows.map((r) => r.replace(/,F\d+$/, ''));

describe('a position opened in one export and closed in the next', () => {
  it('finishes the trade the journal has open: the exit comes from the file, what you wrote stays', () => {
    const journal = openedOn(WITH_IDS, day1);
    const open = journal[0];
    const r = run(WITH_IDS, day2, journal);
    expect(r.trades).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.finished).toHaveLength(1);
    expect(r.finished[0]).toMatchObject({
      id: open.id,
      createdAt: open.createdAt,
      side: 'LONG',
      openedAt: '2026-03-02T15:50',
      closedAt: '2026-03-03T09:45',
      quantity: 2,
      entryPrice: 21000,
      exitPrice: 21010,
      fees: 3,
      multiplier: 2,
      externalId: 'F1|F2',
      fillCount: 2,
      notes: 'Held for the open',
      setupId: 's1',
      tags: ['swing'],
      stopLoss: 20950,
    });
    expect(r.finished[0].needsReview).toBeUndefined();
    // 10 points × 2 contracts × $2, less $3 of fees
    expect(netPnl(r.finished[0])).toBe(37);
    expect(r.notices[0]).toBe(
      'Each row is one fill: 1 fill was put back together into 1 trade, following the position in each symbol.',
    );
  });

  it('the same without the broker’s ids', () => {
    const journal = openedOn(NO_IDS, noIds(day1));
    const r = run(NO_IDS, noIds(day2), journal);
    expect(r.trades).toEqual([]);
    expect(r.finished.map((t) => [t.id, t.exitPrice, t.fees])).toEqual([[journal[0].id, 21010, 3]]);
  });

  it('a file that says the fill closes a position: finished, not an exit with no entry', () => {
    const head = `${WITH_IDS},effect`;
    const journal = openedOn(head, [`${day1[0]},open`]);
    const r = run(head, [`${day2[0]},close`], journal);
    expect(r.trades).toEqual([]);
    expect(r.finished).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });

  it('asked not to, the file starts from nothing, as before: the sell opens a short', () => {
    const journal = openedOn(WITH_IDS, day1);
    const r = run(WITH_IDS, day2, journal, { finishOpen: false });
    expect(r.finished).toEqual([]);
    expect(r.trades.map((t) => [t.side, t.closedAt ?? null])).toEqual([['SHORT', null]]);
  });

  it('a point value the file can’t give comes from the journal’s trade', () => {
    const journal = openedOn(WITH_IDS, ['2026-03-02 15:50,XYZ,buy,1,40,0,F1']).map((t) => ({ ...t, multiplier: 5 }));
    const r = run(WITH_IDS, ['2026-03-03 10:00,XYZ,sell,1,42,0,F2'], journal);
    expect(r.finished[0]).toMatchObject({ multiplier: 5 });
    expect(netPnl(r.finished[0])).toBe(10);
  });
});

describe('closed in parts, or added to first', () => {
  it('closed in part: finished for that part, the rest a trade of its own that the next export finishes', () => {
    const journal = openedOn(WITH_IDS, ['2026-03-02 15:50,AAPL,buy,3,100,0.3,F1']);
    const r = run(WITH_IDS, ['2026-03-03 10:00,AAPL,sell,1,104,0.1,F2'], journal);
    expect(r.finished.map((t) => [t.id, t.quantity, t.exitPrice, t.fees])).toEqual([[journal[0].id, 1, 104, 0.2]]);
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]).toMatchObject({
      quantity: 2,
      entryPrice: 100,
      exitPrice: null,
      openedAt: '2026-03-02T15:50',
      notes: 'Held for the open',
      setupId: 's1',
      stopLoss: 20950,
      externalId: 'F1',
    });
    expect(r.trades[0].fees).toBeCloseTo(0.2, 10);
    expect(r.trades[0].id).not.toBe(journal[0].id);

    const after = apply(journal, r);
    const rest = run(WITH_IDS, ['2026-03-04 11:00,AAPL,sell,2,106,0.2,F3'], after);
    expect(rest.trades).toEqual([]);
    expect(rest.finished.map((t) => [t.id, t.quantity, t.exitPrice])).toEqual([[r.trades[0].id, 2, 106]]);
  });

  it('added to before it is flat again: one trade, at the average prices', () => {
    const journal = openedOn(WITH_IDS, ['2026-03-02 15:50,AAPL,buy,2,100,0,F1']);
    const r = run(
      WITH_IDS,
      [
        '2026-03-03 10:00,AAPL,sell,1,110,0,F2',
        '2026-03-03 10:05,AAPL,buy,1,106,0,F3',
        '2026-03-03 10:30,AAPL,sell,2,113,0,F4',
      ],
      journal,
    );
    expect(r.trades).toEqual([]);
    expect(r.finished[0]).toMatchObject({ quantity: 3, entryPrice: 102, exitPrice: 112, fillCount: 4 });
    expect(netPnl(r.finished[0])).toBe(30);
  });

  it('a fill past flat closes the trade and opens the other way with the rest', () => {
    const journal = openedOn(WITH_IDS, ['2026-03-02 15:50,AAPL,buy,1,100,0,F1']);
    const r = run(WITH_IDS, ['2026-03-03 10:00,AAPL,sell,3,104,0,F2'], journal);
    expect(r.finished.map((t) => [t.quantity, t.exitPrice])).toEqual([[1, 104]]);
    expect(r.trades.map((t) => [t.side, t.quantity, t.entryPrice])).toEqual([['SHORT', 2, 104]]);
  });
});

describe('importing again', () => {
  it('the export that finished a trade, imported again, changes nothing, with ids or without', () => {
    for (const [head, first, second] of [
      [WITH_IDS, day1, day2],
      [NO_IDS, noIds(day1), noIds(day2)],
    ] as const) {
      const journal = openedOn(head, [...first]);
      const after = apply(journal, run(head, [...second], journal));
      const again = run(head, [...second], after);
      expect([again.trades.length, again.finished.length, again.duplicates]).toEqual([0, 0, 1]);
    }
  });

  it('the same for an export that closed only part of it', () => {
    const journal = openedOn(NO_IDS, ['2026-03-02 15:50,AAPL,buy,3,100,0']);
    const part = ['2026-03-03 10:00,AAPL,sell,1,104,0'];
    const after = apply(journal, run(NO_IDS, part, journal));
    const again = run(NO_IDS, part, after);
    expect([again.trades.length, again.finished.length, again.duplicates]).toEqual([0, 0, 1]);
  });

  it('an export that repeats the opening fill finishes the trade too, rather than adding a second', () => {
    const journal = openedOn(WITH_IDS, day1);
    const r = run(WITH_IDS, [...day1, ...day2], journal);
    expect(r.trades).toEqual([]);
    expect(r.duplicates).toBe(0);
    expect(r.finished.map((t) => [t.id, t.quantity, t.exitPrice, t.externalId])).toEqual([
      [journal[0].id, 2, 21010, 'F1|F2'],
    ]);

    const without = openedOn(NO_IDS, noIds(day1));
    const plain = run(NO_IDS, noIds([...day1, ...day2]), without);
    expect(plain.trades).toEqual([]);
    expect(plain.finished.map((t) => [t.id, t.exitPrice, t.fees])).toEqual([[without[0].id, 21010, 3]]);
  });

  it('repeated with a part already closed: only the open rest is finished, the closed part is a duplicate', () => {
    const first = ['2026-03-02 15:50,AAPL,buy,3,100,0,F1', '2026-03-02 15:55,AAPL,sell,1,102,0,F2'];
    const journal = openedOn(WITH_IDS, first);
    expect(journal.map((t) => [t.quantity, t.closedAt ?? null])).toEqual([
      [1, '2026-03-02T15:55'],
      [2, null],
    ]);
    const r = run(WITH_IDS, [...first, '2026-03-03 10:00,AAPL,sell,2,105,0,F3'], journal);
    expect(r.trades).toEqual([]);
    expect(r.finished.map((t) => [t.id, t.quantity, t.exitPrice])).toEqual([[journal[1].id, 2, 105]]);
    expect(r.duplicates).toBe(1);
  });
});

describe('what is never continued', () => {
  const stale = (extra: Partial<Trade> = {}) =>
    trade({
      symbol: 'AAPL',
      side: 'LONG',
      openedAt: '2026-03-02T10:00',
      closedAt: undefined,
      exitPrice: null,
      quantity: 1,
      entryPrice: 100,
      ...extra,
    });

  it('a first fill on the same side starts a trade of its own: a trade left open by mistake is not mixed in', () => {
    const r = run(NO_IDS, ['2026-03-05 10:00,AAPL,buy,1,110,0', '2026-03-05 10:30,AAPL,sell,1,111,0'], [stale()]);
    expect(r.finished).toEqual([]);
    expect(r.trades.map((t) => [t.quantity, t.entryPrice, t.exitPrice])).toEqual([[1, 110, 111]]);
  });

  it('two open trades in the symbol, or one opened after the fill: too uncertain, so nothing is carried', () => {
    const sell = ['2026-03-05 10:00,AAPL,sell,1,110,0'];
    const two = run(NO_IDS, sell, [stale(), stale({ openedAt: '2026-03-03T10:00' })]);
    expect(two.finished).toEqual([]);
    const later = run(NO_IDS, sell, [stale({ openedAt: '2026-03-05T11:00' })]);
    expect(later.finished).toEqual([]);
    expect(later.trades.map((t) => t.side)).toEqual(['SHORT']);
  });

  it('test data, another account, or a trade with no entry price', () => {
    const sell = ['2026-03-05 10:00,AAPL,sell,1,110,0'];
    for (const t of [stale({ isSample: true }), stale({ accountId: 'acc2' }), stale({ entryPrice: 0 })]) {
      expect(run(NO_IDS, sell, [t]).finished).toEqual([]);
    }
  });

  it('a trade the journal has closed some other way stays as it is, and the file starts from nothing', () => {
    const byHand = stale({ closedAt: '2026-03-06T10:00', exitPrice: 112 });
    const r = run(NO_IDS, ['2026-03-05 10:00,AAPL,sell,1,110,0'], [byHand]);
    expect(r.finished).toEqual([]);
    expect(r.duplicates).toBe(0);
    expect(r.trades.map((t) => t.side)).toEqual(['SHORT']);
  });
});
