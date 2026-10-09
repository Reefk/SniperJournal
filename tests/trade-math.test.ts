import { afterEach, describe, expect, it } from 'vitest';
import {
  grossPnl,
  holdMinutes,
  isClosed,
  isIncomplete,
  missingDetails,
  netPnl,
  outcome,
  plannedRR,
  riskAmount,
  rMultiple,
  statTrades,
  tradeDay,
} from '@/lib/trade-math';
import { trade } from './helpers';

describe('grossPnl and netPnl', () => {
  it.each([
    // hand-calculated: (exit - entry) * quantity * multiplier * direction
    ['long winner', { side: 'LONG', entryPrice: 100, exitPrice: 110, quantity: 10 }, 100],
    ['short winner', { side: 'SHORT', entryPrice: 100, exitPrice: 90, quantity: 10 }, 100],
    ['short loser', { side: 'SHORT', entryPrice: 100, exitPrice: 110, quantity: 2 }, -20],
    ['futures ES, 2 contracts, 2.25 points', { side: 'LONG', entryPrice: 5000, exitPrice: 5002.25, quantity: 2, multiplier: 50 }, 225],
    ['forex, 47k units', { side: 'LONG', entryPrice: 1.07979, exitPrice: 1.08706, quantity: 47000 }, 341.69],
    ['fractional crypto size', { side: 'LONG', entryPrice: 60000, exitPrice: 60500, quantity: 0.0015 }, 0.75],
    ['scratch: exit equals entry', { side: 'LONG', entryPrice: 100, exitPrice: 100, quantity: 5 }, 0],
  ] as const)('%s', (_, fields, expected) => {
    expect(grossPnl(trade(fields))).toBeCloseTo(expected, 8);
  });

  it('a manual P&L overrides the prices', () => {
    expect(grossPnl(trade({ entryPrice: 100, exitPrice: 200, quantity: 10, manualPnl: 42 }))).toBe(42);
  });

  it('net is gross minus fees, so a fee can only lower it', () => {
    const t = trade({ entryPrice: 100, exitPrice: 110, quantity: 10, fees: 7.5 });
    expect(netPnl(t)).toBeCloseTo(92.5, 10);
    expect(netPnl({ ...t, fees: 0 })).toBeGreaterThan(netPnl(t));
  });

  it('fees larger than the gross profit turn a winner into a loser', () => {
    const t = trade({ entryPrice: 100, exitPrice: 100.5, quantity: 10, fees: 10 });
    expect(netPnl(t)).toBeCloseTo(-5, 10);
    expect(outcome(t)).toBe('LOSS');
  });

  it('an open position has no realised P&L, fees or not', () => {
    const t = trade({ exitPrice: null, closedAt: undefined, fees: 3 });
    expect(isClosed(t)).toBe(false);
    expect(grossPnl(t)).toBe(0);
    expect(netPnl(t)).toBe(0);
    expect(outcome(t)).toBe('OPEN');
  });

  it('a non-finite exit price never makes a trade closed', () => {
    expect(isClosed(trade({ exitPrice: Number.NaN }))).toBe(false);
    expect(isClosed(trade({ exitPrice: Number.POSITIVE_INFINITY }))).toBe(false);
  });

  it('a zero manual P&L is a closed breakeven trade, not an open one', () => {
    const t = trade({ exitPrice: null, manualPnl: 0 });
    expect(isClosed(t)).toBe(true);
    expect(outcome(t)).toBe('BE');
  });

  it('a trade that nets exactly zero after fees is breakeven, despite floating-point noise', () => {
    // 0.1 * 10 is 0.9999999999999987 in binary floating point; the fee is 1.00
    const t = trade({ entryPrice: 1.1, exitPrice: 1.2, quantity: 10, fees: 1 });
    expect(outcome(t)).toBe('BE');
    expect(netPnl(t)).toBe(0);
  });
});

