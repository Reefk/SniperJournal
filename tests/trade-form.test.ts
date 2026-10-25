// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { TradeFormModal } from '@/components/trades/TradeFormModal';
import { isIncomplete } from '@/lib/trade-math';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider, useUI } from '@/store/UIProvider';
import { STARTING_MISTAKES } from '@/lib/mistakes';
import { trade } from './helpers';
import { button, click, field, mount, press, type, until } from './render';

/**
 * The trade form (src/components/trades/TradeFormModal.tsx), saving through
 * the real journal: a trade that still lacks something it needs comes back
 * marked needsReview, and one that has everything does not. Rendered in jsdom
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

type Seen = { ui: ReturnType<typeof useUI>; journal: ReturnType<typeof useJournal> };
let seen: Seen | null;
const rendered = (s: Seen) => {
  seen = s;
};
/** hands the test the app's own state and actions */
function Probe({ onRender }: { onRender: typeof rendered }) {
  onRender({ ui: useUI(), journal: useJournal() });
  return null;
}

/** an import that had no entry price: the importer leaves 0 and marks it */
const imported = trade({ id: 'imp1', symbol: 'NVDA', entryPrice: 0, exitPrice: 110, needsReview: true });
const saved = (id: string): Trade | undefined => seen?.journal.data.trades.find((t) => t.id === id);
const dialog = () => document.querySelector<HTMLElement>('[data-modal-root]');

let app: Awaited<ReturnType<typeof mount>>;
beforeEach(async () => {
  localStorage.clear();
  seen = null;
  disk.journal = {
    version: 1,
    updatedAt: '2026-10-14T09:00:00.000Z',
    onboarded: true,
    profile: { name: 'Test' },
    settings: { currency: 'USD', theme: 'dark', timezone: 'local', maxDailyLoss: null, maxTradesPerDay: null },
    accounts: [{ id: 'acc1', name: 'Main', startingBalance: 1000, createdAt: '' }],
    activeAccountId: 'acc1',
    trades: [imported],
    setups: [],
    resources: [],
  } satisfies JournalData;
  app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Probe, { onRender: rendered }), h(TradeFormModal))));
  await until(() => seen?.journal.ready === true);
});
afterEach(async () => {
  await app.unmount();
});

async function open(t?: Trade) {
  await act(async () => seen?.ui.openTradeForm(t ? { trade: t } : undefined));
  await until(() => Boolean(dialog()));
}

describe('editing a trade an import left incomplete', () => {
  beforeEach(async () => {
    await open(imported);
  });

  it('shows the missing entry price as empty, not as 0', () => {
    expect(field('Entry price', dialog() ?? document)?.value).toBe('');
  });

  it('with the entry price still missing, is not saved, says why, and stays marked', async () => {
    await click(button('Save changes', dialog() ?? document));
    expect(dialog()?.textContent).toContain('Enter the entry price');
    // the form stays open and the trade is as it was, not saved again
    expect(dialog()).toBeTruthy();
    expect(saved('imp1')).toMatchObject({ entryPrice: 0, needsReview: true, updatedAt: imported.updatedAt });
  });

  it('with an entry price of 0, which is what an empty column becomes, comes back marked needsReview', async () => {
    await type(field('Entry price', dialog() ?? document), '0');
    await click(button('Save changes', dialog() ?? document));
    await until(() => !dialog());
    expect(saved('imp1')).toMatchObject({ entryPrice: 0, needsReview: true });
  });

  it('with the entry price filled in, comes back without needsReview', async () => {
    await type(field('Entry price', dialog() ?? document), '101');
    await click(button('Save changes', dialog() ?? document));
    await until(() => !dialog());
    expect(saved('imp1')).toMatchObject({ entryPrice: 101, exitPrice: 110 });
    expect(saved('imp1')?.needsReview).toBeUndefined();
  });
});

describe('logging a new trade by hand', () => {
  const logged = () => seen?.journal.data.trades.find((t) => t.id !== 'imp1');
  async function log(symbol: string, quantity: string, entry: string) {
    await open();
    await type(field('Symbol', dialog() ?? document), symbol);
    await type(field('Quantity', dialog() ?? document), quantity);
    await type(field('Entry price', dialog() ?? document), entry);
    await click(button('Save trade', dialog() ?? document));
  }

  it('is not saved without its quantity, and says why', async () => {
    await log('AMD', '', '150');
    expect(dialog()?.textContent).toContain('Must be more than 0');
    expect(logged()).toBeUndefined();
  });

  it('with everything it needs, is saved without needsReview', async () => {
    await log('AMD', '2', '150');
    await until(() => !dialog());
    expect(logged()).toMatchObject({ symbol: 'AMD', quantity: 2, entryPrice: 150 });
    expect(logged()?.needsReview).toBeUndefined();
  });

  // decided 2026-10-19: marked, as an edit is (until then a new one was saved
  // without the mark, though the Trades page showed it as needing details)
  it('with an entry price of 0, which is what an empty column becomes, is saved marked needsReview', async () => {
    await log('AMD', '2', '0');
    await until(() => !dialog());
    const t = logged();
    expect(t).toMatchObject({ symbol: 'AMD', entryPrice: 0, needsReview: true });
    expect(t && isIncomplete(t)).toBe(true);
  });
});

