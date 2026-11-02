import type { Message } from '../types';

/**
 * Copy for review: a trade, a day or a week as plain text, to paste into any AI
 * or send to a mentor (src/lib/review-text.ts), and the dialog that copies it.
 * The text speaks as the trader ("my rules"), since they paste it as their own.
 */
export const review = {
  // the first line; date and to: "02 Mar 2026"; from: "02 Mar"; day: a weekday (English keeps "Mon")
  'review.head.trade': 'A trade of mine to review: {symbol}, {date}.',
  'review.head.day': 'A trading day of mine to review: {day}, {date}.',
  'review.head.week': 'A trading week of mine to review: {from} – {to}.',
  'review.leftOut':
    "Amounts are left out: results are in R (a trade's result against the risk its stop set) and in % of my balance.",
  'review.leftOutNoBalance': "Amounts are left out: results are in R, a trade's result against the risk its stop set.",

  // a day's or a week's numbers
  'review.count': { one: '{count} trade: {won} won, {lost} lost.', other: '{count} trades: {won} won, {lost} lost.' },
  'review.net': 'Net: {result}.',
  'review.rTotal': {
    one: 'In R: {r} over the {count} trade with a stop.',
    other: 'In R: {r} over the {count} trades with a stop.',
  },
  // trades of the day or week that the numbers don't count: open, incomplete, or excluded
  'review.uncounted.day': {
    one: '{count} more trade below is still open or left out of my statistics, so these numbers leave it out.',
    other: '{count} more trades below are still open or left out of my statistics, so these numbers leave them out.',
  },
  'review.uncounted.week': {
    one: '{count} more trade is still open or left out of my statistics, so these numbers and the day lines leave it out.',
    other:
      '{count} more trades are still open or left out of my statistics, so these numbers and the day lines leave them out.',
  },
  // pct: "+1.11%"
  'review.pct': '{pct} of my balance',
  'review.days': 'Day by day:',
  // day: "Mon 02 Mar"; trades: "3 trades"; result: as in Net
  'review.dayLine': '{day}: {trades}, {result}',
  // a day's result with amounts left out, no balance and no stop
  'review.wonLost': '{won} won, {lost} lost',
  'review.flagged': 'In full, the trades that broke a rule or had a mistake:',
  'review.flagged.none': 'No trade broke a rule or had a mistake.',
  'review.flagged.rest': {
    one: 'The other trade is only in the day lines above.',
    other: 'The other {count} trades are only in the day lines above.',
  },

  // a trade: side is LONG or SHORT
  'review.trade': '{symbol}, {side}, {date}',
  'review.times': 'Opened {open}, closed {close}, held {hold}.',
  'review.stillOpen': 'Opened {open}, still open.',
  'review.sizePrices': 'Size {size}; entry {entry}; exit {exit}.',
  'review.prices': 'Entry {entry}; exit {exit}.',
  // a trade with no exit price yet
  'review.sizeEntry': 'Size {size}; entry {entry}.',
  'review.entry': 'Entry {entry}.',
  // the stop line; a trade with no target has only the stop
  'review.stop': 'Stop {stop}.',
  'review.stopTarget': 'Stop {stop}; target {target}.',
  'review.noStop': 'No stop set.',
  'review.result': 'Result: {result}.',
  // a trade's R and its amount, or its % of the balance
  'review.rAndAmount': '{r}, {amount}',
  'review.afterFees': '{result}, after {fees} of fees',
  // what a trade with no stop is, with amounts left out and no balance to give a % of
  'review.win': 'a win',
  'review.loss': 'a loss',
  'review.even': 'break-even',
  'review.setup': 'Setup: {name}.',
  // between a setup's rules, which may have commas of their own
  'review.ruleSep': '; ',
  'review.kept': 'Rules kept: {rules}.',
  'review.broken': 'Rules broken: {rules}.',
  'review.unticked': 'Rules not ticked: {rules}.',
  'review.noTicks': 'Its rules were not ticked.',
  'review.mistakes': 'Mistakes: {list}.',
  'review.tags': 'Tags: {list}.',
  // list: "Discipline 4, Execution 3"
  'review.ratings': 'My ratings, out of 5: {list}.',
  'review.session': 'Session: {session}.',
  'review.notes': 'Notes: {notes}',
  'review.excluded': 'I left it out of my statistics.',

  // what the trades are graded against
  'review.mine': 'My own rules, to grade against:',
  // rules: "a; b; c"
  'review.rules': '{name}: {rules}.',
  'review.noRules': '{name}: no rules written yet.',
  'review.mistakeList': 'Mistakes I watch for: {list}.',
  'review.goals': 'My goals: {list}.',
  // the instructions the text ends with, unless Settings has the trader's own
  'review.note':
    'Review these trades as my trading coach. Grade each one on its process, not its result: one line each, with the reason, against my own rules and mistakes above, not general trading advice. Then name one thing to keep doing and one thing to change.',

  // the buttons and the dialog
  'review.copy': 'Copy for review',
  'review.copyTrade': 'Copy this trade for review',
  'review.copyWeek': 'Copy this week for review',
  'review.copyWeekOf': 'Copy the week {week} for review',
  'review.copyDay': 'Copy this day for review',
  'review.dialog':
    'Paste it into any AI chat, or send it to a mentor. The app sends nothing: the text goes only where you paste it.',
  'review.leaveOut': 'Leave out money',
  'review.leaveOut.hint':
    'R and % of your balance instead of amounts, sizes and fees, so your account size stays with you. Your notes go as you wrote them.',
  'review.leaveOut.hidden': 'Amounts are hidden (the eye in the header), so they are left out here too.',
  'review.text': 'The text',
  'review.copied': 'Copied. Paste it wherever you like.',
  'review.failed':
    "This device didn't let the app copy. The text is selected: copy it with Ctrl+C, or press and hold it on a phone.",
} satisfies Record<string, Message>;
