import type { Findings } from './reader';
import type { Table } from './table';

/**
 * What to check after an import, and how the file was read, worded for the
 * import preview. Errors are things to check (rows skipped, values that could
 * not be read); notices are worth knowing, with nothing wrong.
 */

/** said when no trade read has a fee (Tradovate's exports have none): the P&L shown is before commissions */
export const NO_FEES =
  'There are no fees in this file, so the trades come in without them, and their P&L is before commissions. To add them, select the trades on the Trades page, then Add details > Fees per trade.';

/** "Row 4" or "Row 4 and 6 more" */
export const rowsLabel = (rows: number[]) =>
  rows.length === 1 ? `Row ${rows[0]}` : `Row ${rows[0]} and ${rows.length - 1} more`;

/** "Row 4: ..." or "Row 4 and 6 more: ..." */
export function rowsNote(rows: number[], one: string, many: string): string {
  return `${rowsLabel(rows)}: ${rows.length === 1 ? one : many}`;
}

/**
 * Every message of an import, in the order the preview lists them: rows
 * without a symbol first, then what reading that kind of row turned up
 * (`read`), then values left out or worked out, then how the table was found.
 */
export function collectMessages(
  findings: Findings,
  table: Table,
  read: { errors: string[]; notices: string[] },
): { errors: string[]; notices: string[] } {
  const errors = [...read.errors];
  const notices = [...read.notices];

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
  for (const [symbol, how] of findings.inferred) {
    notices.push(`${symbol}: one point taken as worth ${how}. Check it if that is not right.`);
  }
  if (table.grouped) notices.push("Each block's symbol was taken from the line above its column names.");
  if (table.cashFees)
    notices.push(
      `The fees of ${table.cashFees === 1 ? '1 execution were' : `${table.cashFees} executions were`} taken from the statement's Cash Balance section, matched by time.`,
    );
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
