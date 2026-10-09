import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { refuseForeign } from '../local-only';

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
    const files = (await fs.readdir(BACKUP_DIR)).filter((f) => f.endsWith('.json')).sort();
    for (const stale of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) {
      await fs.unlink(path.join(BACKUP_DIR, stale)).catch(() => undefined);
    }
  } catch {
    // a failed backup must never block a save
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

  const data = payload as { version?: number; trades?: unknown; accounts?: unknown };
  if (!data || data.version !== 1 || !Array.isArray(data.trades) || !Array.isArray(data.accounts)) {
    return NextResponse.json({ ok: false, error: 'That is not a valid journal payload.' }, { status: 400 });
  }

  try {
    await ensureDir(DATA_DIR);
    const existing = await fs.readFile(FILE, 'utf8').catch(() => null);
    if (existing) await rollBackup(existing);

    // write to a temp file first so a crash mid-write cannot corrupt the journal
    const serialized = JSON.stringify(data, null, 2);
    const tmp = `${FILE}.tmp`;
    await fs.writeFile(tmp, serialized, 'utf8');
    await fs.rename(tmp, FILE);

    return NextResponse.json({ ok: true, path: FILE });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not write the journal file.' }, { status: 500 });
  }
}
