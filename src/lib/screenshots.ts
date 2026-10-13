import { storage } from './storage';
import type { UnusedImage } from './storage/sweep';
import type { Trade } from './types';

/** Where the app serves a saved chart image from */
export function screenshotSrc(name: string): string {
  return storage.imageSrc(name);
}

/**
 * Shrinks a screenshot before it is saved. A full-screen chart capture is
 * often several megabytes; 1800px wide is more than enough to read a chart,
 * and keeps the data folder a sensible size over hundreds of trades.
 */
async function shrink(file: File): Promise<Blob> {
  const MAX_EDGE = 1800;
  if (file.type === 'image/gif') return file; // animation would be lost

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88));
    if (blob && blob.size < file.size) return blob;
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    return jpeg && jpeg.size < file.size ? jpeg : file;
  } catch {
    return file;
  }
}

export interface UploadResult {
  name?: string;
  error?: string;
}

/** Saves an image into the screenshots folder and returns the name to store on the trade */
export async function uploadScreenshot(file: File): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) return { error: 'That file is not an image.' };

  const blob = await shrink(file);
  const ext =
    blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : blob.type === 'image/gif' ? 'gif' : 'jpg';

  try {
    return { name: await storage.saveImage(blob, ext) };
  } catch (err) {
    // a plain Error carries the storage's own explanation; anything else
    // (a failed fetch, an unreadable reply) means the folder was unreachable
    if (err instanceof Error && err.name === 'Error' && err.message) return { error: err.message };
    return { error: 'Images can only be saved while the app can reach its data folder.' };
  }
}

/**
 * The chart images that only the trades being removed use, and so can go with
 * them. An image another remaining trade still shows is kept.
 */
export function imagesOnlyIn(removed: readonly Trade[], remaining: readonly Trade[]): string[] {
  const stillShown = new Set(remaining.map((t) => t.screenshotFile));
  const names = removed.map((t) => t.screenshotFile).filter((n): n is string => Boolean(n) && !stillShown.has(n));
  return [...new Set(names)];
}

/**
 * The chart images that only the generated test trades use, attached by hand
 * to one of them, so they go when the test data does.
 */
export function chartsOnlyInSample(trades: readonly Trade[]): string[] {
  return imagesOnlyIn(
    trades.filter((t) => t.isSample),
    trades.filter((t) => !t.isSample),
  );
}

/**
 * Which chart images to delete when the trade form closes. Nothing is deleted
 * while it is open, so Cancel always puts the trade back as it was.
 *
 * `uploaded` are the images added while the form was open, `original` the
 * trade's chart when the form opened, and `kept` the chart the trade has
 * now: the one saved, or after Cancel the original again. An image is
 * deleted when the trade no longer shows it, unless another trade does.
 */
export function chartsToDiscard(
  uploaded: Iterable<string>,
  original: string | undefined,
  kept: string | undefined,
  usedElsewhere: (name: string) => boolean,
): string[] {
  const out = new Set<string>();
  for (const name of uploaded) if (name !== kept) out.add(name);
  if (original && original !== kept && !usedElsewhere(original)) out.add(original);
  return [...out];
}

export async function deleteScreenshot(name: string): Promise<void> {
  try {
    await storage.deleteImage(name);
  } catch {
    // an orphaned file is harmless; Settings can reclaim it later
  }
}

/** the chart images some trades show, each once */
function shownBy(trades: readonly Trade[]): string[] {
  return [...new Set(trades.map((t) => t.screenshotFile).filter((n): n is string => Boolean(n)))];
}

/**
 * The chart images nothing uses any more, with their sizes: no trade in
 * `trades` (the journal open here), the saved journal or any copy in backups
 * mentions them, and none was added in the last day. See lib/storage/sweep.ts.
 * Throws, with a message worded for the person, when the journal or a copy
 * cannot be read or is not a whole journal.
 */
export function findUnusedCharts(trades: readonly Trade[]): Promise<UnusedImage[]> {
  return storage.findUnusedImages(shownBy(trades));
}

/**
 * Deletes those of `approved` (the images the person was shown) that are
 * still unused, looked for afresh, and says which went.
 */
export function removeUnusedCharts(trades: readonly Trade[], approved: readonly string[]): Promise<UnusedImage[]> {
  return storage.removeUnusedImages(shownBy(trades), [...approved]);
}

/** Pulls the first image out of a paste or a drop */
export function imageFromTransfer(items: DataTransferItemList | null | undefined): File | null {
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}
