// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, createElement as h } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Setup, Trade } from '@/lib/types';
import { LANGUAGES, messagesOf, setLanguage, tr, type Language } from '@/lib/i18n';
import { sample } from '@/lib/i18n/en/sample';
import { generateSampleData } from '@/lib/sample';
import { lookAlikes } from '@/lib/tags';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider } from '@/store/UIProvider';
import { WelcomeModal } from '@/components/layout/WelcomeModal';
import { button, click, field, mount, type, until } from './render';
import { withoutKept, looksEnglish } from './i18n-kept';

/**
 * The test journal (Load test data) is written in the language on screen
 * when it is loaded: its setups, their rules, its tags and its notes. From
 * then on they are journal data, kept as written when the language changes.
 * In English it reads word for word as it always has.
 */
const disk = vi.hoisted(() => ({ journal: null as unknown }));
vi.mock('@/lib/storage', () => ({
  JournalConflict: class extends Error {},
  storage: {
    kind: 'native',
    device: 'pc',
    async init() {},
    async readJournal() {
      return disk.journal;
    },
    version: () => null,
    location: () => 'C:\\journal\\journal.json',
    async writeJournal() {
      return 'C:\\journal\\journal.json';
    },
    async keepCopy() {
      return null;
    },
    async saveImage() {
      return 'x.png';
    },
    imageSrc: () => '',
    async deleteImage() {},
  },
}));

const OTHERS = LANGUAGES.filter((l) => l.code !== 'en');

/** English left in a text: two Latin letters in a row, or for Spanish an English word, once the kept names are out */
function english(code: Language, text: string): boolean {
  const rest = withoutKept(text);
  return code === 'es' ? looksEnglish(rest) : /[A-Za-z]{2}/.test(rest);
}

/** the test journal as it is made in `code`, on a day where every tag is used */
function made(code: Language) {
  setLanguage(code);
  vi.useFakeTimers({ now: new Date('2026-10-28T12:00:00'), toFake: ['Date'] });
  try {
    return generateSampleData('acc1');
  } finally {
    vi.useRealTimers();
  }
}

/** a journal's words: its setups' names, descriptions and rules, and its trades' tags and notes */
function words({ trades, setups }: { trades: Trade[]; setups: Setup[] }) {
  return {
    setups: setups.flatMap((s) => [s.name, s.description ?? '', ...s.rules]),
    tags: [...new Set(trades.flatMap((t) => t.tags))],
    notes: [...new Set(trades.map((t) => t.notes ?? ''))],
  };
}

/** the journal with its own ids numbered in order, so two made apart can be compared */
function numbered({ trades, setups }: { trades: Trade[]; setups: Setup[] }) {
  const place = (id: string | null | undefined) => (id ? setups.findIndex((s) => s.id === id) : id);
  return {
    setups: setups.map((s) => ({ ...s, id: place(s.id) })),
    trades: trades.map((t) => ({
      ...t,
      id: '',
      setupId: place(t.setupId),
      ruleChecksSetupId: place(t.ruleChecksSetupId),
    })),
  };
}

afterEach(() => setLanguage('en'));

