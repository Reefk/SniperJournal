import { tr, type MessageKey } from '../i18n';
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

/** a group's name, in the language on screen */
export const groupName = (group: PlatformGroup) => tr(`plat.group.${group}`);

/** the kinds of export the importer knows: "executions", "account history" */
type After<T> = T extends `plat.file.${infer K}` ? K : never;
export type FileKind = After<MessageKey>;
/** what the preview calls an export, in the language on screen; two of them are products, named as they are */
export const fileName = (file: FileKind) => tr(`plat.file.${file}`, { flex: 'Flex Query', advanced: 'Advanced' });

/**
 * a text about a platform, and the platform's own names for the menus,
 * reports and products it mentions, which stay as the platform writes them
 */
export interface PlatformText {
  text: MessageKey;
  names?: Record<string, string>;
}
/** the text, in the language on screen */
export const say = ({ text, names }: PlatformText) => tr(text, names);

/** a file's column names as lookup keys (see headerInfo), and whether it is an IBKR statement */
interface Columns {
  has(...keys: string[]): boolean;
  statement: boolean;
}

export interface Platform {
  name: string;
  group: PlatformGroup;
  /** which export to choose, and where to find it */
  how: PlatformText;
  /**
   * the exports it makes that the importer knows, each with a test of its
   * columns; `instead` marks one that holds no trades, and says which to export
   */
  exports: Array<{ file: FileKind; matches: (c: Columns) => boolean; instead?: PlatformText }>;
}

