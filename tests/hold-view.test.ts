// @vitest-environment jsdom
import { act, createElement as h, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { ReportsView } from '@/views/ReportsView';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider } from '@/store/UIProvider';
import { trade } from './helpers';
import { click, mount, until } from './render';

/**
 * Reports → hold time against result: the lines under the chart, drawn from
 * the journal. jsdom draws no chart, so the dots themselves are left to the
 * e2e. Rendered against a stand-in for the PC's storage.
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

/** a trade on day `i` of March 2026, held `minutes` from 10:00, for `r` R (a stop 10 below a 100 entry), or with no stop */
const held = (i: number, minutes: number, r: number, stop: number | null = 90): Trade => {
  const day = new Date(Date.UTC(2026, 2, 1 + i)).toISOString().slice(0, 10);
  const close = new Date(Date.UTC(2026, 2, 1 + i, 10, minutes)).toISOString().slice(11, 16);
  return trade({
    entryPrice: 100,
    stopLoss: stop,
    exitPrice: 100 + r * 10,
    openedAt: `${day}T10:00`,
    closedAt: `${day}T${close}`,
  });
};
/** 10 quick trades at -1R, then 10 held two hours at +2R */
const QUICK_THEN_SLOW = [
  ...Array.from({ length: 10 }, (_, i) => held(i, 5, -1)),
  ...Array.from({ length: 10 }, (_, i) => held(10 + i, 120, 2)),
];

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
  [...document.querySelectorAll('section')].find(
    (s) => s.querySelector('h3')?.textContent === 'Hold time against result',
  );
/** what the card says, visible lines and the screen reader's summary, each a line */
const lines = () => [...(card()?.querySelectorAll('p') ?? [])].map((p) => p.textContent);
const measure = (label: string) =>
  [...(card()?.querySelectorAll<HTMLButtonElement>('[role="group"] button') ?? [])].find(
    (b) => b.textContent === label,
  ) ?? null;
const pressed = () =>
  [...(card()?.querySelectorAll('[role="group"] button') ?? [])].find((b) => b.getAttribute('aria-pressed') === 'true')
    ?.textContent;

describe('Reports: hold time against result', () => {
  it('in R, whether holding longer paid: the trades held up to the median against the ones held longer', async () => {
    await reports(QUICK_THEN_SLOW);
    expect(pressed()).toBe('R');
    expect(lines()).toEqual([
      'A dot for each trade in the range: how long you held it, and how it did. Tap one to open it.',
      'Hold time against result: 20 trades, held from 5m to 2h.',
      'Held longer than 1h 3m: +2.00R a trade (10 trades). Up to 1h 3m: -1.00R a trade (10 trades).',
    ]);
  });

  it('in money when picked, and back', async () => {
    await reports(QUICK_THEN_SLOW);
    await click(measure('Net'));
    expect(pressed()).toBe('Net');
    expect(lines()).toContain(
      'Held longer than 1h 3m: +$20.00 a trade (10 trades). Up to 1h 3m: -$10.00 a trade (10 trades).',
    );
    await click(measure('R'));
    expect(lines()).toContain(
      'Held longer than 1h 3m: +2.00R a trade (10 trades). Up to 1h 3m: -1.00R a trade (10 trades).',
    );
  });

  it('says what it left out: no stop in R, no close time either way', async () => {
    const trades = [
      ...QUICK_THEN_SLOW,
      held(20, 30, 1, null),
      trade({ openedAt: '2026-03-22T10:00', closedAt: undefined, exitPrice: 110 }),
    ];
    await reports(trades);
    expect(lines().slice(-2)).toEqual([
      '1 trade with no stop is left out: it has no R.',
      '1 trade with no close time is left out.',
    ]);
    // in money a trade with no stop has a dot
    await click(measure('Net'));
    expect(lines()).toContain('Hold time against result: 21 trades, held from 5m to 2h.');
    expect(lines().at(-1)).toBe('1 trade with no close time is left out.');
  });

  it('with too few trades on a side, it says how many it needs', async () => {
    await reports(QUICK_THEN_SLOW.slice(1));
    expect(lines().at(-1)).toBe('Whether holding longer pays shows once each half has 10 trades.');
  });

  it('starts in money when most trades have no stop', async () => {
    await reports([held(0, 5, 1, null), held(1, 5, 1, null), held(2, 5, 1)]);
    expect(pressed()).toBe('Net');
    // picked R: the two with no stop are why so few dots
    await click(measure('R'));
    expect(lines()).toContain('2 trades with no stop are left out: they have no R.');
  });

  it('in R with no stop at all, it says that is why there is nothing to show, and what else was left out', async () => {
    await reports([held(0, 5, 1, null), trade({ openedAt: '2026-03-02T10:00', closedAt: undefined, exitPrice: 110 })]);
    await click(measure('R'));
    expect(card()?.textContent).toContain(
      '1 trade with no stop is left out: it has no R. 1 trade with no close time is left out.',
    );
    expect(card()?.querySelector('.sr-only')).toBeNull();
  });

  it('with nothing it could draw, it says so, and what was left out', async () => {
    await reports([trade({ openedAt: '2026-03-02T10:00', closedAt: undefined, exitPrice: 110 })]);
    expect(card()?.textContent).toContain(
      'No trade in this range has a hold time to show. 1 trade with no close time is left out.',
    );
  });

  it('enough trades, but all held as long: it says why it can’t split them, not that it needs more', async () => {
    await reports(Array.from({ length: 24 }, (_, i) => held(i, 30, i % 2 ? 1 : -1)));
    expect(lines().at(-1)).toBe('Too many trades share the same hold time to split them in two.');
  });

  it('a measure picked is for that account: another starts from what fits its trades', async () => {
    disk.journal = {
      ...journalWith([...QUICK_THEN_SLOW, { ...held(0, 5, 1), accountId: 'acc2' }]),
      accounts: [
        { id: 'acc1', name: 'A', startingBalance: 1000, createdAt: '' },
        { id: 'acc2', name: 'B', startingBalance: 1000, createdAt: '' },
      ],
    };
    app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Probe, { onRender: seen }), h(ReportsView))));
    await until(() => journal?.ready === true);
    await click(measure('Net'));
    expect(pressed()).toBe('Net');
    await act(async () => journal?.actions.setActiveAccount('acc2'));
    await until(() => lines().some((line) => line?.includes('1 trade, held from 5m to 5m')));
    expect(pressed()).toBe('R');
  });

  it('follows the range picked above', async () => {
    // all in March 2026: the last 30 days have none of them
    await reports(QUICK_THEN_SLOW);
    await click([...document.querySelectorAll('button')].find((b) => b.textContent === '30D') ?? null);
    expect(card()?.textContent).toContain('No trade in this range has a hold time to show.');
  });
});
