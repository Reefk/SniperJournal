// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, createElement as h, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { CURRENCIES } from '@/lib/format';
import { PLATFORMS, importTradesFromCsv } from '@/lib/csv';
import { LANGUAGES, setLanguage, type Language } from '@/lib/i18n';
import { STARTING_MISTAKES } from '@/lib/mistakes';
import { DashboardView } from '@/views/DashboardView';
import { SettingsView } from '@/views/SettingsView';
import { TradesView } from '@/views/TradesView';
import { TradeFormModal } from '@/components/trades/TradeFormModal';
import { BulkDetailsModal } from '@/components/trades/BulkDetailsModal';
import { ImportTradesModal } from '@/components/trades/ImportTradesModal';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider, useUI } from '@/store/UIProvider';
import { pnl, trade } from './helpers';
import { click, mount, type, until } from './render';
import { KEPT } from './i18n-kept';

/**
 * Every screen drawn in each language, with no English left in what a
 * person reads: its text, and the labels, titles and placeholders a screen
 * reader or a pointer shows. What the journal itself holds (names, symbols,
 * the starting mistakes) is the person's own and stays as it is.
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
/** hands the test the journal and the dialogs, to tell when it has loaded and to open one */
function Probe({ onRender }: { onRender: typeof seen }) {
  onRender(useJournal(), useUI());
  return null;
}

/** a day's trades, closed, each for `net`; some with a stop, a rating and a mistake, so every part of a screen shows */
const day = (date: string, nets: number[]): Trade[] =>
  nets.map((net, i) =>
    pnl(net, {
      openedAt: `${date}T1${i}:00`,
      closedAt: `${date}T1${i}:30`,
      symbol: 'X',
      stopLoss: 90,
      entryPrice: 100,
      review: { discipline: 4, execution: 3, patience: 5 },
      mistakes: net < 0 ? [STARTING_MISTAKES[0]] : [],
      tags: ['x1'],
    }),
  );

const TRADES = [
  ...day('2026-10-05', [40, -20, 30]),
  ...day('2026-10-06', [-15, 25]),
  ...day('2026-10-08', [60, -30, 10]),
  ...day('2026-10-12', [-40, 20]),
  ...day('2026-10-14', [35, 15, -5]),
  // one still open
  pnl(0, { openedAt: '2026-10-20T10:00', closedAt: undefined, manualPnl: null, exitPrice: null, symbol: 'X' }),
];

function journalIn(language: Language, trades: Trade[]): JournalData {
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
      goals: { winRate: 50, withStop: 90 },
      language,
    },
    accounts: [
      { id: 'acc1', name: 'A', startingBalance: 1000, createdAt: '' },
      { id: 'acc2', name: 'B', startingBalance: 500, createdAt: '' },
    ],
    activeAccountId: 'acc1',
    trades,
    setups: [{ id: 's1', name: 'S', rules: ['r1', 'r2'], createdAt: '' } as JournalData['setups'][number]],
    resources: [],
  };
}

/** a trade with everything the form shows: a setup with rules, a mistake not on the list, a chart */
const FULL = {
  ...TRADES[1],
  setupId: 's1',
  ruleChecks: { r1: true },
  mistakes: ['No stop', 'Own one'],
  session: 'Asia',
};

/**
 * The list of trades: the two newest are parts of one position, each with a chart and a link,
 * so merging them says all it can; one has three fills, one no quantity, and there are enough
 * for a second page.
 */
const leg = (time: string, exitPrice: number, n: number) =>
  trade({
    openedAt: `2026-10-21T${time}`,
    closedAt: `2026-10-21T${time}`,
    symbol: 'X',
    exitPrice,
    screenshotFile: `${n}.png`,
    screenshotUrl: `https://a.example/${n}`,
  });
const LIST: Trade[] = [
  leg('09:00', 110, 1),
  leg('09:30', 105, 2),
  { ...TRADES[0], fillCount: 3 },
  ...TRADES.slice(1),
  pnl(0, { openedAt: '2026-10-19T10:00', quantity: 0, symbol: 'X' }),
  ...['10', '11', '12', '13'].flatMap((d) => day(`2026-09-${d}`, [10, -5, 20, -10, 5, 15, -20, 30, -15, 10])),
];

/** ticks the first two trades in the table, the newest */
function selectTwo() {
  const boxes = document.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]');
  boxes[0].click();
  boxes[1].click();
}

/**
 * The import window, with a file chosen. The journal has a position open, and two trades the
 * file holds again; the file closes part of the position, and has rows the importer can't read.
 */
