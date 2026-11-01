import { describe, expect, it } from 'vitest';
import { defaultHoldMeasure, holdAxis, HOLD_SIDE_MIN, holdReport } from '@/lib/hold';
import type { Trade } from '@/lib/types';
import { pnl, seeded, shuffle, trade } from './helpers';

/** a trade on day `i` of March 2026, held `minutes` from 10:00, for `r` R (a stop 10 below a 100 entry) */
const held = (minutes: number, r: number, i = 0, stop: number | null = 90): Trade => {
  const day = `2026-03-${String(1 + i).padStart(2, '0')}`;
  const close = new Date(Date.UTC(2026, 2, 1 + i, 10, minutes));
  const closedAt = `${close.toISOString().slice(0, 10)}T${close.toISOString().slice(11, 16)}`;
  return trade({ entryPrice: 100, stopLoss: stop, exitPrice: 100 + r * 10, openedAt: `${day}T10:00`, closedAt });
};

describe('holdReport: hold time against result', () => {
  it('a dot for each trade: how long it was held, and its R or its net', () => {
    const trades = [held(5, 2, 0), held(90, -1, 1), held(60 * 26, 0.5, 2)];
    expect(holdReport(trades, 'R').dots.map((d) => [d.minutes, d.value])).toEqual([
      [5, 2],
      [90, -1],
      [60 * 26, 0.5],
    ]);
    // in money: 1R is $10
    expect(holdReport(trades, 'net').dots.map((d) => d.value)).toEqual([20, -10, 5]);
    expect(holdReport(trades, 'R').dots[0].trade).toBe(trades[0]);
  });

  it('oldest first, whatever order the trades were logged in', () => {
    const trades = Array.from({ length: 12 }, (_, i) => held(10 + i, 1, i));
    const dots = holdReport(shuffle(trades, seeded(3)), 'R').dots;
    expect(dots.map((d) => d.minutes)).toEqual(trades.map((_, i) => 10 + i));
  });

  it('leaves out, and counts, a trade with no time it closed, and in R one with no stop', () => {
    const trades = [
      held(5, 1, 0),
      pnl(30, { openedAt: '2026-03-02T10:00', closedAt: undefined }),
      held(20, 1, 2, null),
    ];
    const r = holdReport(trades, 'R');
    expect([r.dots.length, r.noTime, r.noStop]).toEqual([1, 1, 1]);
    // in money a trade with no stop has a dot
    const net = holdReport(trades, 'net');
    expect([net.dots.length, net.noTime, net.noStop]).toEqual([2, 1, 0]);
  });

  it('counts only what every statistic counts: no open or excluded trade', () => {
    const trades = [
      held(5, 1, 0),
      trade({ openedAt: '2026-03-03T10:00', exitPrice: null, closedAt: undefined }),
      { ...held(5, 1, 4), excluded: true },
    ];
    expect(holdReport(trades, 'net').dots).toHaveLength(1);
  });

  it('compares the trades held up to the median with those held longer', () => {
    // 10 quick ones at -1R, 10 long ones at +2R
    const trades = [
      ...Array.from({ length: 10 }, (_, i) => held(5, -1, i)),
      ...Array.from({ length: 10 }, (_, i) => held(120, 2, 10 + i)),
    ];
    expect(holdReport(trades, 'R').split).toEqual({
      minutes: (5 + 120) / 2,
      shorter: { trades: 10, avg: -1 },
      longer: { trades: 10, avg: 2 },
    });
  });

  it('the median of an odd count is its middle hold, which counts as held up to it', () => {
    const trades = Array.from({ length: 21 }, (_, i) => held(i + 1, i < 11 ? -1 : 1, i));
    const { split } = holdReport(trades, 'R');
    expect(split?.minutes).toBe(11);
    expect([split?.shorter.trades, split?.longer.trades]).toEqual([11, 10]);
    expect([split?.shorter.avg, split?.longer.avg]).toEqual([-1, 1]);
  });

  it(`says nothing until each side has ${HOLD_SIDE_MIN} trades`, () => {
    const nineteen = Array.from({ length: 19 }, (_, i) => held(i + 1, 1, i));
    expect(holdReport(nineteen, 'R').split).toBeNull();
    // 20 trades, but 15 held the same 5 minutes: up to the median is 15, longer only 5
    const bunched = [
      ...Array.from({ length: 15 }, (_, i) => held(5, 1, i)),
      ...Array.from({ length: 5 }, (_, i) => held(60, 1, 15 + i)),
    ];
    expect(holdReport(bunched, 'R').split).toBeNull();
  });

  it('says nothing when every trade was held as long, however many there are', () => {
    const same = Array.from({ length: 40 }, (_, i) => held(30, i % 2 ? 1 : -1, i));
    expect(holdReport(same, 'R').split).toBeNull();
  });

  it('a trade closed the minute it opened has a dot, held 0 minutes', () => {
    expect(holdReport([held(0, 1, 0)], 'R').dots.map((d) => d.minutes)).toEqual([0]);
  });
});

describe('holdAxis: the chart’s log axis', () => {
  it('a little room either side, and the marks in between', () => {
    expect(holdAxis([5, 120])).toEqual({ lo: 5 / 1.5, hi: 180, marks: [5, 15, 60] });
  });

  it('at least two marks: it reaches out to the next one, later ones first', () => {
    // all under a minute: up to a minute, then five
    expect(holdAxis([0.5, 0.5]).marks).toEqual([1, 5]);
    // one mark inside: the next one above
    expect(holdAxis([50, 70])).toMatchObject({ hi: 240, marks: [60, 240] });
    // longer than a week: the marks below it
    expect(holdAxis([30_000])).toMatchObject({ lo: 1440, marks: [1440, 10080] });
  });
});

describe('defaultHoldMeasure', () => {
  it('R while at least half the trades with a hold time have a stop, the net otherwise', () => {
    expect(defaultHoldMeasure([held(5, 1, 0), held(5, 1, 1, null)])).toBe('R');
    expect(defaultHoldMeasure([held(5, 1, 0), held(5, 1, 1, null), held(5, 1, 2, null)])).toBe('net');
    // a trade with no hold time doesn't count either way
    expect(defaultHoldMeasure([held(5, 1, 0), pnl(5, { closedAt: undefined }), pnl(5, { closedAt: undefined })])).toBe(
      'R',
    );
    expect(defaultHoldMeasure([])).toBe('net');
  });
});
