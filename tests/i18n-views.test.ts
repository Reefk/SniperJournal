// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, createElement as h, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { CURRENCIES } from '@/lib/format';
import { PLATFORMS, importTradesFromCsv } from '@/lib/csv';
import { LANGUAGES, setLanguage, tr, type Language } from '@/lib/i18n';
import { reports } from '@/lib/i18n/en/reports';
import type { RangeKey } from '@/lib/ranges';
import { STARTING_MISTAKES } from '@/lib/mistakes';
import { CalendarView } from '@/views/CalendarView';
import { DashboardView } from '@/views/DashboardView';
import { InsightsView } from '@/views/InsightsView';
import { ReportsView } from '@/views/ReportsView';
import { PlaybookView } from '@/views/PlaybookView';
import { ResourcesView } from '@/views/ResourcesView';
import { SettingsView } from '@/views/SettingsView';
import { SupportView } from '@/views/SupportView';
import { TradesView } from '@/views/TradesView';
import { TradeFormModal } from '@/components/trades/TradeFormModal';
import { BulkDetailsModal } from '@/components/trades/BulkDetailsModal';
import { ImportTradesModal } from '@/components/trades/ImportTradesModal';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider, useUI } from '@/store/UIProvider';
import { pnl, trade } from './helpers';
import { click, mount, type, until } from './render';
import { ENGLISH, KEPT, SUPPORT_TYPED } from './i18n-kept';
import { INSIGHTS, INSIGHT_SETUPS } from './insights-journal';

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
/** every key a screen asks tr() for, so a test can tell that none of an area's text went unseen */
const asked = vi.hoisted(() => new Set<string>());
vi.mock('@/lib/i18n', async (original) => {
  const i18n = await original<typeof import('@/lib/i18n')>();
  return {
    ...i18n,
    tr: (...args: Parameters<typeof i18n.tr>) => {
      asked.add(args[0]);
      return i18n.tr(...args);
    },
  };
});
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

/** the Calendar's trades with no stop and no rating, so the Sniper Score has axes it can't score */
const UNRATED = TRADES.map((t) => ({ ...t, stopLoss: null, review: undefined }));
/** the Calendar's trades in the journal's setup and in one since deleted, so Reports has its table of setups */
const IN_SETUPS = TRADES.map((t, i) => ({ ...t, setupId: i % 2 ? 's1' : 'gone' }));
/** Reports' tag tables: x1 on every trade, x2 on two (greyed), x3 on four (dotted), and a group no trade has */
const TAG_GROUPS = [
  { name: 'G', tags: ['x1', 'x2', 'x3'] },
  { name: 'H', tags: ['y1'] },
];
/** with a second mistake on the four biggest wins, so its cost is none so far */
const TAGGED = IN_SETUPS.map((t, i) => ({
  ...t,
  tags: ['x1', ...(i < 2 ? ['x2'] : i < 6 ? ['x3'] : [])],
  mistakes: (t.manualPnl ?? 0) >= 30 ? [STARTING_MISTAKES[1]] : t.mistakes,
}));
/** a day the month before, with a mistake, so Reports compares the two months */
const SEPTEMBER = day('2026-09-10', [-25, 30]);
/** the range picker's button for a range, found by its label in the language shown */
const rangeButton = (range: RangeKey) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="group"] button')].find(
    (button) => button.textContent === tr(`range.${range}`),
  );

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

/**
 * The Playbook. The journal's setup has enough trades on each side of its rules to cost breaking
 * one, a rule broken often enough to be the costliest, one it no longer has, and trades partly
 * or not checked; three more setups have breaking a rule pay, too few trades to cost it, and no
 * rules or trades at all. TRADES have no setup.
 */
const ticked = (net: number, ruleChecks: Trade['ruleChecks'], setupId = 's1') =>
  pnl(net, { setupId, ruleChecks, symbol: 'X', stopLoss: 90, entryPrice: 100 });
