import { describe, expect, it } from 'vitest';
import { mergeIssue, mergeTrades } from '@/lib/merge';
import { computeStats } from '@/lib/stats';
import { grossPnl, isClosed, netPnl } from '@/lib/trade-math';
import { trade } from './helpers';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('merging partial fills back into one position', () => {
  it('scale-in then scale-out: size adds up, prices average, P&L stays the sum of the parts', () => {
    // buy 2 @ 100, add 1 @ 103; sell 2 @ 105, sell 1 @ 110 (as the broker paired them)
    const legs = [
      trade({ quantity: 2, entryPrice: 100, exitPrice: 105, fees: 1.5, openedAt: '2026-03-02T09:30', closedAt: '2026-03-02T10:00' }),
      trade({ quantity: 1, entryPrice: 103, exitPrice: 110, fees: 0.75, openedAt: '2026-03-02T09:45', closedAt: '2026-03-02T10:30' }),
    ];
    const merged = mergeTrades(legs);
    expect(merged.quantity).toBe(3);
    expect(merged.entryPrice).toBe(101); // (2*100 + 1*103) / 3
    expect(merged.fees).toBe(2.25);
    expect(merged.openedAt).toBe('2026-03-02T09:30');
    expect(merged.closedAt).toBe('2026-03-02T10:30');
    expect(merged.fillCount).toBe(2);
    // 2*5 + 1*7 = 17 gross; the rounded average exit cannot reproduce it, so it is kept verbatim
    expect(grossPnl(merged)).toBeCloseTo(17, 10);
    expect(netPnl(merged)).toBeCloseTo(sum(legs.map(netPnl)), 10);
  });

  it('a reproducible merge keeps real prices and no manual override', () => {
    const legs = [
      trade({ quantity: 1, entryPrice: 100, exitPrice: 104, openedAt: '2026-03-02T09:30' }),
      trade({ quantity: 1, entryPrice: 100, exitPrice: 106, openedAt: '2026-03-02T09:30' }),
    ];
    const merged = mergeTrades(legs);
    expect(merged.exitPrice).toBe(105);
    expect(merged.manualPnl).toBeNull();
    expect(grossPnl(merged)).toBe(10);
  });

  it('shorts and futures multipliers merge correctly', () => {
    const legs = [
      trade({ side: 'SHORT', quantity: 1, entryPrice: 5000, exitPrice: 4995, multiplier: 50 }),
      trade({ side: 'SHORT', quantity: 1, entryPrice: 5002, exitPrice: 4995, multiplier: 50 }),
    ];
    const merged = mergeTrades(legs);
    expect(grossPnl(merged)).toBeCloseTo(250 + 350, 8);
    expect(merged.multiplier).toBe(50);
  });

  it('legs with different multipliers keep their combined P&L exactly', () => {
    const legs = [
      trade({ quantity: 1, entryPrice: 100, exitPrice: 101, multiplier: 50 }),
      trade({ quantity: 1, entryPrice: 100, exitPrice: 101, multiplier: 20 }),
    ];
    expect(grossPnl(mergeTrades(legs))).toBe(70);
  });

  it('a leg with a manual P&L keeps the merged total exact', () => {
    const legs = [trade({ manualPnl: 12.34, exitPrice: null }), trade({ entryPrice: 100, exitPrice: 101, quantity: 2 })];
    expect(grossPnl(mergeTrades(legs))).toBeCloseTo(14.34, 10);
  });

  it('merging open legs gives one open position', () => {
    const legs = [
      trade({ quantity: 2, entryPrice: 100, exitPrice: null, closedAt: undefined }),
      trade({ quantity: 3, entryPrice: 105, exitPrice: null, closedAt: undefined }),
    ];
    const merged = mergeTrades(legs);
    expect(isClosed(merged)).toBe(false);
    expect(merged.quantity).toBe(5);
    expect(merged.entryPrice).toBe(103);
    expect(merged.closedAt).toBeUndefined();
  });

  it('no fill is counted twice and no result disappears: statistics before and after agree', () => {
    const legs = [
      trade({ quantity: 2, entryPrice: 100, exitPrice: 99, fees: 1, closedAt: '2026-03-02T10:00' }),
      trade({ quantity: 1, entryPrice: 100, exitPrice: 104.5, fees: 1, closedAt: '2026-03-02T10:05' }),
      trade({ quantity: 1, entryPrice: 100, exitPrice: 103.25, fees: 1, closedAt: '2026-03-02T10:10' }),
    ];
    const before = computeStats(legs);
    const after = computeStats([mergeTrades(legs)]);
    expect(after.net).toBeCloseTo(before.net, 10);
    expect(after.fees).toBeCloseTo(before.fees, 10);
    expect(after.total).toBe(1);
  });

  it('carries tags, notes, external ids and the most informative details across', () => {
    const merged = mergeTrades([
      trade({ tags: ['a'], notes: 'first', externalId: 'f1:s1', stopLoss: 95 }),
      trade({ tags: ['a', 'b'], notes: 'second', externalId: 'f1:s2' }),
    ]);
    expect(merged.tags).toEqual(['a', 'b']);
    expect(merged.notes).toBe('first / second');
    expect(merged.externalId).toBe('f1:s1|f1:s2');
    expect(merged.stopLoss).toBe(95);
  });
});

describe('when trades cannot be merged', () => {
  it.each([
    ['one trade', [trade()], 'Select at least two trades to merge.'],
    ['different symbols', [trade({ symbol: 'A' }), trade({ symbol: 'B' })], 'They have to be the same symbol.'],
    ['different directions', [trade({ side: 'LONG' }), trade({ side: 'SHORT' })], 'They have to be the same direction.'],
    ['different accounts', [trade({ accountId: 'a' }), trade({ accountId: 'b' })], 'They have to be in the same account.'],
    ['a part without size', [trade(), trade({ quantity: 0 })], 'Every part needs a quantity before they can be merged.'],
    ['a part without an entry price', [trade(), trade({ entryPrice: 0 })], 'Every part needs an entry price before they can be merged.'],
    ['open mixed with closed', [trade(), trade({ exitPrice: null, closedAt: undefined })], 'Some of these are still open. Merge the closed ones, or close the rest first.'],
  ])('%s', (_, trades, message) => {
    expect(mergeIssue(trades)).toBe(message);
  });

  it('two compatible closed trades can be merged', () => {
    expect(mergeIssue([trade(), trade()])).toBeNull();
  });
});
