import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync, utimesSync, promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UNSUPPORTED_IMAGE } from '@/lib/storage/image-types';

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
    // where it will be kept is known before the first save
    expect(await res.json()).toEqual({ ok: true, data: null, version: 'none', path: join(root, 'data', 'journal.json') });
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

  describe('two windows saving the same journal', () => {
    const get = async () => (await routes.journal.GET(req('/api/journal'))).json();
    const putOn = async (body: unknown, version: string) => {
      const res = await put(body, { 'if-match': version });
      return { status: res.status, json: await res.json() };
    };

    it('each read and save says which version of the file it saw or wrote', async () => {
      const first = await putOn(valid(1), 'none');
      expect(first.status).toBe(200);
      expect(first.json.version).toMatch(/^[0-9a-f]{32}$/);
      expect((await get()).version).toBe(first.json.version);
      const second = await putOn(valid(2), first.json.version);
      expect(second.status).toBe(200);
      expect(second.json.version).not.toBe(first.json.version);
      expect((await get()).version).toBe(second.json.version);
    });

    it('a save made on top of an older version is refused, and the file is left alone', async () => {
      const v1 = (await putOn(valid(1), 'none')).json.version;
      expect((await putOn(valid(2), v1)).status).toBe(200); // the other window saved first
      const late = await putOn(valid(3), v1);
      expect(late.status).toBe(412);
      expect(late.json).toMatchObject({ ok: false, conflict: true });
      expect(file()).toEqual(valid(2));
    });

    it('a window that saw no file yet cannot write over one that has appeared since', async () => {
      expect((await putOn(valid(1), 'none')).status).toBe(200);
      expect((await putOn(valid(2), 'none')).status).toBe(412);
      expect(file()).toEqual(valid(1));
    });

    it('of two saves made on top of the same version at the same moment, exactly one is written', async () => {
      const v1 = (await putOn(valid(1), 'none')).json.version;
      const [a, b] = await Promise.all([putOn(valid(2), v1), putOn(valid(3), v1)]);
      expect([a.status, b.status].sort()).toEqual([200, 412]);
      expect(file()).toEqual(a.status === 200 ? valid(2) : valid(3));
    });

    it('a save that names no version (a page from before versions) is still written', async () => {
      await putOn(valid(1), 'none');
      expect((await put(valid(2))).status).toBe(200);
      expect(file()).toEqual(valid(2));
    });

    it('keeps the version of a refused window as a conflict copy when asked', async () => {
      const res = await routes.journal.POST(
        req('/api/journal?copy=conflict', { method: 'POST', body: JSON.stringify(valid(5)), headers: { 'content-type': 'application/json' } }),
      );
      expect(res.status).toBe(200);
      const copies = readdirSync(join(root, 'data', 'backups')).filter((f) => f.startsWith('conflict-'));
      expect(copies).toHaveLength(1);
      expect(JSON.parse(readFileSync(join(root, 'data', 'backups', copies[0]), 'utf8'))).toEqual(valid(5));
    });
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

  it("goes by the image's own type: an AVIF, BMP or HEIC is refused, in the phone's words, whatever it is called", async () => {
    for (const type of ['image/avif', 'image/bmp', 'image/heic']) {
      const res = await upload(new Blob([new Uint8Array([1, 2, 3])], { type }), 'chart.jpg');
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe(UNSUPPORTED_IMAGE);
    }
    expect(existsSync(join(root, 'data', 'screenshots'))).toBe(false);
    // a JPEG is saved as .jpg; one saved as .jpeg is still served as a JPEG
    const { name } = await (await upload(new Blob([new Uint8Array([255, 216])], { type: 'image/jpeg' }), 'x.jpeg')).json();
    expect(name).toMatch(/^[a-z0-9]{6,40}\.jpg$/);
    writeFileSync(join(root, 'data', 'screenshots', 'older001.JPEG'), 'x');
    for (const n of [name, 'older001.JPEG']) {
      expect((await routes.shot.GET(req(`/api/screenshot?name=${n}`))).headers.get('content-type')).toBe('image/jpeg');
    }
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

  describe('reclaiming the images nothing uses', () => {
    const shots = join(root, 'data', 'screenshots');
    const backups = join(root, 'data', 'backups');
    const month = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const shot = (name: string, modified = month) => {
      mkdirSync(shots, { recursive: true });
      writeFileSync(join(shots, name), name); // as many bytes as letters in its name
      utimesSync(join(shots, name), modified, modified);
    };
    const mentioning = (...names: string[]) => JSON.stringify({ trades: names.map((n) => ({ screenshotFile: n })) });
    const unused = (body: unknown, headers: Record<string, string> = {}) =>
      routes.shot.POST(
        req('/api/screenshot?unused', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } }),
      );
    const left = () => readdirSync(shots).sort();
    const named = async (res: Response) => ((await res.json()).images as { name: string; bytes: number }[]).sort((a, b) => a.name.localeCompare(b.name));

    it('finds, with their sizes, the images neither the open journal, the saved one, a kept copy nor the last day uses', async () => {
      for (const name of ['shown001.png', 'saved001.png', 'daily001.png', 'other001.webp', 'orphan01.jpg', 'orphan002.png']) shot(name);
      shot('fresh001.png', new Date(Date.now() - 23 * 60 * 60 * 1000));
      shot('desktop.ini'); // not a name the app gives, so never touched
      writeFileSync(join(root, 'data', 'journal.json'), mentioning('saved001.png'));
      mkdirSync(backups, { recursive: true });
      writeFileSync(join(backups, 'journal-2026-10-01.json'), mentioning('daily001.png'));
      writeFileSync(join(backups, 'conflict-20261012-101500.json'), mentioning('other001.webp'));
      const everything = left();

      const found = await unused({ inUse: ['shown001.png'] });
      expect(found.status).toBe(200);
      expect(await named(found)).toEqual([
        { name: 'orphan002.png', bytes: 13 },
        { name: 'orphan01.jpg', bytes: 12 },
      ]);
      expect(left()).toEqual(everything); // finding deletes nothing

      expect(await named(await unused({ inUse: ['shown001.png'], remove: ['orphan01.jpg', 'orphan002.png'] }))).toEqual([
        { name: 'orphan002.png', bytes: 13 },
        { name: 'orphan01.jpg', bytes: 12 },
      ]);
      expect(left()).toEqual(['daily001.png', 'desktop.ini', 'fresh001.png', 'other001.webp', 'saved001.png', 'shown001.png']);
    });

    it('deletes only the images it was told to, of those still unused', async () => {
      for (const name of ['orphan01.png', 'orphan02.png', 'shown001.png']) shot(name);
      writeFileSync(join(root, 'data', 'journal.json'), mentioning());
      expect(await named(await unused({ inUse: ['shown001.png'], remove: ['orphan01.png', 'shown001.png'] }))).toEqual([
        { name: 'orphan01.png', bytes: 12 },
      ]);
      // shown001 came back into use after it was agreed to; orphan02 never was
      expect(left()).toEqual(['orphan02.png', 'shown001.png']);
    });

    it('with no journal, a damaged journal or a copy it cannot read, it says why and deletes nothing', async () => {
      shot('orphan01.png');
      const error = async (res: Response) => [res.status, (await res.json()).error];
      expect(await error(await unused({ inUse: [], remove: ['orphan01.png'] }))).toEqual([
        500,
        'Your journal file could not be read, so no chart image was deleted.',
      ]);
      writeFileSync(join(root, 'data', 'journal.json'), mentioning('orphan01.png').slice(0, 12)); // cut short
      expect(await error(await unused({ inUse: [] }))).toEqual([
        500,
        'Your journal file is damaged (it is not a complete journal), so no chart image was deleted.',
      ]);
      writeFileSync(join(root, 'data', 'journal.json'), mentioning());
      mkdirSync(join(backups, 'conflict-unreadable.json'), { recursive: true }); // a folder: reading it fails
      expect(await error(await unused({ inUse: [], remove: ['orphan01.png'] }))).toEqual([
        500,
        'The backup conflict-unreadable.json could not be read, so no chart image was deleted.',
      ]);
      expect(left()).toEqual(['orphan01.png']);
    });

    it('a backup pruned by a save while it searches is skipped; the journal itself is not', async () => {
      for (const name of ['orphan01.png', 'daily001.png']) shot(name);
      writeFileSync(join(root, 'data', 'journal.json'), mentioning());
      mkdirSync(backups, { recursive: true });
      writeFileSync(join(backups, 'journal-2026-09-01.json'), mentioning());
      writeFileSync(join(backups, 'journal-2026-10-01.json'), mentioning('daily001.png'));
      const readFile = fsp.readFile;
      const pruned = (end: string) =>
        vi.spyOn(fsp, 'readFile').mockImplementation(async (...args: Parameters<typeof fsp.readFile>) => {
          if (String(args[0]).endsWith(end)) throw Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
          return readFile(...args);
        });
      try {
        pruned('journal-2026-09-01.json');
        expect(await named(await unused({ inUse: [] }))).toEqual([{ name: 'orphan01.png', bytes: 12 }]);
        vi.restoreAllMocks();
        pruned('journal.json');
        expect((await unused({ inUse: [] })).status).toBe(500);
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('with no screenshots folder there is nothing to find', async () => {
      expect(await (await unused({ inUse: [] })).json()).toEqual({ ok: true, images: [] });
    });

    it('refuses a request that does not say which images are in use or which to delete, or comes from another site', async () => {
      shot('orphan01.png');
      writeFileSync(join(root, 'data', 'journal.json'), mentioning());
      expect((await unused({ remove: ['orphan01.png'] })).status).toBe(400);
      expect((await unused({ inUse: [1], remove: ['orphan01.png'] })).status).toBe(400);
      // "delete whatever is unused", as a page from before this change asked
      expect((await unused({ inUse: [], remove: true })).status).toBe(400);
      expect((await unused({ inUse: [], remove: ['orphan01.png'] }, { origin: 'https://evil.example' })).status).toBe(403);
      expect(left()).toEqual(['orphan01.png']);
    });
  });

  it('a cross-site upload is refused before anything is written', async () => {
    const res = await upload(new Blob([new Uint8Array([1])], { type: 'image/png' }), 'x.png', { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(existsSync(join(root, 'data', 'screenshots'))).toBe(false);
  });
});
