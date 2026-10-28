import type { Message } from '../types';

/**
 * The Reports screen: its header, the Results, Consistency and Risk cards, the tables by month,
 * symbol, setup and weekday, a table for each tag group, and what each mistake cost
 */
export const reports = {
  'rep.description': 'Printable summaries of your trading record.',
  'rep.empty.title': 'No report to build yet',
  'rep.empty.text':
    'Reports summarise what you have logged: a monthly breakdown, performance per symbol and per setup, and the headline statistics, all ready to print or export.',
  // label: the account shown, or all of them
  'rep.closed': { one: '{label} · {count} closed trade', other: '{label} · {count} closed trades' },
  'rep.print': 'Print',

  'rep.results': 'Results',
  'rep.grossProfit': 'Gross profit',
  'rep.grossLoss': 'Gross loss',
  'rep.expectancy': 'Expectancy per trade',

  'rep.consistency': 'Consistency',
  // a count of trades, and a table's column
  'rep.trades': 'Trades',
  'rep.winRate': 'Win rate',
  'rep.greenDays': 'Green days',
  // "58% (7 of 12)": the green days of the days traded
  'rep.greenDays.value': '{pct} ({green} of {days})',
  'rep.greenDays.info':
    'The share of your trading days that ended above zero, after fees. A day counts once, however many trades it had.',
  'rep.bestShare': "Best day's share",
  // count: the green days
  'rep.bestShare.value': { one: '{pct} of {count} green day', other: '{pct} of {count} green days' },
  'rep.bestShare.none': 'no green day',
  'rep.bestShare.info':
    "Your best day's profit as a share of every green day's profit added up. High means one lucky day carries the record; low means the profit is spread over many days.",
  'rep.withoutBest': 'Net without the best day',
  'rep.withoutBest.info':
    'Your net profit with your best day taken out. Red here means that one day is carrying the record.',
  'rep.avgWin': 'Average win',
  'rep.avgLoss': 'Average loss',
  'rep.winStreak': 'Longest win streak',
  'rep.lossStreak': 'Longest loss streak',

  'rep.risk': 'Risk',
  'rep.fromPeak': 'Drawdown from peak',
  // what Drawdown from peak says when there is no balance to take a percentage of
  'rep.setBalance': 'set a starting balance',
  'rep.recovery': 'Recovery factor',
  'rep.recovery.info':
    'Net profit divided by the max drawdown: how many times over the profit covers the deepest fall. Under 1, it is less than you once gave back; ∞ means no fall yet.',
  'rep.sqn': 'System quality (SQN)',
  'rep.hold': 'Average hold time',

  'rep.months': 'Month by month',
  'rep.months.empty': 'No closed trades in this range.',
  'rep.month': 'Month',
  'rep.net': 'Net',
  'rep.bySymbol': 'Best and worst symbols',
  'rep.bySetup': 'Playbook setups',
  'rep.byWeekday': 'Day of the week',
  // a trade's setup that is no longer in the playbook
  'rep.unknownSetup': 'Unknown',
  'rep.bestWorst': 'Best day {best} at {bestNet}; worst day {worst} at {worstNet}.',

  // a table for each tag group (Settings → Tags), with each of its tags
  'rep.tags.kind': 'Tag group',
  'rep.tags.empty': 'No trade in this range has its tags.',
  'rep.tags.tag': 'Tag',
  'rep.tags.avgR': 'Average R is over the trades with a stop.',
  'rep.tags.few': 'Greyed: under 3 trades.',
  'rep.tags.thin': 'Dotted: under 10, too few to go by yet.',
  // count: the trades with two of the group's tags
  'rep.tags.shared': {
    one: '{count} trade has two of these tags and counts in each row.',
    other: '{count} trades have two of these tags and count in each row.',
  },

  // what each mistake cost: how much less its trades made than the clean ones, with no mistake
  // "58% clean (7 of 12)": count is the trades closed that month
  'rep.mis.clean': '{pct} clean ({clean} of {count})',
  'rep.mis.thisMonth': 'This month {share}.',
  'rep.mis.bothMonths': 'This month {share}, last month {last}.',
  'rep.mis.lastMonth': 'No trade closed this month yet; last month {last}.',
  // <num> is the share, drawn as a figure; count is the trades looked at
  'rep.mis.cleanInRange': 'Clean trades, with no mistake: <num>{pct}</num> ({clean} of {count}) in this range.',
  'rep.mis.cleanSince': 'Clean trades, with no mistake: <num>{pct}</num> ({clean} of {count}) since {date}.',
  'rep.mis.mistake': 'Mistake',
  'rep.mis.times': 'Times',
  'rep.mis.cost': 'Cost',
  // a mistake whose trades did no worse than the clean ones
  'rep.mis.noCost': 'none so far',
  // count: the trades with a mistake, never fewer than 4 here; <loss> is the total, drawn in red
  'rep.mis.gap': {
    one: 'The {count} trade with a mistake made {gap} a trade less than the clean ones: about <loss>{cost}</loss> in all.',
    other:
      'The {count} trades with a mistake made {gap} a trade less than the clean ones: about <loss>{cost}</loss> in all.',
  },
  // min: how many trades a mistake, and the clean trades, need before a cost shows
  'rep.mis.how':
    "A mistake's cost is what its trades would have made more at the average of the clean trades ({avg}), so a trade that won despite it counts too. It shows once a mistake was made {min} times and {min} trades were clean. A trade with two mistakes counts for both.",
  // the same, before there is a clean trade to take the average of
  'rep.mis.howNoClean':
    "A mistake's cost is what its trades would have made more at the average of the clean trades, so a trade that won despite it counts too. It shows once a mistake was made {min} times and {min} trades were clean. A trade with two mistakes counts for both.",
  'rep.mis.before': 'Trades from before {date}, the first day a trade has a mistake, are not counted.',
  'rep.mis.noneInRange': 'No trade in this range made a mistake.',
  'rep.mis.noneYet':
    'No mistakes logged yet. Tap the ones a trade made in its form, under Mistakes, and this works out what each one costs you.',
} satisfies Record<string, Message>;
