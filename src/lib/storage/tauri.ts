import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { newerJournal, versionInFile } from '@/lib/journal-version';
import type { JournalData } from '@/lib/types';
import { JournalConflict, KEEP_COPIES, copyStamp, type CopyReason, type JournalStorage } from './types';
import { IMAGE_NAME, findUnused, removeUnused, type SweepFiles, type UnusedImage } from './sweep';
import { imageExtension, unsupportedImage } from './image-types';

/**
 * The Windows app (src-tauri/): the journal and its chart images live in
 * Documents\Sniper Journal, the same layout the phone and the PC server keep:
 *
 *   journal.json        the whole journal
 *   backups/            one copy per day, the last 30 kept, plus a copy made
 *                       before each restore or erase (the last 10 of each)
 *   screenshots/        chart images, referenced by name from each trade
 *
 * Each file operation is a command in src-tauri/src/lib.rs, which refuses any
 * path outside that folder and writes every file whole: a temp file, flushed
 * to the disk, renamed over the old one, waiting out antivirus or OneDrive
 * holding it for a moment. Being in Documents rather than inside the app, the
 * journal stays when the app is uninstalled.
 */

const FILE = 'journal.json';
const BACKUP_DIR = 'backups';
const SHOTS_DIR = 'screenshots';
const KEEP_BACKUPS = 30;

/** one file or folder, as the `list` command describes it */
interface Entry {
  name: string;
  isFile: boolean;
  /** last modified, in milliseconds since 1970 */
  modified: number;
  bytes: number;
}

/** the journal folder, resolved once in init() */
let root = '';

const readText = (path: string) => invoke<string | null>('read_text', { path });
const writeText = (path: string, text: string) => invoke<void>('write_text', { path, text });
/** what is in a folder; nothing when it is not there yet, and throws when it cannot be read */
const list = (dir: string) => invoke<Entry[]>('list', { dir });
const remove = (path: string) => invoke<boolean>('remove', { path });

/** a path inside the folder the way Windows writes it, to show the person */
const shown = (path: string) => `${root}\\${path.replace(/\//g, '\\')}`;

/** oldest first, so only the newest `keep` backups starting with `prefix` stay */
async function prune(prefix: string, keep: number) {
  const names = (await list(BACKUP_DIR))
    .map((f) => f.name)
    .filter((n) => n.startsWith(prefix) && n.endsWith('.json'))
    .sort();
  for (const stale of names.slice(0, Math.max(0, names.length - keep))) {
    await remove(`${BACKUP_DIR}/${stale}`).catch(() => undefined);
  }
}

/**
 * One copy per day, oldest pruned, so a bad edit is always recoverable.
 * Says whether today's copy is in place, so it is only looked for once a day.
 */
async function rollBackup(day: string): Promise<boolean> {
  try {
    const made = await invoke<boolean>('copy_new', { from: FILE, to: `${BACKUP_DIR}/journal-${day}.json` });
    if (made) await prune('journal-', KEEP_BACKUPS);
    return true;
  } catch {
    // a failed backup must never block a save
    return false;
  }
}

let writes: Promise<unknown> = Promise.resolve();
let journalExists = false;
let backedUpDay = '';

