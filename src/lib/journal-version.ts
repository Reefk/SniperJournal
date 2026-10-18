/**
 * Which shape of journal this version of the app reads and writes. Kept on
 * its own, importing nothing, so the PC server's route and the storage code
 * can check a journal without pulling in the rest of the app.
 */

/**
 * The shape of journal this version of the app writes, and the newest it can
 * open. A change to the shape raises it, and comes with an upgrade from the
 * one before, in normalize() (journal.ts).
 */
export const JOURNAL_VERSION = 1;

/**
 * The version of a journal saved by a newer app than this one, or null. This
 * one can't open it: normalize() would drop whatever the newer one added, and
 * the next save would write the journal over without it (SJ-32). A version
 * written as text ("2") counts as its number.
 */
export function newerJournal(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const written = (raw as { version?: unknown }).version;
  const version = typeof written === 'string' && written.trim() !== '' ? Number(written) : written;
  return typeof version === 'number' && version > JOURNAL_VERSION ? version : null;
}

/**
 * The version a journal file says it is. The app writes it first, so a save
 * can check the file it is about to replace without reading all of it; a
 * file that doesn't start with it is read whole. Undefined when there is none.
 */
export function versionInFile(text: string): unknown {
  // only as the very first key: a "version" further in could belong to something else
  const head = /^\s*\{\s*"version"\s*:\s*("[^"]*"|[-+\d.eE]+)/.exec(text.slice(0, 4096));
  try {
    return head ? JSON.parse(head[1]) : (JSON.parse(text) as { version?: unknown } | null)?.version;
  } catch {
    return undefined;
  }
}
