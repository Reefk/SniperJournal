// @vitest-environment jsdom
import { createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { setLanguage, type Language } from '@/lib/i18n';
import { CalendarView } from '@/views/CalendarView';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider } from '@/store/UIProvider';
import { pnl } from './helpers';
import { click, mount, until } from './render';

/**
 * The Calendar's counts, in English, where they are seen: the month's cards,
 * a day's cell and a day's window. Each one is a number put into a sentence,
 * so this is where two of them swapped would show. Rendered in jsdom against
 * a stand-in for the PC's storage.
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

const closed = (day: string, net: number, hour = 10) =>
  pnl(net, { openedAt: `${day}T${hour}:00`, closedAt: `${day}T${hour}:30` });

/** October 2026: two green days, one of them with two trades, one red day, and a trade still open */
const OCTOBER: Trade[] = [
  closed('2026-10-05', 30),
  closed('2026-10-05', 20, 11),
  closed('2026-10-06', -15),
  closed('2026-10-07', 10),
  pnl(0, { openedAt: '2026-10-20T10:00', closedAt: undefined, manualPnl: null, exitPrice: null }),
];

function journalWith(trades: Trade[], language: Language = 'en'): JournalData {
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
      language,
    },
    accounts: [{ id: 'acc1', name: 'Main', startingBalance: 1000, createdAt: '' }],
    activeAccountId: 'acc1',
    trades,
    setups: [],
    resources: [],
  };
}

let app: Awaited<ReturnType<typeof mount>> | null;

beforeEach(() => {
  localStorage.clear();
  journal = null;
  app = null;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 21, 12));
});
afterEach(async () => {
  await app?.unmount();
  setLanguage('en');
  vi.useRealTimers();
});

async function calendar(trades: Trade[], language: Language = 'en') {
  disk.journal = journalWith(trades, language);
  app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Probe, { onRender: rendered }), h(CalendarView))));
  await until(() => journal?.ready === true);
}

/** a day's cell, by its date */
const cell = (day: number) =>
  [...document.querySelectorAll<HTMLButtonElement>('.grid-cols-7 > button')].find(
    (b) => b.querySelector('span')?.textContent === String(day),
  ) ?? null;

describe('Calendar: the counts in its sentences', () => {
  it("the month's cards: green and red days, what is still open, wins and losses", async () => {
    await calendar(OCTOBER);
    const text = document.body.textContent ?? '';
    expect(text).toContain('2 green, 1 red');
    expect(text).toContain('1 still open');
    expect(text).toContain('3W · 1L');
  });

  it("a day's cell counts its trades, one or more", async () => {
    await calendar(OCTOBER);
    expect(cell(5)?.textContent).toContain('2 trades');
    expect(cell(6)?.textContent).toContain('1 trade');
    expect(cell(6)?.textContent).not.toContain('1 trades');
  });

  it("a day's window: its trades and their net", async () => {
    await calendar(OCTOBER);
    await click(cell(5));
    await until(() => Boolean(document.querySelector('[data-modal-root]')));
    expect(document.querySelector('[data-modal-root]')?.textContent).toContain('2 trades · net +$50.00');
  });

  it('a month with no trades names itself and offers the months that have some', async () => {
    await calendar([closed('2026-08-03', 10)]);
    expect(document.body.textContent).toContain('No trades in October 2026.');
    expect([...document.querySelectorAll('.mt-3.flex-wrap > button')].map((b) => b.textContent)).toEqual(['Aug 2026']);
  });
});

describe("Calendar: a day's amount, on two lines where its cell is too narrow", () => {
  const DAY = [closed('2026-10-08', 740.31)];
  // the phone's and the desktop's, each with the place it may break (jsdom lays nothing out)
  const amounts = () => ['.md\\:hidden', '.max-md\\:hidden'].map((s) => cell(8)?.querySelector(s)?.innerHTML);

  it('before the cents, on a phone and on a desktop', async () => {
    await calendar(DAY);
    expect(amounts()).toEqual(['+$740<wbr>.31', '+$740<wbr>.31']);
  });

  it('before a unit written after the number: a line of its own on a phone, a space on a desktop', async () => {
    await calendar(DAY, 'ru');
    expect(amounts()).toEqual(['+740,31<br>$', '+740,31 $']);
  });
});