describe('the test journal, in English', () => {
  it('reads word for word as it always has', () => {
    const journal = made('en');
    const { setups, notes } = words(journal);
    expect(setups).toEqual([
      'Opening Range Breakout',
      'Break and hold of the first 15 minute range, taken only in the direction of the daily trend.',
      'Wait for the first 15 minutes to complete',
      'Enter on the retest, not the first push',
      'Stop below the range mid',
      'Target 2R or the prior day high',
      'VWAP Reclaim',
      'Price loses VWAP, flushes, then reclaims it with volume.',
      'Must reclaim within 30 minutes of losing it',
      'Volume on the reclaim candle above average',
      'Stop under the flush low',
      'Scale half at 1R',
      'Trend Pullback',
      'Buying the first controlled pullback into a rising moving average.',
      'Higher highs and higher lows on the 5 minute',
      'Pullback on falling volume',
      'Entry on the reversal candle close',
      'No entry in the last hour',
    ]);
    // each tag by the first trade that has it, so they are given out to the same trades as before
    const first = new Map<string, number>();
    journal.trades.forEach((t, i) => t.tags.forEach((tag) => first.has(tag) || first.set(tag, i)));
    expect(Object.fromEntries(first)).toEqual({
      breakout: 0,
      pullback: 1,
      'moved stop': 3,
      fomo: 4,
      tired: 5,
      'early entry': 6,
      news: 10,
      planned: 13,
      oversized: 29,
      'A+ setup': 44,
    });
    expect(notes.sort()).toEqual(
      ['Entered before confirmation and paid for it.', 'Followed the plan, let the runner work.'].sort(),
    );
    // and every trade's tags, rule ticks and note, all of them as before: a fingerprint, taken
    // from the test journal as the app made it before its words went through tr()
    const placed = journal.trades.map((t) => [t.tags, t.ruleChecks ? Object.entries(t.ruleChecks) : null, t.notes]);
    expect(journal.trades).toHaveLength(78);
    expect(createHash('sha256').update(JSON.stringify(placed)).digest('hex').slice(0, 16)).toBe('802342452ea77a61');
  });
});

describe.each(OTHERS)('the test journal in $name', ({ code }) => {
  it('is written in it: every setup, rule, tag and note', () => {
    const { setups, tags, notes } = words(made(code));
    const all = [...setups, ...tags, ...notes];
    expect(all.filter((text) => english(code, text))).toEqual([]);
    const theEnglish = new Set(Object.values(messagesOf('en')));
    expect(all.filter((text) => theEnglish.has(text))).toEqual([]);
  });

  it('holds the same trades as in English, with only the words in the language', () => {
    const en = messagesOf('en');
    const ours = messagesOf(code);
    const said = new Map(
      Object.keys(sample).map((key) => [en[key as keyof typeof sample], ours[key as keyof typeof sample]]),
    );
    // no two texts alike, in English or in the language, or a word could be swapped for the wrong one
    expect(said.size).toBe(Object.keys(sample).length);
    expect(new Set(said.values()).size).toBe(said.size);
    const say = (text: string) => {
      expect(said.has(text)).toBe(true);
      return said.get(text) as string;
    };
    const inEnglish = made('en');
    // the English journal with its words swapped for the language's
    const swapped = {
      setups: inEnglish.setups.map((s) => ({
        ...s,
        name: say(s.name),
        description: say(s.description ?? ''),
        rules: s.rules.map(say),
      })),
      trades: inEnglish.trades.map((t) => ({
        ...t,
        tags: t.tags.map(say),
        notes: say(t.notes ?? ''),
        ruleChecks:
          t.ruleChecks && Object.fromEntries(Object.entries(t.ruleChecks).map(([rule, kept]) => [say(rule), kept])),
      })),
    };
    expect(numbered(made(code))).toEqual(numbered(swapped));
  });

  it("ticks each trade's rules by its setup's own, no rule twice in a setup", () => {
    const { trades, setups } = made(code);
    for (const s of setups) expect(new Set(s.rules).size).toBe(s.rules.length);
    const ticked = trades.filter((t) => t.ruleChecks);
    expect(ticked.length).toBeGreaterThan(0);
    for (const t of ticked) {
      expect(t.ruleChecksSetupId).toBe(t.setupId);
      expect(Object.keys(t.ruleChecks ?? {})).toEqual(setups.find((s) => s.id === t.setupId)?.rules);
    }
  });

  it('has ten tags that Settings → Tags would not take for one, and none with a comma, which would end it as it is typed', () => {
    const { tags } = words(made(code));
    expect(tags).toHaveLength(10);
    expect(lookAlikes(tags)).toEqual([]);
    expect(tags.filter((tag) => /[,،]/.test(tag))).toEqual([]);
  });
});

