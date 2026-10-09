import { describe, expect, it } from 'vitest';
import { aggregateDays, computeStats, groupTrades, sniperScore, sqnLabel } from '@/lib/stats';
import type { Trade } from '@/lib/types';
import { pnl, seeded, shuffle, trade } from './helpers';

/** one closed trade per day from 2 March 2026, in order, with the given net results */
function series(nets: number[], extra: (i: number) => Partial<Trade> = () => ({})): Trade[] {
  return nets.map((n, i) => {
    const day = `2026-03-${String(2 + i).padStart(2, '0')}`;
    return pnl(n, { openedAt: `${day}T10:00`, closedAt: `${day}T11:00`, ...extra(i) });
  });
}

/**
 * An independent reference for the headline numbers, written from the textbook
 * definitions rather than from the production code.
 */
function reference(trades: Trade[], start: number) {
  const nets = trades.map((t) => t.manualPnl as number);
  const wins = nets.filter((n) => n > 0);
  const losses = nets.filter((n) => n < 0);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  let equity = start;
  let peak = start;
  let maxDD = 0;
  let maxPct = 0;
  for (const n of nets) {
    equity += n;
    if (equity > peak) peak = equity;
    maxDD = Math.max(maxDD, peak - equity);
    if (peak > 0) maxPct = Math.max(maxPct, ((peak - equity) / peak) * 100);
  }
  return { total: nets.length, net: sum(nets), wins: wins.length, losses: losses.length, maxDD, maxPct, end: equity };
}

describe('computeStats: a hand-calculated mixed record', () => {
  // chronological nets: +100, -50, 0, +200, -100, starting balance 1000
  const trades = series([100, -50, 0, 200, -100]);
  const s = computeStats(trades, 1000);

  it('counts wins, losses and breakevens, and puts breakevens in the win-rate denominator', () => {
    expect([s.total, s.wins, s.losses, s.breakeven]).toEqual([5, 2, 2, 1]);
    expect(s.winRate).toBeCloseTo(40, 10); // 2 / 5
    expect(s.lossRate).toBeCloseTo(40, 10);
  });

  it('gross profit, gross loss, profit factor, averages and payoff', () => {
    expect(s.grossProfit).toBe(300);
    expect(s.grossLoss).toBe(150);
    expect(s.profitFactor).toBe(2);
    expect(s.avgWin).toBe(150);
    expect(s.avgLoss).toBe(75);
    expect(s.payoff).toBe(2);
  });

  it('expectancy is net per trade, and equals P(win)*avgWin - P(loss)*avgLoss', () => {
    expect(s.net).toBe(150);
    expect(s.expectancy).toBe(30);
    expect(s.expectancy).toBeCloseTo(0.4 * 150 - 0.4 * 75, 10);
  });

  it('walks the equity curve from the starting balance and finds the deepest fall from a peak', () => {
    expect(s.equity.map((p) => p.equity)).toEqual([1000, 1100, 1050, 1050, 1250, 1150]);
    expect(s.equity.map((p) => p.peak)).toEqual([1000, 1100, 1100, 1100, 1250, 1250]);
    expect(s.maxDrawdown).toBe(100); // 1250 -> 1150
    expect(s.maxDrawdownPct).toBeCloseTo(8, 10); // 100 / 1250, larger than 50 / 1100
  });

  it('streaks: a breakeven ends a run, and the current streak is the last run', () => {
    expect(s.maxWinStreak).toBe(1);
    expect(s.maxLossStreak).toBe(1);
    expect(s.currentStreak).toBe(-1);
  });

  it('best and worst day, active days and the average day', () => {
    expect(s.bestDay?.net).toBe(200);
    expect(s.worstDay?.net).toBe(-100);
    expect(s.activeDays).toBe(5);
    expect(s.avgDaily).toBe(30);
    expect(s.largestWin).toBe(200);
    expect(s.largestLoss).toBe(-100);
  });

  it("SQN follows Van Tharp's definition: mean / sample standard deviation * sqrt(n)", () => {
    // no stops were logged, so the basis is money: mean 30, sample variance 58000 / 4
    const expected = (30 / Math.sqrt(58000 / 4)) * Math.sqrt(5);
    expect(s.sqn).toBeCloseTo(expected, 10); // 0.557...
  });
});

