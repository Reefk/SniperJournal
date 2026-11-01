// @vitest-environment jsdom
import { act, createElement as h, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { HIDDEN_MONEY, setMoneyHidden } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { CalendarView } from '@/views/CalendarView';
import { DashboardView } from '@/views/DashboardView';
import { InsightsView } from '@/views/InsightsView';
import { PlaybookView } from '@/views/PlaybookView';
import { ReportsView } from '@/views/ReportsView';
import { SettingsView } from '@/views/SettingsView';
import { TradesView } from '@/views/TradesView';
import { TradeFormModal } from '@/components/trades/TradeFormModal';
import { PrivacyToggle } from '@/components/layout/PrivacyToggle';
import { AccountSwitcher } from '@/components/layout/AccountSwitcher';
import { EquityTooltip } from '@/components/dashboard/ChartTooltip';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider, useUI } from '@/store/UIProvider';
import { pnl } from './helpers';
import { click, mount, until } from './render';

/**
 * Privacy mode, from the eye in the header: every amount on every screen reads
 * •••, and the Dashboard's Net profit card and equity header give the result
 * in % and R instead. Rendered in jsdom against a stand-in for the PC's storage.
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
let ui: ReturnType<typeof useUI> | null;
const seen = (j: typeof journal, u: typeof ui) => {
  journal = j;
  ui = u;
};
/** hands the test the journal and the dialogs */
function Probe({ onRender }: { onRender: typeof seen }) {
  onRender(useJournal(), useUI());
  return null;
}

/** a day's trades, closed, each for `net`, with a stop 10 below a 100 entry: 1R is $10 */
const day = (date: string, nets: number[], stop: number | null = 90): Trade[] =>
  nets.map((net, i) =>
    pnl(net, {
      openedAt: `${date}T1${i}:00`,
      closedAt: `${date}T1${i}:30`,
      symbol: 'X',
      entryPrice: 100,
      stopLoss: stop,
      quantity: 1,
      tags: ['x1'],
    }),
  );

// in the Dashboard's last 30 days: +$150 on a $1,000 start, 15R over 10 trades
const TRADES = [
  ...day('2026-10-05', [40, -20, 30]),
  ...day('2026-10-06', [-15, 25]),
  ...day('2026-10-08', [60, -30, 10]),
  ...day('2026-10-12', [-40, 90]),
];
const NO_STOPS = TRADES.map((t) => ({ ...t, stopLoss: null }));

function journalWith(trades: Trade[], settings: Partial<JournalData['settings']> = {}, startingBalance = 1000) {
  return {
    version: 1,
    updatedAt: '2026-10-14T09:00:00.000Z',
    onboarded: true,
    profile: { name: 'A' },
    settings: {
      currency: 'USD',
      theme: 'dark',
      timezone: 'local',
      maxDailyLoss: 100,
      maxTradesPerDay: 3,
      hideMoney: true,
      ...settings,
    },
    accounts: [{ id: 'acc1', name: 'A', startingBalance, createdAt: '' }],
    activeAccountId: 'acc1',
    trades,
    setups: [{ id: 's1', name: 'S', rules: ['r1'] }],
    resources: [],
  } satisfies JournalData;
}

let app: Awaited<ReturnType<typeof mount>> | null;
async function show(view: () => ReactNode, data: JournalData) {
  disk.journal = data;
  app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Probe, { onRender: seen }), h(view))));
  await until(() => journal?.ready === true);
}

beforeEach(() => {
  localStorage.clear();
  journal = null;
  ui = null;
  app = null;
  vi.useFakeTimers({ toFake: ['Date'] });
  // Wednesday 21 October 2026
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
  // the flag outlives a screen; the next test starts with money shown, as the app does
  setMoneyHidden(false);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** each piece of text the page shows or says, one per text node or attribute */
function shown(): string[] {
  const out: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.trim()) out.push(node.textContent.trim());
  }
  for (const el of document.body.querySelectorAll('*')) {
    for (const name of ['aria-label', 'title', 'alt', 'aria-description']) {
      const value = el.getAttribute(name);
      if (value?.trim()) out.push(value.trim());
    }
  }
  return out;
}
/** what shows an amount of money: every one has its currency's symbol */
const amounts = (symbol: string) => shown().filter((text) => text.includes(symbol));
const money = () => amounts('$');

