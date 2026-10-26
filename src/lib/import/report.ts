import { decimalMark, tr } from '../i18n';
import { roleLabels, type Role } from './columns';
import type { ImportLayout } from './layout';
import type { Findings } from './reader';
import type { Table } from './table';

/**
 * What to check after an import, and how the file was read, worded for the
 * import preview. Errors are things to check (rows skipped, values that could
 * not be read); notices are worth knowing, with nothing wrong.
 */

/** said when no trade read has a fee (Tradovate's exports have none): the P&L shown is before commissions */
export const noFeesNotice = () => tr('imp.noFees');

/** said instead when the file writes its fees, all 0 (TradingView's paper trading) */
export const zeroFeesNotice = () => tr('imp.zeroFees');

/** a value from the file, quoted as the language quotes */
export const quoted = (text: string) => tr('imp.quoted', { text });

/** "Row 4" or "Row 4 and 6 more" */
export const rowsLabel = (rows: number[]) =>
  rows.length === 1 ? tr('imp.row', { row: rows[0] }) : tr('imp.rows', { row: rows[0], count: rows.length - 1 });

/** what a file's columns were read as, for the notice of those guessed from their names */
export type GuessedColumns = Pick<ImportLayout, 'columns' | 'rowKind' | 'kindFromGuesses'>;

/**
 * Which columns were read from the words of their names (import/words.ts),
 * and whether that decided the kind of rows; null for none.
 */
export function guessedNote({ columns, rowKind, kindFromGuesses }: GuessedColumns): string | null {
  const labels = new Map<Role | '', string>(roleLabels());
  const role = (r: Role | '') => `${labels.get(r)}`;
  const read = columns.filter((c) => c.guessed);
  if (!read.length) return null;
  const n = read.length === 1 ? 'one' : 'many';
  const which =
    n === 'one'
      ? tr('imp.guessed.one', { header: quoted(read[0].header), role: role(read[0].role) })
      : tr('imp.guessed.many', {
          list: read
            .map((c) => tr('imp.guessed.item', { header: quoted(c.header), role: role(c.role) }))
            .join(tr('format.comma')),
        });
  const rows = !kindFromGuesses
    ? ''
    : tr(`imp.guessed.${rowKind === 'fills' ? 'fills' : 'trades'}.${n}`, { eachRowIs: tr('imp.label.eachRowIs') });
  return `${which}${rows}${tr(`imp.guessed.check.${n}`, { columns: tr('imp.label.columns') })}`;
}

/** "Row 4: ..." or "Row 4 and 6 more: ..." */
export function rowsNote(rows: number[], one: string, many: string): string {
  return tr('imp.rowsNote', { rows: rowsLabel(rows), text: rows.length === 1 ? one : many });
}

/** what is said of exactly one, or of more than one */
const oneOrMany = (n: number) => (n > 1 ? 'many' : 'one');

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
    errors.unshift(rowsNote(findings.noSymbol, tr('imp.noSymbol.one'), tr('imp.noSymbol.many')));
  for (const [value, rowsWith] of findings.unknownSides) {
    errors.push(
      tr(`imp.unknownSide.${oneOrMany(rowsWith.length)}`, { rows: rowsLabel(rowsWith), value, side: tr('side.LONG') }),
    );
  }
  const bad = findings.badMultipliers;
  if (bad.rows.length) {
    errors.push(tr(`imp.badMultiplier.${oneOrMany(bad.rows.length)}`, { rows: rowsLabel(bad.rows), value: bad.value }));
  }
  if (findings.foreignFees.size) {
    errors.push(tr('imp.foreignFees', { currencies: [...findings.foreignFees].join(tr('format.comma')) }));
  }
  if (findings.rateNoSize.length)
    errors.push(rowsNote(findings.rateNoSize, tr('imp.rateNoSize.one'), tr('imp.rateNoSize.many')));
  if (findings.netAboveGross.length)
    errors.push(rowsNote(findings.netAboveGross, tr('imp.netAboveGross.one'), tr('imp.netAboveGross.many')));
  for (const [symbol, how] of findings.inferred) {
    notices.push(tr('imp.inferred', { symbol, how }));
  }
  if (findings.pnlSetAside.size) {
    const symbols = [...findings.pnlSetAside];
    const comma = tr('format.comma');
    const named =
      symbols.length > 3
        ? tr('imp.andMore', { list: symbols.slice(0, 3).join(comma), count: symbols.length - 3 })
        : symbols.join(comma);
    notices.push(tr(`imp.pnlSetAside.${oneOrMany(symbols.length)}`, { symbols: named }));
  }
  if (table.grouped) notices.push(tr('imp.grouped'));
  // the sections are named as the statement names them
  if (table.cashFees) notices.push(tr('imp.cashFees', { count: table.cashFees, section: 'Cash Balance' }));
  if (table.cashFeesUnmatched) {
    const { lines, fees } = table.cashFeesUnmatched;
    // less than a cent is shown as it is, not as 0.00
    const amount = decimalMark(fees >= 0.01 ? fees.toFixed(2) : String(fees));
    errors.push(tr('imp.cashUnmatched', { count: lines, section: 'Account Trade History', amount }));
  }
  if (table.statement) notices.push(tr('imp.statement', { section: 'Trades' }));
  else if (table.preamble) notices.push(tr('imp.preamble', { line: table.preamble + 1 }));
  if (table.skipped) notices.push(tr('imp.skipped', { count: table.skipped }));
  // a time with no zone is taken as this device's: off by the difference if
  // the platform wrote another zone's (the exchange's, say), so it is said
  if (findings.zoned && findings.unzoned) notices.push(tr('imp.zoned.some'));
  else if (findings.zoned) notices.push(tr('imp.zoned.all'));
  else if (findings.unzoned) notices.push(tr('imp.zoned.none'));

  return { errors, notices };
}
