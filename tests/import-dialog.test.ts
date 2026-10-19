// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, JournalData } from '@/lib/types';
import { ImportTradesModal } from '@/components/trades/ImportTradesModal';
import { importTradesFromCsv } from '@/lib/csv';
import { JournalProvider } from '@/store/JournalProvider';
import { UIProvider } from '@/store/UIProvider';
import { mount, until } from './render';

/**
 * The import dialog's preview (src/components/trades/ImportTradesModal.tsx)
 * says what the importer returned for the file: as many rows ready to import,
 * the same rows in the table, and the same problems in its list. Rendered in
 * jsdom against a stand-in for the PC's storage; the file is handed to the
 * dialog's file input as a person choosing it would.
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

const accounts: Account[] = [{ id: 'acc1', name: 'Main', startingBalance: 1000, createdAt: '' }];
/** what the dialog asks the importer for a file read automatically, into an empty journal */
const importerSays = (csv: string) =>
  importTradesFromCsv(csv, {
    accountId: 'acc1',
    accounts,
    setups: [],
    existing: [],
    combinePartials: true,
    mapping: {},
    defaultSymbol: '',
  });

const HEADER = 'symbol,side,opened_at,closed_at,quantity,entry_price,exit_price,fees';
const row = (i: number, side = 'Buy', quantity = '1') =>
  `SYM${i},${side},2026-03-0${1 + (i % 9)} 10:00,2026-03-0${1 + (i % 9)} 11:00,${quantity},100,${100 + i},1`;

let app: Awaited<ReturnType<typeof mount>>;
const dialog = () => document.querySelector<HTMLElement>('[data-modal-root]');
const text = () => dialog()?.textContent ?? '';

beforeEach(async () => {
  localStorage.clear();
  disk.journal = {
    version: 1,
    updatedAt: '2026-10-14T09:00:00.000Z',
    onboarded: true,
    profile: { name: 'Test' },
    settings: { currency: 'USD', theme: 'dark', timezone: 'local', maxDailyLoss: null, maxTradesPerDay: null },
    accounts,
    activeAccountId: 'acc1',
    trades: [],
    setups: [],
    resources: [],
  } satisfies JournalData;
  app = await mount(h(JournalProvider, null, h(UIProvider, null, h(ImportTradesModal, { open: true, onClose() {} }))));
  await until(() => Boolean(dialog()?.querySelector('input[type=file]')));
});
afterEach(async () => {
  await app.unmount();
});

/** chooses `csv` as the file, then waits for the preview */
async function choose(csv: string) {
  const input = dialog()?.querySelector<HTMLInputElement>('input[type=file]');
  expect(input).toBeTruthy();
  if (!input) return;
  const file = new File([csv], 'trades.csv', { type: 'text/csv' });
  await act(async () => {
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await until(() => /ready to import/.test(text()));
}

const readyCount = () => Number(text().match(/(\d+)\s*ready to import/)?.[1]);
const tableRows = () => dialog()?.querySelectorAll('tbody tr').length ?? 0;
/**
 * the dialog's list of problems, one line each. Found by its red text
 * (text-loss), the one thing that marks them; no file error is shown in
 * these tests, which uses the same colour.
 */
const errorLines = () => [...(dialog()?.querySelectorAll('p.text-loss') ?? [])].map((p) => p.textContent?.trim() ?? '');

describe('the preview says what the importer returned', () => {
  it('as many rows ready to import, the first 6 in the table, and the rest counted', async () => {
    const csv = [HEADER, ...Array.from({ length: 9 }, (_, i) => row(i + 1))].join('\n');
    const result = importerSays(csv);
    expect(result.trades).toHaveLength(9);
    await choose(csv);
    expect(readyCount()).toBe(result.trades.length);
    expect(tableRows()).toBe(6);
    expect(text()).toContain(`…and ${result.trades.length - 6} more rows.`);
    expect(errorLines()).toEqual([]);
  });

  it('the same problems in its list, and the rows that need details counted', async () => {
    const csv = [
      HEADER,
      row(1),
      row(2, 'Sell'),
      row(3, 'Hold'), // a direction it doesn't know: imported as LONG, and said so
      row(4, 'Buy', ''), // no size: imported, marked needs details, and said so
      ',Buy,2026-03-05 10:00,2026-03-05 11:00,1,100,101,1', // no symbol: skipped, and said so
    ].join('\n');
    const result = importerSays(csv);
    expect(result.trades).toHaveLength(4);
    expect(result.errors).toHaveLength(3);
    await choose(csv);
    expect(readyCount()).toBe(result.trades.length);
    expect(tableRows()).toBe(result.trades.length);
    expect(errorLines()).toEqual(result.errors);
    const incomplete = result.trades.filter((t) => t.needsReview).length;
    expect(incomplete).toBe(1);
    expect(text()).toContain(`${incomplete} need details before they count`);
  });

  it('a long list of problems: the first 30, and how many more', async () => {
    // every direction it doesn't know is a problem of its own
    const csv = [HEADER, ...Array.from({ length: 32 }, (_, i) => row(i + 1, `Way${i + 1}`))].join('\n');
    const result = importerSays(csv);
    expect(result.errors).toHaveLength(32);
    await choose(csv);
    expect(errorLines()).toEqual(result.errors.slice(0, 30));
    expect(text()).toContain('…and 2 more.');
  });
});
