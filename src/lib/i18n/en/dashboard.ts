import type { Message } from '../types';

/** the Dashboard, its charts, the Sniper Score (lib/stats.ts) and the charts in words (lib/chart-summary.ts) */
export const dashboard = {
  'range.7D': '7D',
  'range.30D': '30D',
  'range.90D': '90D',
  'range.YTD': 'YTD',
  'range.ALL': 'All',
  'range.none.7D': 'No closed trades in the last 7 days',
  'range.none.30D': 'No closed trades in the last 30 days',
  'range.none.90D': 'No closed trades in the last 90 days',
  'range.none.YTD': 'No closed trades this year',
  'range.none.ALL': 'No closed trades yet',
  // the period the goals' arrows compare with: as long as the range, just before it
  'range.before.7D': 'the 7 days before',
  'range.before.30D': 'the 30 days before',
  'range.before.90D': 'the 90 days before',
  'range.before.YTD': 'as many days before',

  // a figure's name, wherever it shows
  'stat.netProfit': 'Net profit',
  'stat.profitFactor': 'Profit factor',
  'stat.avgRR': 'Avg R:R',
  'stat.expectancy': 'Expectancy',
  'stat.sqn': 'System quality',
  'stat.commissions': 'Commissions',
  'stat.totalTrades': 'Total trades',
  'stat.maxStreak': 'Max streak',
  'stat.bestDay': 'Best day',
  'stat.worstDay': 'Worst day',
  'stat.avgWinLoss': 'Avg win / loss',
  'stat.largestWin': 'Largest win',
  'stat.largestLoss': 'Largest loss',
  'stat.maxDrawdown': 'Max drawdown',
  'stat.averageDay': 'Average day',
  'stat.wins': '{n}W',
  'stat.losses': '{n}L',
  'stat.breakeven': '{n}BE',
  'stat.tradingDays': { one: '{count} trading day', other: '{count} trading days' },

  'dash.empty.title': 'Your dashboard builds itself from your trades',
  'dash.empty.body':
    'Nothing here is pre-filled. Log your first trade and the equity curve, win rate, profit factor and Sniper Score all start calculating from your own numbers.',
  'dash.empty.first': 'Log your first trade',
  'dash.empty.import': 'Import a CSV',
  'dash.empty.sample': 'Load test data to explore',
  'dash.closedInRange': {
    one: '<num>{count}</num> closed trade in range',
    other: '<num>{count}</num> closed trades in range',
  },
  'dash.open': { one: '{count} open', other: '{count} open' },
  'dash.noClosedHint':
    'Your statistics are calculated from closed trades only. Widen the range, or close out a position to see it counted.',
  'dash.showAllTime': 'Show all time',

  'dash.balance': 'Balance {money}',
  'dash.netInfo': 'Total profit after fees and commissions, across every closed trade in the selected range.',
  'dash.winRateInfo': 'The share of closed trades that finished above break-even after fees.',
  'dash.wonLost': '{won} won vs {lost} lost',
  'dash.pfInfo':
    'Gross profit divided by gross loss. Above 1 means you make more than you give back; 2 or more is strong.',
  'dash.rrSub': 'Your average winner against your average loser',
  'dash.avgResult': '{r} average result',
  'dash.rrInfo':
    'Your average winner measured against your average loser. The sub-line shows the average result in units of the risk your stop loss defined.',
  'dash.perTrade': 'per trade',
  'dash.expectancyInfo': 'What you earn on an average trade. Positive expectancy is the whole game.',
  'dash.sqnInfo': "Van Tharp's SQN: how strong your edge is relative to how erratic your results are.",
  'dash.feesShare': '{pct} of gross profit',
  'dash.paidInFees': 'paid in fees',
  'dash.feesInfo': 'Everything you paid your broker across these trades.',
  'dash.noStreak': 'no active streak',
  'dash.currently': 'currently {streak}',
  'dash.streakInfo': 'The longest run of consecutive wins and consecutive losses.',
  'dash.held': 'held {duration} on average',
  'dash.avgWinLossInfo': 'The size of your average winner against your average loser.',

  'dash.equity': 'Equity curve',
  'dash.drawdown': 'Max drawdown {money}',
  'dash.drawdownPct': 'Max drawdown {money} ({pct})',
  'dash.equityHint': 'Account balance after every closed trade',
  'dash.currentBalance': 'current balance',
  'dash.currentBalanceExcluded': 'current balance, incl. excluded trades',
  'dash.start': 'Start',
  'dash.onThisTrade': '{money} on this trade',
  'dash.dayTrades': { one: '{count} trade · {wl}', other: '{count} trades · {wl}' },

  'dash.score': 'Sniper Score',
  'dash.scoreHint': 'Rate your trades to build this',
  'dash.scoreOverall': '{score} / 100 overall',
  'dash.notRated': 'Not yet rated: {axes}. Add stops and self-ratings when you log a trade.',

  'dash.daily': 'Daily P&L',
  'dash.dailyHint': {
    one: '{count} green day, {red} red · {pct} green',
    other: '{count} green days, {red} red · {pct} green',
  },
  'dash.dailyEmpty': 'No closed trades in this range yet.',

  'dash.avgWinner': 'Avg winner {money}',
  'dash.avgLoser': 'Avg loser {money}',
  'dash.fromPeak': '{pct} from peak',
  'dash.setBalance': 'Set a starting balance for %',
  'dash.drawdownInfo': 'The deepest fall from a peak in your equity curve.',
  'dash.across': { one: 'Across {count} trading day', other: 'Across {count} trading days' },

  'dash.recent': 'Recent trades',
  'dash.recentHint': 'Your last five, newest first',
  'dash.viewAll': 'View all',

  'dash.openPositions': {
    one: 'You have {count} open position.',
    other: 'You have {count} open positions.',
  },
  'dash.openExcluded': {
    one: ' It is excluded from statistics until you add an exit price.',
    other: ' They are excluded from statistics until you add an exit price.',
  },
  'dash.openTable': 'Open the trades table',
  'dash.footer':
    'Every figure above is calculated from the trades you entered. Nothing is estimated or filled in for you.',

  // the Sniper Score's axes (lib/stats.ts)
  'score.winRate': 'Win rate',
  'score.profitFactor': 'Profit factor',
  'score.riskReward': 'Risk:reward',
  'score.consistency': 'Consistency',
  'score.discipline': 'Discipline',
  'score.execution': 'Execution',
  'score.patience': 'Patience',
  'score.winRate.detail': '{pct} of trades closed green',
  'score.profitFactor.detail': '{pf} earned per unit lost',
  'score.riskReward.detail': '{r} average result',
  'score.consistency.detail': {
    one: '{green} green of {count} trading day',
    other: '{green} green of {count} trading days',
  },
  'score.rating.detail': { one: '{avg} of 5 across {count} trade', other: '{avg} of 5 across {count} trades' },
  'score.needsTrades': 'Needs at least 5 closed trades',
  'score.needsStops': 'Log a stop loss on at least 5 trades',
  'score.needsDays': 'Needs trades on at least 5 days',
  'score.needsRatings': 'Rate at least 3 trades when you log them',
  'sqn.none': 'Not enough data',
  'sqn.below': 'Below average',
  'sqn.average': 'Average',
  'sqn.good': 'Good',
  'sqn.excellent': 'Excellent',
  'sqn.superb': 'Superb',
  'sqn.exceptional': 'Exceptional',

  // the charts in words, for a screen reader (lib/chart-summary.ts)
  'summary.equityEmpty': 'Account balance: no closed trades in this range yet, so it stays at {money}.',
  'summary.equity': {
    one: 'Account balance after each of {count} closed trade, {from} to {to}: from {start} to {end}, lowest {low}, highest {high}.',
    other:
      'Account balance after each of {count} closed trades, {from} to {to}: from {start} to {end}, lowest {low}, highest {high}.',
  },
  'summary.dailyEmpty': 'Daily P&L: no closed trades in this range yet.',
  'summary.daily': {
    one: 'Net P&L of each of {count} trading day, {from} to {to}: worst {worst}, best {best}, last day {last}.',
    other: 'Net P&L of each of {count} trading days, {from} to {to}: worst {worst}, best {best}, last day {last}.',
  },
  'summary.score': 'Sniper Score out of 100 on each axis: {axes}.',
  'summary.scoreAxis': '{axis} {score}',
  'summary.scoreNone': 'Sniper Score: no axis rated yet.',
  'summary.unrated': 'Not yet rated: {axes}.',
  'summary.overall': 'Overall {score} out of 100.',
} satisfies Record<string, Message>;
