import { describe, expect, it } from 'vitest';
import { FORM_WINDOWS, recentForm } from '@/lib/recent-form';
import type { Trade } from '@/lib/types';
import { pnl, seeded, shuffle, trade } from './helpers';

/** one closed trade a day from 1 January 2026, in order, each for its net */
const series = (nets: number[], extra: (i: number) => Partial<Trade> = () => ({})): Trade[] =>
  nets.map((net, i) => {
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    return pnl(net, { openedAt: `${day}T10:00`, closedAt: `${day}T11:00`, ...extra(i) });
  });
/** a closed trade with a stop 10 below a 100 entry, for `r` R, on day `i` of the series */
const withStop = (r: number, i: number) => {
  const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
  return trade({
    entryPrice: 100,
    stopLoss: 90,
    exitPrice: 100 + r * 10,
    openedAt: `${day}T10:00`,
    closedAt: `${day}T11:00`,
  });
};

describe('recentForm: the last 10, 20 and 50 trades against the whole record', () => {
  it('looks back over 10, 20 and 50 trades', () => {
    expect([...FORM_WINDOWS]).toEqual([10, 20, 50]);
    expect(recentForm([]).windows.map((w) => w.size)).toEqual([10, 20, 50]);
  });

  it('a hand-worked record: 30 losing trades, then 20 winning ones', () => {
    const form = recentForm(series([...Array(30).fill(-10), ...Array(20).fill(10)]));
    const [ten, twenty, fifty] = form.windows;
    expect(ten).toMatchObject({ trades: 10, needed: 0, winRate: 100 });
    expect(twenty).toMatchObject({ trades: 20, needed: 0, winRate: 100 });
    expect(fifty).toMatchObject({ trades: 50, needed: 0, winRate: 40 });
    expect(form.all).toMatchObject({ size: null, trades: 50, needed: 0, winRate: 40 });
  });

  it('takes the last trades by the time they closed, whatever order they were logged in', () => {
    const record = series([...Array(15).fill(-10), ...Array(10).fill(10)]);
    const rand = seeded(7);
    for (let i = 0; i < 5; i++) {
      expect(recentForm(shuffle(record, rand)).windows[0]).toMatchObject({ trades: 10, winRate: 100 });
    }
    // a trade opened first but closed last is the latest
    const late = pnl(-10, { openedAt: '2025-12-01T10:00', closedAt: '2026-03-01T11:00' });
    expect(recentForm([...record, late]).windows[0].winRate).toBe(90);
  });

  it('a window with too few trades is not read, and says how many more it needs', () => {
    const form = recentForm(series(Array(14).fill(10)));
    expect(form.windows.map((w) => [w.trades, w.needed, w.winRate])).toEqual([
      [10, 0, 100],
      [0, 6, null],
      [0, 36, null],
    ]);
    expect(form.all).toMatchObject({ trades: 14, needed: 0, winRate: 100 });
    // none at all: every window needs its whole size, and the record has nothing to say
    expect(recentForm([]).windows.map((w) => w.needed)).toEqual([10, 20, 50]);
    expect(recentForm([]).all).toMatchObject({ trades: 0, winRate: null, avgR: null, rTrades: 0 });
  });

  it('counts only what every statistic counts: no open, excluded or incomplete trade', () => {
    const record = series(Array(10).fill(10));
    const others = [
      trade({ exitPrice: null, closedAt: undefined, openedAt: '2026-02-01T10:00' }),
      pnl(-50, { excluded: true, openedAt: '2026-02-02T10:00', closedAt: '2026-02-02T11:00' }),
      trade({ entryPrice: 0, exitPrice: 50, openedAt: '2026-02-03T10:00', closedAt: '2026-02-03T11:00' }),
    ];
    const form = recentForm([...record, ...others]);
    expect(form.windows[0]).toMatchObject({ trades: 10, winRate: 100 });
    expect(form.all.trades).toBe(10);
  });

  it('a trade at break-even is not a win', () => {
    expect(recentForm(series([...Array(5).fill(10), ...Array(5).fill(0)])).windows[0].winRate).toBe(50);
  });

  it('average R is over the trades with a stop, and says how many those are', () => {
    // 10 trades: 4 with a stop (+2, -1, +1, -0.5 R), 6 without
    const trades = [
      ...[2, -1, 1, -0.5].map((r, i) => withStop(r, i)),
      ...series(Array(6).fill(10), (i) => ({ openedAt: `2026-01-1${i}T10:00`, closedAt: `2026-01-1${i}T11:00` })),
    ];
    const form = recentForm(trades);
    expect(form.windows[0].avgR).toBeCloseTo(1.5 / 4, 10);
    expect(form.windows[0].rTrades).toBe(4);
    // none with a stop: no average R
    expect(recentForm(series(Array(10).fill(10))).windows[0]).toMatchObject({ avgR: null, rTrades: 0 });
  });

  it('the R of the last trades only, against the whole record', () => {
    // 20 trades at -1R, then 10 at +2R
    const trades = [...Array(20).fill(-1), ...Array(10).fill(2)].map((r, i) => withStop(r, i));
    const form = recentForm(trades);
    expect(form.windows[0].avgR).toBeCloseTo(2, 10);
    expect(form.windows[1].avgR).toBeCloseTo((10 * 2 + 10 * -1) / 20, 10);
    expect(form.all.avgR).toBeCloseTo((10 * 2 + 20 * -1) / 30, 10);
    expect(form.all.rTrades).toBe(30);
  });

  it('other windows can be asked for', () => {
    const form = recentForm(series([-10, 10, 10]), [2, 5]);
    expect(form.windows.map((w) => [w.size, w.winRate, w.needed])).toEqual([
      [2, 100, 0],
      [5, null, 2],
    ]);
  });
});
