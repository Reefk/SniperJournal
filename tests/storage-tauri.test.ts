import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData } from '@/lib/types';
import { UNSUPPORTED_IMAGE } from '@/lib/storage/image-types';

/**
 * The Windows app's storage, against an in-memory stand-in for the commands
 * in src-tauri/src/lib.rs that can be told to fail the way a real disk can.
 * The commands' own rules (paths stay inside the folder, every write lands
 * whole) are tested in Rust: `cargo test` in src-tauri.
 */
const app = vi.hoisted(() => {
  const files = new Map<string, string>();
  /** last modified, where a test sets it; anything else is from 1970 */
  const mtimes = new Map<string, number>();
  const failures = { write: false, slowWrites: 0, listFails: '', readFails: '' };
  const calls: Array<{ cmd: string; args: unknown }> = [];
  const listeners = new Map<string, () => Promise<void>>();
  return { files, mtimes, failures, calls, listeners };
});

const ROOT = 'C:\\Users\\Trader\\Documents\\Sniper Journal';

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  convertFileSrc: (name: string, protocol: string) => `http://${protocol}.localhost/${encodeURIComponent(name)}`,
  async invoke(cmd: string, args: Record<string, unknown> = {}, options?: { headers?: Record<string, string> }) {
    app.calls.push({ cmd, args });
    const { files, failures } = app;
    switch (cmd) {
      case 'journal_folder':
        return ROOT;
      case 'read_text': {
        if (failures.readFails === args.path) throw 'The file could not be read.';
        return files.get(args.path as string) ?? null;
      }
      case 'write_text': {
        if (failures.slowWrites) await new Promise((r) => setTimeout(r, failures.slowWrites));
        if (failures.write) throw 'There is not enough space on the disk.';
        files.set(args.path as string, args.text as string);
        return;
      }
      case 'copy_new': {
        if (files.has(args.to as string)) return false;
        const text = files.get(args.from as string);
        if (text == null) throw 'The system cannot find the file specified.';
        files.set(args.to as string, text);
        return true;
      }
      case 'list': {
        if (failures.listFails === args.dir) throw 'The folder could not be read.';
        const prefix = `${args.dir}/`;
        return [...files.keys()]
          .filter((k) => k.startsWith(prefix))
          .map((k) => ({
            name: k.slice(prefix.length),
            isFile: true,
            modified: app.mtimes.get(k) ?? 0,
            bytes: files.get(k)?.length ?? 0,
          }));
      }
      case 'remove':
        return files.delete(args.path as string);
      case 'save_image': {
        const bytes = args as unknown as Uint8Array;
        files.set(`screenshots/${options?.headers?.['x-name']}`, [...bytes].join(','));
        return;
      }
      case 'save_as':
      case 'guard_close':
      case 'close_now':
        return null;
      default:
        throw new Error(`no command ${cmd}`);
    }
  },
}));

vi.mock('@tauri-apps/api/event', () => ({
  async listen(event: string, handler: () => Promise<void>) {
    app.listeners.set(event, handler);
    return () => app.listeners.delete(event);
  },
}));

const journal = (n: number): JournalData =>
  ({
    version: 1,
    updatedAt: `2026-03-0${n}T00:00:00.000Z`,
    trades: [{ id: `t${n}` }],
    accounts: [],
  }) as unknown as JournalData;

const onDisk = (path = 'journal.json') => JSON.parse(app.files.get(path) as string);
const called = (cmd: string) => app.calls.filter((c) => c.cmd === cmd);

async function freshStorage() {
  vi.resetModules();
  const { tauriStorage } = await import('@/lib/storage/tauri');
  await tauriStorage.init();
  return tauriStorage;
}

beforeEach(() => {
  app.files.clear();
  app.mtimes.clear();
  app.calls.length = 0;
  app.listeners.clear();
  Object.assign(app.failures, { write: false, slowWrites: 0, listFails: '', readFails: '' });
  vi.useRealTimers();
});

describe('reading the journal', () => {
  it('a first run has no journal', async () => {
    expect(await (await freshStorage()).readJournal()).toBeNull();
  });

  it('reads back what was written, from the Sniper Journal folder in Documents', async () => {
    const s = await freshStorage();
    expect(await s.writeJournal(journal(1))).toBe(`${ROOT}\\journal.json`);
    const again = await freshStorage();
    expect(await again.readJournal()).toEqual(journal(1));
    expect(again.location()).toBe(`${ROOT}\\journal.json`);
  });

  it('a corrupted or truncated journal is an error, never an empty journal that would be saved over it', async () => {
    for (const bad of ['{not json', '{"version":1,"trades":[{"id":"t1"']) {
      app.files.set('journal.json', bad);
      await expect((await freshStorage()).readJournal()).rejects.toThrow();
      expect(app.files.get('journal.json')).toBe(bad);
    }
  });

  it('a journal the disk will not give up is an error too', async () => {
    app.files.set('journal.json', JSON.stringify(journal(1)));
    app.failures.readFails = 'journal.json';
    await expect((await freshStorage()).readJournal()).rejects.toBe('The file could not be read.');
  });
});

