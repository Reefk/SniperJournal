import type { JournalData } from '@/lib/types';

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
   * Persist the journal, and say where it ended up — a file path on a PC, the
   * app's own folder on a phone. The Support page shows this so you always
   * know where your trades actually live. Return null when there is nothing
   * meaningful to show.
   *
   * Must be atomic enough that a crash mid-write cannot leave a half-written
   * file behind.
   */
  writeJournal(data: JournalData): Promise<string | null>;

  /** Save a chart image and return the name to store on the trade. */
  saveImage(blob: Blob, extension: string): Promise<string>;

  /**
   * A URL the webview can put in an <img src>. Synchronous on purpose: it is
   * called during render, after `init` has finished.
   */
  imageSrc(name: string): string;

  deleteImage(name: string): Promise<void>;

  /**
   * Hand the user a file: a CSV export, a JSON backup, the import template.
   * On a PC this downloads it. On a phone there is no download folder, so it
   * opens the share sheet instead.
   */
  exportFile(filename: string, content: string, mimeType: string): Promise<void>;
}

/** Thrown when storage is unavailable, so callers can say something useful. */
export class StorageUnavailable extends Error {}
