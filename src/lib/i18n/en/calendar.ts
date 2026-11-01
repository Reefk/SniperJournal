import type { Message } from '../types';

/** the Calendar screen: its header, the month's numbers, the days and a day's trades */
export const calendar = {
  'cal.title': 'Performance Calendar',
  // one of the two words shows: <phone> on a phone, <pc> on a PC
  'cal.hint': '<phone>tap</phone><pc>click</pc> any day to see the trades behind the number',
  'cal.previous': 'Previous month',
  'cal.next': 'Next month',
  'cal.today': 'Today',
  'cal.empty.title': 'Your trading calendar is empty',
  'cal.empty.text':
    'Once you log trades, each day fills in with its net profit or loss and the number of trades you took, so streaks and problem days become obvious at a glance.',
  'cal.net': 'Monthly net P&L',
  'cal.stillOpen': { one: '{count} still open', other: '{count} still open' },
  'cal.activeDays': 'Active days',
  // count: the green days
  'cal.greenRed': { one: '{count} green, {red} red', other: '{count} green, {red} red' },
  'cal.winRate': 'Win rate this month',
  'cal.noneClosed': 'no closed trades yet',
  'cal.noneIn': 'No trades in {month}.',
  'cal.dayNet': { one: '{count} trade · net {net}', other: '{count} trades · net {net}' },
  // the month's weeks, a row each as on the grid: beside it on a wide screen, under it otherwise
  'cal.weeks': 'Weeks',
  // a week's first and last day in the month
  'cal.week.days': '{from} – {to}',
  'cal.week.none': 'No trades',
  // the line under the month's numbers; green and red are amounts with their sign
  'cal.line.both': 'Green days average {green}, red days {red}.',
  'cal.line.green': 'Green days average {green}.',
  'cal.line.red': 'Red days average {red}.',
  // day: a weekday's name as a sentence names it (weekdayName's long form: "lunes", "понедельник";
  // English keeps "Mon", as its other sentences do); count is 10 or more
  'cal.line.best': {
    one: 'Best weekday: {day}, {net} from {count} trade.',
    other: 'Best weekday: {day}, {net} from {count} trades.',
  },
} satisfies Record<string, Message>;
