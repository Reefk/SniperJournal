import { describe, expect, it } from 'vitest';
import { weekdayHourHeatmap, type HeatCell } from '@/lib/heatmap';
import { pnl, trade } from './helpers';

/** a trade for `net` opened at `time` on a day of March 2026: the 2nd is a Monday */
const at = (day: number, time: string, net: number) =>
  pnl(net, { openedAt: `2026-03-${String(day).padStart(2, '0')}T${time}`, closedAt: undefined });

/** the cells that have trades, as [weekday, hour, trades, net] */
const filled = (grid: (HeatCell | null)[][]) =>
  grid.flat().flatMap((c) => (c ? [[c.weekday, c.hour, c.trades, c.net]] : []));

describe('weekdayHourHeatmap: when the trades were opened', () => {
  it('a cell for each weekday and hour a trade was opened in: its net and trades', () => {
    const map = weekdayHourHeatmap([at(2, '09:30', 40), at(2, '09:55', -15), at(4, '14:00', 25)]);
    // Monday 9:00 has two, Wednesday 14:00 one
    expect(filled(map.grid)).toEqual([
      [0, 9, 2, 25],
      [2, 14, 1, 25],
    ]);
  });

  it('a whole day of hours, midnight to 23:59, and times written as an import may write them', () => {
    // a one-digit hour ("9:30") and seconds ("23:59:59"), as some platforms export them
    const map = weekdayHourHeatmap([at(2, '00:00', 1), at(2, '9:30', 2), at(3, '23:59:59', 3)]);
    expect(map.hours).toEqual(Array.from({ length: 24 }, (_, hour) => hour));
    expect(filled(map.grid)).toEqual([
      [0, 0, 1, 1],
      [0, 9, 1, 2],
      [1, 23, 1, 3],
    ]);
  });

  it('Monday to Friday always; Saturday and Sunday only once traded on', () => {
    expect(weekdayHourHeatmap([at(2, '10:00', 1)]).weekdays).toEqual([0, 1, 2, 3, 4]);
    // the 8th is a Sunday
    expect(weekdayHourHeatmap([at(2, '10:00', 1), at(8, '10:00', 1)]).weekdays).toEqual([0, 1, 2, 3, 4, 6]);
  });

  it('the hours from the first a trade was opened in to the last, empty ones between', () => {
    const map = weekdayHourHeatmap([at(2, '09:00', 1), at(3, '13:59', 1)]);
    expect(map.hours).toEqual([9, 10, 11, 12, 13]);
    expect(map.grid[0]).toHaveLength(5);
    expect(map.grid[0][1]).toBeNull();
  });

  it('leaves out, and counts, a trade with only a date: it would sit at midnight', () => {
    const map = weekdayHourHeatmap([at(2, '09:00', 1), pnl(5, { openedAt: '2026-03-03', closedAt: undefined })]);
    expect(map.noTime).toBe(1);
    expect(filled(map.grid)).toHaveLength(1);
  });

  it('counts only what every statistic counts: no open or excluded trade', () => {
    const map = weekdayHourHeatmap([
      at(2, '09:00', 1),
      trade({ openedAt: '2026-03-02T09:10', exitPrice: null, closedAt: undefined }),
      { ...at(2, '09:20', 5), excluded: true },
    ]);
    expect(filled(map.grid)).toEqual([[0, 9, 1, 1]]);
  });

  it('marks cells as the other tables do: under 3 trades few, under 10 thin', () => {
    const map = weekdayHourHeatmap([
      ...Array.from({ length: 2 }, () => at(2, '09:00', 1)),
      ...Array.from({ length: 5 }, () => at(3, '09:00', 1)),
      ...Array.from({ length: 10 }, () => at(4, '09:00', 1)),
    ]);
    expect(map.grid.slice(0, 3).map((row) => row[0]?.mark)).toEqual(['few', 'thin', null]);
  });

  it('a colour is a cell against the strongest one of 3 trades or more, a cell of 1 or 2 not counted', () => {
    const map = weekdayHourHeatmap([
      at(2, '09:00', 500),
      ...Array.from({ length: 3 }, () => at(3, '09:00', -40)),
      ...Array.from({ length: 3 }, () => at(4, '10:00', 20)),
    ]);
    expect(map.strongest).toBe(120);
  });

  it('a cell of +0.10, +0.20 and -0.30 is $0, not a fraction above it', () => {
    const map = weekdayHourHeatmap([at(2, '09:00', 0.1), at(2, '09:10', 0.2), at(2, '09:20', -0.3)]);
    expect(map.grid[0][0]?.net).toBe(0);
  });

  it('with nothing timed, no hours and nothing strong', () => {
    expect(weekdayHourHeatmap([])).toEqual({
      weekdays: [0, 1, 2, 3, 4],
      hours: [],
      grid: [[], [], [], [], []],
      strongest: 0,
      noTime: 0,
    });
  });
});
