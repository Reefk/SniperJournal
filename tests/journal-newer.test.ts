// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData } from '@/lib/types';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { MIRROR_KEY, encodeMirror } from '@/store/mirror';
import { trade } from './helpers';

/**
 * A journal saved by a newer version of the app than this one (SJ-32): this
 * version would drop what that one added, and its next save would write the
 * journal over without it. So it opens nothing and saves nothing. Rendered in
 * jsdom against a stand-in for the PC's storage.
 */
const disk = vi.hoisted(() => ({ journal: null as unknown, version: null as string | null, writes: 0, copies: 0 }));
vi.mock('@/lib/storage', () => ({
  JournalConflict: class extends Error {},
  storage: {
    kind: 'web',
    device: 'pc',
    async init() {},
    async readJournal() {
      return disk.journal;
    },
    version: () => disk.version,
    location: () => 'C:\\journal\\data\\journal.json',
    async writeJournal() {
      disk.writes += 1;
      return 'C:\\journal\\data\\journal.json';
    },
    async keepCopy() {
      disk.copies += 1;
      return null;
    },
    imageSrc: () => '',
    async deleteImage() {},
  },
}));

const journal = (overrides: Record<string, unknown> = {}) =>
  ({
    version: 1,
    updatedAt: '2026-10-14T09:00:00.000Z',
    onboarded: true,
    profile: { name: 'Test' },
    settings: { currency: 'USD', theme: 'dark', timezone: 'local', maxDailyLoss: null, maxTradesPerDay: null },
    accounts: [{ id: 'acc1', name: 'Main', startingBalance: 1000, createdAt: '' }],
    activeAccountId: 'acc1',
    trades: [trade()],
    setups: [],
    resources: [],
    ...overrides,
  }) as JournalData;
/** what a version 2 app might have written: a field this version has never heard of */
const fromVersion2 = (updatedAt = '2026-10-15T09:00:00.000Z') =>
  journal({ version: 2, updatedAt, goals: [{ id: 'g1', target: 5000 }] });

type Journal = ReturnType<typeof useJournal>;
let seen: Journal | null;
const record = (journal: Journal) => {
  seen = journal;
};
function Probe({ onRender }: { onRender: typeof record }) {
  onRender(useJournal());
  return null;
}

let root: Root;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) {
    await act(async () => {
      await sleep(20);
    });
  }
  expect(check()).toBe(true);
}
async function open() {
  root = createRoot(document.createElement('div'));
  await act(async () => root.render(h(JournalProvider, null, h(Probe, { onRender: record }))));
  await until(() => seen?.ready === true || seen?.newer != null);
}
/** an edit made anyway, and time for any save it would start (they wait 350ms) */
async function tryToChangeIt() {
  await act(async () => seen!.actions.updateSettings({ maxTradesPerDay: 4 }));
  await act(async () => {
    await sleep(600);
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  Object.assign(disk, { journal: null, version: null, writes: 0, copies: 0 });
  seen = null;
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe('a journal saved by a newer version of the app', () => {
  it('in the file: is not opened, and nothing is written over it', async () => {
    disk.journal = fromVersion2();
    await open();
    expect([seen!.newer, seen!.ready]).toEqual([2, false]);
    await tryToChangeIt();
    expect([disk.writes, disk.copies]).toEqual([0, 0]);
    expect(localStorage.getItem(MIRROR_KEY)).toBeNull();
  });

  it('in the browser’s copy, newer than the file: is not opened over it either', async () => {
    disk.journal = journal();
    const copy = encodeMirror(fromVersion2(), null, 'another-tab');
    localStorage.setItem(MIRROR_KEY, copy);
    await open();
    expect([seen!.newer, seen!.ready]).toEqual([2, false]);
    await tryToChangeIt();
    expect(disk.writes).toBe(0);
    expect(localStorage.getItem(MIRROR_KEY)).toBe(copy);
  });

  it('in the file, with another window’s changes left in the browser: they stay there, and nothing is saved, even leaving the app', async () => {
    // changes made on top of an older file: those are otherwise kept as a copy at startup
    disk.journal = fromVersion2('2026-10-15T09:00:00.000Z');
    disk.version = 'file-now';
    const copy = encodeMirror(journal({ updatedAt: '2026-10-16T09:00:00.000Z' }), 'file-before', 'another-tab');
    localStorage.setItem(MIRROR_KEY, copy);
    await open();
    expect(seen!.newer).toBe(2);
    await tryToChangeIt();
    // a phone suspending the app, or a window closing, flushes what waits to be saved
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await sleep(400);
    });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    expect([disk.writes, disk.copies]).toEqual([0, 0]);
    expect(localStorage.getItem(MIRROR_KEY)).toBe(copy);
  });

  it('this version’s own journal opens and saves as before', async () => {
    disk.journal = journal();
    await open();
    expect([seen!.newer, seen!.ready]).toEqual([null, true]);
    await tryToChangeIt();
    expect(disk.writes).toBe(1);
  });
});
