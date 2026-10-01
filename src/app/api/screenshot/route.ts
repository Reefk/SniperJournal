import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Chart screenshots live as real image files next to your journal, in
 * data/screenshots. Keeping them out of journal.json is what stops that file
 * growing to hundreds of megabytes once you have a few hundred trades.
 */
const DIR = path.join(process.cwd(), 'data', 'screenshots');

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
  const name = safeName(new URL(request.url).searchParams.get('name'));
  if (!name) return new NextResponse('Not found', { status: 404 });

  try {
    const file = await fs.readFile(path.join(DIR, name));
    const ext = name.split('.').pop()?.toLowerCase() ?? 'png';
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': TYPES[ext] ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}

export async function POST(request: Request) {
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
      return NextResponse.json({ ok: false, error: 'Only PNG, JPEG, WebP and GIF images can be saved.' }, { status: 400 });
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
  const name = safeName(new URL(request.url).searchParams.get('name'));
  if (!name) return NextResponse.json({ ok: false, error: 'Unknown image.' }, { status: 400 });
  await fs.unlink(path.join(DIR, name)).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
