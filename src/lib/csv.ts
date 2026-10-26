import type { Account, Setup, Trade } from './types';
import { grossPnl, isClosed, needsText, netPnl, rMultiple } from './trade-math';
import { pad2 } from './utils';
import { detectLayout, missingSymbol, type ImportLayout, type LayoutChoices } from './import/layout';
import { createReader, type ImportTarget } from './import/reader';
import { combinePartials, tradesFromRows } from './import/rows';
import { tradesFromFills } from './import/positions';
import { collectMessages, noFeesNotice, zeroFeesNotice } from './import/report';
import { tr } from './i18n';
import { splitLikelyDuplicates } from './import/likely';
import { recognisePlatform } from './import/platforms';
import { formulaSafe } from './import/values';
import { feeAtRate, type FeeRate } from './fee-rate';

export { parseCsv } from './import/table';
export { noFeesNotice, quoted, zeroFeesNotice } from './import/report';
export type { FeeRate } from './fee-rate';
export { roleLabels, type Role } from './import/columns';
export type { DateOrder } from './import/values';
export type { ImportLayout, RowKind } from './import/layout';
export { PLATFORMS, groupName, say, type Platform, type PlatformGroup } from './import/platforms';
export { fileTooLarge, sheetTooLarge } from './import/size';
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
  /**
   * Whether a file that closes a trade the journal has open finishes that
   * trade (the default). False leaves the journal's trades as they are, and
   * the file starts from nothing: its closing fills become trades of their own.
   */
  finishOpen?: boolean;
  /**
   * a fee for every trade the import adds or finishes, used only when the
   * file has none of its own (`feesMissing`); a file with fees keeps them
   */
  addFee?: FeeRate;
  /**
   * a fee charged on every trade in place of the file's own, used only when
   * the file has some (`feesMissing` null): its fees are wrong, or yours differ
   */
  replaceFees?: FeeRate;
}

export interface ImportResult {
  trades: Trade[];
  /**
   * left out of `trades`: no broker id says so, but the account, symbol, side,
   * entry time and size match a trade already in the journal (import/likely.ts)
   */
  likelyDuplicates: Trade[];
  /**
   * trades the journal has open that the file closes, finished: each keeps
   * its journal id and replaces the open one (import/finish.ts)
   */
  finished: Trade[];
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
  /**
   * the file has no fees of its own, so a fee can be added (`addFee`): none
   * written at all, or every one 0; null when it has some, or a P&L after
   * them, which `replaceFees` replaces
   */
  feesMissing: 'none' | 'zero' | null;
}

/** a result with nothing imported, and why */
function nothingImported(why: Partial<ImportResult>): ImportResult {
  return {
    trades: [],
    likelyDuplicates: [],
    finished: [],
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
    feesMissing: null,
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
 *   finish.ts     a trade the journal has open, finished by the file that closes it
 * and a fee given in the import window, on every trade it makes: ../fee-rate.ts
 */
export function importTradesFromCsv(text: string, ctx: ImportOptions): ImportResult {
  const sheet = detectLayout(text, ctx);
  if (!sheet) return nothingImported({ errors: [tr('imp.noRows')] });
  const known = recognisePlatform(sheet.table.header, sheet.table.statement);
  const platform = known && { name: known.name, file: known.file };
  // a platform's export that holds no trades: say which one does
  if (known?.instead) {
    return nothingImported({
      recognised: sheet.recognised,
      ignored: sheet.ignored,
      layout: sheet.layout,
      platform,
      errors: [known.instead],
    });
  }
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
  const finishing = ctx.finishOpen !== false;
  const journal = finishing ? (ctx.existing ?? []) : undefined;
  const read = sheet.rowKind === 'fills' ? tradesFromFills(reader, journal) : tradesFromRows(reader, journal);
  const { errors, notices } = collectMessages(reader.findings, sheet.table, read, sheet.layout);
  // not a fee anywhere: unless a P&L after fees says what they were, the P&L
  // is before them. Fees the file has but that were left out are said already
  // (fee lines that matched no execution, another currency, a rate with no
  // size); fees the file writes, all 0, are said as such. Told from the rows
  // read, not the trades: one the file finishes may keep the journal's fees.
  const made = [...read.trades, ...(read.finished ?? [])];
  const { feesWritten, feesFound, rateNoSize, foreignFees } = reader.findings;
  const feesLeftOut = Boolean(sheet.table.cashFeesUnmatched) || foreignFees.size > 0 || rateNoSize.length > 0;
  const feesMissing = sheet.has('net_pnl') || feesLeftOut || feesFound ? null : feesWritten ? 'zero' : 'none';
  // a fee given for such a file, or in place of the file's own, is charged on
  // every trade it makes, so nothing is missing any more
  const given = feesMissing ? ctx.addFee : ctx.replaceFees;
  const rate = given && given.amount > 0 ? given : null;
  const withFee = (t: Trade): Trade => (rate ? { ...t, fees: feeAtRate(t, rate) } : t);
  if (made.length && feesMissing && !rate) notices.push(feesMissing === 'zero' ? zeroFeesNotice() : noFeesNotice());
  const {
    trades: all,
    combined,
    unsaid,
  } = ctx.combinePartials === false || !read.openingFill
    ? { trades: read.trades, combined: 0, unsaid: read.unsaid }
    : combinePartials(read.trades, read.openingFill, read.unsaid);
  // what the rows finished counts as finished here too, so nothing finishes twice
  const done = new Map((read.finished ?? []).map((t) => [t.id, t]));
  const existing = (ctx.existing ?? []).map((t) => done.get(t.id) ?? t);
  const split = splitLikelyDuplicates(all, existing, finishing, new Set(done.keys()), unsaid);
  const { fresh: trades, likely, closesOpen, closesPart, finished } = split;
  if (closesOpen) errors.push(tr('imp.closesOpen', { count: closesOpen }));
  if (closesPart && finishing) notices.push(tr('imp.closesPart.finished', { count: closesPart }));
  else if (closesPart) errors.push(tr('imp.closesPart.kept', { count: closesPart }));

  return {
    trades: trades.map(withFee),
    likelyDuplicates: likely.map(withFee),
    finished: [...done.values(), ...finished].map(withFee),
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
    feesMissing,
  };
}

/** Human-readable list of what a row still needs, for the import preview */
export function describeGaps(trade: Trade): string {
  return needsText(trade);
}
