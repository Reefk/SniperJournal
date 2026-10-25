// @vitest-environment jsdom
import { createElement as h, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { ReportsView } from '@/views/ReportsView';
import { DashboardView } from '@/views/DashboardView';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider } from '@/store/UIProvider';
import { pnl } from './helpers';
import { button, click, mount, until } from './render';

/**
 * Green days, the best day's share, the net without it and the recovery
 * factor where they are seen: the Reports cards, with their tooltips, and the
 * Dashboard's Daily P&L line. Rendered in jsdom against a stand-in for the PC's
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
// the Dashboard's links, without Next's router around them
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => h('a', { href, ...rest }, children),
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

/** a trade closed on `day` (YYYY-MM-DD) for `net` */
const on = (day: string, net: number): Trade => pnl(net, { openedAt: `${day}T10:00`, closedAt: `${day}T11:00` });

function journalWith(trades: Trade[]): JournalData {
  return {
    version: 1,
    updatedAt: '2026-10-14T09:00:00.000Z',
    onboarded: true,
    profile: { name: 'Test' },
    settings: { currency: 'USD', theme: 'dark', timezone: 'local', maxDailyLoss: null, maxTradesPerDay: null },
    accounts: [{ id: 'acc1', name: 'Main', startingBalance: 1000, createdAt: '' }],
    activeAccountId: 'acc1',
    trades,
    setups: [],
    resources: [],
  };
}

// six trading days: three green, two red and one at zero; the best day (+300) is two thirds of the green ones
const RECORD = [
  on('2026-10-05', 120),
  on('2026-10-05', -20),
  on('2026-10-06', -80),
  on('2026-10-07', 0),
  on('2026-10-08', 300),
  on('2026-10-14', 50),
  on('2026-10-15', -40),
];

let app: Awaited<ReturnType<typeof mount>> | null;
async function show(view: typeof ReportsView | typeof DashboardView, data: JournalData) {
  disk.journal = data;
  app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Probe, { onRender: rendered }), h(view))));
  await until(() => journal?.ready === true);
}

beforeEach(() => {
  localStorage.clear();
  journal = null;
  app = null;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12));
});
afterEach(async () => {
  await app?.unmount();
  vi.useRealTimers();
});

/** a line of the Results, Consistency and Risk cards, by its label */
const line = (label: string) =>
  [...document.querySelectorAll('section > div')].find((d) => d.firstElementChild?.firstChild?.textContent === label);
const value = (label: string) => line(label)?.lastElementChild?.textContent;
const tip = (label: string) => line(label)?.querySelector('[role="tooltip"]')?.textContent ?? '';

describe('Reports: the day numbers', () => {
  it('over every trade: green days, the best day against the others, and the net over the deepest fall', async () => {
    await show(ReportsView, journalWith(RECORD));
    // the day at zero is a trading day, not a green one
    expect(value('Green days')).toBe('50% (3 of 6)');
    // 300 of 100 + 300 + 50
    expect(value("Best day's share")).toBe('67% of 3 green days');
    expect(value('Net without the best day')).toBe('+$30.00');
    expect(line('Net without the best day')?.lastElementChild?.className).toContain('text-profit');
    // 330 net over the fall from 1,120 to 1,020
    expect(value('Recovery factor')).toBe('3.30');
  });

  it('each one says what it means', async () => {
    await show(ReportsView, journalWith(RECORD));
    expect(tip('Green days')).toContain('trading days that ended above zero');
    expect(tip("Best day's share")).toContain('one lucky day carries the record');
    expect(tip('Net without the best day')).toContain('that one day is carrying the record');
    expect(tip('Recovery factor')).toContain('divided by the max drawdown');
    // the lines that were there before stay as they were
    expect(line('Win rate')?.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('over a range: only its days', async () => {
    await show(ReportsView, journalWith(RECORD));
    await click(button('7D'));
    expect(value('Green days')).toBe('50% (1 of 2)');
    expect(value("Best day's share")).toBe('100% of 1 green day');
    expect(value('Net without the best day')).toBe('-$40.00');
    expect(line('Net without the best day')?.lastElementChild?.className).toContain('text-loss');
    // +50, then -40 of it given back
    expect(value('Recovery factor')).toBe('0.25');
  });

  it('with no green day: no share to show, and a recovery factor below zero', async () => {
    await show(ReportsView, journalWith([on('2026-10-14', -25), on('2026-10-15', -10)]));
    expect(value('Green days')).toBe('0% (0 of 2)');
    expect(value("Best day's share")).toBe('no green day');
    expect(value('Net without the best day')).toBe('—');
    expect(value('Recovery factor')).toBe('-1.00');
  });

  it('with one green day only: nothing left without it, shown uncoloured', async () => {
    await show(ReportsView, journalWith([on('2026-10-14', 25), on('2026-10-15', 0)]));
    expect(value("Best day's share")).toBe('100% of 1 green day');
    expect(value('Net without the best day')).toBe('$0.00');
    const shown = line('Net without the best day')?.lastElementChild?.className ?? '';
    expect(shown).not.toMatch(/text-(profit|loss)/);
  });

  it('over a range with no trade in it: a dash on each line', async () => {
    await show(ReportsView, journalWith([on('2026-08-03', 25), on('2026-08-04', -10)]));
    await click(button('7D'));
    for (const label of ['Green days', "Best day's share", 'Net without the best day', 'Recovery factor']) {
      expect(value(label)).toBe('—');
    }
  });

  it('with no fall yet: an infinite recovery factor', async () => {
    await show(ReportsView, journalWith([on('2026-10-14', 25), on('2026-10-15', 10)]));
    expect(value('Recovery factor')).toBe('∞');
    expect(value('Green days')).toBe('100% (2 of 2)');
  });
});

describe('Dashboard: the green-day rate beside the Daily P&L', () => {
  beforeEach(() => {
    // the charts measure their box; jsdom has nothing to measure
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const subtitle = () =>
    [...document.querySelectorAll('h3')].find((x) => x.textContent === 'Daily P&L')?.nextElementSibling?.textContent;

  it('counts the green and red days, and says which share was green', async () => {
    await show(DashboardView, journalWith(RECORD));
    expect(subtitle()).toBe('3 green days, 2 red · 50% green');
  });

  it('a range of one green day', async () => {
    await show(DashboardView, journalWith([on('2026-10-15', 40)]));
    expect(subtitle()).toBe('1 green day, 0 red · 100% green');
  });

  it('a range of red days only', async () => {
    await show(DashboardView, journalWith([on('2026-10-14', -40), on('2026-10-15', -5)]));
    expect(subtitle()).toBe('0 green days, 2 red · 0% green');
  });
});
