import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData } from '@/lib/types';
import type { JournalStorage } from '@/lib/storage/types';

/**
 * src/lib/storage/index.ts: which storage the app runs on is known at once,
 * but only that platform's implementation is ever loaded, when the app starts
 * (init). Stand-ins replace the three implementations, each noting when the
 * storage module takes it; Capacitor and Tauri are told which platform this is.
 *
 * That only the running platform's code reaches the browser at all is a
 * property of the build, which this can't show: each implementation is
 * imported with import(), which Next.js puts in a chunk of its own (checked
 * on 2026-10-19 against the desktop build and the Android export).
 */
const env = vi.hoisted(() => {
  const loaded: string[] = [];
  /** a stand-in that logs each call; like the real ones, only web keeps versions and only Tauri holds the close */
  const fake = (name: string, kind: 'web' | 'native', device: 'pc' | 'phone') => {
    const calls: unknown[][] = [];
    const log =
      (method: string, result?: unknown) =>
      async (...args: unknown[]) => {
        calls.push([method, ...args]);
        return result;
      };
    const self = {
      kind,
      device,
      calls,
      failInit: false,
      inits: 0,
      stops: 0,
      async init() {
        self.inits += 1;
        if (self.failInit) throw new Error('the journal folder cannot be read');
      },
      readJournal: log('readJournal', null),
      location: () => `${name}-location`,
      writeJournal: log('writeJournal', `${name}-location`),
      keepCopy: log('keepCopy', `${name}-copy`),
      saveImage: log('saveImage', 'a.png'),
      imageSrc: (file: string) => `${name}:${file}`,
      deleteImage: log('deleteImage'),
      findUnusedImages: log('findUnusedImages', []),
      removeUnusedImages: log('removeUnusedImages', []),
      exportFile: log('exportFile'),
      ...(name === 'web' && { version: () => 'web-v1' }),
      ...(name === 'tauri' && {
        whenClosing(save: () => void) {
          calls.push(['whenClosing', save]);
          return () => {
            self.stops += 1;
          };
        },
      }),
    };
    return self;
  };
  // made once: Vitest keeps a mocked module's exports across resetModules
  const fakes = {
    web: fake('web', 'web', 'pc'),
    tauri: fake('tauri', 'native', 'pc'),
    capacitor: fake('capacitor', 'native', 'phone'),
  };
  /** the next load of an implementation fails, the way a chunk that can't be fetched does */
  const failLoad = { next: false };
  return { native: false, tauri: false, loaded, fakes, impl: fakes.web, failLoad };
});

vi.mock('@capacitor/core', async (original) => {
  const real = await original<typeof import('@capacitor/core')>();
  return { ...real, Capacitor: { ...real.Capacitor, isNativePlatform: () => env.native } };
});
vi.mock('@tauri-apps/api/core', async (original) => ({
  ...(await original<typeof import('@tauri-apps/api/core')>()),
  isTauri: () => env.tauri,
}));
/** what the storage module gets when it takes an implementation from its module */
const take = (name: keyof typeof env.fakes) => {
  if (env.failLoad.next) {
    env.failLoad.next = false;
    throw new Error('Failed to fetch dynamically imported module');
  }
  env.loaded.push(name);
  return env.fakes[name];
};
vi.mock('@/lib/storage/web', () => ({
  get webStorage() {
    return take('web');
  },
}));
vi.mock('@/lib/storage/tauri', () => ({
  get tauriStorage() {
    return take('tauri');
  },
}));
vi.mock('@/lib/storage/capacitor', () => ({
  get capacitorStorage() {
    return take('capacitor');
  },
}));

/** the storage module as a fresh app start on the given platform sees it */
async function startOn(platform: 'browser' | 'windows' | 'phone', { tauriToo = false } = {}): Promise<JournalStorage> {
  vi.resetModules();
  env.loaded.length = 0;
  env.failLoad.next = false;
  for (const f of Object.values(env.fakes)) {
    f.calls.length = 0;
    Object.assign(f, { failInit: false, inits: 0, stops: 0 });
  }
  env.impl = platform === 'phone' ? env.fakes.capacitor : platform === 'windows' ? env.fakes.tauri : env.fakes.web;
  env.native = platform === 'phone';
  env.tauri = platform === 'windows' || tauriToo;
  return (await import('@/lib/storage')).storage;
}
const journal = { version: 1, trades: [] } as unknown as JournalData;

beforeEach(() => {
  vi.resetModules();
});

describe('one platform, and only its storage loaded', () => {
  it.each([
    ['browser', 'web', 'pc', 'web'],
    ['windows', 'native', 'pc', 'tauri'],
    ['phone', 'native', 'phone', 'capacitor'],
  ] as const)(
    '%s: says %s on a %s before anything is loaded, and init loads %s alone',
    async (platform, kind, device, impl) => {
      const storage = await startOn(platform);
      expect(storage.kind).toBe(kind);
      expect(storage.device).toBe(device);
      expect(env.loaded).toEqual([]);
      await storage.init();
      expect(env.loaded).toEqual([impl]);
      expect(env.impl.inits).toBe(1);
    },
  );

  it('a phone that Tauri also claims is still a phone: Capacitor is asked first', async () => {
    const storage = await startOn('phone', { tauriToo: true });
    await storage.init();
    expect(env.loaded).toEqual(['capacitor']);
  });

  it('loads once however many ask at the same time, init or not', async () => {
    const storage = await startOn('browser');
    await Promise.all([storage.init(), storage.readJournal(), storage.exportFile('a.csv', '', 'text/csv')]);
    expect(env.loaded).toEqual(['web']);
    expect(env.impl.inits).toBe(1);
  });
});