describe('computeStats: boundaries', () => {
  it('no trades at all', () => {
    const s = computeStats([], 500);
    expect(s.total).toBe(0);
    expect(s.profitFactor).toBeNull();
    expect(s.payoff).toBeNull();
    expect(s.sqn).toBeNull();
    expect(s.maxDrawdown).toBe(0);
    expect(s.maxDrawdownPct).toBeNull();
    expect(s.equity).toEqual([{ index: 0, label: 'Start', equity: 500, net: 0, peak: 500 }]);
  });

  it('one winning trade: profit factor and payoff are infinite, not a number', () => {
    const s = computeStats(series([50]));
    expect(s.profitFactor).toBe(Number.POSITIVE_INFINITY);
    expect(s.payoff).toBe(Number.POSITIVE_INFINITY);
    expect(s.sqn).toBeNull(); // a single sample has no spread
  });

  it('every trade a winner', () => {
    const s = computeStats(series([10, 20, 30]), 100);
    expect(s.winRate).toBe(100);
    expect(s.profitFactor).toBe(Number.POSITIVE_INFINITY);
    expect(s.maxDrawdown).toBe(0);
    expect(s.avgLoss).toBe(0);
  });

  it('every trade a loser: profit factor 0, payoff 0', () => {
    const s = computeStats(series([-10, -20]), 100);
    expect(s.winRate).toBe(0);
    expect(s.profitFactor).toBe(0);
    expect(s.payoff).toBe(0);
    expect(s.maxDrawdown).toBe(30);
    expect(s.maxDrawdownPct).toBeCloseTo(30, 10);
  });

  it('every trade breakeven: profit factor is undefined (null), SQN undefined', () => {
    const s = computeStats(series([0, 0, 0]));
    expect(s.breakeven).toBe(3);
    expect(s.profitFactor).toBeNull();
    expect(s.expectancy).toBe(0);
    expect(s.sqn).toBeNull();
  });

  it('drawdown percentage needs a starting balance', () => {
    expect(computeStats(series([10, -5])).maxDrawdownPct).toBeNull();
  });

  it('very large and very small values stay exact enough', () => {
    const s = computeStats(series([1e12, -5e11, 0.0001]));
    expect(s.net).toBeCloseTo(5e11 + 0.0001, 0);
    expect(s.grossProfit).toBeCloseTo(1e12 + 0.0001, 0);
  });
});

describe('computeStats: which trades count', () => {
  it('open, excluded and incomplete trades stay out of every figure', () => {
    const counted = series([100, -40]);
    const others = [
      trade({ exitPrice: null, closedAt: undefined, openedAt: '2026-03-04T10:00' }),
      pnl(5000, { excluded: true }),
      trade({ entryPrice: 0, exitPrice: 5000, quantity: 1, multiplier: 50 }), // an incomplete import
    ];
    const s = computeStats([...counted, ...others], 1000);
    expect(s.total).toBe(2);
    expect(s.net).toBe(60);
  });

  it('the open count is positions still open, not trades that are merely incomplete', () => {
    const s = computeStats([
      ...series([10]),
      trade({ exitPrice: null, closedAt: undefined }), // genuinely open
      trade({ entryPrice: 0 }), // closed, but missing its entry price
    ]);
    expect(s.open).toBe(1);
  });

  it('fees are counted once: in net P&L and in the fees total', () => {
    const t = trade({ entryPrice: 100, exitPrice: 110, quantity: 10, fees: 4 });
    const s = computeStats([t]);
    expect(s.gross).toBe(100);
    expect(s.fees).toBe(4);
    expect(s.net).toBe(96);
  });

  it('equal close times keep the order the trades were logged in (documented tie-break)', () => {
    const a = pnl(-100, { closedAt: '2026-03-02T11:00' });
    const b = pnl(100, { closedAt: '2026-03-02T11:00' });
    expect(computeStats([a, b], 1000).maxDrawdown).toBe(100);
    expect(computeStats([b, a], 1000).maxDrawdown).toBe(100);
  });
});

describe('computeStats: R multiples and SQN basis', () => {
  it('SQN uses R when most trades have a stop, scaled by the number of R values', () => {
    // 6 trades with a stop (R = 2, -1, 1, -1, 2, 0.5) and 4 without
    const withStops = [2, -1, 1, -1, 2, 0.5].map((r, i) =>
      trade({
        entryPrice: 100,
        stopLoss: 90,
        exitPrice: 100 + r * 10,
        quantity: 1,
        openedAt: `2026-03-${String(2 + i).padStart(2, '0')}T10:00`,
        closedAt: `2026-03-${String(2 + i).padStart(2, '0')}T11:00`,
      }),
    );
    const withoutStops = series([30, -10, 5, 20]);
    const s = computeStats([...withStops, ...withoutStops]);
    const rs = [2, -1, 1, -1, 2, 0.5];
    const m = rs.reduce((a, b) => a + b, 0) / rs.length;
    const sd = Math.sqrt(rs.reduce((a, r) => a + (r - m) ** 2, 0) / (rs.length - 1));
    expect(s.avgR).toBeCloseTo(m, 10);
    expect(s.sqn).toBeCloseTo((m / sd) * Math.sqrt(rs.length), 10);
  });
});

