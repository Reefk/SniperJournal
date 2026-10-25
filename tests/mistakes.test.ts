import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings, Trade } from '@/lib/types';
import {
  cleanMonths,
  combineMistakes,
  editedMistakes,
  matchesMistakeFilter,
  type MistakeFilter,
  matchMistake,
  MIN_MISTAKE_SIDE,
  mistakeList,
  mistakeReport,
  mistakesShown,
  mistakesSince,
  renameMistakes,
  STARTING_MISTAKES,
  thisAndLastMonth,
  wholeShare,
} from '@/lib/mistakes';
import { parseBackup } from '@/lib/backup';
import { buildInsights } from '@/lib/insights';
import { createDefaultData, normalize } from '@/lib/journal';
import { mergeTrades } from '@/lib/merge';
import { finishOpen, openRest } from '@/lib/import/finish';
import { generateSampleData } from '@/lib/sample';
import { matchesSearch, netPnl } from '@/lib/trade-math';
import { cleanSettings, cleanTrades } from '@/store/sanitize';
import { pnl, trade } from './helpers';

const FOMO = 'Entered early (FOMO)';
const STOP = 'Moved my stop';
const SIZE = 'Oversized';

/** a closed trade, `net` after fees, with these mistakes, closed on `day` */
const made = (net: number, mistakes?: string[], day = '2026-03-02', overrides: Partial<Trade> = {}) =>
  pnl(net, { mistakes, openedAt: `${day}T10:00`, closedAt: `${day}T11:00`, ...overrides });
/** `n` clean trades of `net` each */
const clean = (n: number, net: number, day?: string) => Array.from({ length: n }, () => made(net, undefined, day));

const settings: Settings = createDefaultData().settings;

describe('the mistake list', () => {
  it('starts as the nine of the plan, until it is changed', () => {
    expect(STARTING_MISTAKES).toEqual([
      'Entered early (FOMO)',
      'Chased the entry',
      'Moved my stop',
      'No stop',
      'Oversized',
      'Revenge trade',
      'Exited too early',
      'Held a loser too long',
      'Outside my plan',
    ]);
    expect(mistakeList({})).toEqual(STARTING_MISTAKES);
    expect(mistakeList({ mistakes: ['Traded the open'] })).toEqual(['Traded the open']);
    // every mistake taken off is a list with none, not the starting one again
    expect(mistakeList({ mistakes: [] })).toEqual([]);
  });

  it('is a copy, so changing it changes neither the settings nor the starting list', () => {
    const own = { mistakes: ['A'] };
    mistakeList(own).push('B');
    mistakeList({}).push('C');
    expect(own.mistakes).toEqual(['A']);
    expect(STARTING_MISTAKES).toHaveLength(9);
  });

  it('takes a typed mistake as the one it already is, whatever its capitals and spaces', () => {
    const known = mistakeList({});
    expect(matchMistake('oversized ', known)).toBe(SIZE);
    expect(matchMistake('  MOVED   my stop', known)).toBe(STOP);
    expect(matchMistake('  Traded  the open ', known)).toBe('Traded the open');
    expect(matchMistake('   ', known)).toBeNull();
  });

  it('the form shows the list, then any the trade has that the list no longer does, each once', () => {
    expect(mistakesShown(['A', 'B'], ['B', 'Gone'])).toEqual(['A', 'B', 'Gone']);
    expect(mistakesShown(['A'], undefined)).toEqual(['A']);
  });
});

