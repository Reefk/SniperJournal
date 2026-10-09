import type { JournalData } from '@/lib/types';
import type { CopyReason, JournalStorage } from './types';

/**
 * Saves are sent one at a time, in order. Two in flight at once could finish
 * in the wrong order and leave the older journal on disk.
 */
let writes: Promise<unknown> = Promise.resolve();

async function put(data: JournalData): Promise<string | null> {
  const res = await fetch('/api/journal', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json?.ok) throw new Error(json?.error ?? 'Could not save the journal.');
  return (json.path as string) ?? null;
}

/**
 * The desktop implementation: talks to the Next.js API routes, which write
 * into the `data` folder next to the app. This is what runs when you open
 * the app in a browser on your PC.
 */
export const webStorage: JournalStorage = {
  kind: 'web',

  async init() {
    // the server is already there; nothing to resolve
  },

  async readJournal(): Promise<JournalData | null> {
    const res = await fetch('/api/journal', { cache: 'no-store' });
    const json = await res.json();
    if (!json?.ok) throw new Error(json?.error ?? 'Could not read the journal.');
    return (json.data as JournalData | null) ?? null;
  },

  writeJournal(data: JournalData): Promise<string | null> {
    const run = writes.then(() => put(data));
    writes = run.catch(() => undefined);
    return run;
  },

  async keepCopy(data: JournalData, reason: CopyReason): Promise<string | null> {
    const res = await fetch(`/api/journal?copy=${reason}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json?.ok) throw new Error(json?.error ?? 'Could not keep a copy of the journal.');
    return (json.path as string) ?? null;
  },

  async saveImage(blob: Blob, extension: string): Promise<string> {
    const form = new FormData();
    form.append('file', new File([blob], `chart.${extension}`, { type: blob.type }));
    const res = await fetch('/api/screenshot', { method: 'POST', body: form });
    const json = await res.json();
    if (!json?.ok || !json.name) throw new Error(json?.error ?? 'Could not save the image.');
    return json.name as string;
  },

  imageSrc(name: string): string {
    return `/api/screenshot?name=${encodeURIComponent(name)}`;
  },

  async deleteImage(name: string) {
    await fetch(`/api/screenshot?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
  },

  async exportFile(filename: string, content: string, mimeType: string) {
    const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