describe('computeStats: properties over random records', () => {
  const rand = seeded(20261009);
  const randomRecord = () =>
    Array.from({ length: 2 + Math.floor(rand() * 40) }, (_, i) => {
      const net = Math.round((rand() - 0.45) * 2000) / 100;
      const day = 1 + Math.floor(i / 3);
      return pnl(net, {
        openedAt: `2026-04-${String(day).padStart(2, '0')}T09:${String(i % 60).padStart(2, '0')}`,
        closedAt: `2026-04-${String(day).padStart(2, '0')}T10:${String(i % 60).padStart(2, '0')}`,
      });
    });

  it('matches the reference implementation', () => {
    for (let k = 0; k < 200; k++) {
      const trades = randomRecord();
      const start = Math.round(rand() * 10000);
      const s = computeStats(trades, start);
      const r = reference(trades, start);
      expect(s.total).toBe(r.total);
      expect(s.wins).toBe(r.wins);
      expect(s.losses).toBe(r.losses);
      expect(s.net).toBeCloseTo(r.net, 8);
      expect(s.maxDrawdown).toBeCloseTo(r.maxDD, 8);
      if (start > 0) expect(s.maxDrawdownPct).toBeCloseTo(r.maxPct, 8);
      expect(s.equity.at(-1)?.equity).toBeCloseTo(r.end, 8);
    }
  });

  it('input order does not change any total (the curve is sorted by time)', () => {
    for (let k = 0; k < 100; k++) {
      const trades = randomRecord();
      const a = computeStats(trades, 1000);
      const b = computeStats(shuffle(trades, rand), 1000);
      expect(b.net).toBeCloseTo(a.net, 8);
      expect(b.winRate).toBe(a.winRate);
      expect(b.profitFactor).toBe(a.profitFactor);
      expect(b.maxDrawdown).toBeCloseTo(a.maxDrawdown, 8);
    }
  });

  it('adding a breakeven trade changes no money figure', () => {
    for (let k = 0; k < 100; k++) {
      const trades = randomRecord();
      const a = computeStats(trades, 1000);
      const b = computeStats([...trades, pnl(0, { closedAt: '2026-04-30T12:00' })], 1000);
      expect(b.net).toBeCloseTo(a.net, 8);
      expect(b.grossProfit).toBeCloseTo(a.grossProfit, 8);
      expect(b.grossLoss).toBeCloseTo(a.grossLoss, 8);
      expect(b.breakeven).toBe(a.breakeven + 1);
    }
  });
});

describe('aggregateDays and groupTrades', () => {
  it('groups by the day a trade closed, skipping open and excluded trades', () => {
    const days = aggregateDays([
      pnl(10, { closedAt: '2026-03-02T09:00' }),
      pnl(-4, { closedAt: '2026-03-02T15:00' }),
      pnl(7, { closedAt: '2026-03-03T09:00' }),
      pnl(99, { closedAt: '2026-03-03T10:00', excluded: true }),
      trade({ exitPrice: null, closedAt: undefined, openedAt: '2026-03-03T10:00' }),
    ]);
    expect(days).toEqual([
      { day: '2026-03-02', net: 6, trades: 2, wins: 1, losses: 1 },
      { day: '2026-03-03', net: 7, trades: 1, wins: 1, losses: 0 },
    ]);
  });

  it('per-group figures use the same definitions as the headline ones', () => {
    const groups = groupTrades(
      [pnl(10, { symbol: 'A' }), pnl(-5, { symbol: 'A' }), pnl(3, { symbol: 'B' })],
      (t) => t.symbol,
    );
    expect(groups).toEqual([
      { key: 'A', label: 'A', trades: 2, net: 5, wins: 1, winRate: 50, avg: 2.5, profitFactor: 2 },
      { key: 'B', label: 'B', trades: 1, net: 3, wins: 1, winRate: 100, avg: 3, profitFactor: Number.POSITIVE_INFINITY },
    ]);
  });
});

describe('sniperScore', () => {
  it('rates nothing below 5 closed trades, and says so rather than scoring 0', () => {
    const trades = series([10, -5]);
    const score = sniperScore(trades, computeStats(trades));
    expect(score.overall).toBeNull();
    expect(score.unrated).toContain('Win rate');
  });

  it('documents the formula: win rate x1.4, PF/3, (avg R + 0.5) x 50, ratings / 5', () => {
    const trades = series([10, -5, 10, 10, -5, 10], (i) => ({ review: { discipline: 4, execution: 3, patience: 5 }, closedAt: `2026-03-${String(2 + i).padStart(2, '0')}T11:00` }));
    const stats = computeStats(trades);
    const score = sniperScore(trades, stats);
    const axis = (name: string) => score.axes.find((a) => a.axis === name);
    expect(axis('Win rate')?.score).toBeCloseTo(Math.min(100, (4 / 6) * 100 * 1.4), 10);
    expect(axis('Profit factor')?.score).toBeCloseTo(Math.min(100, (40 / 10 / 3) * 100), 10);
    expect(axis('Risk:reward')?.rated).toBe(false); // no stops logged
    expect(axis('Discipline')?.score).toBe(80);
    expect(axis('Patience')?.score).toBe(100);
    const rated = score.axes.filter((a) => a.rated);
    expect(score.overall).toBe(Math.round(rated.reduce((a, b) => a + b.score, 0) / rated.length));
  });

  it('labels SQN bands', () => {
    expect(sqnLabel(null)).toBe('Not enough data');
    expect(sqnLabel(1.5)).toBe('Below average');
    expect(sqnLabel(2.4)).toBe('Good');
    expect(sqnLabel(5)).toBe('Exceptional');
  });
});