const PLAYBOOK: Trade[] = [
  ...TRADES,
  ...[30, 40, 25, 35].map((net) => ticked(net, { r1: true, r2: true })),
  ...[-20, -30, 10, -15].map((net) => ticked(net, { r1: false, r2: true })),
  ticked(-5, { r1: true, r2: true, r0: false }),
  ticked(12, { r1: true, r2: null }),
  ticked(8, undefined),
  ...[5, 6, 4, 5].map((net) => ticked(net, { r3: true }, 's2')),
  ...[20, 25, 30, 15].map((net) => ticked(net, { r3: false }, 's2')),
  ticked(10, { r4: true }, 's3'),
  ticked(-10, { r4: false }, 's3'),
];
const MORE_SETUPS: JournalData['setups'] = [
  { id: 's2', name: 'T', rules: ['r3'] },
  { id: 's3', name: 'U', rules: ['r4'] },
  { id: 's4', name: 'V', rules: [] },
];
const addSetups = () => MORE_SETUPS.forEach((setup) => journal?.actions.upsertSetup(setup));
const fourSetups = () => document.querySelectorAll('article').length === 4;
/** the colours offered, as their codes, in each colour's label */
const COLOURS = ['#38bdf8', '#a78bfa'];
const inModal = (selector: string) => document.querySelector<HTMLElement>(`[data-modal-root] ${selector}`);
const lastModalButton = () => [...document.querySelectorAll<HTMLElement>('[data-modal-root] button')].at(-1) ?? null;

