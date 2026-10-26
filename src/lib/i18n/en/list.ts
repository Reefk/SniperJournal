import type { Message } from '../types';

/** the list of trades (views/TradesView.tsx), what merging them says (lib/merge.ts), and what a trade still needs */
export const list = {
  'list.description': { one: '{count} trade in {account}', other: '{count} trades in {account}' },
  'list.import': 'Import',
  'list.exportCsv': 'Export CSV',
  'list.exported': { one: 'Exported {count} trade', other: 'Exported {count} trades' },
  'list.empty.title': 'No trades logged yet',
  'list.empty.description':
    "Log each trade as you close it, or import your broker's file. Every chart and statistic in Sniper Journal is built from these entries.",
  'list.empty.logFirst': 'Log your first trade',

  'list.missing': {
    one: '<num>{count}</num> trade is missing something.',
    other: '<num>{count}</num> trades are missing something.',
  },
  'list.missingHint': ' They stay out of every statistic until you fill the gaps.',
  'list.showThem': 'Show them',

  'list.search': 'Search trades',
  'list.filters': 'Filters',
  'list.allSymbols': 'All symbols',
  'list.allSessions': 'All sessions',
  'list.allLeverage': 'All leverage',
  'list.allSetups': 'All setups',
  'list.mistake': 'Mistake',
  'list.allMistakes': 'All mistakes',
  'list.madeMistake': 'Made a mistake',
  'list.noMistake': 'No mistake logged',
  // "From [date] to [date]"; the first only on a phone, where an empty date box shows nothing
  'list.from': 'From',
  'list.to': 'to',
  'list.fromDate': 'From date',
  'list.toDate': 'To date',
  'list.allSides': 'All sides',
  'list.long': 'Long',
  'list.short': 'Short',
  'list.allResults': 'All results',
  'list.wins': 'Wins',
  'list.losses': 'Losses',
  'list.open': 'Open',
  'list.needsDetails': 'Needs details',
  'list.clearFilters': { one: 'Clear {count} filter', other: 'Clear {count} filters' },
  'list.shown': { other: '<num>{count}</num> shown' },
  'list.net': 'Net',

  'list.selected': { other: '<num>{count}</num> selected' },
  'list.clear': 'Clear',
  'list.mergeIntoOne': 'Merge into one',
  'list.addDetails': 'Add details',
  'list.exclude': 'Exclude from stats',
  'list.excluded': 'Excluded from statistics',
  'list.include': 'Include',
  'list.included': 'Included in statistics',

  'list.noMatch': 'No trades match these filters.',
  'list.clearAll': 'Clear filters',
  'list.select': 'Select {symbol} trade',
  'list.selectPage': 'Select all on this page',
  'list.hasChart': 'Has a chart',
  'list.needsBadge': 'needs details',
  // only shown for more than one
  'list.fills': { other: '{count} fills' },
  'list.includeStats': 'Include in statistics',
  'list.excludeStats': 'Exclude from statistics',
  'list.excludedTitle': 'Excluded from statistics. Click to include.',
  'list.includedTitle': 'Included in statistics. Click to exclude.',
  'list.col.date': 'Date & time',
  'list.col.qty': 'Qty',
  'list.col.entry': 'Entry',
  'list.col.exit': 'Exit',
  'list.col.pnl': 'P&L',
  'list.col.action': 'Action',
  // a P&L typed in by hand, in place of an exit price
  'list.manual': 'manual',
  'list.edit': 'Edit {symbol} trade',
  'list.delete': 'Delete {symbol} trade',
  'list.showing': 'Showing <num>{from}–{to}</num> of <num>{total}</num>',
  'list.previous': 'Previous page',
  'list.next': 'Next page',
  'list.tapToEdit': 'Tap a trade to edit it.',
  'list.clickToEdit': 'Click any row to edit that trade.',
  'list.eyeHint': ' The eye icon keeps a trade in your journal but leaves it out of the statistics.',

  // what a trade still needs before it counts (lib/trade-math.ts), "needs symbol, quantity"
  'needs.list': 'needs {list}',
  'needs.symbol': 'symbol',
  'needs.entryTime': 'entry time',
  'needs.quantity': 'quantity',
  'needs.entryPrice': 'entry price',

  // one trade has its own words ("this trade"); the plural is for more than one
  'list.delete.titleOne': 'Delete this trade?',
  'list.delete.title': { other: 'Delete {count} trades?' },
  'list.delete.message':
    'Deleted trades are removed from your journal and from every statistic. This cannot be undone.',
  'list.delete.confirmOne': 'Delete trade',
  'list.delete.confirm': { other: 'Delete {count} trades' },
  'list.deletedOne': 'Trade deleted',
  'list.deleted': { other: '{count} trades deleted' },

  // each <tag></tag> is drawn by the screen: <pos> "NVDA long", <qty>, <entry> and <exit> prices, <pnl>
  'list.merge.title': { other: 'Merge {count} parts into one trade?' },
  'list.merge.body':
    'These look like one position you scaled out of. Merging gives you a single <pos></pos> of <qty></qty>, entered around <entry></entry> and exited around <exit></exit>, worth <pnl></pnl> — the same as the parts added together.',
  'list.merge.bodyOpen':
    'These look like one position you scaled out of. Merging gives you a single <pos></pos> of <qty></qty>, entered around <entry></entry>, worth <pnl></pnl> — the same as the parts added together.',
  // when exactly one other image or link goes, then when more than one
  'list.merge.chart':
    'The merged trade keeps the chart of the earliest part that has one; the other chart image is deleted.',
  'list.merge.charts': {
    other:
      'The merged trade keeps the chart of the earliest part that has one; the other {count} chart images are deleted.',
  },
  'list.merge.link':
    'It keeps the chart link of the earliest part that has one, and the other link is added to its notes.',
  'list.merge.links': {
    other:
      'It keeps the chart link of the earliest part that has one, and the other {count} links are added to its notes.',
  },
  'list.merge.undo': 'This cannot be undone, though re-importing the original CSV brings the separate parts back.',
  'list.merge.confirm': 'Merge into one trade',
  'list.merged': { other: '{count} parts merged into one trade' },

  // why trades cannot be merged (lib/merge.ts)
  'merge.atLeastTwo': 'Select at least two trades to merge.',
  'merge.sameSymbol': 'They have to be the same symbol.',
  'merge.sameSide': 'They have to be the same direction.',
  'merge.sameAccount': 'They have to be in the same account.',
  'merge.quantity': 'Every part needs a quantity before they can be merged.',
  'merge.entryPrice': 'Every part needs an entry price before they can be merged.',
  'merge.someOpen': 'Some of these are still open. Merge the closed ones, or close the rest first.',
} satisfies Record<string, Message>;