describe('risk, R multiples and planned reward-to-risk', () => {
  it('risk is the distance to the stop times size and multiplier', () => {
    expect(riskAmount(trade({ entryPrice: 100, stopLoss: 95, quantity: 10 }))).toBe(50);
    expect(riskAmount(trade({ entryPrice: 5000, stopLoss: 4990, quantity: 2, multiplier: 50 }))).toBe(1000);
    // for a short the stop sits above the entry; distance is still positive
    expect(riskAmount(trade({ side: 'SHORT', entryPrice: 100, stopLoss: 104, quantity: 5 }))).toBe(20);
  });

  it('no stop, or a stop at the entry, means no measurable risk', () => {
    expect(riskAmount(trade({ stopLoss: null }))).toBeNull();
    expect(riskAmount(trade({ entryPrice: 100, stopLoss: 100 }))).toBeNull();
    expect(rMultiple(trade({ entryPrice: 100, stopLoss: 100, exitPrice: 120 }))).toBeNull();
  });

  it('R is the net result over the risk', () => {
    // gross +100, fees 10 -> net 90; risk 50 -> 1.8R
    const t = trade({ entryPrice: 100, exitPrice: 110, stopLoss: 95, quantity: 10, fees: 10 });
    expect(rMultiple(t)).toBeCloseTo(1.8, 10);
    expect(rMultiple({ ...t, exitPrice: 95, fees: 0 })).toBeCloseTo(-1, 10);
  });

  it('an open trade has no R yet', () => {
    expect(rMultiple(trade({ stopLoss: 95, exitPrice: null }))).toBeNull();
  });

  it('planned R:R is target distance over stop distance', () => {
    expect(plannedRR(trade({ entryPrice: 100, stopLoss: 95, takeProfit: 110 }))).toBe(2);
    expect(plannedRR(trade({ entryPrice: 100, stopLoss: 95 }))).toBeNull();
    expect(plannedRR(trade({ entryPrice: 100, stopLoss: 100, takeProfit: 110 }))).toBeNull();
  });
});

describe('time', () => {
  const zone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = zone;
  });

  it('hold time is minutes from entry to exit', () => {
    expect(holdMinutes(trade({ openedAt: '2026-03-02T10:00', closedAt: '2026-03-02T11:30' }))).toBe(90);
  });

  it('a trade crossing midnight counts towards the day it closed', () => {
    const t = trade({ openedAt: '2026-03-02T23:30', closedAt: '2026-03-03T00:15' });
    expect(holdMinutes(t)).toBe(45);
    expect(tradeDay(t)).toBe('2026-03-03');
  });

  it('an open trade counts towards the day it opened', () => {
    expect(tradeDay(trade({ openedAt: '2026-03-05T09:00', closedAt: undefined, exitPrice: null }))).toBe('2026-03-05');
  });

  it('an exit recorded before the entry gives no hold time rather than a negative one', () => {
    expect(holdMinutes(trade({ openedAt: '2026-03-02T11:00', closedAt: '2026-03-02T10:00' }))).toBeNull();
  });

  it('across the spring-forward DST change, hold time is the real elapsed time', () => {
    process.env.TZ = 'America/New_York'; // clocks jump 02:00 -> 03:00 on 8 March 2026
    expect(holdMinutes(trade({ openedAt: '2026-03-08T01:30', closedAt: '2026-03-08T03:30' }))).toBe(60);
  });
});

describe('completeness and the set statistics are built from', () => {
  it('lists every missing field', () => {
    const t = trade({ symbol: ' ', openedAt: '', quantity: 0, entryPrice: 0 });
    expect(missingDetails(t)).toEqual(['symbol', 'entry time', 'quantity', 'entry price']);
  });

  it('a negative quantity is incomplete, not a short', () => {
    expect(isIncomplete(trade({ quantity: -5 }))).toBe(true);
  });

  it('statistics use closed, complete, non-excluded trades only', () => {
    const counted = trade();
    const open = trade({ exitPrice: null, closedAt: undefined });
    const excluded = trade({ excluded: true });
    const incomplete = trade({ entryPrice: 0 });
    expect(statTrades([counted, open, excluded, incomplete])).toEqual([counted]);
  });
});