/** Resources: one in each category the app offers; their titles, notes and links are the person's own */
const RESOURCES = ['Charting', 'News & data', 'Education', 'Broker', 'Tools', 'Reading', 'Other'].map(
  (category, i) => ({ id: `q${i}`, title: 'Q', url: 'https://q.example', category, notes: 'n', createdAt: '' }),
);
const LINK = ['q.example', 'tradingview.com'];
const addResources = () => RESOURCES.forEach((resource) => journal?.actions.upsertResource(resource));
const allResources = () => document.querySelectorAll('article').length === RESOURCES.length;
/** the first of a resource's buttons, once its icon `icon` is there, and the window it opens */
async function openFirst(icon: string) {
  await click(document.querySelector(`svg[class*="lucide-${icon}"]`)?.closest('button') ?? null);
  await until(() => Boolean(document.querySelector('[data-modal-root]')));
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
  { name: 'Calendar', view: CalendarView, trades: TRADES },
  { name: 'Calendar, empty', view: CalendarView, trades: [] },
  {
    name: 'Calendar, a month with no trades',
    view: CalendarView,
    trades: TRADES,
    open: () => document.querySelector('svg.lucide-chevron-left')?.closest('button')?.click(),
    modal: false,
    // the months that have trades, offered under the grid
    ready: () => document.querySelectorAll('.mt-3.flex-wrap > button').length > 0,
  },
  {
    name: "Calendar, a day's trades",
    view: CalendarView,
    trades: TRADES,
    open: () => document.querySelector<HTMLButtonElement>('.grid-cols-7 > button:enabled')?.click(),
  },
  { name: 'Insights', view: InsightsView, trades: INSIGHTS },
  {
    name: 'Insights, with more setups',
    view: InsightsView,
    trades: INSIGHTS,
    open: () => INSIGHT_SETUPS.forEach((setup) => journal?.actions.upsertSetup(setup)),
    modal: false,
    ready: () => journal?.data.setups.length === 1 + INSIGHT_SETUPS.length,
  },
  { name: 'Insights, nothing rated', view: InsightsView, trades: UNRATED },
  { name: 'Insights, empty', view: InsightsView, trades: [] },
  { name: 'Insights, too few trades', view: InsightsView, trades: TRADES.slice(0, 2) },
  { name: 'Reports', view: ReportsView, trades: IN_SETUPS },
  { name: 'Reports, empty', view: ReportsView, trades: [] },
  // one closed trade, one green day
  { name: 'Reports, one trade', view: ReportsView, trades: TRADES.slice(0, 1) },
  { name: 'Reports, no green day', view: ReportsView, trades: TRADES.filter((t) => (t.manualPnl ?? 0) < 0) },
  {
    name: 'Reports, tag groups',
    view: ReportsView,
    trades: TAGGED,
    open: () => journal?.actions.updateSettings({ tagGroups: TAG_GROUPS }),
    modal: false,
    ready: () =>
      Boolean(document.querySelector('tr[data-mark="few"]') && document.querySelector('tr[data-mark="thin"]')),
  },
  // the first mistake before the range, and a month before this one
  {
    name: 'Reports, the last 30 days',
    view: ReportsView,
    trades: [...SEPTEMBER, ...TRADES],
    open: () => rangeButton('30D')?.click(),
    modal: false,
    ready: () => rangeButton('30D')?.getAttribute('aria-pressed') === 'true',
  },
  // nothing closed in the range, though there are mistakes before it
  {
    name: 'Reports, the last 7 days',
    view: ReportsView,
    trades: TRADES,
    open: () => rangeButton('7D')?.click(),
    modal: false,
    ready: () => rangeButton('7D')?.getAttribute('aria-pressed') === 'true',
  },
  { name: 'Reports, nothing closed this month', view: ReportsView, trades: SEPTEMBER },
  // no balance to take the drawdown's percentage of
  {
    name: 'Reports, no starting balance',
    view: ReportsView,
    trades: TRADES,
    open: () => journal?.actions.updateAccount('acc1', { startingBalance: 0 }),
    modal: false,
    ready: () => journal?.data.accounts[0]?.startingBalance === 0,
  },
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
  { name: 'Playbook', view: PlaybookView, trades: PLAYBOOK, open: addSetups, modal: false, ready: fourSetups },
  {
    name: 'Playbook, empty',
    view: PlaybookView,
    trades: [],
    open: () => journal?.actions.deleteSetup('s1'),
    modal: false,
    ready: () => !document.querySelector('article'),
  },
  {
    name: 'Playbook, deleting a setup with trades',
    view: PlaybookView,
    trades: PLAYBOOK,
    open: () => document.querySelector('svg[class*="lucide-trash"]')?.closest('button')?.click(),
  },
  {
    name: 'Playbook, deleting a setup with none',
    view: PlaybookView,
    trades: PLAYBOOK,
    open: addSetups,
    modal: false,
    ready: fourSetups,
    then: async () => {
      await click([...document.querySelectorAll('svg[class*="lucide-trash"]')].at(-1)?.closest('button') ?? null);
      await until(() => Boolean(document.querySelector('[data-modal-root]')));
    },
  },
  {
    name: 'Playbook, a setup deleted',
    view: PlaybookView,
    trades: PLAYBOOK,
    open: () => document.querySelector('svg[class*="lucide-trash"]')?.closest('button')?.click(),
    then: () => click(lastModalButton()),
  },
  {
    name: 'Playbook, a new setup saved without a name',
    view: PlaybookView,
    trades: TRADES,
    open: () => document.querySelector('svg.lucide-plus')?.closest('button')?.click(),
    then: () => click(inModal('button[type="submit"]')),
    own: COLOURS,
  },
  {
    name: 'Playbook, editing a setup',
    view: PlaybookView,
    trades: PLAYBOOK,
    open: () => document.querySelector('svg[class*="lucide-pencil"]')?.closest('button')?.click(),
    own: COLOURS,
  },
  {
    name: 'Playbook, a setup saved',
    view: PlaybookView,
    trades: PLAYBOOK,
    open: () => document.querySelector('svg[class*="lucide-pencil"]')?.closest('button')?.click(),
    then: () => click(inModal('button[type="submit"]')),
  },
  {
    name: 'Resources',
    view: ResourcesView,
    trades: [],
    open: addResources,
    modal: false,
    ready: allResources,
    own: LINK,
  },
  { name: 'Resources, empty', view: ResourcesView, trades: [] },
  {
    name: 'Resources, removing one',
    view: ResourcesView,
    trades: [],
    open: addResources,
    modal: false,
    ready: allResources,
    then: () => openFirst('trash'),
    own: LINK,
  },
  {
    name: 'Resources, one removed',
    view: ResourcesView,
    trades: [],
    open: addResources,
    modal: false,
    ready: allResources,
    then: async () => {
      await openFirst('trash');
      await click(lastModalButton());
    },
    own: LINK,
  },
  {
    name: 'Resources, a new one saved without a title',
    view: ResourcesView,
    trades: [],
    open: () => document.querySelector('svg.lucide-plus')?.closest('button')?.click(),
    then: () => click(inModal('button[type="submit"]')),
    own: LINK,
  },
  {
    name: 'Resources, editing one',
    view: ResourcesView,
    trades: [],
    open: addResources,
    modal: false,
    ready: allResources,
    then: () => openFirst('pencil'),
    own: LINK,
  },
  {
    name: 'Resources, one saved',
    view: ResourcesView,
    trades: [],
    open: addResources,
    modal: false,
    ready: allResources,
    then: async () => {
      await openFirst('pencil');
      await click(inModal('button[type="submit"]'));
    },
    own: LINK,
  },
  // the browser version, everything saved; the apps' answers and the other save states are in i18n-support.test.ts
  { name: 'Support', view: SupportView, trades: [], own: [...SUPPORT_TYPED, 'C:\\journal\\data\\journal.json'] },
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

// each of Reports' texts was asked for on one of the screens above, so each was checked in every language;
// it counts on those screens running first, so a -t filter that leaves them out fails it
it('Reports: every text is on one of its screens', () => {
  expect(Object.keys(reports).filter((key) => !asked.has(key))).toEqual([]);
});
