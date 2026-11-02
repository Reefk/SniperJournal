// @vitest-environment jsdom
import { act, createElement as h, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { setMoneyHidden } from '@/lib/format';
import { CalendarView } from '@/views/CalendarView';
import { SettingsView } from '@/views/SettingsView';
import { TradeFormModal } from '@/components/trades/TradeFormModal';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider, useUI } from '@/store/UIProvider';
import { pnl } from './helpers';
import { button, click, mount, press, until } from './render';

/**
 * Copy for review, where it is used: a Calendar week, a Calendar day and a
 * trade being edited each open the text in a dialog, which copies it to the
 * clipboard, or selects it where the device won't. Rendered in jsdom against
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

/** closed trades on a day, each for `net`, with a stop 10 below a 100 entry: 1R is $10 */
const day = (date: string, nets: number[]): Trade[] =>
  nets.map((net, i) =>
    pnl(net, {
      openedAt: `${date}T1${i}:00`,
      closedAt: `${date}T1${i}:30`,
      symbol: 'X',
      entryPrice: 100,
      stopLoss: 90,
      quantity: 1,
    }),
  );
/** the week of 5 October 2026: +$45 on a $1,000 start, and a loss the week before */
const TRADES = [...day('2026-09-28', [-100]), ...day('2026-10-05', [30, 20]), ...day('2026-10-06', [-15, 10])];

function journalWith(settings: Partial<JournalData['settings']> = {}): JournalData {
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
      ...settings,
    },
    accounts: [{ id: 'acc1', name: 'A', startingBalance: 1000, createdAt: '' }],
    activeAccountId: 'acc1',
    trades: TRADES,
    setups: [],
    resources: [],
  };
}

let app: Awaited<ReturnType<typeof mount>> | null;
async function show(views: Array<() => ReactNode>, data: JournalData) {
  disk.journal = data;
  app = await mount(
    h(JournalProvider, null, h(UIProvider, null, h(Probe, { onRender: seen }), ...views.map((v) => h(v)))),
  );
  await until(() => journal?.ready === true);
}

beforeEach(() => {
  localStorage.clear();
  journal = null;
  ui = null;
  app = null;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 21, 12));
});
afterEach(async () => {
  await app?.unmount();
  setMoneyHidden(false);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(document, 'execCommand');
});

/** the dialog on top */
const dialog = () => [...document.querySelectorAll('[data-modal-root]')].at(-1) ?? null;
const text = () => dialog()?.querySelector('textarea')?.value ?? '';
const leaveOut = () => dialog()?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null;
const named = (name: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);

async function openWeek() {
  await click(named('Copy the week 05 Oct – 11 Oct for review'));
  await until(() => text() !== '');
}

/** the clipboard as a browser has it, writing what it is given */
function clipboard(write: (text: string) => Promise<void>) {
  const writeText = vi.fn(write);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}
/** types into a text area the way a person does, so React sees the change */
async function write(box: HTMLTextAreaElement | null, value: string) {
  expect(box).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(box, value);
    box?.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
/** the older way of copying, from the selected text: true when it copied */
function execCommand(copies: boolean) {
  const exec = vi.fn(() => copies);
  Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
  return exec;
}

describe('Copy for review: a Calendar week', () => {
  it("opens the week's text, with the numbers its row shows", async () => {
    await show([CalendarView], journalWith());
    // one button for the one week with trades, named with its days
    expect(document.querySelectorAll('button[aria-label^="Copy the week"]')).toHaveLength(1);
    await openWeek();
    expect(dialog()?.querySelector('h2')?.textContent).toBe('Copy this week for review');
    expect(text().split('\n').slice(0, 9)).toEqual([
      'A trading week of mine to review: 05 Oct – 11 Oct 2026.',
      '',
      '4 trades: 3 won, 1 lost.',
      'Net: +$45.00.',
      'In R: +4.50R over the 4 trades with a stop.',
      '',
      'Day by day:',
      '- Mon 05 Oct: 2 trades, +$50.00',
      '- Tue 06 Oct: 2 trades, -$5.00',
    ]);
    expect(leaveOut()?.checked).toBe(false);
  });

  it('"Leave out money" writes % of the balance the week began with, and no amount', async () => {
    await show([CalendarView], journalWith());
    await openWeek();
    await click(leaveOut());
    // $1,000 less the $100 lost the week before
    expect(text()).toContain('\nNet: +5.00% of my balance.\n');
    expect(text()).toContain('\n- Mon 05 Oct: 2 trades, +5.56% of my balance\n');
    expect(text()).not.toContain('$');
  });

  it('with amounts hidden, money is left out and stays out', async () => {
    await show([CalendarView], journalWith({ hideMoney: true }));
    await openWeek();
    expect(leaveOut()?.checked).toBe(true);
    expect(leaveOut()?.disabled).toBe(true);
    expect(dialog()?.textContent).toContain(
      'Amounts are hidden (the eye in the header), so they are left out here too.',
    );
    expect(text()).toContain('\nNet: +5.00% of my balance.\n');
    expect(text()).not.toMatch(/\$|•/);
  });

  it('ends with my own instructions, when Settings has them', async () => {
    await show([CalendarView], journalWith({ reviewNote: 'Be brief.' }));
    await openWeek();
    expect(text().endsWith('\n\nBe brief.')).toBe(true);
  });
});

describe('Copy for review: copying', () => {
  it('puts the text on the clipboard, says so, and closes', async () => {
    const writeText = clipboard(async () => {});
    await show([CalendarView], journalWith());
    await openWeek();
    const copied = text();
    await click(button('Copy for review', dialog() ?? document));
    await until(() => !dialog());
    expect(writeText).toHaveBeenCalledWith(copied);
    expect(document.body.textContent).toContain('Copied. Paste it wherever you like.');
  });

  it('with no clipboard to write to, copies the selected text the older way', async () => {
    const exec = execCommand(true);
    await show([CalendarView], journalWith());
    await openWeek();
    await click(button('Copy for review', dialog() ?? document));
    await until(() => !dialog());
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.body.textContent).toContain('Copied. Paste it wherever you like.');
  });

  it("where the device won't copy at all, the text is selected and it says how to copy it by hand", async () => {
    clipboard(() => Promise.reject(new Error('NotAllowedError')));
    execCommand(false);
    await show([CalendarView], journalWith());
    await openWeek();
    await click(button('Copy for review', dialog() ?? document));
    await until(() => Boolean(dialog()?.querySelector('[role="alert"]')));
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
      "This device didn't let the app copy. The text is selected: copy it with Ctrl+C, or press and hold it on a phone.",
    );
    const box = dialog()?.querySelector('textarea');
    expect(document.activeElement).toBe(box);
    expect([box?.selectionStart, box?.selectionEnd]).toEqual([0, text().length]);
    expect(document.body.textContent).not.toContain('Copied.');
  });
});