describe('mistakes when trades are merged, imported, renamed and searched', () => {
  it('a merged trade made each mistake any of its parts made', () => {
    expect(combineMistakes([[FOMO], undefined, [STOP, FOMO]])).toEqual([FOMO, STOP]);
    expect(combineMistakes([undefined, []])).toBeUndefined();
    const merged = mergeTrades([
      trade({ openedAt: '2026-03-02T09:30', mistakes: [FOMO] }),
      trade({ openedAt: '2026-03-02T09:45' }),
      trade({ openedAt: '2026-03-02T10:00', mistakes: [SIZE, FOMO] }),
    ]);
    expect(merged.mistakes).toEqual([FOMO, SIZE]);
    expect(mergeTrades([trade(), trade()]).mistakes).toBeUndefined();
  });

  it('a trade an import finishes, and the open rest of one it closes only part of, keep their mistakes', () => {
    const open = trade({ exitPrice: null, closedAt: undefined, mistakes: [FOMO] });
    expect(finishOpen(open, trade({ mistakes: [STOP] }), undefined).mistakes).toEqual([FOMO]);
    expect(openRest(open, trade({ exitPrice: null, closedAt: undefined, quantity: 2 })).mistakes).toEqual([FOMO]);
  });

  it('a renamed mistake goes with its new name on every trade, kept once on a trade that has both', () => {
    const one = made(10, [FOMO, SIZE]);
    const both = made(10, [FOMO, 'FOMO']);
    const none = made(10, [STOP]);
    const unmarked = made(10);
    const [a, b, c, d] = renameMistakes([one, both, none, unmarked], new Map([[FOMO, 'FOMO']]));
    expect(a.mistakes).toEqual(['FOMO', SIZE]);
    expect(b.mistakes).toEqual(['FOMO']);
    expect(c).toBe(none);
    expect(d).toBe(unmarked);
    const trades = [one];
    expect(renameMistakes(trades, new Map())).toBe(trades);
  });

  it('the list editor: renames go by row and all at once, so a chain moves one step and a swap swaps', () => {
    const row = (text: string, was: string | null) => ({ text, was });
    // A → B and B → C in one save: A's trades become B's, B's become C's, none merge
    const chain = editedMistakes([row('B', 'A'), row('C', 'B')]);
    expect(chain).toEqual({
      list: ['B', 'C'],
      renamed: new Map([
        ['A', 'B'],
        ['B', 'C'],
      ]),
    });
    const [a, b] = renameMistakes([made(10, ['A']), made(10, ['B'])], chain.renamed);
    expect([a.mistakes, b.mistakes]).toEqual([['B'], ['C']]);
    const swap = editedMistakes([row('B', 'A'), row('A', 'B')]);
    const [x, y] = renameMistakes([made(10, ['A']), made(10, ['B', 'Other'])], swap.renamed);
    expect([x.mistakes, y.mistakes]).toEqual([['B'], ['A', 'Other']]);
  });

  it('the list editor: trimmed, no blank, each name once whatever its capitals, the unchanged spelling kept', () => {
    const row = (text: string, was: string | null) => ({ text, was });
    const { list, renamed } = editedMistakes([
      row('oversized ', 'Chased the entry'),
      row('  ', 'No stop'),
      row('Oversized', 'Oversized'),
      row('  Traded   the open ', null),
      row('traded the OPEN', null),
    ]);
    expect(list).toEqual(['Oversized', 'Traded the open']);
    // the renamed row merges into the one left as it was; the emptied row is taken off, not renamed
    expect(renamed).toEqual(new Map([['Chased the entry', 'Oversized']]));
    // only the capitals changed: still a rename, so the trades follow
    expect(editedMistakes([row('oversized', 'Oversized')]).renamed).toEqual(new Map([['Oversized', 'oversized']]));
    // a new row with a name that was renamed away is a new mistake; the old one's trades move
    expect(editedMistakes([row('Too big', 'Oversized'), row('Oversized', null)])).toEqual({
      list: ['Too big', 'Oversized'],
      renamed: new Map([['Oversized', 'Too big']]),
    });
  });

  it('a search finds a trade by its mistake', () => {
    expect(matchesSearch(made(10, [FOMO]), 'fomo')).toBe(true);
    expect(matchesSearch(made(10), 'fomo')).toBe(false);
  });

  it("the Trades page's filter: every trade, clean ones, ones with a mistake, or one mistake", () => {
    const fomo = made(10, [FOMO, SIZE]);
    const plain = made(10);
    const empty = made(10, []);
    expect([fomo, plain, empty].map((t) => matchesMistakeFilter(t, ''))).toEqual([true, true, true]);
    expect([fomo, plain, empty].map((t) => matchesMistakeFilter(t, 'clean'))).toEqual([false, true, true]);
    expect([fomo, plain, empty].map((t) => matchesMistakeFilter(t, 'any'))).toEqual([true, false, false]);
    expect([fomo, plain].map((t) => matchesMistakeFilter(t, `m:${SIZE}`))).toEqual([true, false]);
    expect(matchesMistakeFilter(fomo, 'm:Oversize')).toBe(false);
    // a mistake named like one of the filter's own words, or with a colon, is still only that mistake
    const named = made(10, ['any', 'clean', 'm:x']);
    expect(['m:any', 'm:clean', 'm:m:x'].map((f) => matchesMistakeFilter(named, f as MistakeFilter))).toEqual([
      true,
      true,
      true,
    ]);
    expect(['m:any', 'm:clean', 'm:m:x'].map((f) => matchesMistakeFilter(plain, f as MistakeFilter))).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe('what a mistake cost', () => {
  it('is (the clean average − its average) × times made, so a trade that won despite it counts too', () => {
    const fomo = [made(-10, [FOMO]), made(-10, [FOMO]), made(30, [FOMO]), made(-10, [FOMO])];
    const report = mistakeReport([...clean(4, 50), ...fomo], mistakeList({}));
    const [line] = report.lines;
    expect(line).toMatchObject({ mistake: FOMO, listed: true, trades: 4, net: 0, avg: 0, winRate: 25 });
    // the four would have made 50 each at the clean trades' average
    expect(line.cost).toBe(200);
    expect(report.costliest).toBe(line);
    expect(report).toMatchObject({ trades: 8, cost: 200 });
    expect(report.clean).toMatchObject({ trades: 4, net: 200, avg: 50, winRate: 100 });
    expect(report.withMistake).toMatchObject({ trades: 4, net: 0 });
  });

  it(`is not worked out below ${MIN_MISTAKE_SIDE} trades on either side`, () => {
    const fomo = (n: number) => Array.from({ length: n }, () => made(-10, [FOMO]));
    expect(mistakeReport([...clean(3, 50), ...fomo(4)], []).lines[0].cost).toBeNull();
    expect(mistakeReport([...clean(4, 50), ...fomo(3)], []).lines[0].cost).toBeNull();
    const thin = mistakeReport([...clean(3, 50), ...fomo(4)], []);
    expect(thin.cost).toBeNull();
    expect(thin.costliest).toBeNull();
  });

  it('is below zero while the trades with it did better, and none of them is the costliest then', () => {
    const report = mistakeReport([...clean(4, 10), ...[1, 2, 3, 4].map(() => made(40, [SIZE]))], []);
    expect(report.lines[0].cost).toBe(-120);
    expect(report.costliest).toBeNull();
  });

  it('counts a trade with two mistakes for each, and once in the cost of all of them together', () => {
    const both = [1, 2, 3, 4].map(() => made(-30, [FOMO, STOP]));
    const report = mistakeReport([...clean(4, 20), ...both, ...[1, 2, 3, 4].map(() => made(0, [FOMO]))], []);
    const fomo = report.lines.find((l) => l.mistake === FOMO);
    const stop = report.lines.find((l) => l.mistake === STOP);
    expect(fomo).toMatchObject({ trades: 8, avg: -15, cost: 280 });
    expect(stop).toMatchObject({ trades: 4, avg: -30, cost: 200 });
    // 8 trades with a mistake at -15 against 20: 280, not 280 + 200
    expect(report.withMistake?.trades).toBe(8);
    expect(report.cost).toBe(280);
  });

  it('counts a mistake a trade lists twice once', () => {
    const report = mistakeReport([...clean(4, 20), ...[1, 2, 3, 4].map(() => made(0, [FOMO, FOMO]))], []);
    expect(report.lines).toHaveLength(1);
    expect(report.lines[0]).toMatchObject({ trades: 4, cost: 80 });
  });

  it('lists the costliest first, then the ones not costed yet, the most made first', () => {
    const report = mistakeReport(
      [
        ...clean(4, 20),
        ...[1, 2, 3, 4].map(() => made(10, [STOP])),
        ...[1, 2, 3, 4].map(() => made(-20, [SIZE])),
        made(-50, ['No stop']),
        made(-50, ['Revenge trade']),
        made(-50, ['Revenge trade']),
      ],
      [STOP, SIZE, 'No stop'],
    );
    expect(report.lines.map((l) => [l.mistake, l.cost])).toEqual([
      [SIZE, 160],
      [STOP, 40],
      ['Revenge trade', null],
      ['No stop', null],
    ]);
    expect(report.costliest?.mistake).toBe(SIZE);
    // one that only trades still have, taken off the list
    expect(report.lines.find((l) => l.mistake === 'Revenge trade')?.listed).toBe(false);
  });

  it('counts trades from the first day a trade has a mistake: before it, none was logged on any', () => {
    // a month of trades from before mistakes were logged would pass for clean ones
    const before = clean(10, 500, '2026-02-02');
    const report = mistakeReport([...before, ...clean(4, 20), ...[1, 2, 3, 4].map(() => made(0, [FOMO]))], []);
    expect(mistakesSince([...before, made(0, [FOMO])])).toBe('2026-03-02');
    expect(report.since).toBe('2026-03-02');
    expect(report.trades).toBe(8);
    expect(report.clean?.trades).toBe(4);
    expect(report.lines[0].cost).toBe(80);
    // later on the same day mistakes started, a clean trade counts
    expect(mistakeReport([made(0, [FOMO], '2026-03-02'), made(5, undefined, '2026-03-02')], []).clean?.trades).toBe(1);
  });

  it('within a range, counts from its first day or from the first mistake, whichever is later', () => {
    const trades = [
      made(0, [FOMO], '2026-01-05'),
      ...clean(4, 100, '2026-02-02'),
      ...clean(4, 20, '2026-03-02'),
      ...[1, 2, 3, 4].map(() => made(0, [FOMO], '2026-03-03')),
    ];
    // the range starts after the first mistake: February's clean trades are out of it, though they count in all
    const inMarch = mistakeReport(trades, [], '2026-03-01');
    expect(inMarch.since).toBe('2026-01-05');
    expect(inMarch).toMatchObject({ trades: 8, clean: { trades: 4, avg: 20 } });
    expect(inMarch.lines[0]).toMatchObject({ trades: 4, cost: 80 });
    expect(mistakeReport(trades, [])).toMatchObject({ trades: 13, clean: { trades: 8, avg: 60 } });
    // a range starting before mistakes were logged still counts from the first one
    expect(mistakeReport(trades, [], '2025-12-01').trades).toBe(13);
    // a range with no mistake in it has nothing to show, but knows that mistakes are logged
    const quiet = mistakeReport(trades, [], '2026-03-04');
    expect(quiet).toMatchObject({ since: '2026-01-05', trades: 0, lines: [], clean: null, costliest: null });
  });

  it('leaves out open, excluded and incomplete trades, as every statistic does', () => {
    const report = mistakeReport(
      [
        ...clean(4, 20),
        ...[1, 2, 3, 4].map(() => made(0, [FOMO])),
        trade({ exitPrice: null, closedAt: undefined, mistakes: [FOMO] }),
        made(-500, [FOMO], '2026-03-02', { excluded: true }),
        made(500, undefined, '2026-03-02', { excluded: true }),
        made(-500, [FOMO], '2026-03-02', { quantity: 0 }),
      ],
      [],
    );
    expect(report.trades).toBe(8);
    expect(report.lines[0]).toMatchObject({ trades: 4, cost: 80 });
    // an open trade with a mistake doesn't start the count either
    expect(mistakesSince([trade({ exitPrice: null, closedAt: undefined, mistakes: [FOMO] })])).toBeNull();
  });

  it('with no mistake logged, counts nothing', () => {
    expect(mistakeReport(clean(10, 20), [])).toEqual({
      since: null,
      from: null,
      trades: 0,
      clean: null,
      withMistake: null,
      cost: null,
      lines: [],
      costliest: null,
    });
  });

  it('never names as the costliest a mistake whose cost is only what is left over from adding up cents', () => {
    // both sides +0.25 a trade, but added in another order: 1 against 0.9999999999999999
    const cleanOnes = [0.1, 0.2, 0.3, 0.4].map((net) => made(net));
    const fomo = [0.4, 0.3, 0.2, 0.1].map((net) => made(net, [FOMO]));
    const report = mistakeReport([...cleanOnes, ...fomo], []);
    expect(report.lines[0].cost).toBeGreaterThan(0);
    expect(report.costliest).toBeNull();
    expect(buildInsights([...cleanOnes, ...fomo], [], settings).some((i) => i.id === 'mistake')).toBe(false);
  });
});

describe('what counts as money', () => {
  const fomo = (gap: number) => [...clean(4, 10), ...[1, 2, 3, 4].map(() => made(10 - gap, [FOMO]))];

  it('names a mistake costing four cents the costliest, and one costing under half a cent not', () => {
    expect(mistakeReport(fomo(0.01), []).costliest?.mistake).toBe(FOMO);
    expect(mistakeReport(fomo(0.0012), []).costliest).toBeNull();
    expect(buildInsights(fomo(0.01), [], settings).find((i) => i.id === 'mistake')?.metric).toBe(
      'about $0.04 over 4 trades',
    );
  });

  it('gives the insight its cost to the cent', () => {
    // (10 − 6.9136) × 4 = 12.3456
    const insight = buildInsights(fomo(3.0864), [], settings).find((i) => i.id === 'mistake');
    expect(insight?.metric).toBe('about $12.35 over 4 trades');
    expect(insight?.body).toContain('about $12.35 better off');
  });

  it('says from which day it counted: the first mistake, or the start of the range when later', () => {
    const trades = [made(0, [FOMO], '2026-01-05'), ...clean(4, 20, '2026-03-02')];
    expect(mistakeReport(trades, []).from).toBe('2026-01-05');
    expect(mistakeReport(trades, [], '2025-12-01').from).toBe('2026-01-05');
    expect(mistakeReport(trades, [], '2026-03-01').from).toBe('2026-03-01');
    expect(mistakeReport(clean(4, 20), [], '2026-03-01').from).toBeNull();
  });
});

describe('the clean-trade rate', () => {
  it('reads true as a whole percentage: never all or none unless it is', () => {
    expect(wholeShare(249, 250)).toBe(99);
    expect(wholeShare(1, 250)).toBe(1);
    expect(wholeShare(250, 250)).toBe(100);
    expect(wholeShare(0, 250)).toBe(0);
    expect(wholeShare(53, 78)).toBe(68);
    expect(wholeShare(0, 0)).toBe(0);
  });

  const trades = [
    ...clean(9, 10, '2026-01-20'),
    made(0, [FOMO], '2026-02-03'),
    ...clean(1, 10, '2026-02-10'),
    made(0, [FOMO], '2026-03-02'),
    made(0, [STOP, SIZE], '2026-03-03'),
    ...clean(2, 10, '2026-03-31'),
  ];

  it('is the share of trades with no mistake, month by month by the day they closed, the latest first', () => {
    expect(cleanMonths(trades)).toEqual([
      { month: '2026-03', trades: 4, clean: 2, rate: 50 },
      { month: '2026-02', trades: 2, clean: 1, rate: 50 },
    ]);
    expect(cleanMonths(clean(5, 10))).toEqual([]);
  });

  it('counts from the first day a trade has a mistake, in that month too', () => {
    const [, february] = cleanMonths([made(10, undefined, '2026-02-01'), ...trades]);
    expect(february).toEqual({ month: '2026-02', trades: 2, clean: 1, rate: 50 });
  });

  it('gives this month and the one before it, across the turn of a year too', () => {
    const months = cleanMonths(trades);
    expect(thisAndLastMonth(months, new Date(2026, 2, 15))).toEqual({ thisMonth: months[0], lastMonth: months[1] });
    expect(thisAndLastMonth(months, new Date(2026, 3, 1))).toEqual({ thisMonth: null, lastMonth: months[0] });
    expect(thisAndLastMonth(months, new Date(2026, 1, 28))).toEqual({ thisMonth: months[1], lastMonth: null });
    const turn = cleanMonths([made(0, [FOMO], '2025-12-31'), made(10, undefined, '2026-01-01')]);
    expect(thisAndLastMonth(turn, new Date(2026, 0, 10))).toEqual({
      thisMonth: { month: '2026-01', trades: 1, clean: 1, rate: 100 },
      lastMonth: { month: '2025-12', trades: 1, clean: 0, rate: 0 },
    });
  });
});

describe('mistakes in the journal file', () => {
  it('keeps a trade\'s mistakes exactly as they are, and leaves "none" out', () => {
    const [kept, none, empty] = cleanTrades([
      { ...trade(), mistakes: [STOP, FOMO] },
      trade(),
      { ...trade(), mistakes: [] },
    ]);
    expect(kept.mistakes).toEqual([STOP, FOMO]);
    expect(none.mistakes).toBeUndefined();
    expect(empty.mistakes).toBeUndefined();
  });

  it('drops what is not a name, a blank one and a repeat, which would count twice', () => {
    const [t] = cleanTrades([{ ...trade(), mistakes: [FOMO, 3, null, '  ', FOMO, { name: 'x' }, ' Oversized'] }]);
    expect(t.mistakes).toEqual([FOMO, ' Oversized']);
    const [notAList] = cleanTrades([{ ...trade(), mistakes: FOMO }]);
    expect(notAList.mistakes).toBeUndefined();
    const [blanks] = cleanTrades([{ ...trade(), mistakes: ['', ' '] }]);
    expect(blanks.mistakes).toBeUndefined();
  });

  it('keeps the list as it is; absent, or not a list, reads as the starting one; empty stays empty', () => {
    const base = createDefaultData().settings;
    expect(cleanSettings({ mistakes: ['B', 'A'] }, base).mistakes).toEqual(['B', 'A']);
    expect(cleanSettings({ mistakes: ['A', '', 7, 'A'] }, base).mistakes).toEqual(['A']);
    expect(cleanSettings({ mistakes: [] }, base).mistakes).toEqual([]);
    expect(cleanSettings({}, base).mistakes).toBeUndefined();
    expect(cleanSettings({ mistakes: 'A' }, base).mistakes).toBeUndefined();
    // a list with nothing usable in it is damaged, not emptied on purpose: the starting list
    expect(cleanSettings({ mistakes: [1, '', ' '] }, base).mistakes).toBeUndefined();
    expect(mistakeList(cleanSettings({}, base))).toEqual(STARTING_MISTAKES);
  });

  it('a journal from before mistakes opens with none on its trades and the starting list', () => {
    const old = { ...createDefaultData(), trades: [trade()] };
    const opened = normalize(JSON.parse(JSON.stringify(old)));
    expect(opened.trades[0].mistakes).toBeUndefined();
    expect(mistakeList(opened.settings)).toEqual(STARTING_MISTAKES);
  });

  it('a backup keeps them, on the trades and the list', () => {
    const journal = {
      ...createDefaultData(),
      settings: { ...createDefaultData().settings, mistakes: ['Traded the open'] },
      trades: [made(10, [FOMO, 'Traded the open'])],
    };
    // as Settings restores it: read, then opened like the journal file
    const restored = normalize(parseBackup(JSON.stringify(journal, null, 2)).data);
    expect(restored.settings.mistakes).toEqual(['Traded the open']);
    expect(restored.trades[0].mistakes).toEqual([FOMO, 'Traded the open']);
  });

  it('a journal with mistakes comes back from its file as it was', () => {
    const journal = {
      ...createDefaultData(),
      settings: { ...createDefaultData().settings, mistakes: [FOMO, 'Traded the open'] },
      trades: [made(10, [FOMO]), made(10)],
    };
    const opened = normalize(JSON.parse(JSON.stringify(journal)));
    expect(opened.settings.mistakes).toEqual([FOMO, 'Traded the open']);
    expect(opened.trades.map((t) => t.mistakes)).toEqual([[FOMO], undefined]);
  });
});

describe('the insight', () => {
  const trades = [
    ...clean(4, 50),
    ...[1, 2, 3, 4].map(() => made(-25, [STOP])),
    ...[1, 2, 3, 4].map(() => made(40, [SIZE])),
  ];

  it('names the most expensive mistake and what it cost against the clean trades', () => {
    const insight = buildInsights(trades, [], settings).find((i) => i.id === 'mistake');
    expect(insight).toMatchObject({
      tone: 'bad',
      category: 'Behaviour',
      title: '"Moved my stop" is your most expensive mistake',
      metric: 'about $300.00 over 4 trades',
    });
    expect(insight?.body).toBe(
      'You made it on 4 trades, and they averaged -$25.00 against +$50.00 for the 4 clean trades, the ones with no mistake. Had they done as well, you would be about $300.00 better off.',
    );
  });

  it(`stays quiet below ${MIN_MISTAKE_SIDE} trades a side, and when no mistake has cost money`, () => {
    expect(buildInsights(trades.slice(1), [], settings).some((i) => i.id === 'mistake')).toBe(false);
    const paid = [...clean(4, 50), ...[1, 2, 3, 4].map(() => made(60, [SIZE]))];
    expect(buildInsights(paid, [], settings).some((i) => i.id === 'mistake')).toBe(false);
  });
});

describe('the test trades', () => {
  // they are made going back from today, so which days they fall on, and with them the counts, move with the date
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 20, 12));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('made mistakes from the starting list, most of them losers, and some are costed', () => {
    const { trades } = generateSampleData('acc1');
    const withOne = trades.filter((t) => t.mistakes);
    expect(withOne.length).toBeGreaterThan(0);
    expect(withOne.length).toBeLessThan(trades.length);
    for (const t of withOne) {
      expect(t.mistakes!.length).toBeGreaterThan(0);
      expect(new Set(t.mistakes).size).toBe(t.mistakes!.length);
      for (const m of t.mistakes!) expect(STARTING_MISTAKES).toContain(m);
    }
    const losers = withOne.filter((t) => netPnl(t) < 0).length;
    expect(losers).toBeGreaterThan(withOne.length / 2);
    const report = mistakeReport(trades, mistakeList({}));
    expect(report.since).not.toBeNull();
    expect(report.lines.some((l) => l.cost != null)).toBe(true);
    expect(report.costliest).not.toBeNull();
  });
});
