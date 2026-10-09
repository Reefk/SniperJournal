import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { JournalData } from '@/lib/types';
import type { JournalStorage } from './types';

/**
 * The phone implementation: the journal and its chart images live in the
 * app's own private folder (Directory.Data), the same layout the desktop
 * keeps in its data folder:
 *
 *   journal.json        the whole journal
 *   backups/            one copy per day, the last 30 kept
 *   screenshots/        chart images, referenced by name from each trade
 *
 * Nothing here is visible to other apps, and uninstalling the app deletes it,
 * which is why the backup export matters on a phone.
 */

const FILE = 'journal.json';
const TMP = 'journal.tmp';
const BACKUP_DIR = 'backups';
const SHOTS_DIR = 'screenshots';
const KEEP_BACKUPS = 30;

const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** file:// URI of Directory.Data, resolved once in init() */
let baseUri = '';

const data = { directory: Directory.Data };

async function exists(path: string): Promise<boolean> {
  try {
    await Filesystem.stat({ path, ...data });
    return true;
  } catch {
    return false;
  }
}

async function readText(path: string): Promise<string> {
  const { data: text } = await Filesystem.readFile({ path, encoding: Encoding.UTF8, ...data });
  return typeof text === 'string' ? text : await text.text();
}

/**
 * One copy per day, oldest pruned, so a bad edit is always recoverable.
 * Says whether today's copy is in place, so it is only looked for once a day.
 */
async function rollBackup(day: string): Promise<boolean> {
  try {
    const target = `${BACKUP_DIR}/journal-${day}.json`;
    if (await exists(target)) return true; // today's snapshot already exists
    await Filesystem.mkdir({ path: BACKUP_DIR, recursive: true, ...data }).catch(() => undefined);
    await Filesystem.copy({ from: FILE, to: target, directory: Directory.Data, toDirectory: Directory.Data });

    const { files } = await Filesystem.readdir({ path: BACKUP_DIR, ...data });
    const names = files
      .map((f) => f.name)
      .filter((n) => n.endsWith('.json'))
      .sort();
    for (const stale of names.slice(0, Math.max(0, names.length - KEEP_BACKUPS))) {
      await Filesystem.deleteFile({ path: `${BACKUP_DIR}/${stale}`, ...data }).catch(() => undefined);
    }
    return true;
  } catch {
    // a failed backup must never block a save
    return false;
  }
}

let writes: Promise<unknown> = Promise.resolve();

// Remembered between saves so that a routine save is just two calls into
// Android, writing and renaming. A phone may suspend the app moments after it
// leaves the screen, and a short save is far more likely to finish first.
let journalExists: boolean | null = null;
let backedUpDay = '';

async function writeNow(journal: JournalData): Promise<string> {
  const hadFile = journalExists ?? (await exists(FILE));
  const today = new Date().toISOString().slice(0, 10);
  if (hadFile && backedUpDay !== today && (await rollBackup(today))) backedUpDay = today;

  // write to a temp file first so a crash mid-write cannot corrupt the journal
  await Filesystem.writeFile({ path: TMP, data: JSON.stringify(journal), encoding: Encoding.UTF8, ...data });
  try {
    await Filesystem.rename({ from: TMP, to: FILE, directory: Directory.Data, toDirectory: Directory.Data });
  } catch (err) {
    // some filesystems refuse to rename over an existing file; only then is the
    // old one removed, and only once the finished temp file is known to be there
    if (!hadFile || !(await exists(TMP))) throw err;
    await Filesystem.deleteFile({ path: FILE, ...data });
    await Filesystem.rename({ from: TMP, to: FILE, directory: Directory.Data, toDirectory: Directory.Data });
  }
  journalExists = true;

  return decodeURIComponent(`${baseUri}/${FILE}`.replace(/^file:\/\//, ''));
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image.'));
    reader.readAsDataURL(blob);
  });
}

/** only ever touch a plain generated filename, never a path */
function safeName(raw: string): string | null {
  return /^[a-z0-9]{6,40}\.(png|jpe?g|webp|gif)$/i.test(raw) ? raw : null;
}

export const capacitorStorage: JournalStorage = {
  kind: 'native',

  async init() {
    baseUri = (await Filesystem.getUri({ path: '', ...data })).uri.replace(/\/+$/, '');
  },

  async readJournal(): Promise<JournalData | null> {
    journalExists = await exists(FILE);
    if (journalExists) {
      // a file that exists but cannot be read must throw, never read as empty:
      // an empty journal would be saved over it on the next change
      return JSON.parse(await readText(FILE)) as JournalData;
    }
    // a save that stopped between removing the old file and renaming the new
    // one leaves only the finished temp file behind
    if (await exists(TMP)) {
      try {
        return JSON.parse(await readText(TMP)) as JournalData;
      } catch {
        // a temp file that was itself cut short; there was never a journal
      }
    }
    return null;
  },

  writeJournal(journal: JournalData): Promise<string | null> {
    // saves share one temp file, so they must never overlap
    const run = writes.then(() => writeNow(journal));
    writes = run.catch(() => undefined);
    return run;
  },

  async saveImage(blob: Blob, extension: string): Promise<string> {
    const ext = extension.toLowerCase();
    if (!TYPES[ext]) throw new Error('Only PNG, JPEG, WebP and GIF images can be saved.');
    const name = `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}.${ext}`;
    await Filesystem.writeFile({
      path: `${SHOTS_DIR}/${name}`,
      data: await toBase64(blob),
      recursive: true,
      ...data,
    });
    return name;
  },

  imageSrc(name: string): string {
    // the name comes from the journal, which a restored backup can supply, so
    // it must be a plain generated file name before it becomes part of a path
    if (!safeName(name)) return '';
    // a raw file:// path will not load in the webview; it has to be served by Capacitor
    return Capacitor.convertFileSrc(`${baseUri}/${SHOTS_DIR}/${name}`);
  },

  async deleteImage(name: string) {
    if (!safeName(name)) return;
    await Filesystem.deleteFile({ path: `${SHOTS_DIR}/${name}`, ...data }).catch(() => undefined);
  },

  async exportFile(filename: string, content: string) {
    // there is no downloads folder to drop a file into; the share sheet is the
    // phone's way of handing a file to Drive, email, Files and so on
    const { uri } = await Filesystem.writeFile({
      path: filename.replace(/[\\/:*?"<>|]/g, '-'),
      data: content,
      encoding: Encoding.UTF8,
      directory: Directory.Cache,
    });
    try {
      await Share.share({ title: filename, files: [uri], dialogTitle: `Save or send ${filename}` });
    } catch {
      // closing the share sheet without picking anything is not an error
    }
  },
};