async function writeNow(journal: JournalData): Promise<string> {
  // a journal a newer version of the app saved while this one was open (a
  // Documents folder OneDrive keeps in step with another PC) is never written
  // over: this one would lose what that one added. Refused as a conflict, so
  // this window stops saving and keeps its own changes as a copy.
  if (journalExists) {
    const current = await readText(FILE);
    if (current !== null && newerJournal({ version: versionInFile(current) }) != null) {
      throw new JournalConflict('A newer version of Sniper Journal saved the journal.');
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  if (journalExists && backedUpDay !== today && (await rollBackup(today))) backedUpDay = today;
  await writeText(FILE, JSON.stringify(journal, null, 2));
  journalExists = true;
  return shown(FILE);
}

/** every kept copy of the journal in backups/ */
async function keptCopies(): Promise<string[]> {
  return (await list(BACKUP_DIR))
    .filter((f) => f.isFile && f.name.endsWith('.json'))
    .map((f) => f.name)
    .sort()
    .map((n) => `${BACKUP_DIR}/${n}`);
}

const sweepFiles: SweepFiles = {
  async images() {
    // a folder that cannot be listed has nothing in it that can be deleted
    const files = await list(SHOTS_DIR).catch(() => [] as Entry[]);
    return files
      .filter((f) => f.isFile && IMAGE_NAME.test(f.name))
      .map(({ name, modified, bytes }) => ({ name, modified, bytes }));
  },
  async journals() {
    return [FILE, ...(await keptCopies())];
  },
  // null for a file that is not there: a copy pruned since it was listed, or
  // a missing journal, which stops the sweep
  read: (path) => readText(path),
  remove: async (name) => {
    await remove(`${SHOTS_DIR}/${name}`);
  },
};

export const tauriStorage: JournalStorage = {
  kind: 'native',
  device: 'pc',

  async init() {
    root = await invoke<string>('journal_folder');
  },

  async readJournal(): Promise<JournalData | null> {
    const text = await readText(FILE);
    journalExists = text !== null;
    // a file that exists but cannot be read must throw, never read as empty:
    // an empty journal would be saved over it on the next change
    return text === null ? null : (JSON.parse(text) as JournalData);
  },

  location() {
    return root ? shown(FILE) : null;
  },

  writeJournal(journal: JournalData): Promise<string | null> {
    // one save at a time, so an older journal can never land after a newer one
    const run = writes.then(() => writeNow(journal));
    writes = run.catch(() => undefined);
    return run;
  },

  keepCopy(journal: JournalData, reason: CopyReason): Promise<string | null> {
    // in the same queue as saves, so the copy is of a settled journal
    const run = writes.then(async () => {
      const path = `${BACKUP_DIR}/${reason}-${copyStamp()}.json`;
      await writeText(path, JSON.stringify(journal, null, 2));
      await prune(`${reason}-`, KEEP_COPIES).catch(() => undefined);
      return shown(path);
    });
    writes = run.catch(() => undefined);
    return run;
  },

  async saveImage(blob: Blob): Promise<string> {
    const ext = imageExtension(blob.type);
    if (!ext) throw new Error(unsupportedImage());
    const name = `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}.${ext}`;
    // the bytes go as they are, not as text
    await invoke('save_image', new Uint8Array(await blob.arrayBuffer()), { headers: { 'x-name': name } });
    return name;
  },

  imageSrc(name: string): string {
    // the name comes from the journal, which a restored backup can supply, so
    // it must be a plain generated file name before it becomes part of a URL
    if (!IMAGE_NAME.test(name)) return '';
    // served by the app itself (the "chart" protocol in src-tauri/src/lib.rs)
    return convertFileSrc(name, 'chart');
  },

  async deleteImage(name: string) {
    if (!IMAGE_NAME.test(name)) return;
    await remove(`${SHOTS_DIR}/${name}`).catch(() => undefined);
  },

  findUnusedImages(inUse: string[]): Promise<UnusedImage[]> {
    return findUnused(sweepFiles, inUse);
  },

  removeUnusedImages(inUse: string[], approved: string[]): Promise<UnusedImage[]> {
    return removeUnused(sweepFiles, inUse, approved);
  },

  async exportFile(filename: string, content: string) {
    // a Save As dialog, opening on Downloads; closing it saves nothing
    await invoke('save_as', { filename: filename.replace(/[\\/:*?"<>|]/g, '-'), content });
  },

  whenClosing(save: () => void) {
    let stop: (() => void) | undefined;
    let ended = false;
    void listen('sniper://closing', async () => {
      save();
      // `save` queued its write in `writes` straight away
      await writes;
      await invoke('close_now');
    }).then((unlisten) => {
      if (ended) return unlisten();
      stop = unlisten;
      // from now on the app holds a close until the last change is saved
      void invoke('guard_close');
    });
    return () => {
      ended = true;
      stop?.();
    };
  },
};

/** The journal kept by the PC version that ran its own server */
export interface OldJournal {
  text: string;
  /** the data folder it was read from */
  folder: string;
}

/**
 * Asks for the folder of the version that ran its own server and reads its
 * journal, for the pages to restore the way they restore a backup. Null when
 * the person closed the folder picker; throws, with a message worded for
 * them, when that folder holds no journal.
 */
export function readOldJournal(): Promise<OldJournal | null> {
  return invoke<OldJournal | null>('import_old');
}

/** Copies that journal's chart images into this folder; says how many it copied */
export function copyOldImages(old: OldJournal): Promise<number> {
  return invoke<number>('import_old_images', { from: old.folder });
}
