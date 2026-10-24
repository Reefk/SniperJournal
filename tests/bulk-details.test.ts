// @vitest-environment jsdom
import { createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { BulkDetailsModal } from '@/components/trades/BulkDetailsModal';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider } from '@/store/UIProvider';
import { button, click, field, mount, press, type, until } from './render';
import { trade } from './helpers';

/**
 * Trades → Add details (src/components/trades/BulkDetailsModal.tsx): one fee
 * for the trades selected, per trade or per contract on each side. Rendered
 * in jsdom against a stand-in for the PC's storage; made-up trades only.
 */
const disk = vi.hoisted(() => ({ journal: null as unknown, written: null as unknown }));
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
    async writeJournal(journal: unknown) {
      disk.written = journal;
      return 'C:\\journal\\data\\journal.json';
    },
    async keepCopy() {
      return null;
    },
    imageSrc: () => '',
    async deleteImage() {},
  },
}));

const closed = trade({ id: 'closed', symbol: 'MESZ6', quantity: 2, entryPrice: 5000, exitPrice: 5010, fees: 1 });
const open = trade({
  id: 'open',
  symbol: 'MESZ6',
  quantity: 3,
  entryPrice: 5020,
  exitPrice: null,
  closedAt: undefined,
  fees: 1,
});
const other = trade({ id: 'other', symbol: 'MESZ6', quantity: 5, entryPrice: 5000, exitPrice: 5001, fees: 1 });

let app: Awaited<ReturnType<typeof mount>>;
const dialog = () => document.querySelector<HTMLElement>('[data-modal-root]') ?? document;
const written = () => disk.written as JournalData | null;
const feesOf = (trades: Trade[] | undefined) => Object.fromEntries((trades ?? []).map((t) => [t.id, t.fees]));

beforeEach(async () => {
  // the journal's copy in this browser, newer than the one on `disk`, would win
  localStorage.clear();
  disk.written = null;
  disk.journal = {
    version: 1,
    updatedAt: '2026-10-14T09:00:00.000Z',
    onboarded: true,
    profile: { name: 'Test' },
    settings: { currency: 'USD', theme: 'dark', timezone: 'local', maxDailyLoss: null, maxTradesPerDay: null },
    accounts: [{ id: 'acc1', name: 'Main', startingBalance: 1000, createdAt: '' }],
    activeAccountId: 'acc1',
    trades: [closed, open, other],
    setups: [],
    resources: [],
  } satisfies JournalData;
  // the dialog opened once the journal has loaded, for the first two trades
  const page = (shown: boolean) =>
    h(
      JournalProvider,
      null,
      h(UIProvider, null, h(Loaded), shown && h(BulkDetailsModal, { ids: ['closed', 'open'], onClose() {} })),
    );
  app = await mount(page(false));
  await until(() => document.querySelector('[data-loaded]')?.textContent === '3');
  await app.render(page(true));
  await until(() => Boolean(field('Fees', dialog())));
});
afterEach(async () => {
  await app.unmount();
});

/** how many trades the journal holds, so a test can tell it has loaded */
function Loaded() {
  const { data } = useJournal();
  return h('span', { 'data-loaded': '' }, data.trades.length);
}

/** types the fee, chooses how it is charged, and applies it; done once the open trade is saved at `openFee` */
async function applyFee(amount: string, per: 'trade' | 'contract' | undefined, openFee: number) {
  await type(field('Fees', dialog()), amount);
  if (per) await type(field('Charged', dialog()), per);
  await click(button('Apply to 2', dialog()));
  await until(() => written()?.trades.find((t) => t.id === 'open')?.fees === openFee);
}

describe('Add details: fees for the trades selected', () => {
  it('per trade, as before: the amount on each trade, whatever its size', async () => {
    expect(field('Charged', dialog())?.value).toBe('trade');
    await applyFee('1.24', undefined, 1.24);
    expect(feesOf(written()?.trades)).toEqual({ closed: 1.24, open: 1.24, other: 1 });
  });

  it('per contract, each side: × the size, in and out; a trade still open pays its way in', async () => {
    // 0.95 × 2 contracts × 2 sides, and 0.95 × 3 contracts on the way in
    await applyFee('0,95', 'contract', 2.85);
    expect(feesOf(written()?.trades)).toEqual({ closed: 3.8, open: 2.85, other: 1 });
  });

  it('per contract, with tags added to each trade as well: both are kept', async () => {
    const tags = field('Tags', dialog());
    await type(tags, 'news');
    tags?.focus();
    await press('Enter');
    await applyFee('0.5', 'contract', 1.5);
    const saved = written()?.trades;
    expect(feesOf(saved)).toEqual({ closed: 2, open: 1.5, other: 1 });
    expect(saved?.map((t) => t.tags)).toEqual([['news'], ['news'], []]);
  });

  it('left blank, every fee stays as it was', async () => {
    await type(field('Charged', dialog()), 'contract');
    await type(field('Leverage', dialog()), '10');
    await click(button('Apply to 2', dialog()));
    await until(() => written()?.trades.find((t) => t.id === 'open')?.leverage === 10);
    expect(feesOf(written()?.trades)).toEqual({ closed: 1, open: 1, other: 1 });
  });
});
