// @vitest-environment jsdom
import { createElement as h, type ReactNode } from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { DashboardView } from '@/views/DashboardView';
import { SettingsView } from '@/views/SettingsView';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider } from '@/store/UIProvider';
import { pnl } from './helpers';
import { button, click, field, mount, type, until } from './render';

/**
 * Goals where they are set and seen: Settings → Limits and goals, saving
 * through the real journal, and the Dashboard's Goals card. Rendered in jsdom
 * against a stand-in for the PC's storage.
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

/** `n` trades closed on `day` (YYYY-MM-DD), each for `net` */
const many = (n: number, day: string, net: number, overrides: Partial<Trade> = {}) =>
  Array.from({ length: n }, () => pnl(net, { openedAt: `${day}T10:00`, closedAt: `${day}T11:00`, ...overrides }));

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
    activeAccountId: 'acc1',
    trades,
    setups: [],
    resources: [],
  };
}

// the Dashboard opens on its last 30 days: from 22 September, with the 30 days before from 23 August
const RECORD = [
  // in the range: 4 of 5 won in the week of 5 October, 3 of 5 in the week of the 12th
  ...many(4, '2026-10-05', 20),
  ...many(1, '2026-10-05', -10),
  ...many(3, '2026-10-12', 20),
  ...many(2, '2026-10-12', -10),
  // the 30 days before: 5 of 10
  ...many(5, '2026-09-14', 20),
  ...many(5, '2026-09-14', -10),
  // another account's trades, which the account shown leaves out
  ...many(10, '2026-10-06', -50, { accountId: 'acc2' }),
];

let app: Awaited<ReturnType<typeof mount>> | null;
async function show(view: typeof DashboardView | typeof SettingsView, data: JournalData) {
  disk.journal = data;
  app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Probe, { onRender: rendered }), h(view))));
  await until(() => journal?.ready === true);
}

