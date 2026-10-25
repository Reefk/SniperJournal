import type { JOURNAL_VERSION } from './journal-version';

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

/** true: the rule was kept; false: broken; null: not checked */
export type RuleTick = boolean | null;

/** a trade's ticks against its setup's rules, by the rule's wording (see lib/rules.ts) */
export type RuleChecks = Record<string, RuleTick>;

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
  /** which of the setup's rules this trade kept and broke */
  ruleChecks?: RuleChecks;
  /** the setup the ticks were made against (see checksSetupId in lib/rules.ts) */
  ruleChecksSetupId?: string;
  /** the mistakes this trade made, by name (see lib/mistakes.ts) */
  mistakes?: string[];
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
  /**
   * Whether trades excluded from the statistics still count toward the
   * account balance. Absent or false (the default): they do not.
   */
  countExcludedInBalance?: boolean;
  /**
   * Paler example text in empty fields, so "0.00" never looks filled in.
   * Absent or false (the default): it keeps the 4.5:1 contrast of other text.
   */
  fadedPlaceholders?: boolean;
  /**
   * The mistakes the trade form offers, in order. Absent until the list is
   * first changed, which reads as STARTING_MISTAKES (lib/mistakes.ts).
   */
  mistakes?: string[];
}

export interface Profile {
  name: string;
}

export interface JournalData {
  version: typeof JOURNAL_VERSION;
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