export const PLATFORMS: Platform[] = [
  // ---- futures --------------------------------------------------------------
  {
    name: 'NinjaTrader 8',
    group: 'Futures',
    how: {
      text: 'plat.how.ninjaTrader',
      names: { performance: 'Trade Performance', executions: 'Executions', trades: 'Trades' },
    },
    exports: [
      { file: 'executions', matches: (c) => c.has('instrument', 'action', 'ex') },
      { file: 'trades', matches: (c) => c.has('marketpos') || c.has('posmarche') },
    ],
  },
  {
    name: 'Tradovate',
    group: 'Futures',
    how: { text: 'plat.how.tradovate', names: { performance: 'Performance', orders: 'Orders' } },
    exports: [
      { file: 'performance report', matches: (c) => c.has('buyfillid', 'sellfillid') },
      { file: 'orders', matches: (c) => c.has('bs', 'contract', 'product') },
    ],
  },
  {
    name: 'TopstepX',
    group: 'Futures',
    how: { text: 'plat.how.topstepX', names: { trades: 'Trades', orders: 'Orders' } },
    exports: [
      { file: 'trades', matches: (c) => c.has('contractname', 'enteredat', 'exitedat') },
      { file: 'orders', matches: (c) => c.has('contractname', 'positiondisposition') },
    ],
  },
  {
    name: 'Rithmic R | Trader Pro',
    group: 'Futures',
    how: { text: 'plat.how.rithmic', names: { history: 'Orders History', completed: 'Completed Orders' } },
    exports: [
      { file: 'completed orders', matches: (c) => c.has('buysell', 'qtyfilled', 'avgfillprice') },
      { file: 'trade performance', matches: (c) => c.has('entrybuysell', 'fillsize') },
    ],
  },
  {
    name: 'Quantower',
    group: 'Futures',
    how: { text: 'plat.how.quantower', names: { panel: 'Trades history' } },
    exports: [{ file: 'trades history', matches: (c) => c.has('symboltype', 'grosspl', 'netpl') }],
  },
  {
    name: 'ATAS',
    group: 'Futures',
    how: { text: 'plat.how.atas', names: { statistics: 'Statistics' } },
    exports: [{ file: 'journal', matches: (c) => c.has('openvolume', 'closevolume') }],
  },
  {
    name: 'Sierra Chart',
    group: 'Futures',
    how: {
      text: 'plat.how.sierraChart',
      names: { log: 'Trade Activity Log', fills: 'Fills', save: 'File > Save Log As' },
    },
    exports: [{ file: 'trade activity log', matches: (c) => c.has('activitytype', 'fillprice') }],
  },
  {
    name: 'TradeStation',
    group: 'Futures',
    how: { text: 'plat.how.tradeStation', names: { orders: 'Orders' } },
    exports: [{ file: 'orders', matches: (c) => c.has('filledcanceled') || c.has('entered', 'filledprice') }],
  },
  {
    name: 'Deepcharts',
    group: 'Futures',
    how: { text: 'plat.how.deepcharts' },
    exports: [{ file: 'trade list', matches: (c) => c.has('entrydt', 'exitdt') }],
  },

  // ---- TradingView ----------------------------------------------------------
  {
    name: 'TradingView',
    group: 'TradingView',
    how: {
      text: 'plat.how.tradingView',
      names: {
        paper: 'Paper Trading',
        history: 'Order History',
        setup: 'Column setup',
        download: 'Download data > Order history',
        tester: 'Strategy Tester',
        list: 'List of trades > Download',
      },
    },
    exports: [
      { file: 'order history', matches: (c) => c.has('placingtime', 'closingtime') },
      { file: 'strategy tester list of trades', matches: (c) => c.has('tradeno', 'signal') },
      {
        file: 'account history',
        matches: (c) => c.has('balancebefore', 'balanceafter'),
        instead: {
          text: 'plat.instead.tradingView',
          names: {
            platform: 'TradingView',
            account: 'Account History',
            history: 'Order History',
            paper: 'Paper Trading',
            tab: 'History',
            setup: 'Column setup',
            download: 'Download data > Order history',
          },
        },
      },
    ],
  },

  // ---- forex and CFDs -------------------------------------------------------
  {
    name: 'FTMO',
    group: 'Forex and CFDs',
    how: { text: 'plat.how.ftmo', names: { area: 'Client Area' } },
    exports: [{ file: 'trading journal', matches: (c) => c.has('ticket', 'pips') }],
  },
  {
    name: 'MetaTrader 4 and 5',
    group: 'Forex and CFDs',
    how: {
      text: 'plat.how.metaTrader',
      names: { history: 'History', mt5: 'MetaTrader 5', mt4: 'MetaTrader 4' },
    },
    exports: [
      { file: 'account history', matches: (c) => c.has('ticket', 'item') },
      { file: 'positions', matches: (c) => c.has('position', 'sl', 'tp', 'swap') },
      { file: 'deals', matches: (c) => c.has('deal', 'direction', 'swap') },
    ],
  },
  {
    name: 'cTrader',
    group: 'Forex and CFDs',
    how: { text: 'plat.how.exported', names: { menu: 'History' } },
    exports: [{ file: 'history', matches: (c) => c.has('openingdirection', 'closingquantity') }],
  },
  {
    name: 'IG',
    group: 'Forex and CFDs',
    how: { text: 'plat.how.downloaded', names: { menu: 'History > Transactions' } },
    exports: [{ file: 'transaction history', matches: (c) => c.has('marketname', 'openlevel', 'closelevel') }],
  },

  // ---- stocks and options ---------------------------------------------------
  {
    name: 'Interactive Brokers',
    group: 'Stocks and options',
    how: { text: 'plat.how.ibkr', names: { statement: 'Activity Statement', flex: 'Flex Query' } },
    exports: [
      { file: 'activity statement', matches: (c) => c.statement },
      {
        file: 'Flex Query',
        // an Activity Flex query names IBCommission and TradePrice; a Trade Confirmation one, Commission and Price
        matches: (c) =>
          c.has('ibcommission') ||
          c.has('clientaccountid', 'tradeprice') ||
          c.has('clientaccountid', 'currencyprimary'),
      },
    ],
  },
  {
    name: 'Thinkorswim',
    group: 'Stocks and options',
    how: { text: 'plat.how.thinkorswim', names: { menu: 'Monitor > Account Statement' } },
    exports: [{ file: 'account statement', matches: (c) => c.has('exectime', 'poseffect', 'spread') }],
  },
  {
    name: 'Charles Schwab',
    group: 'Stocks and options',
    how: { text: 'plat.how.schwab' },
    exports: [{ file: 'transactions', matches: (c) => c.has('action', 'feescomm') }],
  },
  {
    name: 'Fidelity',
    group: 'Stocks and options',
    how: { text: 'plat.how.fidelity', names: { menu: 'Activity & Orders' } },
    exports: [{ file: 'account history', matches: (c) => c.has('rundate', 'action') }],
  },
  {
    name: 'E*TRADE',
    group: 'Stocks and options',
    how: { text: 'plat.how.downloaded', names: { menu: 'Transactions' } },
    exports: [{ file: 'transactions', matches: (c) => c.has('transactiondate', 'transactiontype', 'securitytype') }],
  },
  {
    name: 'tastytrade',
    group: 'Stocks and options',
    how: { text: 'plat.how.downloaded', names: { menu: 'History > Transactions' } },
    exports: [{ file: 'transactions', matches: (c) => c.has('subtype', 'instrumenttype', 'rootsymbol') }],
  },
  {
    name: 'Webull',
    group: 'Stocks and options',
    how: { text: 'plat.how.webull' },
    exports: [{ file: 'orders', matches: (c) => c.has('placedtime', 'filledtime') }],
  },
  {
    name: 'Robinhood',
    group: 'Stocks and options',
    how: { text: 'plat.how.robinhood', names: { menu: 'Reports and statements' } },
    exports: [{ file: 'account activity', matches: (c) => c.has('activitydate', 'transcode') }],
  },
  {
    name: 'TradeZero',
    group: 'Stocks and options',
    how: { text: 'plat.how.tradeZero' },
    exports: [{ file: 'trades', matches: (c) => c.has('td', 'sd', 'exectime') }],
  },
  {
    name: 'Trading 212',
    group: 'Stocks and options',
    how: { text: 'plat.how.exported', names: { menu: 'History' } },
    exports: [{ file: 'history', matches: (c) => c.has('noofshares') || c.has('priceshare') }],
  },
  {
    name: 'DEGIRO',
    group: 'Stocks and options',
    how: { text: 'plat.how.exported', names: { menu: 'Transactions' } },
    exports: [{ file: 'transactions', matches: (c) => c.has('referenceexchange', 'venue') }],
  },

  // ---- crypto ---------------------------------------------------------------
  {
    name: 'Binance',
    group: 'Crypto',
    how: { text: 'plat.how.binance', names: { menu: 'Orders > Trade History', export: 'Export' } },
    exports: [
      { file: 'spot trade history', matches: (c) => c.has('pair', 'side', 'executed') },
      { file: 'futures trade history', matches: (c) => c.has('realizedprofit', 'amount', 'fee') },
    ],
  },
  {
    name: 'Coinbase',
    group: 'Crypto',
    how: { text: 'plat.how.coinbase', names: { statements: 'Statements', advanced: 'Advanced' } },
    exports: [
      { file: 'transaction history', matches: (c) => c.has('quantitytransacted') },
      { file: 'Advanced fills', matches: (c) => c.has('tradeid', 'product', 'sizeunit') },
    ],
  },
  {
    name: 'Kraken',
    group: 'Crypto',
    how: { text: 'plat.how.kraken', names: { menu: 'History > Export', trades: 'Trades' } },
    exports: [{ file: 'trades', matches: (c) => c.has('txid', 'ordertxid') }],
  },
  {
    name: 'Hyperliquid',
    group: 'Crypto',
    how: { text: 'plat.how.exported', names: { menu: 'Trade History' } },
    exports: [{ file: 'trade history', matches: (c) => c.has('coin', 'dir', 'closedpnl') }],
  },

  // ---- other journals -------------------------------------------------------
  {
    name: 'TradeZella',
    group: 'Other journals',
    how: { text: 'plat.how.tradeZella' },
    exports: [{ file: 'trades', matches: (c) => c.has('adjustedcost', 'adjustedproceeds') }],
  },
];

/** the platform and export a file's columns say it came from, or null for one not known */
export function recognisePlatform(
  header: string[],
  statement = false,
): { name: string; file: string; instead?: string } | null {
  const keys = new Set(header.map((h) => headerInfo(h).key));
  const columns: Columns = { has: (...names) => names.every((n) => keys.has(n)), statement };
  for (const platform of PLATFORMS) {
    const found = platform.exports.find((e) => e.matches(columns));
    if (found)
      return {
        name: platform.name,
        file: fileName(found.file),
        ...(found.instead ? { instead: say(found.instead) } : {}),
      };
  }
  return null;
}