beforeEach(() => {
  localStorage.clear();
  journal = null;
  app = null;
  vi.useFakeTimers({ toFake: ['Date'] });
  // Wednesday 21 October 2026
  vi.setSystemTime(new Date(2026, 9, 21, 12));
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
afterEach(async () => {
  await app?.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const card = () =>
  [...document.querySelectorAll('section')].find((s) => s.querySelector('h3')?.textContent === 'Goals');
const subtitle = () => card()?.querySelector('h3')?.nextElementSibling?.textContent;
/** a goal's row on the card, by its name */
const row = (label: string) =>
  [...(card()?.querySelectorAll('ul > li') ?? [])].find(
    (li) => li.firstElementChild?.firstElementChild?.firstChild?.textContent === label,
  );
const text = (label: string) => row(label)?.textContent?.replace(/\s+/g, ' ').trim();
const dots = (label: string) => [...(row(label)?.querySelectorAll('ol > li') ?? [])].map((li) => li.textContent);
const labels = () =>
  [...(card()?.querySelectorAll('ul > li') ?? [])].map(
    (li) => li.firstElementChild?.firstElementChild?.firstChild?.textContent,
  );

describe('the Dashboard: the Goals card', () => {
  it('is not there while no goal is set', async () => {
    await show(DashboardView, journalWith(RECORD));
    expect(document.body.textContent).toContain('Daily P&L');
    expect(card()).toBeUndefined();
  });

  it('comes last: under the Daily P&L, its four cards and the recent trades', async () => {
    await show(DashboardView, journalWith(RECORD, { goals: { winRate: 60 } }));
    const leaf = (text: string) =>
      [...document.querySelectorAll('body *')].find((el) => el.children.length === 0 && el.textContent === text);
    const order = [
      'Equity curve',
      'Sniper Score',
      'Daily P&L',
      'Largest win',
      'Largest loss',
      'Max drawdown',
      'Average day',
      'Recent trades',
      'Goals',
    ];
    const found = order.map(leaf);
    expect(found.map((el, i) => (el ? order[i] : `${order[i]} missing`))).toEqual(order);
    for (let i = 1; i < found.length; i++) {
      expect(found[i - 1]!.compareDocumentPosition(found[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('each goal set, in order, against its target, for the account shown', async () => {
    await show(
      DashboardView,
      journalWith(RECORD, { goals: { winRate: 60, avgR: 0.5, rulesKept: 90, daysInLimits: 80 } }),
    );
    expect(labels()).toEqual(['Rules kept', 'Days inside my limits', 'Win rate', 'Average R']);
    // 7 of 10 won; the other account's 10 losses are not counted
    expect(text('Win rate')).toContain('70% / 60%');
    expect(text('Win rate')).toContain('Met');
    // 5 of 10 in the 30 days before
    expect(text('Win rate')).toContain('up from 50%');
    expect(subtitle()).toBe('1 of 1 met · arrows against the 30 days before · dots for the last 8 weeks');
    expect(card()?.querySelector('a')?.getAttribute('href')).toBe('/settings');
  });

  it('says what a goal needs when it has too few trades, or nothing to go on', async () => {
    await show(DashboardView, journalWith(RECORD, { goals: { rulesKept: 90, daysInLimits: 80, avgR: 0.5 } }));
    expect(text('Rules kept')).toContain('— / 90%');
    expect(text('Rules kept')).toContain('Needs 10 checked trades, 0 so far');
    expect(text('Average R')).toContain('Needs 10 trades with a stop, 0 so far');
    expect(text('Days inside my limits')).toContain('Set a daily limit in Settings to measure this');
    expect(subtitle()).toBe(
      'Not enough trades in this range to tell yet · arrows against the 30 days before · dots for the last 8 weeks',
    );
  });

  it('a dot for each of the last 8 weeks, in words for a screen reader', async () => {
    await show(DashboardView, journalWith(RECORD, { goals: { winRate: 60 } }));
    expect(dots('Win rate')).toEqual([
      'Week of 31 Aug: 0 trades, not enough to tell',
      'Week of 07 Sep: 0 trades, not enough to tell',
      'Week of 14 Sep: 50%, below target',
      'Week of 21 Sep: 0 trades, not enough to tell',
      'Week of 28 Sep: 0 trades, not enough to tell',
      'Week of 05 Oct: 80%, met',
      'Week of 12 Oct: 60%, met',
      'Week of 19 Oct: 0 trades, not enough to tell',
    ]);
    const shown = [...(row('Win rate')?.querySelectorAll('ol > li > span[aria-hidden]') ?? [])].map((s) => s.className);
    expect(shown[2]).toContain('bg-loss');
    expect(shown[5]).toContain('bg-profit');
    expect(shown[0]).toContain('border');
  });

  it('below target, though up from the period before', async () => {
    await show(DashboardView, journalWith(RECORD, { goals: { expectancy: 25 } }));
    // (7 × 20 − 3 × 10) ÷ 10 = 11 a trade, against 5 before
    expect(text('Expectancy')).toContain('+$11.00 / +$25.00');
    expect(text('Expectancy')).toContain('Below target');
    expect(text('Expectancy')).toContain('up from +$5.00');
    expect(subtitle()).toContain('0 of 1 met');
  });

  it('down from the period before, or the same as it', async () => {
    const worse = [
      ...many(5, '2026-10-05', 20),
      ...many(5, '2026-10-06', -10),
      ...many(8, '2026-09-14', 20),
      ...many(2, '2026-09-14', -10),
    ];
    await show(DashboardView, journalWith(worse, { goals: { winRate: 40 } }));
    expect(text('Win rate')).toContain('50% / 40%');
    expect(text('Win rate')).toContain('down from 80%');
    expect(row('Win rate')?.querySelector('svg.text-loss')).toBeTruthy();
    await app?.unmount();
    const same = [
      ...many(5, '2026-10-05', 20),
      ...many(5, '2026-10-06', -10),
      ...many(5, '2026-09-14', 20),
      ...many(5, '2026-09-14', -10),
    ];
    await show(DashboardView, journalWith(same, { goals: { winRate: 40 } }));
    expect(text('Win rate')).toContain('same as before');
  });

  it('no arrow while the period before has too few trades to tell', async () => {
    const nineBefore = [...RECORD.filter((t) => t.closedAt?.startsWith('2026-10')), ...many(9, '2026-09-14', 20)];
    await show(DashboardView, journalWith(nineBefore, { goals: { winRate: 60 } }));
    expect(text('Win rate')).toContain('70% / 60%');
    expect(text('Win rate')).not.toContain(' from ');
    expect(text('Win rate')).not.toContain('same as before');
  });

  it("another account's mistakes and days are its own", async () => {
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
    const trades = [
      ...days.flatMap((day) => many(2, day, 10)),
      // the same day as one of mine: a loss past my limit, with a mistake
      ...many(1, '2026-10-05', -500, { accountId: 'acc2', mistakes: ['Oversized'] }),
    ];
    await show(
      DashboardView,
      journalWith(trades, { maxDailyLoss: 100, goals: { cleanTrades: 80, daysInLimits: 100, greenDayRate: 100 } }),
    );
    expect(text('Clean trades')).toContain('Counts from the first trade you mark with a mistake');
    expect(text('Days inside my limits')).toContain('100% / 100%');
    expect(text('Green days')).toContain('100% / 100%');
    expect(text('Green days')).toContain('Met');
  });

  it('the bar fills toward the target: all of it once met, none below zero, grey until judged', async () => {
    const bar = (label: string) => row(label)?.querySelector<HTMLElement>('div[aria-hidden] > div');
    // 70% won against 60%; +$11.00 a trade against +$25.00; no trade with a stop for Average R
    await show(DashboardView, journalWith(RECORD, { goals: { winRate: 60, expectancy: 25, avgR: 0.5 } }));
    expect(bar('Win rate')?.style.width).toBe('100%');
    expect(bar('Win rate')?.className).toContain('bg-profit');
    expect(bar('Expectancy')?.style.width).toBe('44%');
    expect(bar('Expectancy')?.className).toContain('bg-loss');
    expect(bar('Average R')?.style.width).toBe('0%');
    expect(bar('Average R')?.className).toContain('bg-line-strong');
    await app?.unmount();
    await show(DashboardView, journalWith(many(10, '2026-10-05', -10), { goals: { expectancy: 25 } }));
    expect(bar('Expectancy')?.style.width).toBe('0%');
  });

  it('with only goals it has nothing to measure, the header says so, not that trades are missing', async () => {
    await show(DashboardView, journalWith(RECORD, { goals: { daysInLimits: 80 } }));
    expect(subtitle()).toBe('Nothing to measure yet · arrows against the 30 days before · dots for the last 8 weeks');
  });

  it('this year: against as many days before it', async () => {
    await show(DashboardView, journalWith(RECORD, { goals: { winRate: 60 } }));
    await click(button('YTD'));
    expect(subtitle()).toBe('1 of 1 met · arrows against as many days before · dots for the last 8 weeks');
  });

  it('over all time: no arrows', async () => {
    await show(DashboardView, journalWith(RECORD, { goals: { winRate: 60 } }));
    await click(button('All'));
    // 12 of 20
    expect(text('Win rate')).toContain('60% / 60%');
    expect(text('Win rate')).not.toContain(' from ');
    expect(subtitle()).toBe('1 of 1 met · dots for the last 8 weeks');
  });

  it('follows a goal changed in Settings', async () => {
    await show(DashboardView, journalWith(RECORD, { goals: { winRate: 60 } }));
    await act(async () => journal?.actions.setGoal('winRate', 75));
    expect(text('Win rate')).toContain('70% / 75%');
    expect(text('Win rate')).toContain('Below target');
    await act(async () => journal?.actions.setGoal('winRate', null));
    expect(card()).toBeUndefined();
  });
});

describe('Settings: limits and goals', () => {
  const section = () =>
    [...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === 'Limits and goals');
  const error = (label: string) => field(label, section())?.parentElement?.querySelector('p.text-loss')?.textContent;

  it('a target typed is a goal set; blank takes it off', async () => {
    await show(SettingsView, journalWith(RECORD));
    expect(journal?.data.settings.goals).toBeUndefined();
    await type(field('Win rate', section()), '55');
    expect(journal?.data.settings.goals).toEqual({ winRate: 55 });
    await type(field('Profit factor', section()), '1,5');
    expect(journal?.data.settings.goals).toEqual({ winRate: 55, profitFactor: 1.5 });
    await type(field('Win rate', section()), '');
    expect(journal?.data.settings.goals).toEqual({ profitFactor: 1.5 });
    await type(field('Profit factor', section()), ' ');
    expect(journal?.data.settings.goals).toBeUndefined();
  });

  it("a number the goal can't take says why, and the target stays as it was", async () => {
    await show(SettingsView, journalWith(RECORD, { goals: { winRate: 55 } }));
    expect((field('Win rate', section()) as HTMLInputElement).value).toBe('55');
    await type(field('Win rate', section()), '150');
    expect(error('Win rate')).toBe('A number from 0 to 100. Still using 55%');
    expect(journal?.data.settings.goals).toEqual({ winRate: 55 });
    await type(field('Win rate', section()), '-5');
    expect(error('Win rate')).toBe('A number from 0 to 100. Still using 55%');
    await type(field('Average R', section()), '-0.5');
    expect(error('Average R')).toBe('A number above 0');
    await type(field('Average R', section()), 'abc');
    expect(error('Average R')).toBe('A number above 0');
    expect(journal?.data.settings.goals).toEqual({ winRate: 55 });
    await type(field('Win rate', section()), '60');
    expect(error('Win rate')).toBeUndefined();
    expect(journal?.data.settings.goals).toEqual({ winRate: 60 });
  });

  it('typed a key at a time, it says which target counts, and leaving the box shows it again', async () => {
    await show(SettingsView, journalWith(RECORD, { goals: { winRate: 55 } }));
    const box = field('Win rate', section()) as HTMLInputElement;
    // 1 and then 15 are targets on the way to 150
    for (const keys of ['1', '15', '150']) await type(box, keys);
    expect(error('Win rate')).toBe('A number from 0 to 100. Still using 15%');
    expect(journal?.data.settings.goals).toEqual({ winRate: 15 });
    await act(async () => {
      box.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(box.value).toBe('15');
    expect(error('Win rate')).toBeUndefined();
  });

  it('no finer than the card shows: a tenth of a percent, a hundredth of the rest', async () => {
    await show(SettingsView, journalWith(RECORD));
    await type(field('Win rate', section()), '90.04');
    expect(error('Win rate')).toBe('One decimal at most');
    await type(field('Profit factor', section()), '1.505');
    expect(error('Profit factor')).toBe('Two decimals at most');
    // above 0, but too small to be a hundredth
    await type(field('Profit factor', section()), '0.004');
    expect(error('Profit factor')).toBe('Two decimals at most');
    expect(journal?.data.settings.goals).toBeUndefined();
    await type(field('Win rate', section()), '90.5');
    await type(field('Profit factor', section()), '1.55');
    expect(journal?.data.settings.goals).toEqual({ winRate: 90.5, profitFactor: 1.55 });
  });

  it('a decimal being typed stays as it is typed', async () => {
    await show(SettingsView, journalWith(RECORD));
    const box = field('Average R', section()) as HTMLInputElement;
    await type(box, '0.');
    expect(error('Average R')).toBe('A number above 0');
    await type(box, '1.');
    expect(box.value).toBe('1.');
    expect(journal?.data.settings.goals).toEqual({ avgR: 1 });
    await type(box, '1.50');
    expect(box.value).toBe('1.50');
    expect(journal?.data.settings.goals).toEqual({ avgR: 1.5 });
  });

  it('a target changed somewhere else shows in its box', async () => {
    await show(SettingsView, journalWith(RECORD, { goals: { winRate: 55 } }));
    await act(async () => journal?.actions.setGoal('winRate', 62));
    expect((field('Win rate', section()) as HTMLInputElement).value).toBe('62');
    await act(async () => journal?.actions.setGoal('winRate', null));
    expect((field('Win rate', section()) as HTMLInputElement).value).toBe('');
  });

  it('days inside my limits waits for a limit', async () => {
    await show(SettingsView, journalWith(RECORD));
    const box = () => field('Days inside my limits', section()) as HTMLInputElement;
    expect(box().disabled).toBe(true);
    expect(section()?.textContent).toContain('set a limit above first');
    await type(field('Maximum loss in a day', section()), '200');
    expect(box().disabled).toBe(false);
    await type(box(), '90');
    expect(journal?.data.settings.goals).toEqual({ daysInLimits: 90 });
    // the limit taken off again: the target can still be cleared
    await type(field('Maximum loss in a day', section()), '');
    expect(box().disabled).toBe(false);
    await type(box(), '');
    expect(box().disabled).toBe(true);
  });

  it('a limit of 0 trades is no limit; a target saved without a limit stays to be cleared', async () => {
    await show(SettingsView, journalWith(RECORD, { maxTradesPerDay: 0 }));
    expect((field('Days inside my limits', section()) as HTMLInputElement).disabled).toBe(true);
    await app?.unmount();
    await show(SettingsView, journalWith(RECORD, { goals: { daysInLimits: 90 } }));
    const box = field('Days inside my limits', section()) as HTMLInputElement;
    expect(box.disabled).toBe(false);
    expect(box.value).toBe('90');
  });

  it('beside the win rate, the one the numbers break even at', async () => {
    await show(SettingsView, journalWith(RECORD));
    // the account shown, all time: an average win of 20 and loss of 10
    expect(section()?.textContent).toContain(
      'You break even at 33.3% with your average win and loss (Main, all time).',
    );
  });

  it('with no win and loss yet, it says it will', async () => {
    await show(SettingsView, journalWith(many(3, '2026-10-05', 20)));
    expect(section()?.textContent).toContain(
      'Once you have a win and a loss, the win rate you break even at shows here.',
    );
  });
});
