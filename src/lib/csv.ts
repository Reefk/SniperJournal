import type { Account, Setup, Trade } from './types';
import { grossPnl, isClosed, missingDetails, netPnl, rMultiple } from './trade-math';
import { pad2 } from './utils';
import { detectLayout, missingSymbol, type ImportLayout, type LayoutChoices } from './import/layout';
import { createReader, type ImportTarget } from './import/reader';
import { combinePartials, tradesFromRows } from './import/rows';
import { tradesFromFills } from './import/positions';
import { collectMessages } from './import/report';
import { splitLikelyDuplicates } from './import/likely';
import { recognisePlatform } from './import/platforms';
import { formulaSafe } from './import/values';

export { parseCsv } from './import/table';
export { ROLE_LABELS, type Role } from './import/columns';
export type { DateOrder } from './import/values';
export type { ImportLayout, RowKind } from './import/layout';
export { PLATFORMS, type Platform, type PlatformGroup } from './import/platforms';
export {
  WorkbookError,
  isOldExcel,
  isZip,
  likeliestSheet,
  readWorkbook,
  sheetToCsv,
  type WorkbookSheet,
} from './import/xlsx';

export const CSV_COLUMNS = [
  'symbol',
  'side',
  'opened_at',
  'closed_at',
  'quantity',
  'entry_price',
  'exit_price',
  'stop_loss',
  'take_profit',
  'fees',
  'multiplier',
  'leverage',
  'session',
  'setup',
  'tags',
  'notes',
  'account',
] as const;

export function csvTemplate(): string {
  const today = new Date();
  const day = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  return [
    CSV_COLUMNS.join(','),
    `AAPL,LONG,${day} 09:35,${day} 10:12,100,187.40,189.10,186.20,190.00,1.30,1,,New York,Opening Range Breakout,breakout|planned,Took the first pullback,Main Portfolio`,
    `EURUSD,SHORT,${day} 11:05,${day} 11:48,10000,1.08640,1.08410,1.08790,1.08200,0.40,1,10,London,VWAP Reclaim,fx,Clean rejection at the session high,Main Portfolio`,
  ].join('\n');
}

