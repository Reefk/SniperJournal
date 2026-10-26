import type { Message } from '../types';

/**
 * The platforms whose exports import as they come (lib/import/platforms.ts):
 * their groups, the kinds of export they make, and which one to choose. The
 * platforms' own names for their menus, reports and products come in as
 * placeholders, and stay as the platform writes them in every language.
 */
export const platforms = {
  'plat.group.Futures': 'Futures',
  'plat.group.TradingView': 'TradingView',
  'plat.group.Forex and CFDs': 'Forex and CFDs',
  'plat.group.Stocks and options': 'Stocks and options',
  'plat.group.Crypto': 'Crypto',
  'plat.group.Other journals': 'Other journals',

  // the kind of export a file is, as the preview names it: "Recognised: NinjaTrader 8, executions"
  'plat.file.executions': 'executions',
  'plat.file.trades': 'trades',
  'plat.file.performance report': 'performance report',
  'plat.file.orders': 'orders',
  'plat.file.completed orders': 'completed orders',
  'plat.file.trade performance': 'trade performance',
  'plat.file.trades history': 'trades history',
  'plat.file.journal': 'journal',
  'plat.file.trade activity log': 'trade activity log',
  'plat.file.trade list': 'trade list',
  'plat.file.order history': 'order history',
  'plat.file.strategy tester list of trades': 'strategy tester list of trades',
  'plat.file.account history': 'account history',
  'plat.file.trading journal': 'trading journal',
  'plat.file.positions': 'positions',
  'plat.file.deals': 'deals',
  'plat.file.history': 'history',
  'plat.file.transaction history': 'transaction history',
  'plat.file.activity statement': 'activity statement',
  'plat.file.Flex Query': '{flex}',
  'plat.file.account statement': 'account statement',
  'plat.file.transactions': 'transactions',
  'plat.file.account activity': 'account activity',
  'plat.file.spot trade history': 'spot trade history',
  'plat.file.futures trade history': 'futures trade history',
  'plat.file.Advanced fills': '{advanced} fills',
  'plat.file.trade history': 'trade history',

  // which export to choose, and where to find it
  'plat.how.ninjaTrader':
    'In {performance}, display {executions} or {trades} and generate, then right-click the list and export it as CSV. Any language.',
  'plat.how.tradovate': 'The {performance} report, or the {orders} list, downloaded as CSV.',
  'plat.how.topstepX': 'The {trades} or the {orders} of your account, exported as CSV.',
  'plat.how.rithmic':
    '{history}: choose the account and the day, then export the {completed} as CSV, one day at a time. The trade performance report works too.',
  'plat.how.quantower': 'The {panel} panel, exported as CSV.',
  'plat.how.atas': 'The journal in {statistics}, exported to Excel: the .xlsx file imports as it is.',
  'plat.how.sierraChart': 'The {log} showing {fills}, saved with {save}.',
  'plat.how.tradeStation': 'The {orders} report, exported as CSV.',
  'plat.how.deepcharts': 'The trade list, exported as CSV.',
  'plat.how.tradingView':
    '{paper} or a connected broker: in {history}, tick every column under {setup}, then {download}. Or the {tester}: {list}, then type the symbol in the preview.',
  'plat.how.ftmo': 'The trading journal of your account in the {area}, exported as CSV.',
  'plat.how.metaTrader':
    '{history} tab: right-click and save a report. {mt5}’s Excel report imports as it is; {mt4}’s web-page report opens in Excel, to be saved as CSV. A prop firm’s dashboard often exports CSV directly.',
  // a menu or a tab, and what to do there
  'plat.how.exported': '{menu}, exported as CSV.',
  'plat.how.downloaded': '{menu}, downloaded as CSV.',
  'plat.how.ibkr': 'An {statement} downloaded as CSV, or a {flex} of trades in CSV.',
  'plat.how.thinkorswim': '{menu} for the dates you want, exported to a file.',
  'plat.how.schwab': 'The transaction history of the account, exported as CSV.',
  'plat.how.fidelity': '{menu} history, downloaded as CSV.',
  'plat.how.webull': 'The order history, exported as CSV.',
  'plat.how.robinhood': '{menu}: generate an account activity report.',
  'plat.how.tradeZero': 'The trades for a date range, exported as CSV.',
  'plat.how.binance': '{menu} (spot or futures) > {export}.',
  'plat.how.coinbase': '{statements}: the transaction history as CSV; on {advanced}, the fills export.',
  'plat.how.kraken': '{menu}, choosing {trades}.',
  'plat.how.tradeZella': 'Your trades, exported as CSV.',

  // an export that holds no trades, and which one to choose instead
  'plat.instead.tradingView':
    "This is {platform}'s {account}: it lists changes to the balance, without the trades' entries. Export the {history} instead: in {paper}, open {tab}, tick every column under {setup}, then {download}.",
} satisfies Record<string, Message>;
