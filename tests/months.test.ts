import { describe, expect, it } from 'vitest';
import { monthRows } from '@/lib/months';
import { pnl, trade } from './helpers';

/** a trade for `net` closed on `day`, 'YYYY-MM-DD' */
const on = (day: string, net: number) => pnl(net, { openedAt: `${day}T10:00`, closedAt: `${day}T11:00` });
const ALL = [on('2026-01-10', 100), on('2026-01-20', -40), on('2026-02-05', 30), on('2026-03-01', -10)];

describe("monthRows: Reports' month table", () => {
  it('each month newest first: its net, trades, wins, and the balance it left', () => {
    expect(monthRows(ALL, ALL, 1000)).toEqual([
      { key: '2026-03', net: -10, trades: 1, wins: 0, balance: 1080 },
      { key: '2026-02', net: 30, trades: 1, wins: 1, balance: 1090 },
      { key: '2026-01', net: 60, trades: 2, wins: 1, balance: 1060 },
    ]);
  });

  it("a range shows its own months, each with the balance from all the account's trades", () => {
    expect(monthRows(ALL.slice(2), ALL, 1000).map((row) => [row.key, row.net, row.balance])).toEqual([
      ['2026-03', -10, 1080],
      ['2026-02', 30, 1090],
    ]);
  });

  it('with no starting balance, the balance is the net so far', () => {
    expect(monthRows(ALL, ALL, 0).map((row) => row.balance)).toEqual([80, 90, 60]);
  });

  it('a month of +0.10, +0.20 and -0.30 is $0, not a green fraction above it', () => {
    const month = [on('2026-03-02', 0.1), on('2026-03-03', 0.2), on('2026-03-04', -0.3)];
    expect(monthRows(month, month, 0)).toEqual([{ key: '2026-03', net: 0, trades: 3, wins: 2, balance: 0 }]);
  });

  it('counts only what every statistic counts: no open or excluded trade, in the month or the balance', () => {
    const all = [
      ...ALL,
      trade({ openedAt: '2026-03-02T09:00', exitPrice: null, closedAt: undefined }),
      { ...on('2026-02-10', 500), excluded: true },
    ];
    expect(monthRows(all, all, 1000)).toEqual(monthRows(ALL, ALL, 1000));
  });

  it("an excluded trade counts in the balance when Settings says so, never in a month's figures", () => {
    const all = [
      ...ALL,
      { ...on('2026-02-10', 500), excluded: true },
      // a month with only an excluded trade has no row, and still moves the balance after it
      { ...on('2026-04-03', 7), excluded: true },
      { ...trade({ openedAt: '2026-02-11T09:00', exitPrice: null, closedAt: undefined }), excluded: true },
    ];
    expect(monthRows(all, all, 1000, true)).toEqual([
      { key: '2026-03', net: -10, trades: 1, wins: 0, balance: 1580 },
      { key: '2026-02', net: 30, trades: 1, wins: 1, balance: 1590 },
      { key: '2026-01', net: 60, trades: 2, wins: 1, balance: 1060 },
    ]);
  });
});
