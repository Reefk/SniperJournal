import { ROLE_LABELS, type Role } from './columns';
import type { ImportLayout } from './layout';
import type { Findings } from './reader';
import type { Table } from './table';

/**
 * What to check after an import, and how the file was read, worded for the
 * import preview. Errors are things to check (rows skipped, values that could
 * not be read); notices are worth knowing, with nothing wrong.
 */

/** said when no trade read has a fee (Tradovate's exports have none): the P&L shown is before commissions */
export const NO_FEES =
  'There are no fees in this file, so the trades come in without them, and their P&L is before commissions. To add them, select the trades on the Trades page, then Add details > Fees, per trade or per contract.';

/** said instead when the file writes its fees, all 0 (TradingView's paper trading) */
export const ZERO_FEES =
  'Every fee in this file is 0, so the trades come in with none. If there were commissions, add them: select the trades on the Trades page, then Add details > Fees, per trade or per contract.';

/** "Row 4" or "Row 4 and 6 more" */
export const rowsLabel = (rows: number[]) =>
  rows.length === 1 ? `Row ${rows[0]}` : `Row ${rows[0]} and ${rows.length - 1} more`;

/** what a file's columns were read as, for the notice of those guessed from their names */
export type GuessedColumns = Pick<ImportLayout, 'columns' | 'rowKind' | 'kindFromGuesses'>;

/**
 * Which columns were read from the words of their names (import/words.ts),
 * and whether that decided the kind of rows; null for none.
 */
export function guessedNote({ columns, rowKind, kindFromGuesses }: GuessedColumns): string | null {
  const labels = new Map<Role | '', string>(ROLE_LABELS);
  const read = columns.filter((c) => c.guessed);
  if (!read.length) return null;
  const one = read.length === 1;
  const which = one
    ? `"${read[0].header}" was read as ${labels.get(read[0].role)}, from the words in its name.`
    : `Read from the words in their names: ${read.map((c) => `"${c.header}" as ${labels.get(c.role)}`).join(', ')}.`;
  const rows = !kindFromGuesses
    ? ''
    : rowKind === 'fills'
      ? ` Because of ${one ? 'it' : 'them'}, each row was read as one fill; if each row is a whole trade, choose that under "Each row is".`
      : ` Because of ${one ? 'it' : 'them'}, each row was read as a whole trade; if each row is one fill, choose that under "Each row is".`;
  return `${which}${rows} Check ${one ? 'it' : 'them'} under Columns if that is not right.`;
}

/** "Row 4: ..." or "Row 4 and 6 more: ..." */
export function rowsNote(rows: number[], one: string, many: string): string {
  return `${rowsLabel(rows)}: ${rows.length === 1 ? one : many}`;
}

/**
 * Every message of an import, in the order the preview lists them: rows
 * without a symbol first, then what reading that kind of row turned up
 * (`read`), then values left out or worked out, then how the table was found.
 * Columns read from the words of their names (`layout`) are the first
 * notice: one read wrongly is wrong in every trade.
 */
export function collectMessages(
  findings: Findings,
  table: Table,
  read: { errors: string[]; notices: string[] },
  layout?: GuessedColumns,
): { errors: string[]; notices: string[] } {
  const errors = [...read.errors];
  const guessed = layout && guessedNote(layout);
  const notices = [...(guessed ? [guessed] : []), ...read.notices];

  if (findings.noSymbol.length)
    errors.unshift(
      rowsNote(findings.noSymbol, 'no symbol, so the row was skipped.', 'no symbol, so they were skipped.'),
    );
  for (const [value, rowsWith] of findings.unknownSides) {
    const many = rowsWith.length > 1;
    errors.push(
      `${rowsLabel(rowsWith)}: the direction "${value}" was not recognised, so ${many ? 'they were' : 'it was'} imported as LONG. Check ${many ? 'them' : 'it'}.`,
    );
  }
  const bad = findings.badMultipliers;
  if (bad.rows.length) {
    const many = bad.rows.length > 1;
    errors.push(
      `${rowsLabel(bad.rows)}: the multiplier "${bad.value}" has to be more than 0, so it was left out. Check ${many ? 'them' : 'it'}.`,
    );
  }
  if (findings.foreignFees.size) {
    errors.push(
      `Fees paid in ${[...findings.foreignFees].join(', ')} were left out: they are not in the currency of the prices.`,
    );
  }
  if (findings.rateNoSize.length)
    errors.push(
      rowsNote(
        findings.rateNoSize,
        'a fee per contract but no size to multiply it by, so no fee was added. Add it with the size.',
        'a fee per contract but no size to multiply it by, so no fees were added. Add them with the sizes.',
      ),
    );
  if (findings.netAboveGross.length)
    errors.push(
      rowsNote(
        findings.netAboveGross,
        'the P&L after fees is more than the one before them, so no fee was worked out from the two. Check its fees.',
        'the P&L after fees is more than the one before them, so no fees were worked out from the two. Check their fees.',
      ),
    );
  for (const [symbol, how] of findings.inferred) {
    notices.push(`${symbol}: one point taken as worth ${how}. Check it if that is not right.`);
  }
  if (findings.pnlSetAside.size) {
    const symbols = [...findings.pnlSetAside];
    const named =
      symbols.length > 3 ? `${symbols.slice(0, 3).join(', ')} and ${symbols.length - 3} more` : symbols.join(', ');
    notices.push(
      `${named}: the P&L in the file doesn't follow from the prices at ${symbols.length === 1 ? 'its' : 'their'} point value, so it was worked out from the prices (a broker's P&L can be measured against an earlier entry than the file's). Check it if that is not right.`,
    );
  }
  if (table.grouped) notices.push("Each block's symbol was taken from the line above its column names.");
  if (table.cashFees)
    notices.push(
      `The fees of ${table.cashFees === 1 ? '1 execution were' : `${table.cashFees} executions were`} taken from the statement's Cash Balance section, matched by time.`,
    );
  if (table.cashFeesUnmatched) {
    const { lines, fees } = table.cashFeesUnmatched;
    // less than a cent is shown as it is, not as 0.00
    const amount = fees >= 0.01 ? fees.toFixed(2) : String(fees);
    errors.push(
      lines === 1
        ? `1 fee line in the statement could not be matched to an execution in its Account Trade History (same symbol, side and size, within 2 seconds), so its fees (${amount}) were left out.`
        : `${lines} fee lines in the statement could not be matched to an execution in its Account Trade History (same symbol, side and size, within 2 seconds), so their fees (${amount} in all) were left out.`,
    );
  }
  if (table.statement) notices.push('Read the Trades section of this Interactive Brokers statement.');
  else if (table.preamble)
    notices.push(`The column names are on line ${table.preamble + 1}; the lines above them were left out.`);
  if (table.skipped)
    notices.push(
      `${table.skipped} total, summary or repeated header ${table.skipped === 1 ? 'line was' : 'lines were'} left out.`,
    );
  // a time with no zone is taken as this device's: off by the difference if
  // the platform wrote another zone's (the exchange's, say), so it is said
  if (findings.zoned && findings.unzoned)
    notices.push(
      "Some times in this file carry a time zone, so they were converted to this device's local time; the others carry none and were taken as written.",
    );
  else if (findings.zoned)
    notices.push("Times in this file carry a time zone, so they were converted to this device's local time.");
  else if (findings.unzoned)
    notices.push("Times in this file carry no time zone, so they were taken as written, in this device's local time.");

  return { errors, notices };
}
