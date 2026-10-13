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
 */

/** how long a new image is left alone, whatever refers to it */
export const SWEEP_GRACE_MS = 24 * 60 * 60 * 1000;

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
  /** the images in the screenshots folder, only those with a generated name */
  images(): Promise<StoredImage[]>;
  /**
   * The journal file first, then every kept copy of it. The journal is listed
   * even when it is missing: reading it then fails, and so nothing is deleted.
   */
  journals(): Promise<string[]>;
  /** throws when the file cannot be read, which stops the search */
  read(journal: string): Promise<string>;
  remove(image: string): Promise<void>;
}

/** the images old enough to go that the journal in `inUse` does not show */
export function sweepCandidates(images: readonly StoredImage[], inUse: ReadonlySet<string>, now: number): StoredImage[] {
  return images.filter((i) => !inUse.has(i.name) && now - i.modified >= SWEEP_GRACE_MS);
}

/**
 * The images nothing uses, with their sizes. Throws when the journal or a
 * copy cannot be read: what it refers to cannot be known.
 */
export async function findUnused(files: SweepFiles, inUse: Iterable<string>, now = Date.now()): Promise<UnusedImage[]> {
  let unused = sweepCandidates(await files.images(), new Set(inUse), now);
  if (!unused.length) return [];
  for (const journal of await files.journals()) {
    const text = await files.read(journal);
    unused = unused.filter((i) => !text.includes(i.name));
    if (!unused.length) return [];
  }
  return unused.map(({ name, bytes }) => ({ name, bytes }));
}

/**
 * Deletes the images nothing uses, looked for afresh, and returns those that
 * went. Like `findUnused`, it deletes nothing when a journal cannot be read.
 */
export async function removeUnused(files: SweepFiles, inUse: Iterable<string>, now = Date.now()): Promise<UnusedImage[]> {
  const removed: UnusedImage[] = [];
  for (const image of await findUnused(files, inUse, now)) {
    try {
      await files.remove(image.name);
      removed.push(image);
    } catch {
      // left for next time
    }
  }
  return removed;
}
