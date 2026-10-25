// @vitest-environment jsdom
import { createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { ReportsView } from '@/views/ReportsView';
import { SettingsView } from '@/views/SettingsView';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider } from '@/store/UIProvider';
import { STARTING_MISTAKES } from '@/lib/mistakes';
import { pnl } from './helpers';
import { button, click, mount, type, until } from './render';

/**
 * Mistakes where they are seen: the Reports section, over the range picked,
 * and the list editor in Settings, saving through the real journal. Rendered
 * in jsdom against a stand-in for the PC's storage.
 */
const disk = vi.hoisted(() => ({ journal: null as unknown }));
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
const rendered = (j: ReturnType<typeof useJournal>) => {
  journal = j;
};
/** hands the test the journal's own state */
function Probe({ onRender }: { onRender: typeof rendered }) {
  onRender(useJournal());
  return null;
}

/** a trade closed on `day` (YYYY-MM-DD) for `net`, with the mistakes given */
const on = (day: string, net: number, mistakes?: string[], accountId = 'acc1'): Trade =>
  pnl(net, { accountId, openedAt: `${day}T10:00`, closedAt: `${day}T11:00`, mistakes });

function journalWith(trades: Trade[], settings: Partial<JournalData['settings']> = {}): JournalData {
  return {
    version: 1,
    updatedAt: '2026-10-14T09:00:00.000Z',
    onboarded: true,
    profile: { name: 'Test' },
    settings: {
      currency: 'USD',
      theme: 'dark',
      timezone: 'local',
      maxDailyLoss: null,
      maxTradesPerDay: null,
      ...settings,
    },
    accounts: [
      { id: 'acc1', name: 'Main', startingBalance: 1000, createdAt: '' },
      { id: 'acc2', name: 'Second', startingBalance: 1000, createdAt: '' },
    ],
    // both, so Reports and the editor see every account's trades
    activeAccountId: 'all',
    trades,
    setups: [],
    resources: [],
  };
}

let app: Awaited<ReturnType<typeof mount>> | null;
async function show(view: typeof ReportsView | typeof SettingsView, data: JournalData) {
  disk.journal = data;
  app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Probe, { onRender: rendered }), h(view))));
  await until(() => journal?.ready === true);
}

beforeEach(() => {
  localStorage.clear();
  journal = null;
  app = null;
});
afterEach(async () => {
  await app?.unmount();
  vi.useRealTimers();
});

const section = () =>
  [...document.querySelectorAll('section')].find((s) => s.querySelector('h3')?.textContent === 'Mistakes') ?? null;
const text = () => section()?.textContent?.replace(/\s+/g, ' ') ?? '';
const row = (mistake: string) =>
  [...(section()?.querySelectorAll('tbody tr') ?? [])].find((tr) =>
    tr.querySelector('td')?.textContent?.startsWith(mistake),
  );
const cells = (mistake: string) => [...(row(mistake)?.querySelectorAll('td') ?? [])].map((td) => td.textContent);

describe('the Mistakes section of Reports', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 20, 12));
    await show(
      ReportsView,
      journalWith([
        // before any mistake was logged: not counted, or these would pass for clean trades
        on('2026-03-02', 400),
        on('2026-03-03', 400),
        // from here on
        on('2026-08-03', -25, ['Oversized', 'Traded the open']),
        on('2026-08-04', 50),
        on('2026-09-10', 50),
        on('2026-09-11', -25, ['Oversized'], 'acc2'),
        on('2026-10-05', -25, ['Oversized']),
        on('2026-10-06', -25, ['Oversized']),
        on('2026-10-14', 50),
        on('2026-10-15', 50, undefined, 'acc2'),
      ]),
    );
  });

  it('over every trade: counted from the first day with a mistake, each one costed against the clean trades', () => {
    expect(text()).toContain('Clean trades, with no mistake: 50% (4 of 8) since 03 Aug 2026.');
    expect(text()).toContain('This month 50% clean (2 of 4), last month 50% clean (1 of 2).');
    // (50 − −25) × 4
    expect(cells('Oversized')).toEqual(['Oversized', '4', '0%', '-$100.00', '$300.00']);
    expect(cells('Traded the open')).toEqual(['Traded the open (not on your list)', '1', '0%', '-$25.00', '—']);
    expect(text()).toContain(
      'The 4 trades with a mistake made $75.00 a trade less than the clean ones: about $300.00 in all.',
    );
    expect(text()).toContain('at the average of the clean trades (+$50.00)');
    expect(text()).toContain('Trades from before 03 Aug 2026, the first day a trade has a mistake, are not counted.');
  });

  it('over a range: only its trades, too few to cost yet', async () => {
    await click(button('30D'));
    expect(text()).toContain('Clean trades, with no mistake: 50% (2 of 4) in this range.');
    expect(cells('Oversized')).toEqual(['Oversized', '2', '0%', '-$50.00', '—']);
    expect(row('Traded the open')).toBeUndefined();
    expect(text()).not.toContain('a trade less');
  });

  it('over a range with no mistake in it: says so, and still counts its clean trades', async () => {
    await click(button('7D'));
    expect(text()).toContain('No trade in this range made a mistake.');
    expect(text()).toContain('100% (2 of 2) in this range.');
  });
});

