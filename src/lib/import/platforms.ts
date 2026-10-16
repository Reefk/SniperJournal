import { headerInfo } from './columns';

/**
 * The platforms whose exports import as they come (tests/platform-exports.ts
 * has one file of each), which export to choose in each, and how to tell a
 * file came from one. Recognising a file changes nothing about how it is
 * read: the import preview names the platform so you know the file is a
 * known one, and the "Which file to export" list in the import window is
 * this list.
 */

export type PlatformGroup =
  'Futures' | 'TradingView' | 'Forex and CFDs' | 'Stocks and options' | 'Crypto' | 'Other journals';

/** a file's column names as lookup keys (see headerInfo), and whether it is an IBKR statement */
interface Columns {
  has(...keys: string[]): boolean;
  statement: boolean;
}

export interface Platform {
  name: string;
  group: PlatformGroup;
  /** which export to choose, and where to find it */
  how: string;
  /** the exports it makes that the importer knows, each with a test of its columns */
  exports: Array<{ file: string; matches: (c: Columns) => boolean }>;
}

export const PLATFORMS: Platform[] = [
  // ---- futures --------------------------------------------------------------
  {
    name: 'NinjaTrader 8',
    group: 'Futures',
    how: 'In Trade Performance, display Executions or Trades and generate, then right-click the list and export it as CSV. Any language.',
    exports: [
      { file: 'executions', matches: (c) => c.has('instrument', 'action', 'ex') },
      { file: 'trades', matches: (c) => c.has('marketpos') || c.has('posmarche') },
    ],
  },
  {
    name: 'Tradovate',
    group: 'Futures',
    how: 'The Performance report, or the Orders list, downloaded as CSV.',
    exports: [
      { file: 'performance report', matches: (c) => c.has('buyfillid', 'sellfillid') },
      { file: 'orders', matches: (c) => c.has('bs', 'contract', 'product') },
    ],
  },
  {
    name: 'TopstepX',
    group: 'Futures',
    how: 'The Trades or the Orders of your account, exported as CSV.',
    exports: [
      { file: 'trades', matches: (c) => c.has('contractname', 'enteredat', 'exitedat') },
      { file: 'orders', matches: (c) => c.has('contractname', 'positiondisposition') },
    ],
  },
  {
    name: 'Rithmic R | Trader Pro',
    group: 'Futures',
    how: 'Orders History: choose the account and the day, then export the Completed Orders as CSV, one day at a time. The trade performance report works too.',
    exports: [
      { file: 'completed orders', matches: (c) => c.has('buysell', 'qtyfilled', 'avgfillprice') },
      { file: 'trade performance', matches: (c) => c.has('entrybuysell', 'fillsize') },
    ],
  },
  {
    name: 'Quantower',
    group: 'Futures',
    how: 'The Trades history panel, exported as CSV.',
    exports: [{ file: 'trades history', matches: (c) => c.has('symboltype', 'grosspl', 'netpl') }],
  },
  {
    name: 'ATAS',
    group: 'Futures',
    how: 'The journal in Statistics, exported to Excel: the .xlsx file imports as it is.',
    exports: [{ file: 'journal', matches: (c) => c.has('openvolume', 'closevolume') }],
  },
  {
    name: 'Sierra Chart',
    group: 'Futures',
    how: 'The Trade Activity Log showing Fills, saved with File > Save Log As.',
    exports: [{ file: 'trade activity log', matches: (c) => c.has('activitytype', 'fillprice') }],
  },
  {
    name: 'TradeStation',
    group: 'Futures',
    how: 'The Orders report, exported as CSV.',
    exports: [{ file: 'orders', matches: (c) => c.has('filledcanceled') || c.has('entered', 'filledprice') }],
  },
  {
    name: 'Deepcharts',
    group: 'Futures',
    how: 'The trade list, exported as CSV.',
    exports: [{ file: 'trade list', matches: (c) => c.has('entrydt', 'exitdt') }],
  },

  // ---- TradingView ----------------------------------------------------------
  {
    name: 'TradingView',
    group: 'TradingView',
    how: 'Paper Trading or a connected broker: in Order History, tick every column under Column setup, then Download data > Order history. Or the Strategy Tester: List of trades > Download, then type the symbol in the preview.',
    exports: [
      { file: 'order history', matches: (c) => c.has('placingtime', 'closingtime') },
      { file: 'strategy tester list of trades', matches: (c) => c.has('tradeno', 'signal') },
    ],
  },

  // ---- forex and CFDs -------------------------------------------------------
  {
    name: 'FTMO',
    group: 'Forex and CFDs',
    how: 'The trading journal of your account in the Client Area, exported as CSV.',
    exports: [{ file: 'trading journal', matches: (c) => c.has('ticket', 'pips') }],
  },
  {
    name: 'MetaTrader 4 and 5',
    group: 'Forex and CFDs',
    how: 'History tab: right-click and save a report. MetaTrader 5’s Excel report imports as it is; MetaTrader 4’s web-page report opens in Excel, to be saved as CSV. A prop firm’s dashboard often exports CSV directly.',
    exports: [
      { file: 'account history', matches: (c) => c.has('ticket', 'item') },
      { file: 'positions', matches: (c) => c.has('position', 'sl', 'tp', 'swap') },
      { file: 'deals', matches: (c) => c.has('deal', 'direction', 'swap') },
    ],
  },
  {
    name: 'cTrader',
    group: 'Forex and CFDs',
    how: 'History, exported as CSV.',
    exports: [{ file: 'history', matches: (c) => c.has('openingdirection', 'closingquantity') }],
  },
  {
    name: 'IG',
    group: 'Forex and CFDs',
    how: 'History > Transactions, downloaded as CSV.',
    exports: [{ file: 'transaction history', matches: (c) => c.has('marketname', 'openlevel', 'closelevel') }],
  },

  // ---- stocks and options ---------------------------------------------------
  {
    name: 'Interactive Brokers',
    group: 'Stocks and options',
    how: 'An Activity Statement downloaded as CSV, or a Flex Query of trades in CSV.',
    exports: [
      { file: 'activity statement', matches: (c) => c.statement },
      { file: 'Flex Query', matches: (c) => c.has('ibcommission') || c.has('clientaccountid', 'tradeprice') },
    ],
  },
  {
    name: 'Thinkorswim',
    group: 'Stocks and options',
    how: 'Monitor > Account Statement for the dates you want, exported to a file.',
    exports: [{ file: 'account statement', matches: (c) => c.has('exectime', 'poseffect', 'spread') }],
  },
  {
    name: 'Charles Schwab',
    group: 'Stocks and options',
    how: 'The transaction history of the account, exported as CSV.',
    exports: [{ file: 'transactions', matches: (c) => c.has('action', 'feescomm') }],
  },
  {
    name: 'Fidelity',
    group: 'Stocks and options',
    how: 'Activity & Orders history, downloaded as CSV.',
    exports: [{ file: 'account history', matches: (c) => c.has('rundate', 'action') }],
  },
  {
    name: 'E*TRADE',
    group: 'Stocks and options',
    how: 'Transactions, downloaded as CSV.',
    exports: [{ file: 'transactions', matches: (c) => c.has('transactiondate', 'transactiontype', 'securitytype') }],
  },
  {
    name: 'tastytrade',
    group: 'Stocks and options',
    how: 'History > Transactions, downloaded as CSV.',
    exports: [{ file: 'transactions', matches: (c) => c.has('subtype', 'instrumenttype', 'rootsymbol') }],
  },
  {
    name: 'Webull',
    group: 'Stocks and options',
    how: 'The order history, exported as CSV.',
    exports: [{ file: 'orders', matches: (c) => c.has('placedtime', 'filledtime') }],
  },
  {
    name: 'Robinhood',
    group: 'Stocks and options',
    how: 'Reports and statements: generate an account activity report.',
    exports: [{ file: 'account activity', matches: (c) => c.has('activitydate', 'transcode') }],
  },
  {
    name: 'TradeZero',
    group: 'Stocks and options',
    how: 'The trades for a date range, exported as CSV.',
    exports: [{ file: 'trades', matches: (c) => c.has('td', 'sd', 'exectime') }],
  },
  {
    name: 'Trading 212',
    group: 'Stocks and options',
    how: 'History, exported as CSV.',
    exports: [{ file: 'history', matches: (c) => c.has('noofshares') || c.has('priceshare') }],
  },
  {
    name: 'DEGIRO',
    group: 'Stocks and options',
    how: 'Transactions, exported as CSV.',
    exports: [{ file: 'transactions', matches: (c) => c.has('referenceexchange', 'venue') }],
  },

  // ---- crypto ---------------------------------------------------------------
  {
    name: 'Binance',
    group: 'Crypto',
    how: 'Orders > Trade History (spot or futures) > Export.',
    exports: [
      { file: 'spot trade history', matches: (c) => c.has('pair', 'side', 'executed') },
      { file: 'futures trade history', matches: (c) => c.has('realizedprofit', 'amount', 'fee') },
    ],
  },
  {
    name: 'Coinbase',
    group: 'Crypto',
    how: 'Statements: the transaction history as CSV; on Advanced, the fills export.',
    exports: [
      { file: 'transaction history', matches: (c) => c.has('quantitytransacted') },
      { file: 'Advanced fills', matches: (c) => c.has('tradeid', 'product', 'sizeunit') },
    ],
  },
  {
    name: 'Kraken',
    group: 'Crypto',
    how: 'History > Export, choosing Trades.',
    exports: [{ file: 'trades', matches: (c) => c.has('txid', 'ordertxid') }],
  },
  {
    name: 'Hyperliquid',
    group: 'Crypto',
    how: 'Trade History, exported as CSV.',
    exports: [{ file: 'trade history', matches: (c) => c.has('coin', 'dir', 'closedpnl') }],
  },

  // ---- other journals -------------------------------------------------------
  {
    name: 'TradeZella',
    group: 'Other journals',
    how: 'Your trades, exported as CSV.',
    exports: [{ file: 'trades', matches: (c) => c.has('adjustedcost', 'adjustedproceeds') }],
  },
];

/** the platform and export a file's columns say it came from, or null for one not known */
export function recognisePlatform(header: string[], statement = false): { name: string; file: string } | null {
  const keys = new Set(header.map((h) => headerInfo(h).key));
  const columns: Columns = { has: (...names) => names.every((n) => keys.has(n)), statement };
  for (const platform of PLATFORMS) {
    const found = platform.exports.find((e) => e.matches(columns));
    if (found) return { name: platform.name, file: found.file };
  }
  return null;
}
