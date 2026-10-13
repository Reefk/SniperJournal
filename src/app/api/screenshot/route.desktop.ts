import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { refuseForeign } from '../local-only';
import { findUnused, removeUnused, type StoredImage, type SweepFiles } from '@/lib/storage/sweep';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Chart screenshots live as real image files next to your journal, in
 * data/screenshots. Keeping them out of journal.json is what stops that file
 * growing to hundreds of megabytes once you have a few hundred trades.
 */
const DATA_DIR = path.join(process.cwd(), 'data');
const DIR = path.join(DATA_DIR, 'screenshots');
/** what is searched for images still referred to (see /api/journal) */
const JOURNAL = path.join(DATA_DIR, 'journal.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

const MAX_BYTES = 8 * 1024 * 1024;

/** only ever touch a plain generated filename, never a path from the client */
function safeName(raw: string | null): string | null {
  if (!raw) return null;
  return /^[a-z0-9]{6,40}\.(png|jpe?g|webp|gif)$/i.test(raw) ? raw : null;
}

export async function GET(request: Request) {
  const refused = refuseForeign(request);
  if (refused) return refused;
  const name = safeName(new URL(request.url).searchParams.get('name'));
  if (!name) return new NextResponse('Not found', { status: 404 });

  try {
    const file = await fs.readFile(path.join(DIR, name));
    const ext = name.split('.').pop()?.toLowerCase() ?? 'png';
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': TYPES[ext] ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=31536000, immutable',
        // the type was only ever claimed by whoever uploaded it; never let a
        // browser second-guess it into something runnable such as HTML
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}

/** a folder's entries, none when it doesn't exist; any other failure throws */
async function entries(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

const sweepFiles: SweepFiles = {
  async images() {
    const out: StoredImage[] = [];
    for (const name of await entries(DIR)) {
      if (!safeName(name)) continue;
      const stat = await fs.stat(path.join(DIR, name)).catch(() => null);
      if (stat?.isFile()) out.push({ name, modified: stat.mtimeMs, bytes: stat.size });
    }
    return out;
  },
  async journals() {
    const copies = (await entries(BACKUP_DIR)).filter((f) => f.endsWith('.json')).sort();
    return [JOURNAL, ...copies.map((f) => path.join(BACKUP_DIR, f))];
  },
  read: (file) => fs.readFile(file, 'utf8'),
  remove: (name) => fs.unlink(path.join(DIR, name)),
};

/**
 * POST /api/screenshot?unused, sent { inUse: [names] }: the images nothing
 * uses any more, with their sizes (see lib/storage/sweep.ts). Sent
 * { inUse, remove: true } it deletes them, and answers with those that went.
 */
async function unused(request: Request) {
  let inUse: unknown;
  let remove = false;
  try {
    const body = (await request.json()) as { inUse?: unknown; remove?: unknown } | null;
    inUse = body?.inUse;
    remove = body?.remove === true;
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed request body.' }, { status: 400 });
  }
  if (!Array.isArray(inUse) || inUse.some((n) => typeof n !== 'string')) {
    return NextResponse.json({ ok: false, error: 'Say which images are in use.' }, { status: 400 });
  }
  try {
    const images = await (remove ? removeUnused : findUnused)(sweepFiles, inUse);
    return NextResponse.json({ ok: true, images });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not tell which chart images are still used.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const refused = refuseForeign(request);
  if (refused) return refused;
  if (new URL(request.url).searchParams.has('unused')) return unused(request);
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No image was sent.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'That image is larger than 8MB.' }, { status: 400 });
    }

    const ext = Object.keys(TYPES).find((e) => TYPES[e] === file.type);
    if (!ext) {
      return NextResponse.json(
        { ok: false, error: 'Only PNG, JPEG, WebP and GIF images can be saved.' },
        { status: 400 },
      );
    }

    await fs.mkdir(DIR, { recursive: true });
    const name = `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}.${ext}`;
    await fs.writeFile(path.join(DIR, name), new Uint8Array(await file.arrayBuffer()));

    return NextResponse.json({ ok: true, name });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not save the image.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const refused = refuseForeign(request);
  if (refused) return refused;
  const name = safeName(new URL(request.url).searchParams.get('name'));
  if (!name) return NextResponse.json({ ok: false, error: 'Unknown image.' }, { status: 400 });
  await fs.unlink(path.join(DIR, name)).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
