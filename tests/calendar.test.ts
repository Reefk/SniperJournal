import { describe, expect, it } from 'vitest';
import { monthGrid, monthLine, weekTotals } from '@/lib/calendar';
import { aggregateDays } from '@/lib/stats';
import { pnl } from './helpers';

/** a trade for `net` closed on `day`, 'YYYY-MM-DD' */
const on = (day: string, net: number) => pnl(net, { openedAt: `${day}T10:00`, closedAt: `${day}T11:00` });
/** `count` trades of `net` each on `day` */
const many = (count: number, day: string, net: number) => Array.from({ length: count }, () => on(day, net));
const line = (...trades: ReturnType<typeof on>[][]) => monthLine(aggregateDays(trades.flat()));

describe("monthGrid: the Calendar's rows", () => {
  it('Monday first, the first row filled from the month before and the last from the month after', () => {
    // 1 March 2026 is a Sunday
    const grid = monthGrid(2026, 2);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ key: '2026-02-23', inMonth: false, day: 23 });
    expect(grid[6]).toEqual({ key: '2026-03-01', inMonth: true, day: 1 });
    expect(grid[41]).toEqual({ key: '2026-04-05', inMonth: false, day: 5 });
  });

  it('five rows when the month fits in them', () => {
    // 1 October 2026 is a Thursday: 3 days of September, then 31
    expect(monthGrid(2026, 9)).toHaveLength(35);
  });

  it('February 2027, Monday the 1st to Sunday the 28th, is four rows: no row of March alone', () => {
    const grid = monthGrid(2027, 1);
    expect(grid).toHaveLength(28);
    expect(grid.every((cell) => cell.inMonth)).toBe(true);
  });
});

describe("weekTotals: a total for each of the grid's rows", () => {
  it("from the month's own days, so the weeks add up to the month", () => {
    const weeks = weekTotals(
      monthGrid(2026, 2),
      aggregateDays([
        on('2026-02-27', 50), // on March's first row, but February's
        on('2026-03-01', 10),
        on('2026-03-02', 20),
        on('2026-03-03', -5),
        on('2026-03-03', -10),
        on('2026-03-31', 7),
      ]),
    );
    const none = { net: 0, trades: 0, green: 0, red: 0 };
    expect(weeks).toEqual([
      { from: '2026-03-01', to: '2026-03-01', net: 10, trades: 1, green: 1, red: 0 },
      { from: '2026-03-02', to: '2026-03-08', net: 5, trades: 3, green: 1, red: 1 },
      { from: '2026-03-09', to: '2026-03-15', ...none },
      { from: '2026-03-16', to: '2026-03-22', ...none },
      { from: '2026-03-23', to: '2026-03-29', ...none },
      { from: '2026-03-30', to: '2026-03-31', net: 7, trades: 1, green: 1, red: 0 },
    ]);
  });

  it('a week of +0.10, +0.20 and -0.30 is $0, not a fraction above it', () => {
    const days = aggregateDays([on('2026-03-02', 0.1), on('2026-03-03', 0.2), on('2026-03-04', -0.3)]);
    expect(weekTotals(monthGrid(2026, 2), days)[1].net).toBe(0);
  });
});

describe("monthLine: the line under a month's numbers", () => {
  it('the average green day against the average red day; a day of $0 is neither', () => {
    const month = line([on('2026-03-02', 100), on('2026-03-03', 50), on('2026-03-04', -30), on('2026-03-05', 0)]);
    expect(month.green).toBe(75);
    expect(month.red).toBe(-30);
  });

  it('with no day of a kind, no average of it', () => {
    expect(line([on('2026-03-02', 10)])).toEqual({ green: 10, red: null, best: null });
    expect(line([])).toEqual({ green: null, red: null, best: null });
  });

  it('names the weekday that made the most, from 10 trades', () => {
    // two Mondays of five trades, +$5 each; a Tuesday of three losses
    const month = line(many(5, '2026-03-02', 5), many(5, '2026-03-09', 5), many(3, '2026-03-03', -10));
    expect(month.best).toEqual({ weekday: 0, net: 50, trades: 10 });
  });

  it('names none when the top weekday has under 10 trades, however much it made', () => {
    expect(line(many(10, '2026-03-02', 5), many(4, '2026-03-03', 20)).best).toBeNull();
  });

  it('leaves out a weekday of 1 or 2 trades: the best of the rest is named', () => {
    expect(line(many(10, '2026-03-02', 5), many(2, '2026-03-03', 250)).best?.weekday).toBe(0);
  });

  it('names none when the top weekday lost money, or another made as much', () => {
    expect(line(many(10, '2026-03-02', -5)).best).toBeNull();
    expect(line(many(10, '2026-03-02', 5), many(10, '2026-03-03', 5)).best).toBeNull();
  });
});
