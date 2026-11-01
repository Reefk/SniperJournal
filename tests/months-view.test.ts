// @vitest-environment jsdom
import { createElement as h, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { ReportsView } from '@/views/ReportsView';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider } from '@/store/UIProvider';
import { pnl } from './helpers';
import { click, mount, until } from './render';

/**
 * Reports → month by month: each month's trades, win rate and net, and the
 * balance it left the account at. Rendered against a stand-in for the PC's
 * storage.
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

/** a trade for `net` closed on `day`, 'YYYY-MM-DD' */
const on = (day: string, net: number) => pnl(net, { openedAt: `${day}T10:00`, closedAt: `${day}T11:00` });
const TRADES = [on('2026-01-10', 100), on('2026-01-20', -40), on('2026-02-05', 30), on('2026-03-01', -10)];

function journalWith(trades: Trade[], startingBalance: number, hideMoney = false): JournalData {
  return {
    version: 1,
    updatedAt: '2026-10-14T09:00:00.000Z',
    onboarded: true,
    profile: { name: 'A' },
    settings: {
      currency: 'USD',
      theme: 'dark',
      timezone: 'local',
      maxDailyLoss: null,
      maxTradesPerDay: null,
      hideMoney,
    },
    accounts: [{ id: 'acc1', name: 'A', startingBalance, createdAt: '' }],
    activeAccountId: 'acc1',
    trades,
    setups: [],
    resources: [],
  };
}

let app: Awaited<ReturnType<typeof mount>> | null;
async function reports(startingBalance: number, hideMoney = false) {
  disk.journal = journalWith(TRADES, startingBalance, hideMoney);
  app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Probe, { onRender: seen }), h(ReportsView))));
  await until(() => journal?.ready === true);
}

beforeEach(() => {
  localStorage.clear();
  journal = null;
  app = null;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 20, 12));
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
  [...document.querySelectorAll('section')].find((s) => s.querySelector('h3')?.textContent === 'Month by month');
/** what a cell shows, without what only a screen reader reads */
const shown = (cell: Element) => {
  const copy = cell.cloneNode(true) as Element;
  copy.querySelectorAll('.sr-only').forEach((sr) => sr.remove());
  return copy.textContent?.trim();
};
/** the month table's rows as a PC shows them, header first (jsdom applies no CSS, so the phone's lines are there too) */
const table = () =>
  [...(card()?.querySelectorAll('tr:not(.md\\:hidden)') ?? [])].map((tr) =>
    [...tr.querySelectorAll('th, td')].map(shown),
  );
/** a phone's line under each month, in place of the balance column */
const phoneLines = () => [...(card()?.querySelectorAll('tr.md\\:hidden') ?? [])].map((tr) => tr.textContent?.trim());

describe('Reports: month by month', () => {
  it('each month, newest first, with the balance it left: the starting balance plus the net so far', async () => {
    await reports(1000);
    expect(table()).toEqual([
      ['Month', 'Trades', 'Win rate', 'Net', 'Balance'],
      ['Mar 2026', '1', '0%', '-$10.00', '$1,080.00'],
      ['Feb 2026', '1', '100%', '+$30.00', '$1,090.00'],
      ['Jan 2026', '2', '50%', '+$60.00', '$1,060.00'],
    ]);
  });

  it('with no starting balance, the net so far, signed', async () => {
    await reports(0);
    expect(table().map((row) => row[4])).toEqual(['Net so far', '+$80.00', '+$90.00', '+$60.00']);
    expect(phoneLines()).toEqual(['Net so far +$80.00', 'Net so far +$90.00', 'Net so far +$60.00']);
  });

  it('on a phone, with no room for a fifth column, the balance on a line under each month', async () => {
    await reports(1000);
    expect(phoneLines()).toEqual(['Balance $1,080.00', 'Balance $1,090.00', 'Balance $1,060.00']);
    expect(card()?.querySelector('tr.md\\:hidden td')?.getAttribute('colspan')).toBe('4');
    expect([...(card()?.querySelectorAll('th') ?? [])].at(-1)?.className).toContain('max-md:hidden');
  });

  it("a screen reader on a phone hears the balance with the month's net, a row a month", async () => {
    await reports(1000);
    const lines = [...(card()?.querySelectorAll('tr.md\\:hidden') ?? [])];
    expect(lines.map((tr) => tr.getAttribute('aria-hidden'))).toEqual(['true', 'true', 'true']);
    const said = [...(card()?.querySelectorAll('td .sr-only.md\\:hidden') ?? [])].map((sr) => sr.textContent?.trim());
    expect(said).toEqual(['Balance $1,080.00', 'Balance $1,090.00', 'Balance $1,060.00']);
    expect(card()?.querySelector('tbody tr td:nth-child(4)')?.textContent).toBe('-$10.00 Balance $1,080.00');
  });

  it("a shorter range keeps each month's balance from all the trades before it", async () => {
    await reports(1000);
    // the last 30 days, to 20 March: only March's trade
    await click([...document.querySelectorAll('button')].find((b) => b.textContent === '30D') ?? null);
    expect(table()).toEqual([
      ['Month', 'Trades', 'Win rate', 'Net', 'Balance'],
      ['Mar 2026', '1', '0%', '-$10.00', '$1,080.00'],
    ]);
  });

  it('with amounts hidden, no balance either', async () => {
    await reports(1000, true);
    expect(table()[1]).toEqual(['Mar 2026', '1', '0%', '•••', '•••']);
    expect(phoneLines()[0]).toBe('Balance •••');
  });
});
