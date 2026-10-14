/**
 * The kinds of image a chart can be saved as, by the extension its file gets.
 * One list for the trade form, the PC's server and the phone, so none of them
 * can take an image another refuses. Each checks the image's own type, never
 * a name or extension handed to it. A JPEG is saved as .jpg.
 */
const TYPES = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
  ['gif', 'image/gif'],
]);

export const UNSUPPORTED_IMAGE = 'Only PNG, JPEG, WebP and GIF images can be saved.';

/** the extension an image of this type is saved with; null for one that cannot be saved */
export function imageExtension(type: string): string | null {
  for (const [ext, t] of TYPES) if (t === type) return ext;
  return null;
}

/** the type of a saved image, from its name; null for an extension that is never saved */
export function imageType(name: string): string | null {
  return TYPES.get(name.slice(name.lastIndexOf('.') + 1).toLowerCase()) ?? null;
}
