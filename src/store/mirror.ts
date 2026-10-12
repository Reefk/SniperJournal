import type { JournalData } from '@/lib/types';

/**
 * The browser's copy of the journal (localStorage), and whether to trust it.
 *
 * On a PC every change is copied into the browser at once, in case the app is
 * closed before the server has written it. Every tab of the app shares that
 * one copy, so on its own "the newer of file and copy wins" would let a tab
 * that lost a save conflict bring its version back after a reload, over the
 * work of the tab that saved first. So each copy records which tab wrote it
 * and which version of the file (see storage.version()) it was made on top
 * of, and it only wins over the file while that is still the file's version.
 *
 * No React here, so it can be tested on its own (tests/mirror.test.ts).
 */
export interface Mirror {
  journal: JournalData;
  /** the file version this journal was made on top of; null where versions aren't kept (a phone) */
  base: string | null;
  /** which tab (page load) wrote it */
  tab: string | null;
  /** an older app wrote it, before copies recorded their version */
  legacy?: boolean;
}

export function encodeMirror(journal: JournalData, base: string | null, tab: string): string {
  return JSON.stringify({ tab, base, journal });
}

/** what the browser holds; a copy from before versions were recorded counts as `legacy` */
export function decodeMirror(raw: string | null): Mirror | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if ('journal' in parsed) {
      if (!parsed.journal || typeof parsed.journal !== 'object') return null;
      return {
        journal: parsed.journal,
        base: typeof parsed.base === 'string' ? parsed.base : null,
        tab: typeof parsed.tab === 'string' ? parsed.tab : null,
      };
    }
    return { journal: parsed as JournalData, base: null, tab: null, legacy: true };
  } catch {
    return null;
  }
}

/**
 * Which journal to open: the file's, or the browser's copy when it holds
 * changes made on top of that same file that never reached it (the app was
 * closed before the save). A newer copy made on top of an older file holds a
 * window's changes that lost to another window's save: it is not opened, and
 * comes back as `stale` so it can be kept as a copy rather than lost.
 */
export function pickJournal(
  disk: JournalData | null,
  diskVersion: string | null,
  mirror: Mirror | null,
): { journal: JournalData | null; stale: JournalData | null } {
  if (!mirror) return { journal: disk, stale: null };
  if (!disk) return { journal: mirror.journal, stale: null };
  const newer = (mirror.journal.updatedAt ?? '') > (disk.updatedAt ?? '');
  if (!newer) return { journal: disk, stale: null };
  const sameFile = mirror.legacy || mirror.base == null || diskVersion == null || mirror.base === diskVersion;
  return sameFile ? { journal: mirror.journal, stale: null } : { journal: disk, stale: mirror.journal };
}

/**
 * After this tab's save took the file from version `from` to `to`, its copy
 * in the browser is now on top of `to`. Only this tab's own copy: another
 * tab's copy doesn't hold the changes this save wrote. Null when nothing
 * needs to change.
 */
export function rebaseMirror(raw: string | null, tab: string, from: string | null, to: string | null): string | null {
  const mirror = decodeMirror(raw);
  if (!mirror || mirror.legacy || mirror.tab !== tab || mirror.base !== from || from === to) return null;
  return encodeMirror(mirror.journal, to, tab);
}
