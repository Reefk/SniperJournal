// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { TradeFormModal } from '@/components/trades/TradeFormModal';
import { isIncomplete } from '@/lib/trade-math';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider, useUI } from '@/store/UIProvider';
import { trade } from './helpers';
import { button, click, field, mount, type, until } from './render';

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

  // Under review: an edit marks a trade with an entry price of 0 needsReview
  // (above), but a new one is saved without the mark, because addTrade in
  // src/store/JournalProvider.tsx doesn't set it as updateTrade does. Nothing
  // reads the stored mark on a journal's trades today (the Trades page and the
  // statistics ask isIncomplete), so nothing a user sees is wrong. Planned: set
  // it on add too, or refuse an entry price of 0 in the form.
  it('current behaviour, under review: a new trade with an entry price of 0 is saved without needsReview', async () => {
    await log('AMD', '2', '0');
    await until(() => !dialog());
    const t = logged();
    expect(t).toMatchObject({ symbol: 'AMD', entryPrice: 0 });
    expect(t && isIncomplete(t)).toBe(true);
    expect(t?.needsReview).toBeUndefined();
  });
});
