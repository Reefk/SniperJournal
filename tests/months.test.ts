import { describe, expect, it } from 'vitest';
import { monthRows } from '@/lib/months';
import { pnl, trade } from './helpers';

/** a trade for `net` closed on `day`, 'YYYY-MM-DD' */
const on = (day: string, net: number) => pnl(net, { openedAt: `${day}T10:00`, closedAt: `${day}T11:00` });
const ALL = [on('2026-01-10', 100), on('2026-01-20', -40), on('2026-02-05', 30), on('2026-03-01', -10)];

describe("monthRows: Reports' month table", () => {
  it('each month newest first: its net, trades and wins', () => {
    expect(monthRows(ALL)).toEqual([
      { key: '2026-03', net: -10, trades: 1, wins: 0 },
      { key: '2026-02', net: 30, trades: 1, wins: 1 },
      { key: '2026-01', net: 60, trades: 2, wins: 1 },
    ]);
  });

  it('a month of +0.10, +0.20 and -0.30 is $0, not a green fraction above it', () => {
    const month = [on('2026-03-02', 0.1), on('2026-03-03', 0.2), on('2026-03-04', -0.3)];
    expect(monthRows(month)).toEqual([{ key: '2026-03', net: 0, trades: 3, wins: 2 }]);
  });

  it('counts only what every statistic counts: no open or excluded trade', () => {
    const all = [
      ...ALL,
      trade({ openedAt: '2026-03-02T09:00', exitPrice: null, closedAt: undefined }),
      { ...on('2026-02-10', 500), excluded: true },
    ];
    expect(monthRows(all)).toEqual(monthRows(ALL));
  });
});
