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
 * Reports → weekday and hour: the trades by the weekday and hour they were
 * opened, drawn from the journal. jsdom applies no CSS, so every table is
 * there: a wide screen's (a row a weekday) first while the hours fit across,
 * then a tablet's and the phone's (a row an hour). Rendered against a
 * stand-in for the PC's storage.
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

/** a trade for `net` opened at `time` on a day of March 2026: the 2nd is a Monday */
const at = (day: number, time: string, net: number): Trade =>
  pnl(net, { openedAt: `2026-03-${String(day).padStart(2, '0')}T${time}`, closedAt: undefined });
const WEEK = [at(2, '09:30', 40), at(2, '09:50', -15), at(4, '11:10', 25)];

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
  [...document.querySelectorAll('section')].find((s) => s.querySelector('h3')?.textContent === 'Weekday and hour');
/** a cell's lines, what a screen reader is told included, a space between */
const said = (cell: Element) => {
  const lines = [...cell.querySelectorAll('span')].map((s) => s.textContent?.trim()).filter(Boolean);
  return lines.length ? lines.join(' ') : cell.textContent?.trim();
};
const tables = () => [...(card()?.querySelectorAll('table') ?? [])];
/** a table's rows, header first */
const table = (which: number) =>
  [...(tables()[which]?.querySelectorAll('tr') ?? [])].map((tr) => [...tr.querySelectorAll('th, td')].map(said));
/** the colour on a wide screen's cells, row by row: its opacity, or null for none */
const depths = () =>
  [...(tables()[0]?.querySelectorAll('tbody td') ?? [])]
    .filter((td) => td.hasAttribute('data-mark') || td.querySelector('[title]'))
    .map((td) => td.querySelector<HTMLElement>('span[aria-hidden]')?.style.opacity ?? null);

describe('Reports: weekday and hour', () => {
  it('on a PC a row a weekday, a column an hour: each cell its net and trades', async () => {
    await reports(WEEK);
    expect(table(0)).toEqual([
      ['Weekday', '09:00', '10:00', '11:00'],
      ['Mon', '+$25.00 2×', 'No trades', 'No trades'],
      ['Tue', 'No trades', 'No trades', 'No trades'],
      ['Wed', 'No trades', 'No trades', '+$25.00 1×'],
      ['Thu', 'No trades', 'No trades', 'No trades'],
      ['Fri', 'No trades', 'No trades', 'No trades'],
    ]);
  });

  it('on a tablet the same cells, a row an hour', async () => {
    await reports(WEEK);
    expect(table(1)).toEqual([
      ['Hour', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      ['09:00', '+$25.00 2×', 'No trades', 'No trades', 'No trades', 'No trades'],
      ['10:00', 'No trades', 'No trades', 'No trades', 'No trades', 'No trades'],
      ['11:00', 'No trades', 'No trades', '+$25.00 1×', 'No trades', 'No trades'],
    ]);
  });

  it('on a phone the same cells, a row an hour, in whole amounts from 10 up', async () => {
    await reports([...WEEK, at(3, '10:15', -2.5)]);
    expect(table(2)).toEqual([
      ['Hour', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      ['09:00', '+$25 2×', 'No trades', 'No trades', 'No trades', 'No trades'],
      ['10:00', 'No trades', '-$2.50 1×', 'No trades', 'No trades', 'No trades'],
      ['11:00', 'No trades', 'No trades', '+$25 1×', 'No trades', 'No trades'],
    ]);
  });

  it('a cell of thousands is shortened to fit: one decimal on a PC, none on a phone, the exact net on hover', async () => {
    await reports([at(2, '09:30', 1660)]);
    expect(table(0)[1][1]).toBe('+$1.7K 1×');
    expect(table(2)[1][1]).toBe('+$2K 1×');
    expect(card()?.querySelector('td div')?.getAttribute('title')).toBe('+$1,660.00');
  });

  it('on a phone 999.60 is rounded before it is shortened: "+$1K", not a "+$1,000" too wide', async () => {
    await reports([at(2, '09:30', 999.6)]);
    expect(table(2)[1][1]).toBe('+$1K 1×');
  });

  it('the weekday rows only on a wide screen and while 12 hours fit across; more run down the side', async () => {
    await reports([at(2, '09:30', 5), at(3, '20:10', 5)]);
    expect(tables().map((t) => t.className.match(/\S*(?:lg|md):hidden/g))).toEqual([
      ['max-lg:hidden'],
      ['max-md:hidden', 'lg:hidden'],
      ['md:hidden'],
    ]);
    await app?.unmount();
    // 02:00 to 20:00 is 19 hours: the tablet's table, a row an hour, on a wide screen too
    await reports([at(2, '02:30', 5), at(3, '20:10', 5)]);
    expect(tables().map((t) => t.className.match(/\S*(?:lg|md):hidden/g))).toEqual([['max-md:hidden'], ['md:hidden']]);
    expect(table(0)[0]).toEqual(['Hour', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(table(0)).toHaveLength(20);
    expect(tables().every((t) => t.getAttribute('aria-label') === 'Weekday and hour')).toBe(true);
  });

  it('colours a cell by its net against the strongest of 3 trades or more; a lone big trade stays grey', async () => {
    await reports([
      at(2, '09:00', 500),
      ...Array.from({ length: 3 }, (_, i) => at(3, `09:0${i}`, -40)),
      ...Array.from({ length: 3 }, (_, i) => at(4, `09:0${i}`, 20)),
      ...[10, 15, -25].map((net, i) => at(5, `09:0${i}`, net)),
    ]);
    // Monday's +$500 is one trade: no colour, and not the strongest; Tuesday's -$120 is, the deepest;
    // Wednesday's +$60 half as strong; Thursday's three come to $0, no colour
    expect(depths()).toEqual([null, '0.5', '0.31', null]);
  });

  it('greys a cell of 1 or 2 trades and dots one under 10, and says so', async () => {
    await reports([...WEEK, ...Array.from({ length: 4 }, (_, i) => at(5, `13:0${i}`, 10))]);
    const marks = [...(card()?.querySelectorAll('table')[0]?.querySelectorAll('td[data-mark]') ?? [])].map((td) =>
      td.getAttribute('data-mark'),
    );
    expect(marks).toEqual(['few', 'few', 'thin']);
    expect(card()?.textContent).toContain('Greyed: under 3 trades. Dotted: under 10, too few to go by yet.');
  });

  it('says how many trades it left out for having only a date', async () => {
    await reports([...WEEK, pnl(5, { openedAt: '2026-03-03', closedAt: undefined })]);
    expect(card()?.textContent).toContain('1 trade with only a date, no time it was opened, is left out.');
  });

  it('with no trade it can place, it says why', async () => {
    await reports([pnl(5, { openedAt: '2026-03-03', closedAt: undefined })]);
    expect(card()?.textContent).toContain(
      'No trade in this range has a time it was opened. 1 trade with only a date, no time it was opened, is left out.',
    );
    expect(card()?.querySelector('table')).toBeNull();
  });

  it('with amounts hidden, no amount', async () => {
    await reports(WEEK, true);
    expect(card()?.textContent).not.toContain('$');
    expect(table(0)[1]).toEqual(['Mon', '••• 2×', 'No trades', 'No trades']);
  });

  it('follows the range picked above', async () => {
    // all in March 2026: the last 30 days have none of them
    await reports(WEEK);
    await click([...document.querySelectorAll('button')].find((b) => b.textContent === '30D') ?? null);
    expect(card()?.textContent).toContain('No trade in this range has a time it was opened.');
  });
});
