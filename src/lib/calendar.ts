import type { DayAgg } from './stats';
import { thinMark } from './stats';
import { settle } from './trade-math';
import { dateKey, mean, parseLocal } from './utils';

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

/** a row of the grid: what was made on the month's days in it */
export interface WeekTotal {
  /** the row's first and last day in the month, 'YYYY-MM-DD' */
  from: string;
  to: string;
  net: number;
  trades: number;
  /** the days in the row with a net above 0, and below */
  green: number;
  red: number;
}

/**
 * A total for each row of the grid, from the month's own days only, as the
 * cells show them: a week across two months is in both, each with its part,
 * so the weeks add up to the month.
 */
export function weekTotals(grid: GridCell[], days: DayAgg[]): WeekTotal[] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const weeks: WeekTotal[] = [];
  for (let i = 0; i < grid.length; i += 7) {
    const own = grid.slice(i, i + 7).filter((c) => c.inMonth);
    if (own.length === 0) continue;
    const traded = own.flatMap((c) => byDay.get(c.key) ?? []);
    weeks.push({
      from: own[0].key,
      to: own[own.length - 1].key,
      net: settle(traded.reduce((sum, d) => sum + d.net, 0)),
      trades: traded.reduce((sum, d) => sum + d.trades, 0),
      green: traded.filter((d) => d.net > 0).length,
      red: traded.filter((d) => d.net < 0).length,
    });
  }
  return weeks;
}

export interface WeekdayTotal {
  /** 0 is Monday */
  weekday: number;
  net: number;
  trades: number;
}

export interface MonthLine {
  /** the average net of a green day, and of a red one; null with none */
  green: number | null;
  red: number | null;
  /** the weekday that made the most, once it can be named best; else null */
  best: WeekdayTotal | null;
}

/**
 * The line under a month's numbers: the average green day against the
 * average red day, and the best weekday. As in the other tables, a weekday
 * is ranked from 3 trades and named best only from 10, and only when it made
 * money and no other made as much.
 */
export function monthLine(days: DayAgg[]): MonthLine {
  const greens = days.filter((d) => d.net > 0).map((d) => d.net);
  const reds = days.filter((d) => d.net < 0).map((d) => d.net);
  const weekdays = new Map<number, WeekdayTotal>();
  for (const d of days) {
    const weekday = (parseLocal(d.day).getDay() + 6) % 7;
    const total = weekdays.get(weekday) ?? { weekday, net: 0, trades: 0 };
    total.net = settle(total.net + d.net);
    total.trades += d.trades;
    weekdays.set(weekday, total);
  }
  const [top, next] = [...weekdays.values()].filter((w) => thinMark(w.trades) !== 'few').sort((a, b) => b.net - a.net);
  const named = top && thinMark(top.trades) === null && top.net > 0 && !(next && next.net === top.net);
  return {
    green: greens.length ? settle(mean(greens)) : null,
    red: reds.length ? settle(mean(reds)) : null,
    best: named ? top : null,
  };
}
