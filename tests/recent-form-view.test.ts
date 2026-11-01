// @vitest-environment jsdom
import { createElement as h, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { ReportsView } from '@/views/ReportsView';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider } from '@/store/UIProvider';
import { trade } from './helpers';
import { click, mount, until } from './render';

/**
 * Reports → Recent form: the last 10, 20 and 50 trades against the whole
 * record, drawn from the journal. Rendered in jsdom against a stand-in for the
 * PC's storage.
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
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => h('a', { href, ...rest }, children),
}));

let journal: ReturnType<typeof useJournal> | null;
const seen = (j: typeof journal) => {
  journal = j;
};
/** hands the test the journal, to tell when it has loaded */
function Probe({ onRender }: { onRender: typeof seen }) {
  onRender(useJournal());
  return null;
}

/** trades closed one a day from 1 March 2026, each for `r` R (a stop 10 below a 100 entry), or `null` with no stop */
const record = (rs: Array<number | null>, from = 0): Trade[] =>
  rs.map((r, i) => {
    const day = new Date(Date.UTC(2026, 2, 1 + from + i)).toISOString().slice(0, 10);
    return trade({
      entryPrice: 100,
      stopLoss: r == null ? null : 90,
      exitPrice: 100 + (r ?? 1) * 10,
      openedAt: `${day}T10:00`,
      closedAt: `${day}T11:00`,
    });
  });

function journalWith(trades: Trade[]): JournalData {
  return {
    version: 1,
    updatedAt: '2026-10-14T09:00:00.000Z',
    onboarded: true,
    profile: { name: 'A' },
    settings: { currency: 'USD', theme: 'dark', timezone: 'local', maxDailyLoss: null, maxTradesPerDay: null },
    accounts: [{ id: 'acc1', name: 'A', startingBalance: 1000, createdAt: '' }],
    activeAccountId: 'acc1',
    trades,
    setups: [],
    resources: [],
  };
}

let app: Awaited<ReturnType<typeof mount>> | null;
async function reports(trades: Trade[]) {
  disk.journal = journalWith(trades);
  app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Probe, { onRender: seen }), h(ReportsView))));
  await until(() => journal?.ready === true);
}

beforeEach(() => {
  localStorage.clear();
  journal = null;
  app = null;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 21, 12));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(async () => {
  await app?.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const card = () =>
  [...document.querySelectorAll('section')].find((s) => s.querySelector('h3')?.textContent === 'Recent form');
/** each row: its cells' text, what a screen reader is told included */
const rows = () =>
  [...(card()?.querySelectorAll('tbody tr') ?? [])].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => td.textContent?.replace(/\s+/g, ' ').trim()),
  );

describe('Reports: Recent form', () => {
  it('the last 10, 20 and 50 trades, each against the whole record, with an arrow where it differs', async () => {
    // 40 trades: 30 at -1R, then 10 at +2R
    await reports(record([...Array(30).fill(-1), ...Array(10).fill(2)]));
    expect(card()?.textContent).toContain('Your latest trades against your whole record, whatever the range above');
    expect(rows()).toEqual([
      ['Last 10 trades', '100%above your whole record', '+2.00Rabove your whole record'],
      // 10 of 20 won: 50%, +0.50R
      ['Last 20 trades', '50%above your whole record', '+0.50Rabove your whole record'],
      ['Last 50 trades', 'Needs 10 more trades'],
      // 10 of 40: 25%, (20 - 30) / 40 = -0.25R
      ['All 40 trades', '25%', '-0.25R'],
    ]);
    expect(card()?.querySelectorAll('svg.lucide-arrow-up').length).toBe(4);
  });

  it('an average R from fewer than 10 trades with a stop has no arrow, and it says why', async () => {
    // the last 10: one with no stop, nine at +2R
    await reports(record([...Array(10).fill(-1), null, ...Array(9).fill(2)]));
    expect(rows()[0]).toEqual(['Last 10 trades', '100%above your whole record', '+2.00R']);
    expect(card()?.textContent).toContain(
      'An average R from fewer than 10 trades with a stop gets no arrow: too few to compare.',
    );
    // the last 20 have 19 with a stop: an R set against the record, which reads the same
    expect(rows()[1]).toEqual(['Last 20 trades', '50%', '+0.42R']);
  });

  it('no arrow where a window reads the same as the record', async () => {
    await reports(record(Array(10).fill(1)));
    expect(rows()[0]).toEqual(['Last 10 trades', '100%', '+1.00R']);
    expect(card()?.querySelector('svg')).toBeNull();
  });

  it('down arrows, said in words too, when the latest trades are worse', async () => {
    await reports(record([...Array(10).fill(2), ...Array(10).fill(-1)]));
    expect(rows()[0]).toEqual(['Last 10 trades', '0%below your whole record', '-1.00Rbelow your whole record']);
    expect(card()?.querySelectorAll('svg.lucide-arrow-down').length).toBe(2);
  });

  it('with a few trades, each window says what it needs', async () => {
    await reports(record([1, -1, 1]));
    expect(rows()).toEqual([
      ['Last 10 trades', 'Needs 7 more trades'],
      ['Last 20 trades', 'Needs 17 more trades'],
      ['Last 50 trades', 'Needs 47 more trades'],
      ['All 3 trades', '67%', '+0.33R'],
    ]);
  });

  it('says how many trades the average R counts, when some have no stop', async () => {
    await reports(record([1, null, -1, 2, null, 1, 1, null, 1, 1]));
    expect(card()?.textContent).toContain('Average R counts the trades with a stop: 7 of 10.');
  });

  it('with no stop at all, no R, and it says why', async () => {
    await reports(record(Array(10).fill(null)));
    expect(rows()[0]).toEqual(['Last 10 trades', '100%', '—']);
    expect(card()?.textContent).toContain('No trade has a stop, so there is no R to show.');
  });

  it('is the same whatever the range picked above', async () => {
    // all in March 2026: the last 30 days have none of them
    await reports(record(Array(10).fill(1)));
    const before = rows();
    await click([...document.querySelectorAll('button')].find((b) => b.textContent === '30D') ?? null);
    expect(rows()).toEqual(before);
  });
});