describe('Copy for review: a Calendar day, and a trade', () => {
  /** a day's cell, by its date */
  const cell = (date: number) =>
    [...document.querySelectorAll<HTMLButtonElement>('.grid-cols-7 > button')].find(
      (b) => b.querySelector('span')?.textContent === String(date),
    ) ?? null;

  it("a day's window copies the day, each trade in full", async () => {
    await show([CalendarView], journalWith());
    await click(cell(5));
    await until(() => Boolean(dialog()));
    await click(button('Copy for review', dialog() ?? document));
    await until(() => text() !== '');
    expect(dialog()?.querySelector('h2')?.textContent).toBe('Copy this day for review');
    expect(text().split('\n').slice(0, 4)).toEqual([
      'A trading day of mine to review: Mon, 05 Oct 2026.',
      '',
      '2 trades: 2 won, 0 lost.',
      'Net: +$50.00.',
    ]);
    expect(text()).toContain('\n1. X, LONG, 05 Oct 2026\n');
    expect(text()).toContain('\n2. X, LONG, 05 Oct 2026\n');
  });

  it('a trade being edited copies the trade; Escape closes the copy and leaves the form open', async () => {
    await show([TradeFormModal], journalWith());
    await act(async () => ui?.openTradeForm({ trade: TRADES[1] }));
    await until(() => Boolean(dialog()));
    await click(document.querySelector<HTMLButtonElement>('button[title="Copy this trade for review"]'));
    await until(() => text() !== '');
    expect(text().split('\n').slice(0, 3)).toEqual([
      'A trade of mine to review: X, 05 Oct 2026.',
      '',
      'X, LONG, 05 Oct 2026',
    ]);
    expect(document.querySelectorAll('[data-modal-root]')).toHaveLength(2);
    await press('Escape');
    await until(() => document.querySelectorAll('[data-modal-root]').length === 1);
    expect(dialog()?.querySelector('h2')?.textContent).toBe('Edit X trade');
  });

  it('copies the trade as the form shows it, saved or not', async () => {
    await show([TradeFormModal], journalWith());
    await act(async () => ui?.openTradeForm({ trade: TRADES[1] }));
    await until(() => Boolean(dialog()));
    await write(dialog()?.querySelector('form textarea') ?? null, 'Late entry.');
    await click(document.querySelector<HTMLButtonElement>('button[title="Copy this trade for review"]'));
    await until(() => text() !== '');
    expect(text()).toContain('Late entry.');
    // and nothing was saved
    expect(journal?.data.trades.find((t) => t.id === TRADES[1].id)?.notes).toBeUndefined();
  });

  it("Ctrl+Enter in the copy window doesn't save the trade form under it", async () => {
    await show([TradeFormModal], journalWith());
    await act(async () => ui?.openTradeForm({ trade: TRADES[1] }));
    await until(() => Boolean(dialog()));
    await write(dialog()?.querySelector('form textarea') ?? null, 'Late entry.');
    await click(document.querySelector<HTMLButtonElement>('button[title="Copy this trade for review"]'));
    await until(() => text() !== '');
    // the window isn't inside the form, so Enter in it can't submit the form either
    expect(dialog()?.closest('form')).toBeNull();
    const box = dialog()?.querySelector('textarea');
    box?.focus();
    await act(async () => {
      box?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }),
      );
    });
    expect(document.querySelectorAll('[data-modal-root]')).toHaveLength(2);
    expect(journal?.data.trades.find((t) => t.id === TRADES[1].id)?.notes).toBeUndefined();
  });

  it('a trade not yet saved has nothing to copy', async () => {
    await show([TradeFormModal], journalWith());
    await act(async () => ui?.openTradeForm());
    await until(() => Boolean(dialog()));
    expect(document.querySelector('button[title="Copy this trade for review"]')).toBeNull();
  });
});

describe('Copy for review: my own instructions, in Settings', () => {
  const section = () =>
    [...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === 'Copy for review') ??
    null;

  it("shows the app's greyed until I write my own, and puts the app's back", async () => {
    await show([SettingsView], journalWith());
    const box = section()?.querySelector('textarea') ?? null;
    expect(box?.value).toBe('');
    expect(box?.placeholder).toMatch(/^Review these trades as my trading coach\./);
    expect(button("Use the app's", section() ?? document)).toBeNull();

    await write(box, 'Grade me hard.\nOne line each.');
    expect(journal?.data.settings.reviewNote).toBe('Grade me hard.\nOne line each.');
    await click(button("Use the app's", section() ?? document));
    expect(journal?.data.settings.reviewNote).toBeUndefined();
    expect(section()?.querySelector('textarea')?.value).toBe('');
  });
});