/** a Calendar day's cell, by its date */
const cell = (date: number) =>
  [...document.querySelectorAll<HTMLButtonElement>('.grid-cols-7 > button')].find(
    (b) => b.querySelector('span')?.textContent === String(date),
  ) ?? null;
/** a Dashboard card, by its label: its label, value and the line under it */
const card = (label: string) =>
  [...document.querySelectorAll('span')].find((s) => s.textContent === label)?.closest('div.min-w-0')?.parentElement
    ?.textContent ?? '';

const SCREENS: Array<{ name: string; view: () => ReactNode; open?: () => Promise<void> }> = [
  { name: 'Dashboard', view: DashboardView },
  { name: 'Calendar', view: CalendarView },
  {
    name: "Calendar, a day's window",
    view: CalendarView,
    open: async () => {
      await click(cell(8));
      await until(() => Boolean(document.querySelector('[data-modal-root]')));
    },
  },
  { name: 'Trades', view: TradesView },
  { name: 'Reports', view: ReportsView },
  { name: 'Insights', view: InsightsView },
  { name: 'Playbook', view: PlaybookView },
  { name: 'Settings', view: SettingsView },
  {
    name: 'Trade form, editing',
    view: TradeFormModal,
    open: async () => {
      await act(async () => ui?.openTradeForm({ trade: TRADES[0] }));
      await until(() => Boolean(document.querySelector('[data-modal-root]')));
    },
  },
];
/** in a setup, and one trade of $2,500, so the short amounts (+$2.5K) are drawn too */
const EVERYWHERE = [...TRADES, ...day('2026-10-13', [2500])].map((t) => ({ ...t, setupId: 's1' }));

describe.each([
  { currency: 'USD', symbol: '$' },
  { currency: 'EUR', symbol: '€' },
])('privacy mode, in $currency: no amount on any screen', ({ currency, symbol }) => {
  it.each(SCREENS)('$name', { timeout: 30_000 }, async ({ view, open }) => {
    await show(view, journalWith(EVERYWHERE, { currency }));
    await open?.();
    expect(amounts(symbol)).toEqual([]);
    expect(document.body.textContent).toContain(HIDDEN_MONEY);
  });
});

