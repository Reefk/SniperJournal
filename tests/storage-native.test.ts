import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData } from '@/lib/types';

/**
 * The phone's storage, against an in-memory stand-in for Capacitor's
 * Filesystem plugin that can be told to fail the way a real device can.
 */
const fs = vi.hoisted(() => {
  const files = new Map<string, string>();
  const failures = { renameOverExisting: false, writeFile: false, slowWrites: 0 };
  const key = (dir: string | undefined, path: string) => `${dir ?? 'DATA'}:${path}`;
  const notFound = (path: string) => Object.assign(new Error(`'${path}' does not exist`), { code: 'OS-PLUG-FILE-0008' });
  return { files, failures, key, notFound };
});

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA', Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    async getUri({ path }: { path: string }) {
      return { uri: `file:///data/user/0/com.sniperjournal.app/files${path ? `/${path}` : ''}` };
    },
    async stat({ path, directory }: { path: string; directory?: string }) {
      if (!fs.files.has(fs.key(directory, path))) throw fs.notFound(path);
      return { size: fs.files.get(fs.key(directory, path))?.length ?? 0 };
    },
    async readFile({ path, directory }: { path: string; directory?: string }) {
      const v = fs.files.get(fs.key(directory, path));
      if (v == null) throw fs.notFound(path);
      return { data: v };
    },
    async writeFile({ path, directory, data }: { path: string; directory?: string; data: string }) {
      if (fs.failures.slowWrites) await new Promise((r) => setTimeout(r, fs.failures.slowWrites));
      if (fs.failures.writeFile) throw new Error('No space left on device');
      fs.files.set(fs.key(directory, path), data);
      return { uri: `file:///${directory}/${path}` };
    },
    async rename({ from, to, directory }: { from: string; to: string; directory?: string }) {
      const src = fs.key(directory, from);
      const dst = fs.key(directory, to);
      if (!fs.files.has(src)) throw fs.notFound(from);
      if (fs.failures.renameOverExisting && fs.files.has(dst)) throw new Error('Destination exists');
      fs.files.set(dst, fs.files.get(src) as string);
      fs.files.delete(src);
    },
    async deleteFile({ path, directory }: { path: string; directory?: string }) {
      if (!fs.files.delete(fs.key(directory, path))) throw fs.notFound(path);
    },
    async mkdir() {},
    async copy({ from, to, directory }: { from: string; to: string; directory?: string }) {
      const v = fs.files.get(fs.key(directory, from));
      if (v == null) throw fs.notFound(from);
      fs.files.set(fs.key(directory, to), v);
      return { uri: to };
    },
    async readdir({ path, directory }: { path: string; directory?: string }) {
      const prefix = fs.key(directory, `${path}/`);
      return {
        files: [...fs.files.keys()]
          .filter((k) => k.startsWith(prefix))
          .map((k) => ({ name: k.slice(prefix.length), type: 'file', size: 0, mtime: 0, uri: k })),
      };
    },
  },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { convertFileSrc: (uri: string) => uri.replace('file://', 'https://localhost/_capacitor_file_'), isNativePlatform: () => true },
}));
const share = vi.hoisted(() => ({ calls: [] as unknown[], cancel: false }));
vi.mock('@capacitor/share', () => ({
  Share: {
    async share(options: unknown) {
      share.calls.push(options);
      if (share.cancel) throw new Error('Share canceled');
    },
  },
}));

const journal = (n: number): JournalData =>
  ({ version: 1, updatedAt: `2026-03-0${n}T00:00:00.000Z`, trades: [{ id: `t${n}` }], accounts: [] }) as unknown as JournalData;

async function freshStorage() {
  vi.resetModules();
  const { capacitorStorage } = await import('@/lib/storage/capacitor');
  await capacitorStorage.init();
  return capacitorStorage;
}

beforeEach(() => {
  fs.files.clear();
  Object.assign(fs.failures, { renameOverExisting: false, writeFile: false, slowWrites: 0 });
  share.calls.length = 0;
  share.cancel = false;
  vi.useRealTimers();
});

describe('reading the journal', () => {
  it('a first run has no journal', async () => {
    expect(await (await freshStorage()).readJournal()).toBeNull();
  });

  it('reads back what was written', async () => {
    const s = await freshStorage();
    await s.writeJournal(journal(1));
    expect(await (await freshStorage()).readJournal()).toEqual(journal(1));
  });

  it('a corrupted or truncated journal is an error, never an empty journal that would be saved over it', async () => {
    for (const bad of ['{not json', '{"version":1,"trades":[{"id":"t1"']) {
      fs.files.set('DATA:journal.json', bad);
      await expect((await freshStorage()).readJournal()).rejects.toThrow();
      expect(fs.files.get('DATA:journal.json')).toBe(bad);
    }
  });

  it('recovers a finished temp file left by a save cut off between delete and rename', async () => {
    fs.files.set('DATA:journal.tmp', JSON.stringify(journal(2)));
    expect(await (await freshStorage()).readJournal()).toEqual(journal(2));
  });

  it('ignores a half-written temp file when there was never a journal', async () => {
    fs.files.set('DATA:journal.tmp', '{"version":1,"tra');
    expect(await (await freshStorage()).readJournal()).toBeNull();
  });
});

