// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData } from '@/lib/types';
import { SaveAnnouncer } from '@/components/layout/Sidebar';
import { JournalProvider, useJournal, useSaveState } from '@/store/JournalProvider';
import { mount, until } from './render';

/**
 * The polite live region that tells a screen reader where the journal is saved
 * (SaveAnnouncer in src/components/layout/Sidebar.tsx): a save that fails and
 * one that lands again are said, the "Saving…" of every change is not.
 * Rendered in jsdom against a stand-in for the PC's storage whose writes can
 * be made to fail.
 */
const disk = vi.hoisted(() => ({ journal: null as unknown, writes: 0, failNext: 0 }));
vi.mock('@/lib/storage', () => ({
  JournalConflict: class extends Error {},
  storage: {
    kind: 'web',
    device: 'pc',
    async init() {},
    async readJournal() {
      return disk.journal;
    },
    version: () => null,
    location: () => 'C:\\journal\\data\\journal.json',
    async writeJournal() {
      if (disk.failNext > 0) {
        disk.failNext -= 1;
        throw new Error('EBUSY: resource busy or locked');
      }
      disk.writes += 1;
      return 'C:\\journal\\data\\journal.json';
    },
    async keepCopy() {
      return null;
    },
    imageSrc: () => '',
    async deleteImage() {},
  },
}));

let journal: ReturnType<typeof useJournal> | null;
let status = '';
const rendered = (j: ReturnType<typeof useJournal>, s: string) => {
  journal = j;
  status = s;
};
function Probe({ onRender }: { onRender: typeof rendered }) {
  onRender(useJournal(), useSaveState().saveStatus);
  return null;
}

let app: Awaited<ReturnType<typeof mount>>;
/**
 * every text the live region held before its current one, in order, however
 * quickly one replaced the next (each change keeps the text it replaced)
 */
let before: string[];
/** everything the live region has said, in order, as a screen reader would hear it change */
const said = () => [...before, region()?.textContent ?? ''];
let observer: MutationObserver;
const region = () => document.querySelector('[aria-live="polite"]');

beforeEach(async () => {
  localStorage.clear();
  journal = null;
  disk.writes = 0;
  disk.failNext = 0;
  disk.journal = {
    version: 1,
    updatedAt: '2026-10-14T09:00:00.000Z',
    onboarded: true,
    profile: { name: 'Test' },
    settings: { currency: 'USD', theme: 'dark', timezone: 'local', maxDailyLoss: null, maxTradesPerDay: null },
    accounts: [{ id: 'acc1', name: 'Main', startingBalance: 1000, createdAt: '' }],
    activeAccountId: 'acc1',
    trades: [],
    setups: [],
    resources: [],
  } satisfies JournalData;
  app = await mount(h(JournalProvider, null, h(Probe, { onRender: rendered }), h(SaveAnnouncer)));
  await until(() => journal?.ready === true);
  before = [];
  observer = new MutationObserver((records) => {
    for (const m of records) {
      if (m.type === 'characterData') before.push(m.oldValue ?? '');
      else for (const node of m.removedNodes) before.push(node.textContent ?? '');
    }
  });
  const live = region();
  if (live)
    observer.observe(live, { childList: true, characterData: true, characterDataOldValue: true, subtree: true });
});
afterEach(async () => {
  observer.disconnect();
  await app.unmount();
});

describe('the save status, said to a screen reader', () => {
  it('is a polite live region that reads the whole status, starting at "Saved to disk"', () => {
    expect(region()?.getAttribute('aria-atomic')).toBe('true');
    expect(region()?.textContent).toBe('Saved to disk');
  });

  it('says nothing for an ordinary save, never "Saving…"', async () => {
    await act(async () => journal?.actions.updateSettings({ maxTradesPerDay: 4 }));
    await until(() => disk.writes === 1 && status === 'saved');
    expect(said()).toEqual(['Saved to disk']);
  });

  it('says "Saved in browser" when a save fails, then "Saved to disk" once it lands', async () => {
    disk.failNext = 1;
    await act(async () => journal?.actions.updateSettings({ maxTradesPerDay: 4 }));
    await until(() => region()?.textContent === 'Saved in browser');
    // the save is tried again after a second, and goes through
    await until(() => disk.writes === 1 && status === 'saved', 5000);
    expect(said()).toEqual(['Saved to disk', 'Saved in browser', 'Saved to disk']);
  });
});
