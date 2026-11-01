import { dateKey } from './utils';

/** a day on the Calendar's grid */
export interface GridCell {
  /** 'YYYY-MM-DD' */
  key: string;
  /** false for the days of the months either side that fill the first and last rows */
  inMonth: boolean;
  day: number;
}

/**
 * The Calendar's grid for a month (0 for January): Monday-first rows of 7
 * days, the first and last filled with the days either side, and no row
 * after the one with the month's last day.
 */
export function monthGrid(year: number, month: number): GridCell[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // shift Sunday to the end
  const length = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, i) => {
    // each day from its own date, so a clock change never moves it
    const d = new Date(year, month, 1 - offset + i);
    return { key: dateKey(d), inMonth: d.getMonth() === month, day: d.getDate() };
  });
}
