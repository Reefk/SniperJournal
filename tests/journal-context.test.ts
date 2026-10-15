// @vitest-environment jsdom
import { act, createElement as h, useMemo } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { JournalProvider, useJournal, useSaveState } from '@/store/JournalProvider';
import { trade } from './helpers';

/**
 * What a save going through costs the pages. The status changes twice for
 * every edit ('saving', then 'saved'); only what shows it should be drawn
 * again, and nothing a page works out from the trades should be redone.
 * Rendered in jsdom against a stand-in for the PC's storage.
 */
const disk = vi.hoisted(() => ({ journal: null as unknown, writes: 0 }));
vi.mock('@/lib/storage', () => ({
  JournalConflict: class extends Error {},
  storage: {
    kind: 'web',
    async init() {},
    async readJournal() {
      return disk.journal;
    },
    version: () => null,
    location: () => 'C:\\journal\\data\\journal.json',
    async writeJournal() {
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

type Journal = ReturnType<typeof useJournal>;
let seen: { pageRenders: number; statsRuns: number; statuses: string[]; journal: Journal | null };

const rendered = (journal: Journal) => {
  seen.pageRenders += 1;
  seen.journal = journal;
};
const computed = (trades: Trade[]) => {
  seen.statsRuns += 1;
  return trades.length;
};
const status = (s: string) => seen.statuses.push(s);

/** a page: reads the journal, and works something out from its trades as every page does */
function Page({ onRender, compute }: { onRender: typeof rendered; compute: typeof computed }) {
  const journal = useJournal();
  onRender(journal);
  useMemo(() => compute(journal.accountTrades), [journal.accountTrades, compute]);
  return null;
}

/** the save indicator in the sidebar */
function Indicator({ onRender }: { onRender: typeof status }) {
  onRender(useSaveState().saveStatus);
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

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  disk.writes = 0;
  // two accounts with the first open, so the page gets a filtered list of trades
  disk.journal = {
    version: 1,
    updatedAt: '2026-10-14T09:00:00.000Z',
    onboarded: true,
    profile: { name: 'Test' },
    settings: { currency: 'USD', theme: 'dark', timezone: 'local', maxDailyLoss: null, maxTradesPerDay: null },
    accounts: [
      { id: 'acc1', name: 'Main', startingBalance: 1000, createdAt: '' },
      { id: 'acc2', name: 'Other', startingBalance: 500, createdAt: '' },
    ],
    activeAccountId: 'acc1',
    trades: [trade(), trade(), trade({ accountId: 'acc2' })],
    setups: [],
    resources: [],
  } satisfies JournalData;
  seen = { pageRenders: 0, statsRuns: 0, statuses: [], journal: null };

  root = createRoot(document.createElement('div'));
  await act(async () => {
    root.render(
      h(JournalProvider, null, h(Page, { onRender: rendered, compute: computed }), h(Indicator, { onRender: status })),
    );
  });
  await until(() => seen.journal?.ready === true);
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe('a save going through', () => {
  it('draws the save indicator again, not the pages, and works nothing out again', async () => {
    expect(seen.journal?.accountTrades).toHaveLength(2);
    seen.pageRenders = 0;
    seen.statsRuns = 0;
    seen.statuses = [];

    await act(async () => seen.journal!.actions.updateSettings({ maxTradesPerDay: 4 }));
    await until(() => disk.writes === 1 && seen.statuses.at(-1) === 'saved');

    // the edit itself: drawn once, worked out once
    expect(seen.pageRenders).toBe(1);
    expect(seen.statsRuns).toBe(1);
    // and the indicator shows the save going through
    expect(seen.statuses).toEqual(['saving', 'saved']);
  });

  it('works the trades out again when the open account changes', async () => {
    seen.statsRuns = 0;
    await act(async () => seen.journal!.actions.setActiveAccount('acc2'));
    expect(seen.journal!.accountTrades.map((t) => t.accountId)).toEqual(['acc2']);
    expect(seen.journal!.activeLabel).toBe('Other');
    expect(seen.journal!.startingBalance).toBe(500);
    expect(seen.statsRuns).toBe(1);
  });
});
