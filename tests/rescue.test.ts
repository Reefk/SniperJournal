import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalStorage } from '@/lib/storage/types';
import type { JournalData } from '@/lib/types';
import { encodeMirror, MIRROR_KEY } from '@/store/mirror';
import { rescueJournal, rescueTheme } from '@/store/rescue';

/**
 * The journal read for the screen shown when the app itself has crashed
 * (src/app/global-error.tsx), against stand-ins for the storage and for the
 * browser's localStorage that can each be missing, unreadable or corrupt.
 * It runs at the worst possible moment, so whatever happens it resolves.
 */
const LOCATION = 'C:\\journal\\data\\journal.json';
const disk = vi.hoisted(() => ({
  journal: null as JournalData | null,
  version: null as string | null,
  /** a phone: its storage keeps no versions, so `version` is left out */
  noVersions: false,
  /** init() or readJournal() throws, the way storage that can't start or a locked file does */
  fails: '' as '' | 'init' | 'read',
  /** where the journal is kept; null before the storage has found it */
  location: null as string | null,
}));
vi.mock('@/lib/storage', () => ({
  storage: {
    async init() {
      if (disk.fails === 'init') throw new Error('storage unavailable');
    },
    async readJournal() {
      if (disk.fails === 'read') throw new Error('EBUSY: resource busy or locked');
      return disk.journal;
    },
    get version() {
      return disk.noVersions ? undefined : () => disk.version;
    },
    location: () => disk.location,
  } satisfies Pick<JournalStorage, 'init' | 'readJournal' | 'location'> & Partial<Pick<JournalStorage, 'version'>>,
}));

const browser = { items: new Map<string, string>(), fails: false };

const journal = (updatedAt: string, symbol: string, theme = 'dark'): JournalData =>
  ({
    version: 1,
    updatedAt,
    trades: [{ id: symbol, symbol }],
    accounts: [],
    settings: { theme },
  }) as unknown as JournalData;
const onDisk = journal('2026-03-02T10:00:00.000Z', 'DISK');
const newer = journal('2026-03-02T11:00:00.000Z', 'COPY');
const older = journal('2026-03-02T09:00:00.000Z', 'OLD');

