/**
 * Chart images that nothing uses any more: left by a trade form closed without
 * Save or Cancel (the app was shut, a phone killed it), by a delete that
 * failed, or by a version of the app from before charts went with their
 * trades. Settings → "Reclaim unused chart images" finds and deletes them.
 * Shared by the desktop server and the phone, which each supply the file
 * operations.
 *
 * An image stays when anything could still show it:
 *   - a trade in the journal open in the window asking (`inUse`)
 *   - the saved journal, or any copy kept in backups (daily, before a restore
 *     or an erase, or after a conflict), which are searched for its name
 *   - it was saved in the last day: a trade form in another window may hold
 *     it, not yet saved
 * Names are compared ignoring case, as Windows does. When the journal or a
 * copy cannot be read, or is not a whole journal (cut short, say), what it
 * refers to cannot be known, so nothing is deleted.
 */

/** how long a new image is left alone, whatever refers to it */
export const SWEEP_GRACE_MS = 24 * 60 * 60 * 1000;

/** a name the app gives an image; no other file in the folder is ever touched */
export const IMAGE_NAME = /^[a-z0-9]{6,40}\.(png|jpe?g|webp|gif)$/i;

/** an image name anywhere inside a piece of text */
const MENTIONED = /[a-z0-9]{6,40}\.(?:png|jpe?g|webp|gif)/gi;

export interface StoredImage {
  name: string;
  /** last modified, in milliseconds since 1970 */
  modified: number;
  bytes: number;
}

export interface UnusedImage {
  name: string;
  bytes: number;
}

export interface SweepFiles {
  /** the images in the screenshots folder */
  images(): Promise<StoredImage[]>;
  /**
   * The journal file first, then every kept copy of it. The journal is listed
   * even when it is missing: reading it then fails, and so nothing is deleted.
   * Throws when the backups folder is there but cannot be listed.
   */
  journals(): Promise<string[]>;
  /**
   * A file's text. Null only for a kept copy that was deleted since it was
   * listed (a save prunes old backups); anything else that fails throws.
   */
  read(journal: string): Promise<string | null>;
  remove(image: string): Promise<void>;
}

/**
 * Why the search stopped before anything was deleted, worded for the person
 * using the app. Every failure of `findUnused` is one of these.
 */
export class SweepError extends Error {}

const NOTHING = 'so no chart image was deleted';
const lower = (name: string) => name.toLowerCase();
const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;

async function attempt<T>(task: () => Promise<T>, failure: string): Promise<T> {
  try {
    return await task();
  } catch {
    throw new SweepError(`${failure}, ${NOTHING}.`);
  }
}

/** every image name a journal mentions anywhere, lower-case; null when it is not whole JSON */
function mentionsIn(text: string): Set<string> | null {
  const names = new Set<string>();
  try {
    JSON.parse(text, (_key, value: unknown) => {
      if (typeof value === 'string') for (const m of value.matchAll(MENTIONED)) names.add(lower(m[0]));
      return value;
    });
  } catch {
    return null;
  }
  return names;
}

/**
 * The images with a name the app gives, old enough to go, that the journal in
 * `inUse` (lower-case names) does not show.
 */
export function sweepCandidates(
  images: readonly StoredImage[],
  inUse: ReadonlySet<string>,
  now: number,
): StoredImage[] {
  return images.filter(
    (i) => IMAGE_NAME.test(i.name) && !inUse.has(lower(i.name)) && now - i.modified >= SWEEP_GRACE_MS,
  );
}

/**
 * The images nothing uses, with their sizes. Each journal and copy is read
 * once. Throws a SweepError when one cannot be read or is not whole.
 */
export async function findUnused(files: SweepFiles, inUse: Iterable<string>, now = Date.now()): Promise<UnusedImage[]> {
  const shown = new Set([...inUse].map(lower));
  let unused = sweepCandidates(
    await attempt(() => files.images(), 'The screenshots folder could not be read'),
    shown,
    now,
  );
  if (!unused.length) return [];

  const journals = await attempt(() => files.journals(), 'The backups folder could not be read');
  if (!journals.length) throw new SweepError(`Your journal file could not be read, ${NOTHING}.`);
  for (const [i, journal] of journals.entries()) {
    const what = i === 0 ? 'Your journal file' : `The backup ${fileName(journal)}`;
    const text = await attempt(() => files.read(journal), `${what} could not be read`);
    if (text === null) {
      // a copy deleted since it was listed protects nothing; the journal must be there
      if (i === 0) throw new SweepError(`${what} could not be read, ${NOTHING}.`);
      continue;
    }
    const mentioned = mentionsIn(text);
    if (!mentioned) throw new SweepError(`${what} is damaged (it is not a complete journal), ${NOTHING}.`);
    unused = unused.filter((image) => !mentioned.has(lower(image.name)));
    if (!unused.length) return [];
  }
  return unused.map(({ name, bytes }) => ({ name, bytes }));
}

/**
 * Deletes those of `approved` (the images the person was shown and agreed
 * to) that are still unused, looked for afresh, and returns those that went.
 * Like `findUnused`, it deletes nothing when a journal cannot be read.
 */
export async function removeUnused(
  files: SweepFiles,
  inUse: Iterable<string>,
  approved: Iterable<string>,
  now = Date.now(),
): Promise<UnusedImage[]> {
  const agreed = new Set([...approved].map(lower));
  const removed: UnusedImage[] = [];
  for (const image of await findUnused(files, inUse, now)) {
    if (!agreed.has(lower(image.name))) continue;
    try {
      await files.remove(image.name);
      removed.push(image);
    } catch {
      // left for next time
    }
  }
  return removed;
}
