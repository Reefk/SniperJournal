import type { JournalData } from '@/lib/types';
import type { UnusedImage } from './sweep';

/**
 * Everything the app needs from the device it is running on.
 *
 * The rest of the codebase never touches the filesystem, the network or a
 * database directly — it goes through here. Adding a platform means writing
 * one new file that implements this interface; nothing else changes.
 *
 * Implementations live beside this file:
 *   web.ts        the Next.js server on a PC, writing data/journal.json
 *   capacitor.ts  an iPhone or Android app, writing the app's private folder
 */
export interface JournalStorage {
  /** which implementation this is, for messages that differ per platform */
  readonly kind: 'web' | 'native';

  /**
   * Called once before anything else, while the app shows its loading screen.
   * A platform that needs to resolve a base path does it here, so that
   * `imageSrc` can stay synchronous.
   */
  init(): Promise<void>;

  /** The saved journal, or null on a first run. */
  readJournal(): Promise<JournalData | null>;

  /**
   * Which version of the journal file this window last read or wrote, so the
   * browser's copy can tell whether it was made on top of the file as it is
   * now. Left out where only one window can ever write the file (a phone).
   */
  version?(): string | null;

  /**
   * Where the journal is kept (a file path on a PC, the app's folder on a
   * phone), known once it has been read; null before that.
   */
  location(): string | null;

  /**
   * Persist the journal, and say where it ended up — a file path on a PC, the
   * app's own folder on a phone. The Support page shows this so you always
   * know where your trades actually live. Return null when there is nothing
   * meaningful to show.
   *
   * Must be atomic enough that a crash mid-write cannot leave a half-written
   * file behind. Throws JournalConflict, and writes nothing, when the file
   * changed since this window last read or wrote it.
   */
  writeJournal(data: JournalData): Promise<string | null>;

  /**
   * Keep a separate, dated copy of the journal before something replaces it
   * wholesale: a restore, or erasing everything. The daily backup only holds
   * the start of the day, so without this the day's work up to that moment
   * could not be got back. Returns where the copy went, and throws when it
   * could not be made, so the caller can refuse to go ahead.
   */
  keepCopy(data: JournalData, reason: CopyReason): Promise<string | null>;

  /**
   * Save a chart image and return the name to store on the trade. Its
   * extension comes from the blob's own type; throws UNSUPPORTED_IMAGE
   * (image-types.ts) for a type that cannot be saved.
   */
  saveImage(blob: Blob): Promise<string>;

  /**
   * A URL the webview can put in an <img src>. Synchronous on purpose: it is
   * called during render, after `init` has finished.
   */
  imageSrc(name: string): string;

  deleteImage(name: string): Promise<void>;

  /**
   * The chart images nothing uses any more, with their sizes. `inUse` are the
   * images the journal open in this window shows; those the saved journal or
   * its kept copies mention, and the last day's, are in use too (sweep.ts).
   * Throws, with a message worded for the person, when the journal or a copy
   * cannot be read or is not a whole journal.
   */
  findUnusedImages(inUse: string[]): Promise<UnusedImage[]>;

  /**
   * Delete those of `approved`, the images the person was shown, that are
   * still unused, and say which went. Throws, having deleted nothing, as above.
   */
  removeUnusedImages(inUse: string[], approved: string[]): Promise<UnusedImage[]>;

  /**
   * Hand the user a file: a CSV export, a JSON backup, the import template.
   * On a PC this downloads it. On a phone there is no download folder, so it
   * opens the share sheet instead.
   */
  exportFile(filename: string, content: string, mimeType: string): Promise<void>;
}

/** why a copy was kept; also the start of its file name */
export type CopyReason = 'before-restore' | 'before-erase' | 'conflict';
export const COPY_REASONS: readonly CopyReason[] = ['before-restore', 'before-erase', 'conflict'];

/** how many copies of each kind are kept; the daily backups have their own limit */
export const KEEP_COPIES = 10;

/** 2026-10-09T12:34:56.789Z -> 20261009-123456, for a copy's file name */
export function copyStamp(now = new Date()): string {
  return now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

/**
 * Thrown when a save is refused because the journal file changed since this
 * window last read or wrote it: another tab, window or copy of the app saved
 * in between. Writing anyway would throw that work away, and trying again
 * would only be refused again.
 */
export class JournalConflict extends Error {}
