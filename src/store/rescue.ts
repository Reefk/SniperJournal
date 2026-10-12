import type { JournalData } from '@/lib/types';
import { storage } from '@/lib/storage';
import { decodeMirror, MIRROR_KEY, pickJournal } from './mirror';

/**
 * The journal, read without any of the app's React state, for the screen shown
 * when the app itself has crashed (src/app/global-error.tsx): the file, or the
 * browser's copy when that holds newer changes made on top of it, by the same
 * rule the app opens it with. Never throws; `journal` is null when there is
 * none to be had.
 */
export async function rescueJournal(): Promise<{ journal: JournalData | null; location: string | null }> {
  let disk: JournalData | null = null;
  let readable = true;
  try {
    await storage.init();
    disk = await storage.readJournal();
  } catch {
    readable = false;
  }
  let mirror = null;
  try {
    mirror = decodeMirror(localStorage.getItem(MIRROR_KEY));
  } catch {
    /* no browser copy to be had */
  }
  const { journal } = pickJournal(disk, readable ? (storage.version?.() ?? null) : null, mirror);
  return { journal, location: storage.location() };
}

/** the theme the journal was last shown in, from the browser's copy */
export function rescueTheme(): 'light' | 'dark' {
  try {
    return decodeMirror(localStorage.getItem(MIRROR_KEY))?.journal.settings?.theme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}
