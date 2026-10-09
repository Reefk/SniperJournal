import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync, promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The desktop server's API routes, run against a throwaway folder: the
 * routes write to <working directory>/data, so the tests move there first.
 */
const home = process.cwd();
const root = mkdtempSync(join(tmpdir(), 'sj-api-'));
process.chdir(root);
afterAll(() => {
  process.chdir(home);
  rmSync(root, { recursive: true, force: true });
});

type Routes = {
  journal: typeof import('@/app/api/journal/route.desktop');
  shot: typeof import('@/app/api/screenshot/route.desktop');
};
let routes: Routes;
beforeEach(async () => {
  rmSync(join(root, 'data'), { recursive: true, force: true });
  vi.resetModules();
  routes = {
    journal: await import('@/app/api/journal/route.desktop'),
    shot: await import('@/app/api/screenshot/route.desktop'),
  };
});

const own = { host: '127.0.0.1:3000' };
const req = (path: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
  new Request(`http://127.0.0.1:3000${path}`, { ...init, headers: { ...own, ...(init.headers ?? {}) } });
const put = (body: unknown, headers: Record<string, string> = {}) =>
  routes.journal.PUT(
    req('/api/journal', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } }),
  );
const valid = (n: number) => ({ version: 1, updatedAt: `n${n}`, trades: [{ id: `t${n}` }], accounts: [] });
const file = () => JSON.parse(readFileSync(join(root, 'data', 'journal.json'), 'utf8'));