describe('the mistakes a trade made', () => {
  const chip = (name: string) => button(name, dialog() ?? document);
  const pressed = (name: string) => chip(name)?.getAttribute('aria-pressed');
  const list = () => seen?.journal.data.settings.mistakes;
  /** the imported trade, with the entry price it lacks */
  async function edit() {
    await open(saved('imp1'));
    await type(field('Entry price', dialog() ?? document), '101');
  }

  it('are tapped from the list, and tapped again to take one off', async () => {
    await edit();
    expect(pressed('Oversized')).toBe('false');
    await click(chip('Oversized'));
    await click(chip('No stop'));
    await click(chip('No stop'));
    expect(pressed('Oversized')).toBe('true');
    expect(pressed('No stop')).toBe('false');
    await click(button('Save changes', dialog() ?? document));
    await until(() => !dialog());
    expect(saved('imp1')?.mistakes).toEqual(['Oversized']);
    // the list is still the starting one, not written out
    expect(list()).toBeUndefined();
  });

  it('a new one named in the form goes on the trade and on the list; one the list has is that one', async () => {
    await edit();
    for (const typed of ['  traded  the open ', 'oversized']) {
      await click(chip('Add one'));
      const input = dialog()?.querySelector<HTMLInputElement>('input[aria-label="New mistake"]') ?? null;
      await type(input, typed);
      input?.focus();
      await press('Enter');
      // back on "Add one", so the keyboard can name another
      expect(document.activeElement).toBe(chip('Add one'));
    }
    expect(pressed('traded the open (not on your list)')).toBe('true');
    expect(pressed('Oversized')).toBe('true');
    await click(button('Save changes', dialog() ?? document));
    await until(() => !dialog());
    expect(saved('imp1')?.mistakes).toEqual(['traded the open', 'Oversized']);
    expect(list()).toEqual([...STARTING_MISTAKES, 'traded the open']);
  });

  it('one the trade has that was taken off the list is shown, kept, and stays off the list', async () => {
    await act(async () => {
      seen?.journal.actions.saveMistakes(['Oversized']);
      seen?.journal.actions.patchTrades(['imp1'], { mistakes: ['Gone'] });
    });
    await edit();
    expect(pressed('Gone (not on your list)')).toBe('true');
    await click(button('Save changes', dialog() ?? document));
    await until(() => !dialog());
    expect(saved('imp1')?.mistakes).toEqual(['Gone']);
    expect(list()).toEqual(['Oversized']);
  });

  it('a name typed and left, as on a phone, is added; one only spaces, or one already there, is not', async () => {
    await act(async () => seen?.journal.actions.patchTrades(['imp1'], { mistakes: ['Gone'] }));
    await edit();
    const input = () => dialog()?.querySelector<HTMLInputElement>('input[aria-label="New mistake"]') ?? null;
    const leave = async (typed: string) => {
      await click(chip('Add one'));
      await type(input(), typed);
      await act(async () => input()?.blur());
    };
    await leave('   ');
    expect(input()).toBeNull();
    await leave('Traded the open');
    // a removed mistake typed again in other capitals is the trade's own
    await leave('gone');
    expect(pressed('Traded the open (not on your list)')).toBe('true');
    expect(pressed('Gone (not on your list)')).toBe('true');
    await click(button('Save changes', dialog() ?? document));
    await until(() => !dialog());
    expect(saved('imp1')?.mistakes).toEqual(['Gone', 'Traded the open']);
    expect(list()).toEqual([...STARTING_MISTAKES, 'Traded the open']);
  });

  it('a trade that is not saved puts nothing on the list; one saved with two new names puts both, once', async () => {
    await open();
    await type(field('Symbol', dialog() ?? document), 'AMD');
    await type(field('Entry price', dialog() ?? document), '150');
    for (const typed of ['Traded the open', 'No plan']) {
      await click(chip('Add one'));
      const input = dialog()?.querySelector<HTMLInputElement>('input[aria-label="New mistake"]') ?? null;
      await type(input, typed);
      await act(async () => input?.blur());
    }
    // no quantity yet: not saved, and the list is as it was
    await click(button('Save trade', dialog() ?? document));
    expect(dialog()?.textContent).toContain('Must be more than 0');
    expect(list()).toBeUndefined();
    await type(field('Quantity', dialog() ?? document), '2');
    await click(button('Save trade', dialog() ?? document));
    await until(() => !dialog());
    expect(list()).toEqual([...STARTING_MISTAKES, 'Traded the open', 'No plan']);
    expect(seen?.journal.data.trades.find((t) => t.symbol === 'AMD')?.mistakes).toEqual(['Traded the open', 'No plan']);
  });

  it('all taken off leaves the trade with none', async () => {
    await act(async () => seen?.journal.actions.patchTrades(['imp1'], { mistakes: ['Oversized'] }));
    await edit();
    await click(chip('Oversized'));
    await click(button('Save changes', dialog() ?? document));
    await until(() => !dialog());
    expect(saved('imp1')?.mistakes).toBeUndefined();
  });

  it('a new trade starts with none, also after "Save and log another"', async () => {
    await open();
    await type(field('Symbol', dialog() ?? document), 'AMD');
    await type(field('Quantity', dialog() ?? document), '2');
    await type(field('Entry price', dialog() ?? document), '150');
    await click(chip('Revenge trade'));
    await click(button('Save and log another + next', dialog() ?? document));
    expect(pressed('Revenge trade')).toBe('false');
    expect(seen?.journal.data.trades.find((t) => t.symbol === 'AMD')?.mistakes).toEqual(['Revenge trade']);
  });
});