export function tradesToCsv(trades: Trade[], setups: Setup[], accounts: Account[]): string {
  const setupNames = new Map(setups.map((s) => [s.id, s.name]));
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [...CSV_COLUMNS, 'gross_pnl', 'net_pnl', 'r_multiple'];
  const rows = trades.map((t) =>
    [
      formulaSafe(t.symbol),
      t.side,
      t.openedAt.replace('T', ' '),
      t.closedAt?.replace('T', ' ') ?? '',
      t.quantity,
      t.entryPrice,
      t.exitPrice ?? '',
      t.stopLoss ?? '',
      t.takeProfit ?? '',
      t.fees ?? 0,
      t.multiplier ?? 1,
      t.leverage ?? '',
      formulaSafe(t.session ?? ''),
      formulaSafe(t.setupId ? (setupNames.get(t.setupId) ?? '') : ''),
      formulaSafe(t.tags.join('|')),
      formulaSafe(t.notes ?? ''),
      formulaSafe(accountNames.get(t.accountId) ?? ''),
      isClosed(t) ? grossPnl(t).toFixed(2) : '',
      isClosed(t) ? netPnl(t).toFixed(2) : '',
      rMultiple(t)?.toFixed(2) ?? '',
    ]
      .map(esc)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

export interface ImportOptions extends ImportTarget, LayoutChoices {
  combinePartials?: boolean;
}

export interface ImportResult {
  trades: Trade[];
  /**
   * left out of `trades`: no broker id says so, but the account, symbol, side,
   * entry time and size match a trade already in the journal (import/likely.ts)
   */
  likelyDuplicates: Trade[];
  /** the setups the file names that the journal lacks; some may be used only by `likelyDuplicates` */
  newSetups: Setup[];
  /** things to check: rows skipped, values that could not be read */
  errors: string[];
  /** how the file was read: worth knowing, nothing wrong */
  notices: string[];
  /** rows already in the journal, matched on the broker's ids */
  duplicates: number;
  /** imported, but still missing something the statistics need */
  incomplete: number;
  /** true when the file pairs a buy fill with a sell fill instead of naming a side */
  pairedFills: boolean;
  /** how many rows were folded into a larger position because they shared an entry fill */
  combined: number;
  recognised: string[];
  ignored: string[];
  layout: ImportLayout | null;
  /** the platform and export the file's columns say it came from (import/platforms.ts), if a known one */
  platform: { name: string; file: string } | null;
}

/** a result with nothing imported, and why */
function nothingImported(why: Partial<ImportResult>): ImportResult {
  return {
    trades: [],
    likelyDuplicates: [],
    newSetups: [],
    errors: [],
    notices: [],
    duplicates: 0,
    incomplete: 0,
    pairedFills: false,
    combined: 0,
    recognised: [],
    ignored: [],
    layout: null,
    platform: null,
    ...why,
  };
}

/**
 * Reads a broker's CSV into trades. Only a symbol is genuinely required:
 * anything else that is missing is left blank for you to fill in afterwards,
 * and the trade is flagged so it stays out of the statistics until you do.
 *
 * Three kinds of file are understood: one row per trade (entry and exit),
 * Tradovate-style rows pairing a buy fill with a sell fill, and one row per
 * fill, which is put back together into trades (see import/fills.ts).
 *
 * The stages, each in lib/import/:
 *   layout.ts     where the table is, what each column is, which kind of rows
 *   reader.ts     reading a row's values, noting what turns up
 *   rows.ts       a row per trade or per paired fills: read, made a trade,
 *                 scaled-out positions put back together
 *   positions.ts  a row per fill: read, put into positions, each a trade
 *   report.ts     what to check, and how the file was read
 *   likely.ts     trades that look like ones already in the journal, left out
 */
export function importTradesFromCsv(text: string, ctx: ImportOptions): ImportResult {
  const sheet = detectLayout(text, ctx);
  if (!sheet) return nothingImported({ errors: ['The file has no data rows.'] });
  const platform = recognisePlatform(sheet.table.header, sheet.table.statement);
  const noSymbol = missingSymbol(sheet);
  if (noSymbol) {
    return nothingImported({
      recognised: sheet.recognised,
      ignored: sheet.ignored,
      layout: sheet.layout,
      platform,
      errors: [noSymbol],
    });
  }

  const reader = createReader(sheet, ctx);
  const read = sheet.rowKind === 'fills' ? tradesFromFills(reader) : tradesFromRows(reader);
  const { errors, notices } = collectMessages(reader.findings, sheet.table, read);
  const { trades: all, combined } =
    ctx.combinePartials === false || !read.openingFill
      ? { trades: read.trades, combined: 0 }
      : combinePartials(read.trades, read.openingFill);
  const { fresh: trades, likely, closesOpen } = splitLikelyDuplicates(all, ctx.existing);
  if (closesOpen) {
    errors.push(
      `${closesOpen} ${closesOpen === 1 ? 'trade closes a position' : 'trades close positions'} your journal still has as open. Both are kept: delete the open ${closesOpen === 1 ? 'copy' : 'copies'} once you have checked.`,
    );
  }

  return {
    trades,
    likelyDuplicates: likely,
    newSetups: reader.newSetups,
    errors,
    notices,
    duplicates: reader.findings.duplicates,
    incomplete: trades.filter((t) => t.needsReview).length,
    pairedFills: sheet.paired,
    combined,
    recognised: sheet.recognised,
    ignored: sheet.ignored,
    layout: sheet.layout,
    platform,
  };
}

/** Human-readable list of what a row still needs, for the import preview */
export function describeGaps(trade: Trade): string {
  const gaps = missingDetails(trade);
  if (!gaps.length) return '';
  return `needs ${gaps.join(', ')}`;
}
