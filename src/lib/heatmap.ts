import type { Trade } from './types';
import { netPnl, settle, statTrades } from './trade-math';
import { parseLocal } from './utils';
import { thinMark } from './stats';

/** the trades opened on one weekday in one hour */
export interface HeatCell {
  /** 0 is Monday, as the calendar grid is laid out */
  weekday: number;
  /** 0 to 23, the hour the trades were opened in */
  hour: number;
  trades: number;
  net: number;
  /** under 3 trades 'few', under 10 'thin', as the other tables mark them */
  mark: 'few' | 'thin' | null;
}

export interface Heatmap {
  /** the rows' weekdays, Monday first: Monday to Friday always, Saturday and Sunday once a trade was opened on one */
  weekdays: number[];
  /** the hours drawn: from the first a trade was opened in to the last, with the empty ones between */
  hours: number[];
  /** the cell for each weekday and hour, in the order of `weekdays` and `hours`; null where no trade was opened */
  grid: (HeatCell | null)[][];
  /** the biggest net of a cell of 3 trades or more, either way: a cell's colour is its net against this */
  strongest: number;
  /** trades left out: no time they were opened, only a date */
  noTime: number;
}

/** a time of day written in an entry time: "2026-03-02T09:30", not just "2026-03-02" */
const hasTime = (openedAt: string) => /T\d{1,2}:\d{2}/.test(openedAt);

/**
 * When the trades were opened, by weekday and hour: each cell's net and count.
 * Only trades that count towards the statistics, and only those with a time
 * they were opened; a date alone would put them all at midnight. The range
 * picked on Reports goes by the day a trade closed, as everywhere there; the
 * cell here by when it was opened, so a trade held overnight is in its entry's.
 */
export function weekdayHourHeatmap(trades: Trade[]): Heatmap {
  const cells = new Map<string, HeatCell>();
  let noTime = 0;
  for (const trade of statTrades(trades)) {
    if (!trade.openedAt || !hasTime(trade.openedAt)) {
      noTime++;
      continue;
    }
    const opened = parseLocal(trade.openedAt);
    const weekday = (opened.getDay() + 6) % 7;
    const hour = opened.getHours();
    const key = `${weekday}-${hour}`;
    const cell = cells.get(key) ?? { weekday, hour, trades: 0, net: 0, mark: null };
    cell.trades++;
    cell.net = settle(cell.net + netPnl(trade));
    cells.set(key, cell);
  }

  const all = [...cells.values()];
  for (const cell of all) cell.mark = thinMark(cell.trades);
  const weekend = all.filter((c) => c.weekday >= 5).map((c) => c.weekday);
  const weekdays = [0, 1, 2, 3, 4, ...[5, 6].filter((d) => weekend.includes(d))];
  const opened = all.map((c) => c.hour);
  const hours = opened.length
    ? Array.from({ length: Math.max(...opened) - Math.min(...opened) + 1 }, (_, i) => Math.min(...opened) + i)
    : [];
  const grid = weekdays.map((weekday) => hours.map((hour) => cells.get(`${weekday}-${hour}`) ?? null));
  const strongest = all.filter((c) => c.mark !== 'few').reduce((top, c) => Math.max(top, Math.abs(c.net)), 0);
  return { weekdays, hours, grid, strongest, noTime };
}
