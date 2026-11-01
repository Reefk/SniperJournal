// @vitest-environment jsdom
import { createElement as h, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { ReportsView } from '@/views/ReportsView';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { pnl } from './helpers';
import { mount, until } from './render';
import { UIProvider } from '@/store/UIProvider';

/**
 * Reports → R spread: a bar for each half R, and what the lines under it say.
 * Rendered against a stand-in for the PC's storage.
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

/** a trade for `net` on day `i` of March, with its stop $10 away: `net` / 10 is its R */
const atNet = (i: number, net: number, more: Partial<Trade> = {}) =>
  pnl(net, {
    openedAt: `2026-03-${String(i + 1).padStart(2, '0')}T10:00`,
    closedAt: `2026-03-${String(i + 1).padStart(2, '0')}T11:00`,
    entryPrice: 100,
    stopLoss: 90,
    ...more,
  });
/** -3R, -1.2R (a stop that held, a little past), -1R twice, then winners up to +20R, and one with no stop */
const SPREAD = [-30, -12, -10, -10, 5, 10, 15, 20, 40, 200].map((net, i) => atNet(i, net));
const NO_STOP = atNet(10, 7, { stopLoss: null });

function journalWith(trades: Trade[], hideMoney = false): JournalData {
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
    accounts: [{ id: 'acc1', name: 'A', startingBalance: 1000, createdAt: '' }],
    activeAccountId: 'acc1',
    trades,
    setups: [],
    resources: [],
  };
}

let app: Awaited<ReturnType<typeof mount>> | null;
async function reports(trades: Trade[], hideMoney = false) {
  disk.journal = journalWith(trades, hideMoney);
  app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Probe, { onRender: seen }), h(ReportsView))));
  await until(() => journal?.ready === true);
}

beforeEach(() => {
  localStorage.clear();
  journal = null;
  app = null;
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
  vi.unstubAllGlobals();
});

const card = () =>
  [...document.querySelectorAll('section')].find((s) => s.querySelector('h3')?.textContent === 'R spread');
/** each bar as a screen reader hears it */
const bars = () => [...(card()?.querySelectorAll('li') ?? [])].map((li) => li.querySelector('.sr-only')?.textContent);
/** the bars' heights in px, those with trades */
const heights = () =>
  [...(card()?.querySelectorAll<HTMLElement>('li > div > div') ?? [])]
    .map((bar) => bar.style.height)
    .filter((x) => x !== '0px');
/** the lines under the bars */
const lines = () =>
  [...(card()?.querySelectorAll('p') ?? [])].filter((p) => !p.closest('header')).map((p) => p.textContent);

describe('Reports: R spread', () => {
  it('a bar for each half R, its trades read out, the ends taking everything past them', async () => {
    await reports([...SPREAD, NO_STOP]);
    expect(card()?.querySelector('header p')?.textContent).toBe(
      'How many trades ended near each R, in half-R steps, from -2R or worse to +4R or better.',
    );
    expect(bars()).toEqual([
      '-2R or worse: 1 trade',
      '-1.5R: 0 trades',
      '-1R: 3 trades',
      '-0.5R: 0 trades',
      '0R: 0 trades',
      '+0.5R: 1 trade',
      '+1R: 1 trade',
      '+1.5R: 1 trade',
      '+2R: 1 trade',
      '+2.5R: 0 trades',
      '+3R: 0 trades',
      '+3.5R: 0 trades',
      '+4R or better: 2 trades',
    ]);
    // the tallest bar is -1R's three trades; one trade is a third of it
    expect(heights()).toEqual(['37px', '112px', '37px', '37px', '37px', '37px', '75px']);
  });

  it('labels the whole Rs under the bars, left to right in every language', async () => {
    await reports(SPREAD);
    const labels = card()?.querySelector('ul + div');
    expect([...(labels?.children ?? [])].map((span) => span.textContent)).toEqual([
      '-2R',
      '',
      '-1R',
      '',
      '0R',
      '',
      '+1R',
      '',
      '+2R',
      '',
      '+3R',
      '',
      '+4R',
    ]);
    expect(labels?.parentElement?.getAttribute('dir')).toBe('ltr');
  });

  it('a screen reader hears each bar once, as an item of a list; the eye gets it on hover', async () => {
    await reports(SPREAD);
    expect(card()?.querySelector('ul')?.getAttribute('role')).toBe('list');
    const li = card()?.querySelectorAll('li')[2];
    expect(li?.hasAttribute('title')).toBe(false);
    expect(li?.querySelector('div[aria-hidden]')?.getAttribute('title')).toBe('-1R: 3 trades');
  });

  it("a count of three digits gives way on a chart too narrow for it, as four do on a wider one; the bar's text keeps it", async () => {
    const many = [
      ...Array.from({ length: 120 }, (_, i) => atNet(i % 28, -10)),
      ...Array.from({ length: 5 }, (_, i) => atNet(i, 10)),
    ];
    await reports(many);
    const count = (i: number) => card()?.querySelectorAll('li')[i]?.querySelector('div[aria-hidden] > span');
    expect(count(2)?.textContent).toBe('120');
    expect(count(2)?.className).toContain('@max-[18rem]:hidden');
    expect(count(6)?.className).not.toContain('hidden');
    expect(bars()[2]).toBe('-1R: 120 trades');
  });

  it("the best tenth's share of the net, the losses past -1R, and the trades with no stop", async () => {
    await reports([...SPREAD, NO_STOP]);
    // 11 trades: the best one made $200 of $235; -1.2R is a stop that held, -3R went 2R past it
    expect(lines()).toEqual([
      'Your best 10% of trades (1 of 11) made 85% of your net.',
      '1 loss went past -1R: 2.00R more than its stop allowed.',
      '1 trade with no stop is left out of the bars: it has no R.',
    ]);
  });

  it('when the others lost money, the two amounts; when every stop held, it says so', async () => {
    const carried = [...Array.from({ length: 9 }, (_, i) => atNet(i, -10)), atNet(9, 300)];
    await reports(carried);
    expect(lines()).toEqual([
      'Your best 10% of trades (1 of 10) made +$300.00; the other 9 trades came to -$90.00.',
      'No loss went more than a quarter R past -1R: your stops held.',
    ]);
  });

  it('with amounts hidden, the share still shows and the amounts are •••', async () => {
    const carried = [...Array.from({ length: 9 }, (_, i) => atNet(i, -10)), atNet(9, 300)];
    await reports(carried, true);
    expect(lines()[0]).toBe('Your best 10% of trades (1 of 10) made •••; the other 9 trades came to •••.');
  });

  it('with no stop on any trade, no bars: why, and the best tenth still', async () => {
    await reports(SPREAD.map((t) => ({ ...t, stopLoss: null })));
    expect(card()?.querySelector('ul')).toBeNull();
    expect(lines()).toEqual([
      '10 trades with no stop are left out of the bars: they have no R.',
      'Your best 10% of trades (1 of 10) made 88% of your net.',
    ]);
  });
});