describe('/api/journal', () => {
  it('reports no journal on a first run', async () => {
    const res = await routes.journal.GET(req('/api/journal'));
    expect(await res.json()).toEqual({ ok: true, data: null });
  });

  it('saves a journal atomically and reads it back', async () => {
    const res = await put(valid(1));
    expect(res.status).toBe(200);
    expect((await res.json()).path).toBe(join(root, 'data', 'journal.json'));
    expect(file()).toEqual(valid(1));
    expect(existsSync(join(root, 'data', 'journal.json.tmp'))).toBe(false);
    expect((await (await routes.journal.GET(req('/api/journal'))).json()).data).toEqual(valid(1));
  });

  it('saves that arrive together are written one at a time: every one succeeds and the file is never mixed up', async () => {
    // a big journal takes long enough to write that the saves overlap
    const big = (n: number) => ({ ...valid(n), trades: Array.from({ length: 20000 }, (_, i) => ({ id: `t${n}-${i}`, notes: 'x'.repeat(100) })) });
    const bodies = Array.from({ length: 12 }, (_, n) => (n % 2 ? valid(n) : big(n)));
    const results = await Promise.all(bodies.map((body) => put(body)));
    expect(results.map((r) => r.status)).toEqual(bodies.map(() => 200));
    const saved = file();
    expect(bodies.some((body) => JSON.stringify(body) === JSON.stringify(saved))).toBe(true);
    expect(readdirSync(join(root, 'data')).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  describe('when something else briefly holds the journal (antivirus, OneDrive)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });
    const failing = (code: string, times: number) => {
      const rename = fsp.rename;
      let left = times;
      return vi.spyOn(fsp, 'rename').mockImplementation(async (from, to) => {
        if (left-- > 0) throw Object.assign(new Error(`${code}: rename`), { code });
        return rename(from, to);
      });
    };

    it.each(['EPERM', 'EBUSY', 'EACCES'])('a rename refused with %s is tried again, and the save goes through', async (code) => {
      await put(valid(1));
      const rename = failing(code, 2);
      const res = await put(valid(2));
      expect(res.status).toBe(200);
      expect(rename).toHaveBeenCalledTimes(3);
      expect(file()).toEqual(valid(2));
    });

    it('a file held for too long fails the save, keeps the journal as it was, and leaves no temp file', async () => {
      await put(valid(1));
      failing('EBUSY', Infinity);
      const res = await put(valid(2));
      expect(res.status).toBe(500);
      expect(file()).toEqual(valid(1));
      expect(readdirSync(join(root, 'data')).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    });

    it('any other error is not retried', async () => {
      await put(valid(1));
      const rename = failing('ENOSPC', 1);
      expect((await put(valid(2))).status).toBe(500);
      expect(rename).toHaveBeenCalledTimes(1);
      expect(file()).toEqual(valid(1));
    });

    // the real thing: Windows refuses to replace a file that another program
    // has open without delete sharing, which is how scanners open files
    it.runIf(process.platform === 'win32')('a real lock held for half a second does not fail the save', async () => {
      await put(valid(1));
      const target = join(root, 'data', 'journal.json');
      const locker = spawn('powershell', [
        '-NoProfile',
        '-Command',
        `$f = [IO.File]::Open('${target}', 'Open', 'Read', 'Read'); 'locked'; Start-Sleep -Milliseconds 500; $f.Close()`,
      ]);
      await new Promise((resolve) => locker.stdout.once('data', resolve));
      const res = await put(valid(2));
      if (locker.exitCode === null) await new Promise((resolve) => locker.once('exit', resolve));
      expect(res.status).toBe(200);
      expect(file()).toEqual(valid(2));
    }, 20000);
  });

  it('the new journal is flushed to the disk before it replaces the old one', async () => {
    await put(valid(1));
    const probe = await fsp.open(join(root, 'data', 'probe'), 'w');
    const handle = Object.getPrototypeOf(probe);
    await probe.close();
    const sync = vi.spyOn(handle, 'sync');
    const rename = vi.spyOn(fsp, 'rename');
    try {
      expect((await put(valid(2))).status).toBe(200);
      expect(sync).toHaveBeenCalled();
      expect(sync.mock.invocationCallOrder[0]).toBeLessThan(rename.mock.invocationCallOrder[0]);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it.each([
    ['malformed JSON', '{"version":1,'],
    ['the wrong version', valid(1) && { ...valid(1), version: 2 }],
    ['no trades list', { version: 1, accounts: [] }],
    ['no accounts list', { version: 1, trades: [] }],
  ])('refuses %s and leaves the saved journal alone', async (_, body) => {
    await put(valid(1));
    const res = await put(body);
    expect(res.status).toBe(400);
    expect(file()).toEqual(valid(1));
  });

  it('a corrupted journal on disk is reported as an error, not as "no journal"', async () => {
    mkdirSync(join(root, 'data'), { recursive: true });
    writeFileSync(join(root, 'data', 'journal.json'), '{"version":1,"tr');
    const res = await routes.journal.GET(req('/api/journal'));
    expect(res.status).toBe(500);
    expect((await res.json()).ok).toBe(false);
  });

  it('keeps one dated copy per day, made from the version before the first save', async () => {
    await put(valid(1));
    await put(valid(2));
    await put(valid(3));
    const backups = readdirSync(join(root, 'data', 'backups'));
    expect(backups).toHaveLength(1);
    expect(JSON.parse(readFileSync(join(root, 'data', 'backups', backups[0]), 'utf8'))).toEqual(valid(1));
  });

  it('prunes dated copies to the newest 30', async () => {
    mkdirSync(join(root, 'data', 'backups'), { recursive: true });
    for (let d = 1; d <= 31; d++) writeFileSync(join(root, 'data', 'backups', `journal-2025-12-${String(d).padStart(2, '0')}.json`), '{}');
    await put(valid(1));
    await put(valid(2));
    expect(readdirSync(join(root, 'data', 'backups'))).toHaveLength(30);
  });

  it('keeps a separate copy before a restore replaces the journal', async () => {
    await put(valid(1));
    const res = await routes.journal.POST(
      req('/api/journal?copy=before-restore', { method: 'POST', body: JSON.stringify(valid(1)), headers: { 'content-type': 'application/json' } }),
    );
    expect(res.status).toBe(200);
    const copies = readdirSync(join(root, 'data', 'backups')).filter((f) => f.startsWith('before-restore-'));
    expect(copies).toHaveLength(1);
    expect(JSON.parse(readFileSync(join(root, 'data', 'backups', copies[0]), 'utf8'))).toEqual(valid(1));
  });

  it.each([
    ['another host name (DNS rebinding)', { host: 'evil.example:3000' }],
    ['another origin', { origin: 'https://evil.example' }],
    ['a cross-site request', { 'sec-fetch-site': 'cross-site' }],
    ['an opaque origin', { origin: 'null' }],
  ])('answers nothing to %s', async (_, headers) => {
    expect((await routes.journal.GET(req('/api/journal', { headers }))).status).toBe(403);
    expect((await put(valid(9), headers)).status).toBe(403);
    expect(existsSync(join(root, 'data', 'journal.json'))).toBe(false);
  });

  it('accepts the app itself under its other loopback names', async () => {
    for (const host of ['localhost:3000', '[::1]:3000']) {
      expect((await routes.journal.GET(req('/api/journal', { headers: { host, origin: `http://${host}`, 'sec-fetch-site': 'same-origin' } }))).status).toBe(200);
    }
  });
});

describe('/api/screenshot', () => {
  const upload = (blob: Blob, name = 'chart.png', headers: Record<string, string> = {}) => {
    const form = new FormData();
    form.append('file', new File([blob], name, { type: blob.type }));
    return routes.shot.POST(req('/api/screenshot', { method: 'POST', body: form, headers }));
  };

  it('stores an image under a generated name and serves it back with a fixed type', async () => {
    const res = await upload(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }));
    const { ok, name } = await res.json();
    expect(ok).toBe(true);
    expect(name).toMatch(/^[a-z0-9]{6,40}\.png$/);
    const got = await routes.shot.GET(req(`/api/screenshot?name=${name}`));
    expect(got.headers.get('content-type')).toBe('image/png');
    expect(got.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
  });

  it('refuses types it will not serve, and anything over 8MB', async () => {
    expect((await upload(new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'x.svg')).status).toBe(400);
    expect((await upload(new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: 'image/png' }))).status).toBe(400);
  });

  it('never reads or deletes outside the screenshots folder', async () => {
    mkdirSync(join(root, 'data'), { recursive: true });
    writeFileSync(join(root, 'data', 'journal.json'), 'keep');
    for (const name of ['../journal.json', '..%2Fjournal.json', 'a/b.png', '']) {
      expect((await routes.shot.GET(req(`/api/screenshot?name=${name}`))).status).toBe(404);
      expect((await routes.shot.DELETE(req(`/api/screenshot?name=${name}`, { method: 'DELETE' }))).status).toBe(400);
    }
    expect(readFileSync(join(root, 'data', 'journal.json'), 'utf8')).toBe('keep');
  });

  it('a cross-site upload is refused before anything is written', async () => {
    const res = await upload(new Blob([new Uint8Array([1])], { type: 'image/png' }), 'x.png', { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(existsSync(join(root, 'data', 'screenshots'))).toBe(false);
  });
});
