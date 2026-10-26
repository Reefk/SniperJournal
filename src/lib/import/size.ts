import { formatBytes } from '../format';
import { decimalMark, tr } from '../i18n';

/**
 * The most one import reads: 10 MB. That is about 60,000 trades written one
 * to a row, or 100,000 fills, years of one person's trading, and it imports
 * in one to two seconds on a PC (measured 2026-10-16; a phone is slower).
 * A bigger file is refused before it is read: the page would stall while
 * it read, and the journal it made would be far past what the browser's
 * spare copy holds. Splitting the file, or exporting a shorter period,
 * imports the same trades.
 */
export const IMPORT_LIMIT = 10 * 1024 * 1024;

const LIMIT_TEXT = `${IMPORT_LIMIT / 1024 ** 2} MB`;
/** a size past the limit, rounded up so it never reads as the limit itself: 10.02 MB is "10.1 MB" */
const pastLimit = (bytes: number) =>
  bytes < 1024 ** 3 ? `${decimalMark((Math.ceil((bytes / 1024 ** 2) * 10) / 10).toFixed(1))} MB` : formatBytes(bytes);
const split = () => tr('imp.tooLarge.split');

/** why a file of this many bytes is not imported, worded for the import window; null when it can be */
export function fileTooLarge(bytes: number): string | null {
  if (bytes <= IMPORT_LIMIT) return null;
  return `${tr('imp.tooLarge.file', { size: pastLimit(bytes), limit: LIMIT_TEXT })} ${split()}`;
}

/** why a workbook's sheet, written out as CSV, is not imported; null when it can be */
export function sheetTooLarge(csv: string): string | null {
  if (csv.length <= IMPORT_LIMIT) return null;
  return `${tr('imp.tooLarge.sheet', { size: pastLimit(csv.length), limit: LIMIT_TEXT })} ${split()}`;
}

/**
 * The most one part of a workbook may unpack to. Its XML takes about five
 * times the room of the same table as CSV, so a sheet past this would be
 * past IMPORT_LIMIT anyway; it also stops a small file that unpacks to
 * gigabytes from taking the page down.
 */
export const UNPACKED_LIMIT = IMPORT_LIMIT * 8;

export const workbookTooLarge = () => `${tr('imp.tooLarge.workbook', { limit: LIMIT_TEXT })} ${split()}`;