describe('writing the journal', () => {
  it('a journal a newer version saved meanwhile (OneDrive, from another PC) is never written over', async () => {
    app.files.set('journal.json', JSON.stringify(journal(1), null, 2));
    const s = await freshStorage();
    // the class this storage throws, loaded alongside it
    const { JournalConflict } = await import('@/lib/storage/types');
    await s.readJournal();
    const newer = JSON.stringify({ ...journal(2), version: 2, goals: [] }, null, 2);
    app.files.set('journal.json', newer);
    const refused = await s.writeJournal(journal(3)).catch((err: unknown) => err);
    expect(refused).toBeInstanceOf(JournalConflict);
    expect(app.files.get('journal.json')).toBe(newer);
    // one of this version's, changed meanwhile, is saved over as before
    app.files.set('journal.json', JSON.stringify(journal(2), null, 2));
    await s.writeJournal(journal(3));
    expect(onDisk()).toEqual(journal(3));
  });

  it('writes it readable, as the PC version did', async () => {
    const s = await freshStorage();
    await s.writeJournal(journal(1));
    expect(app.files.get('journal.json')).toBe(JSON.stringify(journal(1), null, 2));
  });

  it('a failed write is an error, and the previous journal stays', async () => {
    const s = await freshStorage();
    await s.writeJournal(journal(1));
    app.failures.write = true;
    await expect(s.writeJournal(journal(2))).rejects.toMatch(/not enough space/);
    expect(onDisk()).toEqual(journal(1));
  });

  it('overlapping saves go one at a time, in order: the last one wins', async () => {
    const s = await freshStorage();
    app.failures.slowWrites = 5;
    await Promise.all([s.writeJournal(journal(2)), s.writeJournal(journal(3)), s.writeJournal(journal(4))]);
    expect(onDisk()).toEqual(journal(4));
  });

  it('copies the previous journal aside once per day, and keeps the last 30 copies', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T09:00:00Z'));
    for (let d = 1; d <= 33; d++) app.files.set(`backups/journal-2026-01-${String(d).padStart(2, '0')}.json`, '{}');
    const s = await freshStorage();
    await s.writeJournal(journal(1)); // the first journal: nothing to copy yet
    expect(app.files.has('backups/journal-2026-03-10.json')).toBe(false);
    await s.writeJournal(journal(2)); // creates today's copy, holding journal 1
    await s.writeJournal(journal(3)); // same day: today's copy is not replaced, nor looked for
    const backups = [...app.files.keys()].filter((k) => k.startsWith('backups/')).sort();
    expect(backups).toHaveLength(30);
    expect(backups.at(-1)).toBe('backups/journal-2026-03-10.json');
    expect(onDisk('backups/journal-2026-03-10.json')).toEqual(journal(1));
    expect(called('copy_new')).toHaveLength(1);
  });

  it('a backup that fails never blocks the save', async () => {
    app.files.set('journal.json', JSON.stringify(journal(1)));
    const s = await freshStorage();
    await s.readJournal();
    app.failures.listFails = 'backups';
    await s.writeJournal(journal(2));
    expect(onDisk()).toEqual(journal(2));
  });

  it('keeps a separate copy before a restore replaces the journal, and the last 10 of them', async () => {
    for (let i = 0; i < 12; i++)
      app.files.set(`backups/before-restore-20260101-0000${String(i).padStart(2, '0')}.json`, '{}');
    const s = await freshStorage();
    const where = await s.keepCopy(journal(1), 'before-restore');
    expect(where).toMatch(/^C:\\Users\\Trader\\Documents\\Sniper Journal\\backups\\before-restore-\d{8}-\d{6}\.json$/);
    const copies = [...app.files.keys()].filter((k) => k.includes('before-restore')).sort();
    expect(copies).toHaveLength(10);
    expect(onDisk(copies.at(-1))).toEqual(journal(1));
  });
});