const FILLS = 'time,symbol,side,qty,price,fee';
const BOOKED = [
  '2026-03-02 10:00,ESH6,buy,1,5000,1.5',
  '2026-03-02 10:30,ESH6,sell,1,5010,1.5',
  '2026-03-02 11:00,ESH6,sell,1,5010,1.5',
  '2026-03-02 11:30,ESH6,buy,1,5000,1.5',
  '2026-03-02 15:50,MNQZ6,buy,2,21000,1.5',
];
const IN_JOURNAL = importTradesFromCsv([FILLS, ...BOOKED].join('\n'), {
  accountId: 'acc1',
  accounts: [{ id: 'acc1', name: 'A', startingBalance: 1000, createdAt: '' }],
  setups: [],
  existing: [],
  combinePartials: true,
  mapping: {},
  defaultSymbol: '',
}).trades;
const CLOSING = [
  FILLS,
  ...BOOKED,
  '2026-03-03 09:45,MNQZ6,sell,1,21010,1.5',
  '2026-03-03 11:00,ESH6,hold,1,5000,1.5',
  '2026-03-03 11:30,,buy,1,5000,1.5',
].join('\n');
/** whole trades with no fees, a column the journal has no place for, dates that read both ways, and new setups */
const WHOLE = [
  'symbol,side,opened_at,closed_at,quantity,entry_price,exit_price,setup,mood',
  ...['1', '2', '3', '4', '5', '6', '7', '8'].map(
    (i) => `SYM${i},Buy,03/04/2026 10:0${i},03/04/2026 11:00,1,100,10${i},Breakout,calm`,
  ),
  'SYMY,Buy,03/04/2026 10:00,03/04/2026 11:00,,100,101,,calm',
].join('\n');
const PAIRED = readFileSync(join(__dirname, 'fixtures', 'import-samples', 'tradovate_performance.csv'), 'utf8');
const NO_SYMBOL = ['time,side,qty,entry,exit', '2026-03-02 10:00,Long,1,100,101'].join('\n');
/** what a file holds is the person's own, as a trade's symbol is: each name and value in it */
const cells = (csv: string) =>
  csv
    .split(/\r?\n/)
    .flatMap((line) => line.split(/[,;\t]/))
    .map((c) => c.replace(/"/g, '').trim())
    .filter(Boolean);

const importWindow = () => h(ImportTradesModal, { open: true, onClose() {} });
/** chooses `csv` as the file, as a person does */
function choose(csv: string) {
  const input = document.querySelector<HTMLInputElement>('[data-modal-root] input[type="file"]');
  Object.defineProperty(input, 'files', { configurable: true, value: [new File([csv], 'trades.csv')] });
  input?.dispatchEvent(new Event('change', { bubbles: true }));
}
const read = () => Boolean(document.querySelector('[data-modal-root] svg.lucide-circle-check'));
/** every box ticked, your own fee per contract, then imported */
async function tickAll() {
  for (const box of document.querySelectorAll<HTMLInputElement>('[data-modal-root] input[type="checkbox"]'))
    await click(box);
  const fee = document.querySelector('[data-modal-root] option[value="contract"]')?.parentElement as HTMLSelectElement;
  await type(fee, 'contract');
  await type(document.querySelector<HTMLInputElement>('[data-modal-root] input[inputmode="decimal"]'), '0');
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-modal-root] button');
  await click(buttons[buttons.length - 1]);
}

const SCREENS: Array<{
  name: string;
  view: () => ReactNode;
  trades: Trade[];
  open?: () => void;
  modal?: false;
  /** once open, what to wait for, and what to do then */
  ready?: () => boolean;
  then?: () => Promise<void>;
  /** what the screen shows of the person's own, beside the journal's */
  own?: string[];
}> = [
  { name: 'Dashboard', view: DashboardView, trades: TRADES },
  { name: 'Dashboard, empty', view: DashboardView, trades: [] },
  { name: 'Settings', view: SettingsView, trades: TRADES },
  { name: 'Trade form, new', view: TradeFormModal, trades: TRADES, open: () => ui?.openTradeForm() },
  { name: 'Trade form, editing', view: TradeFormModal, trades: [FULL], open: () => ui?.openTradeForm({ trade: FULL }) },
  { name: 'Add details to many', view: () => h(BulkDetailsModal, { ids: ['a', 'b'], onClose() {} }), trades: TRADES },
  { name: 'Trades', view: TradesView, trades: LIST },
  { name: 'Trades, empty', view: TradesView, trades: [] },
  { name: 'Trades, two selected', view: TradesView, trades: LIST, open: selectTwo, modal: false },
  {
    name: 'Trades, merging two',
    view: TradesView,
    trades: LIST,
    open: async () => {
      selectTwo();
      await Promise.resolve();
      document.querySelector('svg.lucide-merge')?.closest('button')?.click();
    },
  },
  { name: 'Import, no file yet', view: importWindow, trades: TRADES, open: () => undefined },
  {
    name: 'Import, a file that finishes an open trade',
    view: importWindow,
    trades: IN_JOURNAL,
    open: () => choose(CLOSING),
    ready: read,
    own: cells(CLOSING),
  },
  {
    name: 'Import, the same with every box ticked, imported',
    view: importWindow,
    trades: IN_JOURNAL,
    open: () => choose(CLOSING),
    ready: read,
    then: tickAll,
    own: cells(CLOSING),
  },
  {
    name: 'Import, whole trades',
    view: importWindow,
    trades: [],
    open: () => choose(WHOLE),
    ready: read,
    own: cells(WHOLE),
  },
  {
    name: 'Import, whole trades, boxes ticked',
    view: importWindow,
    trades: [],
    open: () => choose(WHOLE),
    ready: read,
    then: tickAll,
    own: cells(WHOLE),
  },
  {
    name: 'Import, paired fills',
    view: importWindow,
    trades: [],
    open: () => choose(PAIRED),
    ready: read,
    own: cells(PAIRED),
  },
  {
    name: 'Import, no symbol column',
    view: importWindow,
    trades: [],
    open: () => choose(NO_SYMBOL),
    ready: read,
    own: cells(NO_SYMBOL),
  },
];

/** what may stay in Latin letters: the kept words, and the journal's and the app's own names */
const ALLOWED = [
  ...KEPT,
  ...CURRENCIES,
  ...LANGUAGES.map((l) => l.name),
  // the platforms, and their own names for their menus and reports
  ...PLATFORMS.flatMap((p) => [
    p.name,
    ...Object.values(p.how.names ?? {}),
    ...p.exports.flatMap((e) => Object.values(e.instead?.names ?? {})),
  ]),
  'Flex Query',
  'Advanced',
  // the column names, as brokers write them, in "Which columns are understood"
  'Qty',
  'Filled',
  'Market pos.',
  'Comm/Fee',
  'Net P&L (USD)',
  'Date/Time',
  'Start Price',
  'Lots Traded',
  'ESH6',
  'MNQ 03-26',
  // the name of the file chosen
  'trades.csv',
  // the trade's own words, and an example address
  'Own one',
  'NVDA, EURUSD, BTC',
  'https://www.tradingview.com/x/…',
  // what Spanish traders call them too
  'Stop loss',
  'stop loss',
  'Take profit',
];
const allowed = (words: string[]) =>
  [...new Set(words)]
    .sort((a, b) => b.length - a.length)
    .map((word) => new RegExp(`(^|[^A-Za-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^A-Za-z]|$)`, 'g'));

/** English words that are not also Spanish, to find what was left untranslated in Spanish ("importó" is not "import") */
const ENGLISH =
  /(?<!\p{L})(the|and|of|your|trades?|with|for|is|are|you|this|that|from|days?|wins?|loss(es)?|rate|profit|average|closed|show|view|log|balance|settings|delete|edit|add|yet|per|green|red|best|worst|largest|streak|current|recent|equity|curve|rated|backups?|images?|account|tags?|mistakes?|limits?|goals?|cancel|confirm|close|save|import|export|merge|search|filters?|selected|shown|open|needs|details|page|next|previous|net)(?!\p{L})/iu;

/** each piece of text the page shows or says, one per text node or attribute */
function shown(): string[] {
  const out: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent?.closest('script, style')) continue;
    if (node.textContent?.trim()) out.push(node.textContent.trim());
  }
  for (const el of document.body.querySelectorAll('*')) {
    for (const name of ['aria-label', 'placeholder', 'title', 'alt', 'aria-description']) {
      const value = el.getAttribute(name);
      if (value?.trim()) out.push(value.trim());
    }
  }
  return out;
}