describe('writing the journal', () => {
  it('writes through a temp file and leaves no temp file behind', async () => {
    const s = await freshStorage();
    const where = await s.writeJournal(journal(1));
    expect(where).toBe('/data/user/0/com.sniperjournal.app/files/journal.json');
    expect(fs.files.has('DATA:journal.tmp')).toBe(false);
    expect(JSON.parse(fs.files.get('DATA:journal.json') as string)).toEqual(journal(1));
  });

  it('a failed write leaves the previous journal intact', async () => {
    const s = await freshStorage();
    await s.writeJournal(journal(1));
    fs.failures.writeFile = true;
    await expect(s.writeJournal(journal(2))).rejects.toThrow('No space left');
    expect(JSON.parse(fs.files.get('DATA:journal.json') as string)).toEqual(journal(1));
  });

  it('on a filesystem that will not rename over a file, it replaces the old journal only once the new one is complete', async () => {
    const s = await freshStorage();
    await s.writeJournal(journal(1));
    fs.failures.renameOverExisting = true;
    await s.writeJournal(journal(2));
    expect(JSON.parse(fs.files.get('DATA:journal.json') as string)).toEqual(journal(2));
    expect(fs.files.has('DATA:journal.tmp')).toBe(false);
  });

  it('overlapping saves never share the temp file: the last one wins, whole', async () => {
    const s = await freshStorage();
    await s.writeJournal(journal(1));
    fs.failures.slowWrites = 5;
    await Promise.all([s.writeJournal(journal(2)), s.writeJournal(journal(3)), s.writeJournal(journal(4))]);
    expect(JSON.parse(fs.files.get('DATA:journal.json') as string)).toEqual(journal(4));
    expect(fs.files.has('DATA:journal.tmp')).toBe(false);
  });

  it('copies the previous journal aside once per day, and keeps the last 30 copies', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T09:00:00Z'));
    for (let d = 1; d <= 33; d++) fs.files.set(`DATA:backups/journal-2026-01-${String(d).padStart(2, '0')}.json`, '{}');
    const s = await freshStorage();
    await s.writeJournal(journal(1));
    await s.writeJournal(journal(2)); // creates today's copy, holding journal 1
    await s.writeJournal(journal(3)); // same day: today's copy is not replaced
    const backups = [...fs.files.keys()].filter((k) => k.startsWith('DATA:backups/')).sort();
    expect(backups).toHaveLength(30);
    expect(backups.at(-1)).toBe('DATA:backups/journal-2026-03-10.json');
    expect(JSON.parse(fs.files.get('DATA:backups/journal-2026-03-10.json') as string)).toEqual(journal(1));
  });

  it('keeps a separate copy of the journal before a restore replaces it', async () => {
    const s = await freshStorage();
    await s.writeJournal(journal(1));
    const where = await s.keepCopy(journal(1), 'before-restore');
    expect(where).toMatch(/backups\/before-restore-\d{8}-\d{6}\.json$/);
    const copies = [...fs.files.keys()].filter((k) => k.includes('before-restore'));
    expect(copies).toHaveLength(1);
    expect(JSON.parse(fs.files.get(copies[0]) as string)).toEqual(journal(1));
  });
});

describe('chart images and exports', () => {
  beforeEach(() => {
    // the app runs in a WebView, which has FileReader; Node does not
    vi.stubGlobal(
      'FileReader',
      class {
        result: string | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL(blob: Blob) {
          void blob.arrayBuffer().then((b) => {
            this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;
            this.onload?.();
          });
        }
      },
    );
  });

  it('saves an image under a generated name and serves it through Capacitor', async () => {
    const s = await freshStorage();
    const name = await s.saveImage(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'png');
    expect(name).toMatch(/^[a-z0-9]{6,40}\.png$/);
    expect(fs.files.get(`DATA:screenshots/${name}`)).toBe('AQID');
    expect(s.imageSrc(name)).toBe(`https://localhost/_capacitor_file_/data/user/0/com.sniperjournal.app/files/screenshots/${name}`);
  });

  it('refuses file types it does not serve', async () => {
    await expect((await freshStorage()).saveImage(new Blob(['x']), 'svg')).rejects.toThrow(/PNG, JPEG, WebP and GIF/);
  });

  it('never turns a stored name into a path outside the screenshots folder', async () => {
    const s = await freshStorage();
    fs.files.set('DATA:journal.json', 'keep me');
    expect(s.imageSrc('../journal.json')).toBe('');
    await s.deleteImage('../journal.json');
    expect(fs.files.get('DATA:journal.json')).toBe('keep me');
  });

  it('exports through the share sheet from the cache, with a safe file name; cancelling is not an error', async () => {
    const s = await freshStorage();
    share.cancel = true;
    await s.exportFile('../../trades:2026.csv', 'a,b', 'text/csv');
    expect(fs.files.get('CACHE:..-..-trades-2026.csv')).toBe('a,b');
    expect(share.calls).toHaveLength(1);
  });
});
