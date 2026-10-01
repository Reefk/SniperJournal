export type Side = 'LONG' | 'SHORT';
export type ThemeMode = 'dark' | 'light';

export interface Account {
  id: string;
  name: string;
  startingBalance: number;
  createdAt: string;
}

/** 1-5 self ratings captured when the trade is logged */
export interface SelfReview {
  discipline?: number;
  execution?: number;
  patience?: number;
}

export interface Trade {
  id: string;
  accountId: string;
  symbol: string;
  side: Side;
  /** local wall-clock, 'YYYY-MM-DDTHH:mm' */
  openedAt: string;
  closedAt?: string;
  quantity: number;
  entryPrice: number;
  exitPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  fees: number;
  /** contract size: 1 for shares, 50 for ES, 100000 for a standard forex lot */
  multiplier?: number;
  /** overrides the price-derived gross P&L when set */
  manualPnl?: number | null;
  leverage?: number | null;
  session?: string;
  setupId?: string;
  tags: string[];
  notes?: string;
  /** a link to a chart, e.g. a TradingView snapshot */
  screenshotUrl?: string;
  /** an image saved in data/screenshots, by file name */
  screenshotFile?: string;
  review?: SelfReview;
  /** kept in the journal but left out of every statistic */
  excluded?: boolean;
  /** imported without everything the statistics need; waiting for you to fill the gaps */
  needsReview?: boolean;
  /** the broker's own id for this fill pair, used to avoid importing it twice.
   *  A merged trade keeps every part's id, separated by | */
  externalId?: string;
  /** how many partial fills were combined into this trade, when more than one */
  fillCount?: number;
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TradeInput = Omit<Trade, 'id' | 'createdAt' | 'updatedAt'>;

export interface Setup {
  id: string;
  name: string;
  description?: string;
  rules: string[];
  color?: string;
  isSample?: boolean;
}

export interface Resource {
  id: string;
  title: string;
  url?: string;
  category: string;
  notes?: string;
  createdAt: string;
}

export interface Settings {
  currency: string;
  theme: ThemeMode;
  /** 'local' or an IANA zone, used for the header clock only */
  timezone: string;
  maxDailyLoss?: number | null;
  maxTradesPerDay?: number | null;
}

export interface Profile {
  name: string;
}

export interface JournalData {
  version: 1;
  updatedAt: string;
  onboarded: boolean;
  profile: Profile;
  settings: Settings;
  accounts: Account[];
  /** an account id, or 'all' */
  activeAccountId: string;
  trades: Trade[];
  setups: Setup[];
  resources: Resource[];
}