function leftovers(code: Language, own: string[] = []): string[] {
  const words = allowed([...ALLOWED, ...own]);
  return shown().filter((text) => {
    let rest = text;
    for (const word of words) rest = rest.replace(word, '$1 ');
    return code === 'es' ? ENGLISH.test(rest) : /[A-Za-z]{2}/.test(rest);
  });
}

let app: Awaited<ReturnType<typeof mount>> | null;

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
  setLanguage('en');
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe.each(LANGUAGES.filter((l) => l.code !== 'en'))('$name', ({ code, dir }) => {
  // a whole screen drawn in jsdom: alone it takes a second or two, beside the rest of the suite it can take more than 5
  it.each(SCREENS)(
    '$name has no English left',
    { timeout: 30_000 },
    async ({ view, trades, open, modal, ready, then, own }) => {
      disk.journal = journalIn(code, trades);
      app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Probe, { onRender: seen }), h(view))));
      await until(() => journal?.ready === true);
      if (open) {
        await act(async () => open());
        if (modal !== false) await until(() => Boolean(document.querySelector('[data-modal-root]')));
      }
      if (ready) await until(ready);
      if (then) await then();
      expect(document.documentElement.lang).toBe(code);
      expect(document.documentElement.dir).toBe(dir);
      expect(leftovers(code, own)).toEqual([]);
    },
  );
});