describe('before init has loaded it', () => {
  it('knows no version or location and shows no image, and loads nothing to say so', async () => {
    const storage = await startOn('browser');
    expect(storage.version?.()).toBeNull();
    expect(storage.location()).toBeNull();
    expect(storage.imageSrc('a.png')).toBe('');
    expect(env.loaded).toEqual([]);
  });

  it('an asynchronous call loads it first, and goes through', async () => {
    const storage = await startOn('browser');
    await expect(storage.readJournal()).resolves.toBeNull();
    expect(env.loaded).toEqual(['web']);
    expect(env.impl.calls).toEqual([['readJournal']]);
  });
});

describe('once loaded', () => {
  it('hands every call to the implementation with its arguments, imageSrc still synchronously', async () => {
    const storage = await startOn('windows');
    await storage.init();
    const blob = new Blob(['x']);
    expect(storage.imageSrc('a.png')).toBe('tauri:a.png');
    expect(storage.location()).toBe('tauri-location');
    await expect(storage.writeJournal(journal)).resolves.toBe('tauri-location');
    await expect(storage.keepCopy(journal, 'before-erase')).resolves.toBe('tauri-copy');
    await expect(storage.saveImage(blob)).resolves.toBe('a.png');
    await storage.deleteImage('old.png');
    await storage.findUnusedImages(['a.png']);
    await storage.removeUnusedImages(['a.png'], ['b.png']);
    await storage.exportFile('trades.csv', 'x', 'text/csv');
    expect(env.impl.calls).toEqual([
      ['writeJournal', journal],
      ['keepCopy', journal, 'before-erase'],
      ['saveImage', blob],
      ['deleteImage', 'old.png'],
      ['findUnusedImages', ['a.png']],
      ['removeUnusedImages', ['a.png'], ['b.png']],
      ['exportFile', 'trades.csv', 'x', 'text/csv'],
    ]);
  });

  it('gives the version where the implementation keeps one, and none where it does not', async () => {
    const web = await startOn('browser');
    await web.init();
    expect(web.version?.()).toBe('web-v1');
    const phone = await startOn('phone');
    await phone.init();
    expect(phone.version?.()).toBeNull();
  });

  it("stays loaded when the implementation's own init fails, so a backup can still be handed over", async () => {
    const storage = await startOn('phone');
    env.impl.failInit = true;
    await expect(storage.init()).rejects.toThrow('cannot be read');
    await storage.exportFile('backup.json', '{}', 'application/json');
    expect(env.impl.calls).toEqual([['exportFile', 'backup.json', '{}', 'application/json']]);
    expect(storage.location()).toBe('capacitor-location');
    expect(env.loaded).toEqual(['capacitor']);
  });
});

describe('a storage that failed to load', () => {
  it('fails every caller waiting on it, and is tried again at the next init', async () => {
    const storage = await startOn('windows');
    env.failLoad.next = true;
    const tries = await Promise.allSettled([storage.init(), storage.init()]);
    expect(tries.map((t) => t.status)).toEqual(['rejected', 'rejected']);
    expect(storage.location()).toBeNull();
    expect(env.loaded).toEqual([]);
    await storage.init();
    expect(env.loaded).toEqual(['tauri']);
    expect(storage.location()).toBe('tauri-location');
  });
});

describe('holding the close (the Windows app)', () => {
  const closing = () => env.impl.calls.filter(([method]) => method === 'whenClosing');

  it('asked for as the app opens, before init, is passed on once the implementation has loaded', async () => {
    const storage = await startOn('windows');
    const save = () => {};
    const stop = storage.whenClosing?.(save);
    await storage.init();
    expect(closing()).toEqual([['whenClosing', save]]);
    // asked for twice at once (the close and init), loaded once
    expect(env.loaded).toEqual(['tauri']);
    stop?.();
    expect(env.impl.stops).toBe(1);
  });

  it('stopped before the implementation has loaded, is never passed on', async () => {
    const storage = await startOn('windows');
    const stop = storage.whenClosing?.(() => {});
    stop?.();
    await storage.init();
    expect(closing()).toEqual([]);
    expect(env.impl.stops).toBe(0);
  });

  it('asked for while the load fails, is passed on when init loads it on a later try', async () => {
    const storage = await startOn('windows');
    env.failLoad.next = true;
    const save = () => {};
    storage.whenClosing?.(save);
    await expect(storage.init()).rejects.toThrow('Failed to fetch');
    expect(closing()).toEqual([]);
    await storage.init();
    expect(closing()).toEqual([['whenClosing', save]]);
  });

  it('asked for once loaded, goes straight to it', async () => {
    const storage = await startOn('windows');
    await storage.init();
    const save = () => {};
    storage.whenClosing?.(save);
    expect(closing()).toEqual([['whenClosing', save]]);
  });

  it('on a platform that holds no close, does nothing and can be stopped', async () => {
    const storage = await startOn('browser');
    const stop = storage.whenClosing?.(() => {});
    await storage.init();
    expect(() => stop?.()).not.toThrow();
    const later = storage.whenClosing?.(() => {});
    expect(() => later?.()).not.toThrow();
  });
});

describe('each implementation', () => {
  it.each([
    ['@/lib/storage/web', 'webStorage', 'browser'],
    ['@/lib/storage/tauri', 'tauriStorage', 'windows'],
    ['@/lib/storage/capacitor', 'capacitorStorage', 'phone'],
  ] as const)('%s says the same kind and device as pick() does for it', async (path, name, platform) => {
    const real = await vi.importActual<Record<string, JournalStorage>>(path);
    const storage = await startOn(platform);
    expect({ kind: real[name].kind, device: real[name].device }).toEqual({
      kind: storage.kind,
      device: storage.device,
    });
  });
});