// the same screens with money shown: each has amounts, so the checks above have something to hide
describe('with money shown, every screen as it was', () => {
  it.each(SCREENS)('$name', { timeout: 30_000 }, async ({ view, open }) => {
    await show(view, journalWith(EVERYWHERE, { hideMoney: false }));
    await open?.();
    expect(money().length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain(HIDDEN_MONEY);
  });
});

describe('privacy mode: the Dashboard in % and R', () => {
  it('the net as a share of the starting balance, and the R behind it', async () => {
    await show(DashboardView, journalWith(TRADES));
    expect(card('Net profit')).toContain('+15.0%');
    expect(card('Net profit')).toContain('15.00R over 10 trades with a stop');
    // the equity header: the balance's change since the range began
    expect(document.body.textContent).toContain('change since the range began');
    expect(money()).toEqual([]);
  });

  it('with no stop recorded, the % alone, and the info says only that', async () => {
    await show(DashboardView, journalWith(NO_STOPS));
    expect(card('Net profit')).toContain('+15.0%');
    expect(card('Net profit')).toContain(tr('dash.privacy.pctInfo'));
    expect(card('Net profit')).not.toContain('R over');
    expect(money()).toEqual([]);
  });

  it('with no starting balance to measure against, the R alone, and the info says only that', async () => {
    await show(DashboardView, journalWith(TRADES, {}, 0));
    expect(card('Net profit')).toContain('15.00R');
    expect(card('Net profit')).toContain(tr('dash.privacy.rInfo'));
    expect(card('Net profit')).not.toContain('%');
    expect(money()).toEqual([]);
  });

  it('with neither, the net is hidden like any amount, and the info is the usual one', async () => {
    await show(DashboardView, journalWith(NO_STOPS, {}, 0));
    expect(card('Net profit')).toContain(`${tr('dash.netInfo')}${HIDDEN_MONEY}`);
    expect(card('Net profit')).not.toContain('R over');
    expect(money()).toEqual([]);
  });

  it('a loss reads as a share below zero', async () => {
    // -$30 and -$20 on $1,000, at -3R and -2R
    await show(DashboardView, journalWith(day('2026-10-05', [-30, -20])));
    expect(card('Net profit')).toContain('-5.0%');
    expect(card('Net profit')).toContain('-5.00R over 2 trades with a stop');
  });

  it('showing R alone, its colour is the R’s, not the hidden net’s', async () => {
    // -1R on the trade with a stop, +$100 on one without: the net is up, the R down
    const trades = [...day('2026-10-05', [-10]), ...day('2026-10-06', [100], null)];
    await show(DashboardView, journalWith(trades, {}, 0));
    const value = [...document.querySelectorAll('div')].find((d) => d.textContent === '-1.00R');
    expect(value?.className).toContain('text-loss');
  });

  it('on All accounts: the share of their opening balances together, and each balance hidden in the menu', async () => {
    const data = journalWith(TRADES);
    data.accounts.push({ id: 'acc2', name: 'B', startingBalance: 0, createdAt: '' });
    data.activeAccountId = 'all';
    await show(() => h('div', null, h(AccountSwitcher, { variant: 'pill' }), h(DashboardView)), data);
    expect(card('Net profit')).toContain('+15.0%');
    await click(document.querySelector<HTMLElement>('button[aria-expanded]'));
    await until(() => Boolean(document.querySelector('[data-popover]')));
    expect(document.querySelector('[data-popover]')?.textContent).toContain(HIDDEN_MONEY);
    expect(money()).toEqual([]);
  });

  it('with money shown, the card is as it was', async () => {
    await show(DashboardView, journalWith(TRADES, { hideMoney: false }));
    expect(card('Net profit')).toContain('+$150.00');
    expect(card('Net profit')).toContain('Balance $1,150.00');
    expect(document.body.textContent).not.toContain(HIDDEN_MONEY);
  });
});

describe('privacy mode: the eye turns it on and off', () => {
  it('saves the setting, and every amount goes and comes back without leaving the screen', async () => {
    await show(() => h('div', null, h(PrivacyToggle), h(DashboardView)), journalWith(TRADES, { hideMoney: false }));
    const eye = document.querySelector<HTMLButtonElement>('button[aria-label="Hide amounts"]');
    expect(eye?.getAttribute('aria-pressed')).toBe('false');
    expect(money().length).toBeGreaterThan(0);

    await click(eye);
    expect(journal?.data.settings.hideMoney).toBe(true);
    expect(eye?.getAttribute('aria-pressed')).toBe('true');
    expect(eye?.title).toBe('Amounts are hidden: show them');
    expect(money()).toEqual([]);
    expect(card('Net profit')).toContain('+15.0%');

    await click(eye);
    expect(journal?.data.settings.hideMoney).toBe(false);
    expect(card('Net profit')).toContain('+$150.00');
  });
});

describe('privacy mode: the equity curve’s tooltip in %', () => {
  it('the balance as its change since the start, and the trade’s share of the start', () => {
    // a point already in % (equityInPercent): +15% since the start, this trade +1%
    const html = renderToStaticMarkup(
      h(EquityTooltip, {
        active: true,
        payload: [{ payload: { index: 3, label: '2026-10-08', equity: 15, net: 1, peak: 15 } }],
        currency: 'USD',
        inPercent: true,
      }),
    );
    expect(html).toContain('+15.00%');
    expect(html).toContain('+1.00%');
    expect(html).not.toContain('$');
  });
});