beforeEach(() => {
  disk.journal = onDisk;
  disk.version = 'v1';
  disk.noVersions = false;
  disk.fails = '';
  disk.location = LOCATION;
  browser.items.clear();
  browser.fails = false;
  vi.stubGlobal('localStorage', {
    getItem(key: string) {
      if (browser.fails) throw new DOMException('The operation is insecure.', 'SecurityError');
      return browser.items.get(key) ?? null;
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rescueJournal', () => {
  it('reads the journal file when the browser has no copy, and says where it is', async () => {
    await expect(rescueJournal()).resolves.toEqual({ journal: onDisk, location: LOCATION });
  });

  it('opens the browser copy when it is newer and was made on top of the file as it is', async () => {
    browser.items.set(MIRROR_KEY, encodeMirror(newer, 'v1', 'tab-a'));
    expect((await rescueJournal()).journal).toEqual(newer);
  });

  // the same rule the app opens with (pickJournal): a newer copy made on top
  // of an older file is a window that lost a save, and is not opened
  it('keeps the file when the newer copy was made on top of an older file', async () => {
    browser.items.set(MIRROR_KEY, encodeMirror(newer, 'v0', 'tab-a'));
    expect((await rescueJournal()).journal).toEqual(onDisk);
  });

  it('keeps the file when the copy is older than it', async () => {
    browser.items.set(MIRROR_KEY, encodeMirror(older, 'v1', 'tab-a'));
    expect((await rescueJournal()).journal).toEqual(onDisk);
  });

  it('opens a newer copy on a phone, where the file has no version to check it against', async () => {
    disk.noVersions = true;
    // a base that would lose to a versioned file: only the missing version lets it win
    browser.items.set(MIRROR_KEY, encodeMirror(newer, 'v0', 'tab-a'));
    expect((await rescueJournal()).journal).toEqual(newer);
  });

  it('opens the browser copy when the file is readable but there is none yet', async () => {
    disk.journal = null;
    browser.items.set(MIRROR_KEY, encodeMirror(older, 'v0', 'tab-a'));
    expect((await rescueJournal()).journal).toEqual(older);
  });

  it('falls back to the browser copy when the file cannot be read', async () => {
    disk.fails = 'read';
    // even one made on top of another version: there is no file to prefer
    browser.items.set(MIRROR_KEY, encodeMirror(older, 'v0', 'tab-a'));
    await expect(rescueJournal()).resolves.toEqual({ journal: older, location: LOCATION });
  });

  it('falls back to the browser copy when the storage cannot even start', async () => {
    disk.fails = 'init';
    browser.items.set(MIRROR_KEY, encodeMirror(older, 'v1', 'tab-a'));
    expect((await rescueJournal()).journal).toEqual(older);
  });

  it('resolves to no journal when there is neither a file nor a copy', async () => {
    disk.journal = null;
    await expect(rescueJournal()).resolves.toEqual({ journal: null, location: LOCATION });
  });

  it('resolves to no journal, without throwing, when neither can be read', async () => {
    disk.fails = 'read';
    browser.fails = true;
    await expect(rescueJournal()).resolves.toEqual({ journal: null, location: LOCATION });
  });

  it('reads the file when the browser has no localStorage at all', async () => {
    vi.stubGlobal('localStorage', undefined);
    expect((await rescueJournal()).journal).toEqual(onDisk);
  });

  it('resolves to no journal when the file is unreadable and there is no localStorage at all', async () => {
    vi.stubGlobal('localStorage', undefined);
    disk.fails = 'read';
    await expect(rescueJournal()).resolves.toEqual({ journal: null, location: LOCATION });
  });

  const corrupt = '{"tab":"tab-a","base":"v1","journal":{"trades":[';

  it('passes over a corrupt browser copy (not JSON) to the file', async () => {
    browser.items.set(MIRROR_KEY, corrupt);
    expect((await rescueJournal()).journal).toEqual(onDisk);
  });

  it('resolves to no journal, without throwing, when the file is unreadable and the copy corrupt', async () => {
    disk.fails = 'read';
    browser.items.set(MIRROR_KEY, corrupt);
    await expect(rescueJournal()).resolves.toEqual({ journal: null, location: LOCATION });
  });

  it('passes over a browser copy with no journal in it', async () => {
    disk.fails = 'read';
    browser.items.set(MIRROR_KEY, '{"tab":"tab-a","base":"v1","journal":null}');
    expect((await rescueJournal()).journal).toBeNull();
  });

  it('says nothing of where the journal is when the storage never found it', async () => {
    disk.fails = 'init';
    disk.location = null;
    browser.items.set(MIRROR_KEY, encodeMirror(older, 'v1', 'tab-a'));
    await expect(rescueJournal()).resolves.toEqual({ journal: older, location: null });
  });
});

describe('rescueTheme', () => {
  it('is light when the journal was last shown light', () => {
    browser.items.set(MIRROR_KEY, encodeMirror(journal('2026-03-02T10:00:00.000Z', 'A', 'light'), 'v1', 'tab-a'));
    expect(rescueTheme()).toBe('light');
  });

  it('is dark when the copy says dark, or says nothing', () => {
    browser.items.set(MIRROR_KEY, encodeMirror(onDisk, 'v1', 'tab-a'));
    expect(rescueTheme()).toBe('dark');
    browser.items.set(MIRROR_KEY, JSON.stringify({ tab: 'tab-a', base: 'v1', journal: { trades: [] } }));
    expect(rescueTheme()).toBe('dark');
  });

  it('is dark when there is no copy, or a corrupt one', () => {
    expect(rescueTheme()).toBe('dark');
    browser.items.set(MIRROR_KEY, 'not json');
    expect(rescueTheme()).toBe('dark');
  });

  it('is dark when localStorage throws', () => {
    browser.fails = true;
    expect(rescueTheme()).toBe('dark');
  });

  it('is dark when the browser has no localStorage at all', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(rescueTheme()).toBe('dark');
  });
});
