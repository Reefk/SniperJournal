// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, JournalData } from '@/lib/types';
import { ImportTradesModal } from '@/components/trades/ImportTradesModal';
import { importTradesFromCsv } from '@/lib/csv';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider } from '@/store/UIProvider';
import { button, click, field, mount, type, until } from './render';

/**
 * The import dialog's preview (src/components/trades/ImportTradesModal.tsx)
 * says what the importer returned for the file: as many rows ready to import,
 * the same rows in the table, and the same problems in its list. Rendered in
 * jsdom against a stand-in for the PC's storage; the file is handed to the
 * dialog's file input as a person choosing it would.
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
  disk.written = null;
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
  await open();
});
afterEach(async () => {
  await app.unmount();
});

/**
 * the dialog, opened once the journal on `disk` has loaded, as in the app:
 * what it starts with (the account, its remembered fee) comes from that journal
 */
async function open() {
  const page = (isOpen: boolean) =>
    h(JournalProvider, null, h(UIProvider, null, h(Loaded), h(ImportTradesModal, { open: isOpen, onClose() {} })));
  app = await mount(page(false));
  await until(() => document.querySelector('[data-loaded]')?.textContent === 'acc1');
  await app.render(page(true));
  await until(() => Boolean(dialog()?.querySelector('input[type=file]')));
}
/** the journal's first account, so a test can tell it has loaded */
function Loaded() {
  const { data } = useJournal();
  return h('span', { 'data-loaded': '' }, data.accounts[0]?.id);
}

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
    expect(text()).toContain('1 needs details before it counts');
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

describe('a file with no fees of its own: a fee to add', () => {
  const NO_FEES_FILE = [
    'symbol,side,opened_at,closed_at,quantity,entry_price,exit_price',
    'MESZ6,Buy,2026-03-02 10:00,2026-03-02 11:00,2,5000,5010',
  ].join('\n');
  const inDialog = (label: string) => field(label, dialog() ?? document);
  const written = () => disk.written as JournalData | null;
  const FEE_KEY = 'sniper-journal:import-fee:acc1';

  it('per contract: the preview, its totals and the journal get it, and it is remembered for the account', async () => {
    await choose(NO_FEES_FILE);
    // said once, in the fee box, and not again among the notices
    expect(text().split('There are no fees in this file').length).toBe(2);
    expect(text()).toContain('Fees on these trades $0.00');
    await type(inDialog('Fee to add'), 'contract');
    await type(inDialog('Amount'), '0,95');
    // 0.95 × 2 contracts, in and out; 10 points × 2 × $5 = 100, less 3.80
    await until(() => text().includes('Fees on these trades $3.80'));
    expect(dialog()?.querySelector('tbody')?.textContent).toContain('+$96.20');
    await click(button('Import 1 trade', dialog() ?? document));
    await until(() => written()?.trades.length === 1);
    expect(written()?.trades[0].fees).toBe(3.8);
    expect(JSON.parse(localStorage.getItem(FEE_KEY) ?? 'null')).toEqual({ per: 'contract', amount: '0,95' });
  });

  it('the next file into that account starts with the fee remembered', async () => {
    await app.unmount();
    localStorage.setItem(FEE_KEY, JSON.stringify({ per: 'trade', amount: '1.25' }));
    await open();
    await choose(NO_FEES_FILE);
    expect(inDialog('Fee to add')?.value).toBe('trade');
    expect(inDialog('Amount')?.value).toBe('1.25');
    expect(text()).toContain('Fees on these trades $1.25');
  });

  it('an amount not above 0 is said, and adds nothing', async () => {
    await choose(NO_FEES_FILE);
    await type(inDialog('Fee to add'), 'trade');
    await type(inDialog('Amount'), '0');
    await until(() => text().includes('Enter an amount above 0'));
    expect(text()).toContain('Fees on these trades $0.00');
  });

  it('a file with fees of its own is not given the fee remembered for files with none', async () => {
    await app.unmount();
    localStorage.setItem(FEE_KEY, JSON.stringify({ per: 'contract', amount: '0.95' }));
    await open();
    await choose([HEADER, row(1)].join('\n'));
    expect(inDialog('Fee to add')).toBeNull();
    expect(inDialog('Fees')?.value).toBe('none');
    expect(text()).not.toContain('There are no fees in this file');
    expect(text()).toContain('Fees on these trades $1.00');
  });
});

describe('a file with fees of its own: yours in their place, if you like', () => {
  const inDialog = (label: string) => field(label, dialog() ?? document);
  const written = () => disk.written as JournalData | null;

  it("keeps the file's fees unless told otherwise; per contract replaces them, for this import only", async () => {
    await choose([HEADER, row(1)].join('\n'));
    expect(text()).toContain('The fees come from this file');
    expect(inDialog('Fees')?.value).toBe('none');
    expect(inDialog('Amount')).toBeNull();
    // the file's fee of 1 on the trade
    expect(text()).toContain('Fees on these trades $1.00');
    await type(inDialog('Fees'), 'contract');
    await type(inDialog('Amount'), '0.75');
    // 0.75 × 1 contract, in and out
    await until(() => text().includes('Fees on these trades $1.50'));
    await click(button('Import 1 trade', dialog() ?? document));
    await until(() => written()?.trades.length === 1);
    expect(written()?.trades[0].fees).toBe(1.5);
    // nothing is remembered: the next file with fees starts from its own
    expect(Object.keys(localStorage).filter((k) => k.startsWith('sniper-journal:import-fee:'))).toEqual([]);
  });

  it("the next file chosen starts again from the file's own fees", async () => {
    await choose([HEADER, row(1)].join('\n'));
    await type(inDialog('Fees'), 'trade');
    await type(inDialog('Amount'), '3');
    await until(() => text().includes('Fees on these trades $3.00'));
    await choose([HEADER, row(1), row(2)].join('\n'));
    await until(() => text().includes('Fees on these trades $2.00'));
    expect(inDialog('Fees')?.value).toBe('none');
  });
});
