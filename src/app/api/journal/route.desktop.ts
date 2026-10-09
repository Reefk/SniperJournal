import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { refuseForeign } from '../local-only';
import { COPY_REASONS, KEEP_COPIES, copyStamp, type CopyReason } from '@/lib/storage/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Your journal lives here, in plain JSON, inside the app folder on your PC. */
const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'journal.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP_BACKUPS = 30;

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/** one copy per day, oldest pruned, so a bad edit is always recoverable */
async function rollBackup(contents: string) {
  try {
    await ensureDir(BACKUP_DIR);
    const stamp = new Date().toISOString().slice(0, 10);
    const target = path.join(BACKUP_DIR, `journal-${stamp}.json`);
    try {
      await fs.access(target);
      return; // today's snapshot already exists
    } catch {
      await fs.writeFile(target, contents, 'utf8');
    }
    await prune('journal-', KEEP_BACKUPS);
  } catch {
    // a failed backup must never block a save
  }
}

/** oldest first, so only the newest `keep` files starting with `prefix` stay */
async function prune(prefix: string, keep: number) {
  const files = (await fs.readdir(BACKUP_DIR)).filter((f) => f.startsWith(prefix) && f.endsWith('.json')).sort();
  for (const stale of files.slice(0, Math.max(0, files.length - keep))) {
    await fs.unlink(path.join(BACKUP_DIR, stale)).catch(() => undefined);
  }
}

/**
 * Saves are written one at a time. Two that overlap (a slow disk, two tabs)
 * would otherwise interleave their writes and could leave a half-written
 * journal behind.
 */
let writes: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = writes.then(task);
  writes = run.catch(() => undefined);
  return run;
}

function isJournal(data: unknown): boolean {
  const d = data as { version?: number; trades?: unknown; accounts?: unknown } | null;
  return Boolean(d && d.version === 1 && Array.isArray(d.trades) && Array.isArray(d.accounts));
}

/**
 * POST /api/journal?copy=before-restore keeps a separate, dated copy of the
 * journal it is sent, before a restore or an erase replaces the real one.
 */
export async function POST(request: Request) {
  const refused = refuseForeign(request);
  if (refused) return refused;

  const reason = new URL(request.url).searchParams.get('copy') as CopyReason | null;
  if (!reason || !COPY_REASONS.includes(reason)) {
    return NextResponse.json({ ok: false, error: 'Unknown kind of copy.' }, { status: 400 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed request body.' }, { status: 400 });
  }
  if (!isJournal(payload)) {
    return NextResponse.json({ ok: false, error: 'That is not a valid journal payload.' }, { status: 400 });
  }

  try {
    await ensureDir(BACKUP_DIR);
    const target = path.join(BACKUP_DIR, `${reason}-${copyStamp()}.json`);
    await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf8');
    await prune(`${reason}-`, KEEP_COPIES);
    return NextResponse.json({ ok: true, path: target });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not keep a copy of the journal.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const refused = refuseForeign(request);
  if (refused) return refused;
  try {
    const text = await fs.readFile(FILE, 'utf8');
    return NextResponse.json({ ok: true, data: JSON.parse(text) });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ ok: true, data: null });
    }
    return NextResponse.json({ ok: false, error: 'Could not read the journal file.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const refused = refuseForeign(request);
  if (refused) return refused;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed request body.' }, { status: 400 });
  }

  const data = payload;
  if (!isJournal(data)) {
    return NextResponse.json({ ok: false, error: 'That is not a valid journal payload.' }, { status: 400 });
  }

  return oneAtATime(async () => {
    // a temp file of its own, so not even a second server on another port
    // can write into it
    const tmp = `${FILE}.${randomUUID()}.tmp`;
    try {
      await ensureDir(DATA_DIR);
      const existing = await fs.readFile(FILE, 'utf8').catch(() => null);
      if (existing) await rollBackup(existing);

      // write to a temp file first so a crash mid-write cannot corrupt the journal
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
      await fs.rename(tmp, FILE);

      return NextResponse.json({ ok: true, path: FILE });
    } catch {
      await fs.unlink(tmp).catch(() => undefined);
      return NextResponse.json({ ok: false, error: 'Could not write the journal file.' }, { status: 500 });
    }
  });
}