describe('Reports before any mistake is logged', () => {
  it('says how to start, with no share or table', async () => {
    await show(ReportsView, journalWith([on('2026-10-14', 50), on('2026-10-15', -20)]));
    expect(text()).toContain('No mistakes logged yet.');
    expect(text()).not.toContain('Clean trades');
    expect(section()?.querySelector('table')).toBeNull();
  });
});

describe('editing the mistake list in Settings', () => {
  const field = (n: number) => document.querySelector<HTMLInputElement>(`input[aria-label="Mistake ${n}"]`);
  const toast = () => [...document.querySelectorAll('[role="status"]')].map((t) => t.textContent).join(' | ');
  const listed = () => [...document.querySelectorAll('ul[aria-label="Your mistakes"] li')].map((li) => li.textContent);
  const mistakesOf = (id: string) => journal?.data.trades.find((t) => t.id === id)?.mistakes;

  let fomo: Trade, big: Trade, bigToo: Trade;
  beforeEach(async () => {
    fomo = on('2026-10-01', -10, ['Entered early (FOMO)']);
    big = on('2026-10-02', -10, ['Oversized']);
    bigToo = on('2026-10-03', -10, ['Oversized', 'No stop'], 'acc2');
    await show(SettingsView, journalWith([fomo, big, bigToo]));
    expect(listed()).toEqual([...STARTING_MISTAKES]);
    await click(button('Edit the list'));
    await until(() => Boolean(field(1)));
  });

  it('a rename moves the mistake on every trade, in every account, and says how many', async () => {
    expect(field(5)?.value).toBe('Oversized');
    await type(field(5), '  Too big ');
    await click(button('Save mistakes'));
    await until(() => toast().includes('Mistakes saved, and renamed on 2 trades'));
    expect(journal?.data.settings.mistakes).toEqual(STARTING_MISTAKES.map((m) => (m === 'Oversized' ? 'Too big' : m)));
    expect(mistakesOf(big.id)).toEqual(['Too big']);
    expect(mistakesOf(bigToo.id)).toEqual(['Too big', 'No stop']);
    expect(mistakesOf(fomo.id)).toEqual(['Entered early (FOMO)']);
    expect(listed()).toContain('Too big');
  });

  it('one taken off leaves its trades as they are', async () => {
    await click(document.querySelector<HTMLElement>('button[aria-label="Remove mistake 1"]'));
    await click(button('Save mistakes'));
    await until(() => toast().includes('Mistakes saved'));
    expect(toast()).not.toContain('renamed');
    expect(journal?.data.settings.mistakes).toEqual(STARTING_MISTAKES.slice(1));
    expect(mistakesOf(fomo.id)).toEqual(['Entered early (FOMO)']);
  });

  it('all taken off is an empty list, not the starting one', async () => {
    for (let i = STARTING_MISTAKES.length; i >= 1; i--) {
      await click(document.querySelector<HTMLElement>(`button[aria-label="Remove mistake ${i}"]`));
    }
    expect(field(1)).toBeNull();
    await click(button('Save mistakes'));
    await until(() => toast().includes('Mistakes saved'));
    expect(journal?.data.settings.mistakes).toEqual([]);
    expect(document.body.textContent).toContain('The list is empty, so the trade form offers none.');
    expect(mistakesOf(big.id)).toEqual(['Oversized']);
  });
});