describe('chart images and exports', () => {
  it('saves an image as its own bytes under a generated name, and serves it from the app', async () => {
    const s = await freshStorage();
    const name = await s.saveImage(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    expect(name).toMatch(/^[a-z0-9]{6,40}\.png$/);
    expect(app.files.get(`screenshots/${name}`)).toBe('1,2,3');
    expect(s.imageSrc(name)).toBe(`http://chart.localhost/${name}`);
  });

  it("goes by the image's own type: anything but PNG, JPEG, WebP and GIF is refused, and nothing is written", async () => {
    const s = await freshStorage();
    for (const type of ['image/svg+xml', 'image/avif', 'image/bmp']) {
      await expect(s.saveImage(new Blob([new Uint8Array([1])], { type }))).rejects.toThrow(UNSUPPORTED_IMAGE);
    }
    expect(called('save_image')).toEqual([]);
    expect(await s.saveImage(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }))).toMatch(/^[a-z0-9]{6,40}\.jpg$/);
  });

  it('never turns a stored name into a path or address outside the screenshots folder', async () => {
    const s = await freshStorage();
    app.files.set('journal.json', 'keep me');
    expect(s.imageSrc('../journal.json')).toBe('');
    await s.deleteImage('../journal.json');
    expect(called('remove')).toEqual([]);
    expect(app.files.get('journal.json')).toBe('keep me');
  });

  describe('reclaiming the images nothing uses', () => {
    const shot = (name: string, age = 30 * 24 * 60 * 60 * 1000) => {
      app.files.set(`screenshots/${name}`, 'x');
      app.mtimes.set(`screenshots/${name}`, Date.now() - age);
    };
    const mentioning = (...names: string[]) => JSON.stringify({ trades: names.map((n) => ({ screenshotFile: n })) });
    const left = () =>
      [...app.files.keys()]
        .filter((k) => k.startsWith('screenshots/'))
        .map((k) => k.slice(12))
        .sort();

    it('finds, then deletes, only what neither the open journal, the saved one, a kept copy nor the last day uses', async () => {
      const s = await freshStorage();
      for (const name of ['shown001.png', 'saved001.png', 'other001.webp', 'orphan01.jpg']) shot(name);
      shot('fresh001.png', 60_000);
      app.files.set('screenshots/notes.txt', 'not a name the app gives, so never touched');
      app.files.set('journal.json', mentioning('saved001.png'));
      app.files.set('backups/conflict-20261012-101500.json', mentioning('other001.webp'));
      expect(await s.findUnusedImages(['shown001.png'])).toEqual([{ name: 'orphan01.jpg', bytes: 1 }]);
      expect(await s.removeUnusedImages(['shown001.png'], ['orphan01.jpg'])).toEqual([
        { name: 'orphan01.jpg', bytes: 1 },
      ]);
      expect(left()).toEqual(['fresh001.png', 'notes.txt', 'other001.webp', 'saved001.png', 'shown001.png']);
    });

    it('with no journal file it deletes nothing', async () => {
      const s = await freshStorage();
      shot('orphan01.png');
      await expect(s.findUnusedImages([])).rejects.toThrow('Your journal file could not be read');
      expect(left()).toEqual(['orphan01.png']);
    });

    it('a backups folder that cannot be listed stops the search', async () => {
      const s = await freshStorage();
      shot('orphan01.png');
      app.files.set('journal.json', mentioning());
      app.failures.listFails = 'backups';
      await expect(s.removeUnusedImages([], ['orphan01.png'])).rejects.toThrow('The backups folder could not be read');
      expect(left()).toEqual(['orphan01.png']);
    });
  });

  it('exports through a Save As dialog, with a file name Windows accepts', async () => {
    const s = await freshStorage();
    await s.exportFile('../../trades:2026.csv', 'a,b', 'text/csv');
    expect(called('save_as')).toEqual([
      { cmd: 'save_as', args: { filename: '..-..-trades-2026.csv', content: 'a,b' } },
    ]);
  });
});

describe('closing the window', () => {
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('holds the close only once it can save, then saves the waiting change before closing', async () => {
    const s = await freshStorage();
    app.failures.slowWrites = 20;
    const save = vi.fn(() => void s.writeJournal(journal(5)));
    s.whenClosing?.(save);
    await settle();
    expect(called('guard_close')).toHaveLength(1);

    await app.listeners.get('sniper://closing')?.();
    expect(save).toHaveBeenCalledOnce();
    // closed only after the write landed
    expect(onDisk()).toEqual(journal(5));
    expect(app.calls.map((c) => c.cmd).slice(-2)).toEqual(['write_text', 'close_now']);
  });

  it('stopping before the listener is in place leaves the close alone', async () => {
    const s = await freshStorage();
    const stop = s.whenClosing?.(() => undefined);
    stop?.();
    await settle();
    expect(called('guard_close')).toEqual([]);
    expect(app.listeners.size).toBe(0);
  });
});
