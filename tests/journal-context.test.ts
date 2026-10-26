// @vitest-environment jsdom
import { act, createElement as h, useMemo } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Setup, Trade } from '@/lib/types';
import { JournalProvider, useJournal, useSaveState } from '@/store/JournalProvider';
import { language, setLanguage, tr, type Language } from '@/lib/i18n';
import { LANGUAGE_KEY } from '@/store/language';
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
    device: 'pc',
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

describe("rule ticks follow their setup's rules", () => {
  const orb: Setup = { id: 'orb', name: 'ORB', rules: ['Wait', 'Retest'] };
  const ticksOf = () => seen.journal!.accountTrades.map((t) => t.ruleChecks);
  const madeFor = () => seen.journal!.accountTrades.map((t) => t.ruleChecksSetupId);

  beforeEach(async () => {
    const ids = seen.journal!.accountTrades.map((t) => t.id);
    await act(async () => seen.journal!.actions.upsertSetup(orb));
    await act(async () =>
      seen.journal!.actions.patchTrades(ids, { setupId: orb.id, ruleChecks: { Wait: true, Retest: false } }),
    );
    expect(ticksOf()).toEqual([
      { Wait: true, Retest: false },
      { Wait: true, Retest: false },
    ]);
  });

  it('a reworded rule keeps its ticks', async () => {
    const renamed = new Map([['Wait', 'Wait 15 minutes']]);
    await act(async () => seen.journal!.actions.upsertSetup({ ...orb, rules: ['Wait 15 minutes', 'Retest'] }, renamed));
    expect(ticksOf()).toEqual([
      { 'Wait 15 minutes': true, Retest: false },
      { 'Wait 15 minutes': true, Retest: false },
    ]);
  });

  it('a bulk edit to another setup drops them; one that leaves the setup alone keeps them', async () => {
    const [first, second] = seen.journal!.accountTrades.map((t) => t.id);
    await act(async () => seen.journal!.actions.patchTrades([first], { setupId: undefined }));
    await act(async () => seen.journal!.actions.patchTrades([second], { tags: ['news'], setupId: orb.id }));
    expect(ticksOf()).toEqual([undefined, { Wait: true, Retest: false }]);
  });

  it('a change of setup that brings its own ticks keeps those', async () => {
    const vwap: Setup = { id: 'vwap', name: 'VWAP', rules: ['Volume'] };
    const [first] = seen.journal!.accountTrades.map((t) => t.id);
    await act(async () => seen.journal!.actions.upsertSetup(vwap));
    await act(async () =>
      seen.journal!.actions.patchTrades([first], { setupId: vwap.id, ruleChecks: { Volume: false } }),
    );
    expect(ticksOf()[0]).toEqual({ Volume: false });
  });

  it('deleting the setup drops them', async () => {
    await act(async () => seen.journal!.actions.deleteSetup(orb.id));
    expect(ticksOf()).toEqual([undefined, undefined]);
    expect(madeFor()).toEqual([undefined, undefined]);
  });

  it('are saved with the setup they were made against, which goes when they do', async () => {
    const vwap: Setup = { id: 'vwap', name: 'VWAP', rules: ['Volume'] };
    const [first, second] = seen.journal!.accountTrades.map((t) => t.id);
    expect(madeFor()).toEqual([orb.id, orb.id]);
    await act(async () => seen.journal!.actions.upsertSetup(vwap));
    await act(async () =>
      seen.journal!.actions.patchTrades([first], { setupId: vwap.id, ruleChecks: { Volume: false } }),
    );
    await act(async () => seen.journal!.actions.patchTrades([second], { setupId: vwap.id }));
    expect(madeFor()).toEqual([vwap.id, undefined]);
  });

  it("a trade the form saves has its ticks' setup, and loses it with them", async () => {
    await act(async () =>
      seen.journal!.actions.addTrade(trade({ accountId: 'acc1', setupId: orb.id, ruleChecks: { Wait: true } })),
    );
    expect(madeFor()).toEqual([orb.id, orb.id, orb.id]);
    // the form takes the ticks away with the setup
    const [first] = seen.journal!.accountTrades;
    await act(async () =>
      seen.journal!.actions.updateTrade(first.id, { ...first, setupId: undefined, ruleChecks: undefined }),
    );
    expect(seen.journal!.accountTrades.find((t) => t.id === first.id)?.ruleChecksSetupId).toBeUndefined();
    expect(madeFor().filter((id) => id === orb.id)).toHaveLength(2);
  });
});

describe('the language', () => {
  afterEach(() => setLanguage('en'));
  const speak = async (code: Language) => {
    await act(async () => seen.journal!.actions.updateSettings({ language: code }));
    await until(() => language().code === code && seen.journal!.data.settings.language === code);
  };
  const backup = (settings: Partial<JournalData['settings']>): JournalData => ({
    ...seen.journal!.data,
    settings: { ...seen.journal!.data.settings, language: undefined, ...settings },
  });

  it('chosen, is spoken and saved, and remembered for the next opening', async () => {
    await speak('ru');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('ru');
    await speak('en');
    expect(localStorage.getItem(LANGUAGE_KEY)).toBeNull();
  });

  it('stays when a backup saved without one is restored, and is the one a backup has', async () => {
    await speak('es');
    await act(async () => seen.journal!.actions.replaceAll(backup({})));
    expect(seen.journal!.data.settings.language).toBe('es');
    await act(async () => seen.journal!.actions.replaceAll(backup({ language: 'hi' })));
    await until(() => language().code === 'hi');
  });

  it('stays when everything is erased, and the new account is named in it', async () => {
    await speak('ru');
    await act(async () => seen.journal!.actions.resetAll());
    await until(() => seen.journal!.data.accounts.length === 1);
    expect(seen.journal!.data.settings.language).toBe('ru');
    expect(seen.journal!.data.accounts[0].name).toBe(tr('welcome.defaultAccount'));
    expect(seen.journal!.data.accounts[0].name).not.toBe('Main');
  });
});

describe('the mistake list', () => {
  const mistakesOf = () => seen.journal!.data.trades.map((t) => t.mistakes);

  it('saved with a mistake renamed, renames it on every trade, in every account', async () => {
    const ids = seen.journal!.data.trades.map((t) => t.id);
    await act(async () => seen.journal!.actions.patchTrades(ids.slice(0, 2), { mistakes: ['Oversized', 'No stop'] }));
    await act(async () => seen.journal!.actions.patchTrades(ids.slice(2), { mistakes: ['Oversized'] }));
    await act(async () =>
      seen.journal!.actions.saveMistakes(['Too big', 'No stop'], new Map([['Oversized', 'Too big']])),
    );
    expect(seen.journal!.data.settings.mistakes).toEqual(['Too big', 'No stop']);
    expect(mistakesOf()).toEqual([['Too big', 'No stop'], ['Too big', 'No stop'], ['Too big']]);
  });

  it('saved without a mistake, leaves the trades that made it as they are', async () => {
    const [first] = seen.journal!.data.trades.map((t) => t.id);
    await act(async () => seen.journal!.actions.patchTrades([first], { mistakes: ['Oversized'] }));
    await act(async () => seen.journal!.actions.saveMistakes(['No stop']));
    expect(seen.journal!.data.settings.mistakes).toEqual(['No stop']);
    expect(mistakesOf()).toEqual([['Oversized'], undefined, undefined]);
  });
});
