import type { Message } from '../types';

/**
 * What reading a broker's file says (lib/import, lib/csv.ts): things to
 * check, and how the file was read. A sentence about rows starts with "Row 4"
 * or "Row 4 and 6 more", and a text in two, ".one" and ".many", is said of
 * exactly one row or thing, then of more than one.
 */
export const importer = {
  // the words of the import window these sentences point to
  'imp.label.eachRowIs': 'Each row is',
  'imp.label.columns': 'Columns',
  // a value from the file, quoted
  'imp.quoted': '"{text}"',

  'imp.row': 'Row {row}',
  'imp.rows': { other: 'Row {row} and {count} more' },
  'imp.rowsNote': '{rows}: {text}',

  'imp.noFees':
    'There are no fees in this file, so the trades come in without them, and their P&L is before commissions. To add them, select the trades on the Trades page, then Add details > Fees, per trade or per contract.',
  'imp.zeroFees':
    'Every fee in this file is 0, so the trades come in with none. If there were commissions, add them: select the trades on the Trades page, then Add details > Fees, per trade or per contract.',

  // columns read from the words of their names (import/words.ts)
  'imp.guessed.one': '{header} was read as {role}, from the words in its name.',
  'imp.guessed.many': 'Read from the words in their names: {list}.',
  'imp.guessed.item': '{header} as {role}',
  'imp.guessed.fills.one':
    ' Because of it, each row was read as one fill; if each row is a whole trade, choose that under "{eachRowIs}".',
  'imp.guessed.fills.many':
    ' Because of them, each row was read as one fill; if each row is a whole trade, choose that under "{eachRowIs}".',
  'imp.guessed.trades.one':
    ' Because of it, each row was read as a whole trade; if each row is one fill, choose that under "{eachRowIs}".',
  'imp.guessed.trades.many':
    ' Because of them, each row was read as a whole trade; if each row is one fill, choose that under "{eachRowIs}".',
  'imp.guessed.check.one': ' Check it under {columns} if that is not right.',
  'imp.guessed.check.many': ' Check them under {columns} if that is not right.',

  'imp.noSymbol.one': 'no symbol, so the row was skipped.',
  'imp.noSymbol.many': 'no symbol, so they were skipped.',
  'imp.unknownSide.one': '{rows}: the direction "{value}" was not recognised, so it was imported as {side}. Check it.',
  'imp.unknownSide.many':
    '{rows}: the direction "{value}" was not recognised, so they were imported as {side}. Check them.',
  'imp.badMultiplier.one': '{rows}: the multiplier "{value}" has to be more than 0, so it was left out. Check it.',
  'imp.badMultiplier.many': '{rows}: the multiplier "{value}" has to be more than 0, so it was left out. Check them.',
  'imp.foreignFees': 'Fees paid in {currencies} were left out: they are not in the currency of the prices.',
  'imp.rateNoSize.one': 'a fee per contract but no size to multiply it by, so no fee was added. Add it with the size.',
  'imp.rateNoSize.many':
    'a fee per contract but no size to multiply it by, so no fees were added. Add them with the sizes.',
  'imp.netAboveGross.one':
    'the P&L after fees is more than the one before them, so no fee was worked out from the two. Check its fees.',
  'imp.netAboveGross.many':
    'the P&L after fees is more than the one before them, so no fees were worked out from the two. Check their fees.',
  'imp.inferred': '{symbol}: one point taken as worth {how}. Check it if that is not right.',
  'imp.how.future': '{value} a point ({root} futures)',
  'imp.how.option': '{value} (an option contract)',
  'imp.how.amount': '{value} (from the amount against the price)',
  'imp.andMore': { other: '{list} and {count} more' },
  'imp.pnlSetAside.one':
    "{symbols}: the P&L in the file doesn't follow from the prices at its point value, so it was worked out from the prices (a broker's P&L can be measured against an earlier entry than the file's). Check it if that is not right.",
  'imp.pnlSetAside.many':
    "{symbols}: the P&L in the file doesn't follow from the prices at their point value, so it was worked out from the prices (a broker's P&L can be measured against an earlier entry than the file's). Check it if that is not right.",
  'imp.grouped': "Each block's symbol was taken from the line above its column names.",
  // {section} is the statement's own name for it: "Cash Balance", "Account Trade History", "Trades"
  'imp.cashFees': {
    one: "The fees of {count} execution were taken from the statement's {section} section, matched by time.",
    other: "The fees of {count} executions were taken from the statement's {section} section, matched by time.",
  },
  'imp.cashUnmatched': {
    one: '{count} fee line in the statement could not be matched to an execution in its {section} (same symbol, side and size, within 2 seconds), so its fees ({amount}) were left out.',
    other:
      '{count} fee lines in the statement could not be matched to an execution in its {section} (same symbol, side and size, within 2 seconds), so their fees ({amount} in all) were left out.',
  },
  'imp.statement': 'Read the {section} section of this Interactive Brokers statement.',
  'imp.preamble': 'The column names are on line {line}; the lines above them were left out.',
  'imp.skipped': {
    one: '{count} total, summary or repeated header line was left out.',
    other: '{count} total, summary or repeated header lines were left out.',
  },
  'imp.zoned.some':
    "Some times in this file carry a time zone, so they were converted to this device's local time; the others carry none and were taken as written.",
  'imp.zoned.all': "Times in this file carry a time zone, so they were converted to this device's local time.",
  'imp.zoned.none':
    "Times in this file carry no time zone, so they were taken as written, in this device's local time.",

  // each row a whole trade (import/rows.ts)
  'imp.unreadOpen.one':
    'the entry time "{value}" could not be read, so it was left blank and the trade marked needs details.',
  'imp.unreadOpen.many':
    'the entry time could not be read (the first is "{value}"), so it was left blank and the trades marked needs details.',
  'imp.unreadClose.one':
    'the exit time "{value}" could not be read, so it was left blank: until it is filled in, the trade counts on the day it was opened.',
  'imp.unreadClose.many':
    'the exit time could not be read (the first is "{value}"), so it was left blank: until it is filled in, the trades count on the day they were opened.',
  'imp.noSizeColumn':
    'There is no size column, so every trade was marked needs details. Fill in the sizes after importing.',
  'imp.noSize.one': 'no size above 0, so the trade was marked needs details.',
  'imp.noSize.many': 'no size above 0, so the trades were marked needs details.',
  'imp.noSideColumn': 'There is no direction column, so every row was imported as {side}. Check any shorts.',
  'imp.notTrades': {
    one: '{count} row has no price and no size ({examples}), so it is not a trade and was left out.',
    other: '{count} rows have no price and no size ({examples}), so they are not trades and were left out.',
  },

  // each row one fill (import/positions.ts)
  'imp.fills.combined':
    'Each row is one fill: {fills} put back together into {trades}, following the position in each symbol.',
  'imp.fills.count': { one: '{count} fill was', other: '{count} fills were' },
  'imp.fills.into': { one: '{count} trade', other: '{count} trades' },
  'imp.unfilled': {
    one: '{count} order that was cancelled or never filled was left out.',
    other: '{count} orders that were cancelled or never filled were left out.',
  },
  'imp.notBuySell': {
    one: '{count} row is not a buy or a sell ({examples}), so it was left out.',
    other: '{count} rows are not a buy or a sell ({examples}), so they were left out.',
  },
  'imp.noQuantity.one': 'no quantity, so the fill was left out.',
  'imp.noQuantity.many': 'no quantity, so they were left out.',
  'imp.noPrice.one': 'no price, so the fill was left out.',
  'imp.noPrice.many': 'no price, so they were left out.',
  'imp.noSideFills':
    'There is no direction column and no fill has a size below zero, so every fill was read as a buy. Check any sells.',
  'imp.stillOpen': {
    one: '{count} position was still open at the end of the file, so it was imported as open trade.',
    other: '{count} positions were still open at the end of the file, so they were imported as open trades.',
  },
  'imp.orphans': {
    one: '{count} trade closes a position opened before this file starts, so the entry is unknown and it is marked needs details.',
    other:
      '{count} trades close positions opened before this file starts, so the entry is unknown and they are marked needs details.',
  },
  'imp.overlapping': {
    one: '{count} trade shares fills with trades already in your journal (a position that runs across two exports). Check for doubles.',
    other:
      '{count} trades share fills with trades already in your journal (a position that runs across two exports). Check for doubles.',
  },
  'imp.alike': {
    one: "{count} fill is the same as another of the same order (time, size and price), so it was kept as more of that order. If the file lists fills twice, check those trades' sizes.",
    other:
      "{count} fills are the same as another of the same order (time, size and price), so they were kept as more of that order. If the file lists fills twice, check those trades' sizes.",
  },

  // the file against the journal (lib/csv.ts)
  'imp.noRows': 'The file has no data rows.',
  'imp.closesOpen': {
    one: '{count} trade closes a position your journal still has as open. Both are kept: delete the open copy once you have checked.',
    other:
      '{count} trades close positions your journal still has as open. Both are kept: delete the open copies once you have checked.',
  },
  'imp.closesPart.finished': {
    one: '{count} trade closes part of a position your journal had open: that part was finished, and the rest stays open as a trade of its own.',
    other:
      '{count} trades close part of positions your journal had open: those parts were finished, and the rest of each stays open as a trade of its own.',
  },
  'imp.closesPart.kept': {
    one: '{count} trade closes part of a position your journal still has as open. Both are kept: make the open trade smaller once you have checked.',
    other:
      '{count} trades close part of positions your journal still has as open. Both are kept: make the open trades smaller once you have checked.',
  },
  'imp.noSymbolColumn':
    'No symbol column found. The columns in this file are: {columns}. Choose which column holds the symbol under "{columnsLabel}" below, or type the symbol for every row.',
  // a playbook setup a file names that the journal lacks (import/reader.ts)
  'imp.newSetup': 'Created during a CSV import.',

  // too big to import (import/size.ts)
  'imp.tooLarge.file': 'This file is {size}, more than one import takes ({limit}).',
  'imp.tooLarge.sheet': 'This sheet holds {size} of data, more than one import takes ({limit}).',
  'imp.tooLarge.workbook': 'This workbook holds more than one import takes ({limit}).',
  'imp.tooLarge.split': 'Export a shorter period from your platform, or split the file, and import each part.',

  // an Excel file that cannot be read (import/xlsx.ts)
  'imp.xlsx.noReader': 'This device cannot open Excel files. Save the sheet as CSV and import that.',
  'imp.xlsx.damaged': 'This file is damaged, or not an Excel workbook.',
  'imp.xlsx.packed': 'This workbook is packed in a way that cannot be read. Save it as CSV and import that.',
  'imp.xlsx.old': 'This is an old Excel file (.xls). Open it in Excel and save it as .xlsx or CSV.',
  'imp.xlsx.notWorkbook': 'This file is not an Excel workbook.',
  'imp.xlsx.zipNotWorkbook': 'This zip file is not an Excel workbook.',
  'imp.xlsx.noSheets': 'This workbook has no sheets.',
  'imp.xlsx.sheet': 'Sheet {n}',

  // what each column can be read as, in the import window (import/columns.ts)
  'role.symbol': 'Symbol',
  'role.side': 'Direction (buy / sell, long / short)',
  'role.quantity': 'Quantity',
  'role.price': 'Fill price',
  'role.entry_price': 'Entry price',
  'role.exit_price': 'Exit price',
  'role.time': 'Date and time',
  'role.date': 'Date',
  'role.opened_at': 'Opened: date and time',
  'role.opened_date': 'Opened: date',
  'role.closed_at': 'Closed: date and time',
  'role.closed_date': 'Closed: date',
  'role.fees': 'Fees or commission (several add up)',
  'role.fee_rate': 'Fee per contract, each side',
  'role.pnl': 'P&L before fees',
  'role.net_pnl': 'P&L after fees',
  'role.gross_pnl': 'Gross P&L',
  'role.multiplier': 'Multiplier / point value',
  'role.notional': 'Amount or proceeds (price × size)',
  'role.effect': 'Opens or closes a position',
  'role.status': 'Order status',
  'role.trade_no': 'Trade number (groups entry and exit rows)',
  'role.external_id': 'ID (to skip what was already imported)',
  'role.stop_loss': 'Stop loss',
  'role.take_profit': 'Take profit',
  'role.account': 'Account',
  'role.setup': 'Playbook setup / strategy',
  'role.tags': 'Tags',
  'role.notes': 'Notes',
  'role.session': 'Session',
  'role.leverage': 'Leverage',
  'role.asset_class': 'Asset class',
  'role.put_call': 'Call or put',
  'role.strike': 'Strike',
  'role.expiry': 'Expiry',
  'role.underlying': 'Underlying',
  'role.buy_price': 'Buy price (paired fills)',
  'role.sell_price': 'Sell price (paired fills)',
  'role.bought_at': 'Buy time (paired fills)',
  'role.sold_at': 'Sell time (paired fills)',
  'role.buy_fill_id': 'Buy fill ID (paired fills)',
  'role.sell_fill_id': 'Sell fill ID (paired fills)',
} satisfies Record<string, Message>;