describe('loaded on screen', { timeout: 30_000 }, () => {
  /** a first run: the Welcome window shows, in English */
  const firstRun = (): JournalData => ({
    version: 1,
    updatedAt: '2026-10-14T09:00:00.000Z',
    onboarded: false,
    profile: { name: '' },
    settings: { currency: 'USD', theme: 'dark', timezone: 'local', maxDailyLoss: null, maxTradesPerDay: null },
    accounts: [{ id: 'acc1', name: 'Main Portfolio', startingBalance: 0, createdAt: '' }],
    activeAccountId: 'acc1',
    trades: [],
    setups: [],
    resources: [],
  });

  let journal: ReturnType<typeof useJournal> | null = null;
  function Probe() {
    journal = useJournal();
    return null;
  }
  let app: Awaited<ReturnType<typeof mount>> | null = null;
  afterEach(async () => {
    await app?.unmount();
    app = null;
    journal = null;
    localStorage.clear();
  });

  async function welcome() {
    disk.journal = firstRun();
    app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Probe), h(WelcomeModal))));
    await until(() => journal?.ready === true);
  }
  const setupNames = () => journal?.data.setups.map((s) => s.name);
  const notes = () => [...new Set(journal?.data.trades.map((t) => t.notes))].sort();

  it('in English, Explore with test data first loads it word for word as before', async () => {
    await welcome();
    await click(button('Explore with test data first'));
    await until(() => (journal?.data.trades.length ?? 0) > 0);
    expect(setupNames()).toEqual(['Opening Range Breakout', 'VWAP Reclaim', 'Trend Pullback']);
    expect(notes()).toEqual([
      'Entered before confirmation and paid for it.',
      'Followed the plan, let the runner work.',
    ]);
  });

  it.each(OTHERS)(
    '$name chosen in the Welcome window, then Explore: the test journal is in it, and stays so when the language changes',
    async ({ code }) => {
      await welcome();
      await type(field('Language') as HTMLSelectElement, code);
      await until(() => journal?.data.settings.language === code);
      await click(button(tr('welcome.explore')));
      await until(() => (journal?.data.trades.length ?? 0) > 0);
      const names = [tr('sample.orb.name'), tr('sample.vwap.name'), tr('sample.pullback.name')];
      const said = [tr('sample.note.lost'), tr('sample.note.won')].sort();
      expect(setupNames()).toEqual(names);
      expect(notes()).toEqual(said);
      expect(journal?.data.trades.flatMap((t) => t.tags).filter((tag) => english(code, tag))).toEqual([]);

      // journal data from now on: another language leaves it as written
      const next = code === 'es' ? 'ru' : 'es';
      await act(async () => journal?.actions.updateSettings({ language: next }));
      await until(() => document.documentElement.lang === next);
      expect(setupNames()).toEqual(names);
      expect(notes()).toEqual(said);

      // loaded again (Settings → Load test data), it is made anew in the language now on screen
      await act(async () => journal?.actions.loadSampleData());
      await until(() => journal?.data.setups[0]?.name === tr('sample.orb.name'));
      expect(setupNames()).toEqual([tr('sample.orb.name'), tr('sample.vwap.name'), tr('sample.pullback.name')]);
      expect(notes()).toEqual([tr('sample.note.lost'), tr('sample.note.won')].sort());
    },
  );
});

describe('the texts of the test journal', () => {
  it('are each used by the app, so none is left behind by the test journal going back to English', () => {
    const SRC = join(__dirname, '..', 'src');
    const code = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
      .filter((path) => /\.tsx?$/.test(path) && !path.split(/[\\/]/).includes('i18n'))
      .map((path) => readFileSync(join(SRC, path), 'utf8'))
      .join('\n');
    expect(Object.keys(sample).filter((key) => !code.includes(`'${key}'`))).toEqual([]);
  });
});
