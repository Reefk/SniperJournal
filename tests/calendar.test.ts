import { describe, expect, it } from 'vitest';
import { monthGrid } from '@/lib/calendar';

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
