import { describe, expect, it } from 'vitest';
import { rSpread } from '@/lib/r-spread';
import { pnl, trade } from './helpers';

/** a trade that ended at `r`: a long from 100 with its stop at 90, so 1R is $10 */
const atR = (r: number, fees = 0) => trade({ entryPrice: 100, stopLoss: 90, exitPrice: 100 + r * 10, fees });
/** the bars that have trades, as [r, trades] */
const filled = (trades: ReturnType<typeof trade>[]) =>
  rSpread(trades)
    .bars.filter((bar) => bar.trades > 0)
    .map((bar) => [bar.r, bar.trades]);

describe('rSpread: how many trades ended near each R', () => {
  it('13 bars, from -2R or worse to +4R or better in half-R steps', () => {
    expect(rSpread([]).bars.map((bar) => bar.r)).toEqual([-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]);
  });

  it('each trade in the bar of the half R it ended nearest, a quarter going away from 0', () => {
    expect(filled([atR(-1), atR(-0.8), atR(-0.7), atR(-0.25), atR(0.2), atR(0.25), atR(2.3)])).toEqual([
      [-1, 2],
      [-0.5, 2],
      [0, 1],
      [0.5, 1],
      [2.5, 1],
    ]);
  });

  it('-1.25R goes to the -1.5R bar, -1.24R to -1R', () => {
    expect(filled([atR(-1.25), atR(-1.24)])).toEqual([
      [-1.5, 1],
      [-1, 1],
    ]);
  });

  it("a quarter R from prices that don't add up exactly is still a quarter: a forex long a quarter R down is in the -0.5R bar", () => {
    // 1.1000 to 1.0995 against a stop at 1.0980: -0.00049999... over 0.0020000...
    const eurusd = trade({ entryPrice: 1.1, stopLoss: 1.098, exitPrice: 1.0995, quantity: 100_000 });
    expect(filled([eurusd])).toEqual([[-0.5, 1]]);
  });

  it('the ends take everything past them', () => {
    expect(filled([atR(-3), atR(-2.2), atR(5), atR(12)])).toEqual([
      [-2, 2],
      [4, 2],
    ]);
  });

  it('a trade with no stop has no R: counted and left out of the bars', () => {
    const spread = rSpread([atR(1), pnl(50), pnl(-20)]);
    expect([spread.rated, spread.noStop]).toEqual([1, 2]);
    expect(filled([atR(1), pnl(50)])).toEqual([[1, 1]]);
  });

  it('counts only what every statistic counts: no open or excluded trade', () => {
    const spread = rSpread([
      atR(1),
      trade({ stopLoss: 90, exitPrice: null, closedAt: undefined }),
      { ...atR(2), excluded: true },
    ]);
    expect([spread.rated, spread.noStop]).toEqual([1, 0]);
  });
});

describe('rSpread: losses past -1R', () => {
  it('those in a bar left of -1R, and how far past it they went in all', () => {
    const spread = rSpread([atR(-1.3), atR(-3), atR(-1), atR(-0.5), atR(2)]);
    expect(spread.losses).toBe(4);
    expect(spread.pastStop).toEqual({ count: 2, beyond: -2.3 });
  });

  it('from -1.25R: -1.25R counts, -1.24R does not', () => {
    expect(rSpread([atR(-1.25), atR(-1.24)]).pastStop).toEqual({ count: 1, beyond: -0.25 });
  });

  it("a stop that held, a little past -1R from its fees, doesn't count", () => {
    // -$10 at the stop and $0.20 of fees: -1.02R
    expect(rSpread([atR(-1, 0.2)]).pastStop).toEqual({ count: 0, beyond: 0 });
  });
});

describe('rSpread: the best tenth of the trades against the rest', () => {
  it('a tenth of the trades by net, R or not, and what the others came to', () => {
    const trades = [pnl(500), atR(2), ...Array.from({ length: 8 }, () => pnl(5))];
    expect(rSpread(trades).top).toEqual({ count: 1, of: 10, best: 500, rest: 60, share: (500 / 560) * 100 });
  });

  it('a tenth of 15 is 2 trades', () => {
    const trades = Array.from({ length: 15 }, (_, i) => pnl(i));
    expect(rSpread(trades).top).toEqual({ count: 2, of: 15, best: 27, rest: 78, share: (27 / 105) * 100 });
  });

  it('no share once the others lost money, or the net is at or below zero: the two amounts say it', () => {
    const carried = [pnl(500), ...Array.from({ length: 9 }, () => pnl(-20))];
    expect(rSpread(carried).top).toEqual({ count: 1, of: 10, best: 500, rest: -180, share: null });
    const red = [pnl(50), ...Array.from({ length: 9 }, () => pnl(-20))];
    expect(rSpread(red).top?.share).toBeNull();
    const flat = Array.from({ length: 10 }, () => pnl(0));
    expect(rSpread(flat).top?.share).toBeNull();
  });

  it('no share once the others lost even a cent', () => {
    const trades = [pnl(100), ...Array.from({ length: 8 }, () => pnl(0)), pnl(-0.01)];
    expect(rSpread(trades).top).toEqual({ count: 1, of: 10, best: 100, rest: -0.01, share: null });
  });

  it('all of the net when the others came to 0', () => {
    expect(rSpread([pnl(90), ...Array.from({ length: 9 }, () => pnl(0))]).top?.share).toBe(100);
  });

  it('under 10 trades, none', () => {
    expect(rSpread(Array.from({ length: 9 }, () => pnl(10))).top).toBeNull();
  });

  it('cents added as cents: +0.10, +0.20 and -0.30 come to 0', () => {
    const trades = [pnl(100), ...Array.from({ length: 3 }, () => [pnl(0.1), pnl(0.2), pnl(-0.3)]).flat()];
    expect(rSpread(trades).top?.rest).toBe(0);
  });
});
