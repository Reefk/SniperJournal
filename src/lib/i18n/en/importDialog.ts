import type { Message } from '../types';

/** the import window (components/trades/ImportTradesModal.tsx): what it shows of a file before importing it */
export const importDialog = {
  'impw.title': 'Import trades from a file',
  'impw.description':
    'Drop in an export from your broker or trading platform: whole trades or individual fills. Anything missing can be filled in afterwards.',
  'impw.account': 'Import into account',
  'impw.account.hint': 'a matching account column overrides this',
  'impw.template': 'Download template',
  'impw.drop.tap': 'Tap to choose a CSV or Excel file',
  'impw.drop.click': 'Drop a CSV or Excel file here, or click to choose one',
  'impw.drop.works': {
    other:
      "Works with the exports of the {count} platforms listed below, most other brokers' files, whole trades or individual fills, and the template above.",
  },
  'impw.sheet': 'Sheet',
  'impw.sheet.hint': { other: '{count} in this workbook' },
  'impw.sheet.empty': 'This sheet is empty.',
  'impw.unreadable': 'This workbook could not be read. Open it in Excel, save the sheet as CSV, and import that.',

  // what the file holds; <num> is drawn as a number
  'impw.recognised': 'Recognised: {name}, {file}',
  'impw.ready': { other: '<num>{count}</num> ready to import' },
  'impw.finished': {
    one: '<num>{count}</num> open trade finished',
    other: '<num>{count}</num> open trades finished',
  },
  'impw.duplicates': { other: '<num>{count}</num> already in your journal, skipped' },
  'impw.incomplete': { other: '<num>{count}</num> need details before they count' },
  'impw.combined': { other: '<num>{count}</num> partial fills folded into whole positions' },
  'impw.newSetups': {
    one: '{count} new playbook setup will be created',
    other: '{count} new playbook setups will be created',
  },
  // the end of a list of four: "…and 3 more"
  'impw.more': { other: '…and {count} more' },

  // trades that look like ones already in the journal
  'impw.likely': {
    one: '<num>{count}</num> looks like a trade already in your journal: same account, symbol, side, entry time and size.',
    other:
      '<num>{count}</num> look like trades already in your journal: same account, symbol, side, entry time and size.',
  },
  'impw.likely.imported.one': 'It will be imported as well.',
  'impw.likely.imported.many': 'They will be imported as well.',
  'impw.likely.leftOut.one': 'Left out, so nothing is added twice.',
  'impw.likely.leftOut.many': 'Left out, so nothing is added twice.',
  'impw.likely.anyway.one': 'Import it anyway: it is a different trade',
  'impw.likely.anyway.many': 'Import them anyway: they are different trades',

  // open trades in the journal that the file closes
  'impw.closes.one': 'This file closes a trade your journal has open.',
  'impw.closes': { other: 'This file closes <num>{count}</num> trades your journal has open.' },
  'impw.closes.finish.one': "It is finished with the file's exit: your notes, setup and tags stay.",
  'impw.closes.finish.many': "They are finished with the file's exit: your notes, setup and tags stay.",
  'impw.closes.stay.one': "It stays open, and the file's closing fills come in as trades of their own.",
  'impw.closes.stay.many': "They stay open, and the file's closing fills come in as trades of their own.",
  // "ES long · opened Mar 4 09:30 · 1 of 2 · closed Mar 4 10:15 at 5,000.25 · +$50.00, the rest stays open"
  'impw.closes.opened': 'opened {when}',
  'impw.closes.part': '{part} of {whole}',
  'impw.closes.closed': 'closed {when}',
  'impw.closes.at': 'at {price}',
  'impw.closes.rest': ', the rest stays open',
  'impw.closes.leave.one': 'Leave it open, and import the closing fills as trades of their own',
  'impw.closes.leave.many': 'Leave them open, and import the closing fills as trades of their own',

  // the fee box
  'impw.fee.none':
    'There are no fees in this file, so the trades come in without them and their P&L is before commissions. If your broker charges a fee, add it here.',
  'impw.fee.zero':
    'Every fee in this file is 0, so the trades come in without them and their P&L is before commissions. If your broker charges a fee, add it here.',
  'impw.fee.fromFile':
    'The fees come from this file. If they are wrong, or you pay something else, charge your own instead, for this import.',
  'impw.fee.toAdd': 'Fee to add',
  'impw.fee.fees': 'Fees',
  'impw.fee.opt.none': 'None',
  'impw.fee.opt.fromFile': 'From the file',
  'impw.fee.opt.trade': 'Per trade',
  'impw.fee.opt.ownTrade': 'Your own, per trade',
  'impw.fee.opt.contract': 'Per contract, each side',
  'impw.fee.opt.ownContract': 'Your own, per contract, each side',
  'impw.fee.amount': 'Amount',
  'impw.fee.hint.contract': 'charged in, and again out',
  'impw.fee.hint.trade': 'once for every trade',
  'impw.fee.aboveZero': 'Enter an amount above 0',
  // the total of the fees, and the net P&L, are drawn where the empty tags are
  'impw.fee.totals': 'Fees on these trades <money></money> · net P&L after them <pnl></pnl>',
  'impw.fee.whole': '. Open trades this file finishes are charged for the whole trade.',

  // how the file is read
  'impw.rowKind.trades': 'A whole trade',
  'impw.rowKind.fills': 'One fill (put together into trades)',
  'impw.dates': 'Dates like 03/04/2026 are',
  'impw.dates.mdy': 'Month first: March 4',
  'impw.dates.dmy': 'Day first: 3 April',
  'impw.symbolForAll': 'Symbol for every row',
  'impw.symbolForAll.hint': 'this file has none',
  'impw.columns.used': '{columns}: {used} of {total} used',
  'impw.columns.guessed': { one: ', {count} guessed from its name', other: ', {count} guessed from their names' },
  'impw.columns.restored': ', as you set them for this layout last time',
  'impw.columns.explain':
    'Change what a column is read as if the importer got it wrong. Your choices are remembered on this device for files with the same columns.',
  // a column with no name in the file
  'impw.columns.unnamed': 'Column {n}',
  'impw.columns.unnamedLower': 'column {n}',
  // what a column's menu is called, for a screen reader: What "Qty" is
  'impw.columns.what': 'What {name} is',
  'impw.columns.guessedOne': 'guessed from its name',
  'impw.columns.notUsed': 'Not used',
  'impw.columns.automatic': 'Back to automatic',
  'impw.combine': 'Combine partial exits into one trade',
  'impw.combine.explain':
    'When you scale out, the broker writes one row per exit. With this on, rows that share an entry fill become a single position: the sizes add up, the prices become size-weighted averages, and the P&L stays exactly the sum of the parts.',
  'impw.paired':
    'This export pairs a buy fill with a sell fill instead of naming a direction, so the fill that happened first is treated as the entry. Where the file reports a P&L, the contract multiplier is worked out from it, which is how a 2-lot MNQ trade comes out at $2 a point. Check a row or two below before importing.',

  // the preview table
  'impw.col.date': 'Date',
  'impw.noDate': 'no date',
  'impw.moreRows': { other: '…and {count} more rows.' },
  // the names of the columns are drawn where <num></num> is
  'impw.ignored': 'Columns not used: <num></num>. Nothing was lost — those simply have no place in the journal.',
  'impw.moreErrors': { other: '…and {count} more.' },

  // the two help sections at the bottom
  'impw.help.platforms': 'Which file to export from your platform',
  'impw.help.platformsIntro':
    "These platforms' exports import as they come, and the preview names the platform when it recognises the file. Any other CSV with a symbol column works too: check the columns in the preview.",
  'impw.help.columns': 'Which columns are understood',
  'impw.help.files':
    'CSV files and Excel workbooks (.xlsx) are both read. In a workbook, the sheet that looks most like a list of trades is used, and you can choose another. An old .xls file needs saving as .xlsx or CSV first.',
  'impw.help.symbol':
    "Only a <fg>symbol</fg> is required, and for a file without one (TradingView's list of trades) you can type it in. Everything else is optional.",
  'impw.help.rows':
    'A file can list <fg>whole trades</fg>, with the entry and the exit on one row, or <fg>individual fills</fg>, one buy or sell per row. Fills are put back together by following the position in each symbol: scaling in and out stays one trade, and a position still open at the end of the file is imported as open.',
  // <names></names> is a list of column names as brokers write them; <start></start> and <lots></lots> are two more
  'impw.help.names':
    "Column names are recognised in the many forms brokers use — <names></names>, separate date and time columns — and several fee columns add up; a commission per contract is multiplied by the size. A file with no fees at all comes in with none, unless you add a fee per trade or per contract in the preview; it is remembered for the account on this device. A file with fees keeps its own, unless you charge yours in their place, for that file only. A name it doesn't know as a whole is read by its words when it knows every one of them, so <start></start> is the entry price and <lots></lots> the quantity; the preview says which columns it read that way. Title lines above the table and total lines below it are skipped. Anything read wrongly can be changed under {columns}. Separate several tags with a | character.",
  'impw.help.points':
    "What one point is worth comes from a multiplier column, the amount against the price, or the file's P&L. Failing those, futures are recognised from a full contract code such as {first} or {second}, and options count 100 shares. The preview says whenever it worked one out this way.",
  'impw.help.needs':
    'Rows that are missing a date, quantity or entry price still import. They are marked <warn>needs details</warn>, kept out of every statistic, and listed at the top of the Trades page so you can complete them by hand.',
  'impw.help.again':
    'Importing the same trades again adds nothing, so a daily export that overlaps the last one is safe. Where the broker numbers its trades or fills, those numbers decide. Otherwise a trade with the same account, symbol, side, entry time and size as one already in your journal is left out, and the preview lists it in case it really is a second trade.',
  'impw.help.finish':
    'A position that an earlier export left open is finished by the export that closes it: the trade in your journal gets the exit, and your notes, setup and tags stay. The preview lists those trades, with a way to leave them open.',

  // the Import button, and what it says when done
  'impw.button.import': 'Import trades',
  'impw.button.importN': { one: 'Import {count} trade', other: 'Import {count} trades' },
  'impw.button.importAndFinish': {
    one: 'Import {count} trade and finish {open}',
    other: 'Import {count} trades and finish {open}',
  },
  // what goes in {open} above
  'impw.button.open': { one: '{count} open trade', other: '{count} open trades' },
  'impw.button.finish': { one: 'Finish {count} open trade', other: 'Finish {count} open trades' },
  'impw.done.imported': { one: 'Imported {count} trade', other: 'Imported {count} trades' },
  'impw.done.importedAndFinished': {
    one: 'Imported {count} trade, finished {open}',
    other: 'Imported {count} trades, finished {open}',
  },
  // what goes in {open} above
  'impw.done.open': { one: '{count} open trade', other: '{count} open trades' },
  'impw.done.finished': { one: 'Finished {count} open trade', other: 'Finished {count} open trades' },
  'impw.done.needDetails': { other: '{done} — {count} need details' },
} satisfies Record<string, Message>;
