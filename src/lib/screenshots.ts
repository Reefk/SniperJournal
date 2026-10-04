import { storage } from './storage';

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

/** Saves an image into data/screenshots and returns the name to store on the trade */
export async function uploadScreenshot(file: File): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) return { error: 'That file is not an image.' };

  const blob = await shrink(file);
  const form = new FormData();
  const ext =
    blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : blob.type === 'image/gif' ? 'gif' : 'jpg';
  form.append('file', new File([blob], `chart.${ext}`, { type: blob.type }));

  try {
    const res = await fetch('/api/screenshot', { method: 'POST', body: form });
    const json = await res.json();
    if (json?.ok && json.name) return { name: json.name as string };
    return { error: json?.error ?? 'Could not save the image.' };
  } catch {
    return { error: 'Images can only be saved while the app can reach its data folder.' };
  }
}

export async function deleteScreenshot(name: string): Promise<void> {
  try {
    await storage.deleteImage(name);
  } catch {
    // an orphaned file is harmless
  }
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
