import { describe, expect, it } from 'vitest';
import type { Settings, TagGroup, Trade } from '@/lib/types';
import {
  arrangeByGroup,
  changeTags,
  groupTables,
  keepApart,
  likelyMistake,
  lookAlikes,
  saveGroup,
  spacedTag,
  tagLines,
  tradesWith,
} from '@/lib/tags';
import { STARTING_MISTAKES, mistakeList } from '@/lib/mistakes';
import { parseBackup } from '@/lib/backup';
import { createDefaultData, normalize } from '@/lib/journal';
import { cleanSettings } from '@/store/sanitize';
import { pnl, trade } from './helpers';

const base: Settings = createDefaultData().settings;
const tagged = (net: number, tags: string[], overrides: Partial<Trade> = {}) => pnl(net, { tags, ...overrides });
const tagsOf = (trades: Trade[]) => trades.map((t) => t.tags);

describe('the tag list', () => {
  it('has every tag once, with its trades and the net of the ones the statistics count, the most used first', () => {
    const trades = [
      tagged(100, ['breakout', 'fomo']),
      tagged(-40, ['fomo']),
      // a repeat on one trade is one trade
      tagged(-10, ['fomo', 'fomo'], { accountId: 'acc2' }),
      // counted as having it, but not in the net: open, excluded, incomplete
      tagged(0, ['fomo'], { exitPrice: null, manualPnl: null, closedAt: undefined }),
      tagged(500, ['fomo'], { excluded: true }),
      tagged(70, ['tired'], { isSample: true }),
    ];
    const groups: TagGroup[] = [{ name: 'Emotion', tags: ['tired'] }];
    expect(tagLines(trades, groups)).toEqual([
      { tag: 'fomo', trades: 5, counted: 3, net: 50, group: null },
      { tag: 'breakout', trades: 1, counted: 1, net: 100, group: null },
      { tag: 'tired', trades: 1, counted: 1, net: 70, group: 'Emotion' },
    ]);
    expect(tradesWith(trades, ['breakout', 'tired'])).toBe(2);
    expect(tagLines([])).toEqual([]);
  });

  it('takes a typed name as it would be typed again: trimmed, single spaces', () => {
    expect(spacedTag('  moved   stop ')).toBe('moved stop');
  });
});

describe('look-alikes', () => {
  it('lists tags that differ only in capitals, spaces, "-" or "_", the most used first in each set', () => {
    expect(
      lookAlikes(['fomo', 'breakout', 'FOMO', 'moved-stop', 'Fomo ', 'moved stop', 'moved_Stop', 'tired']),
    ).toEqual([
      ['fomo', 'FOMO', 'Fomo '],
      ['moved-stop', 'moved stop', 'moved_Stop'],
    ]);
  });

  it('lists a plural with its singular only when both are there', () => {
    expect(lookAlikes(['breakouts', 'news', 'Breakout', 'stops'])).toEqual([['breakouts', 'Breakout']]);
    // "new" and "news" look alike by the rule, which is what Keep apart is for
    expect(lookAlikes(['news', 'new'])).toEqual([['news', 'new']]);
    // too short to be a plural
    expect(lookAlikes(['as', 'a'])).toEqual([]);
  });

  it('leaves out a set kept apart, until a new tag joins it', () => {
    const kept = [['news', 'new']];
    expect(lookAlikes(['news', 'new', 'fomo', 'FOMO'], kept)).toEqual([['fomo', 'FOMO']]);
    expect(lookAlikes(['news', 'new', 'News'], kept)).toEqual([['news', 'new', 'News']]);
    expect(keepApart({ ...base, tagsKeptApart: kept }, ['fomo', 'FOMO', 'fomo'])).toEqual([...kept, ['fomo', 'FOMO']]);
    // kept apart again, it is not stored twice
    expect(keepApart({ ...base, tagsKeptApart: kept }, ['new', 'news'])).toEqual(kept);
  });
});

describe('renaming, merging and deleting a tag', () => {
  it('renames it on every trade, in every account, excluded, open and test trades too, where it was', () => {
    const trades = [
      tagged(10, ['a', 'fomo', 'b']),
      tagged(10, ['fomo'], { accountId: 'acc2', excluded: true }),
      tagged(10, ['fomo'], { exitPrice: null, manualPnl: null, closedAt: undefined, isSample: true }),
      tagged(10, ['other']),
    ];
    const out = changeTags(trades, base, { from: ['fomo'], into: 'FOMO entry' });
    expect(tagsOf(out.trades)).toEqual([['a', 'FOMO entry', 'b'], ['FOMO entry'], ['FOMO entry'], ['other']]);
    // a trade without it is left as it is, and no trade is marked as edited
    expect(out.trades[3]).toBe(trades[3]);
    expect(out.trades[0].updatedAt).toBe(trades[0].updatedAt);
    expect(out.settings).toEqual(base);
  });

  it('renamed onto a tag that is there already, is merged: a trade with both keeps it once', () => {
    const trades = [tagged(10, ['fomo', 'FOMO']), tagged(10, ['FOMO']), tagged(10, ['x', 'fomo'])];
    const out = changeTags(trades, base, { from: ['FOMO'], into: 'fomo' });
    expect(tagsOf(out.trades)).toEqual([['fomo'], ['fomo'], ['x', 'fomo']]);
  });

  it('merges a look-alike set into the spelling picked, which may be one of the set', () => {
    const trades = [tagged(10, ['Fomo ', 'x']), tagged(10, ['FOMO']), tagged(10, ['fomo'])];
    const out = changeTags(trades, base, { from: ['fomo', 'FOMO', 'Fomo '], into: 'fomo' });
    expect(tagsOf(out.trades)).toEqual([['fomo', 'x'], ['fomo'], ['fomo']]);
    expect(out.trades[2]).toBe(trades[2]);
  });

  it('deleted, it comes off every trade, and the trades stay', () => {
    const trades = [tagged(10, ['tired', 'x']), tagged(10, ['tired'])];
    const out = changeTags(trades, base, { from: ['tired'], into: null });
    expect(tagsOf(out.trades)).toEqual([['x'], []]);
  });

  it('renamed to itself, changes nothing', () => {
    const trades = [tagged(10, ['fomo'])];
    const out = changeTags(trades, base, { from: ['fomo'], into: 'fomo' });
    expect(out.trades).toBe(trades);
    expect(out.settings).toBe(base);
  });

  it('keeps the groups in step: a renamed tag stays in its group, where it was', () => {
    const settings = { ...base, tagGroups: [{ name: 'Emotion', tags: ['calm', 'tierd', 'anxious'] }] };
    const out = changeTags([tagged(1, ['tierd'])], settings, { from: ['tierd'], into: 'tired' });
    expect(out.settings.tagGroups).toEqual([{ name: 'Emotion', tags: ['calm', 'tired', 'anxious'] }]);
  });

  it('a merged tag keeps its own group; with none, it takes the group of the tag merged into it', () => {
    const groups = [
      { name: 'Emotion', tags: ['fomo', 'calm'] },
      { name: 'Setup', tags: ['FOMO'] },
    ];
    const kept = changeTags([], { ...base, tagGroups: groups }, { from: ['FOMO'], into: 'fomo' });
    expect(kept.settings.tagGroups).toEqual([
      { name: 'Emotion', tags: ['fomo', 'calm'] },
      { name: 'Setup', tags: [] },
    ]);
    const taken = changeTags([], { ...base, tagGroups: groups }, { from: ['calm'], into: 'relaxed' });
    expect(taken.settings.tagGroups?.[0]).toEqual({ name: 'Emotion', tags: ['fomo', 'relaxed'] });
    const ungrouped = changeTags([], { ...base, tagGroups: groups }, { from: ['x'], into: 'calm' });
    expect(ungrouped.settings.tagGroups).toEqual(groups);
  });

  it('a deleted tag leaves its group, and a kept-apart set that has one name left goes', () => {
    const settings: Settings = {
      ...base,
      tagGroups: [{ name: 'Emotion', tags: ['calm', 'tired'] }],
      tagsKeptApart: [
        ['new', 'news'],
        ['tired', 'tires'],
      ],
    };
    const out = changeTags([], settings, { from: ['tired'], into: null });
    expect(out.settings.tagGroups).toEqual([{ name: 'Emotion', tags: ['calm'] }]);
    expect(out.settings.tagsKeptApart).toEqual([['new', 'news']]);
    const renamed = changeTags([], settings, { from: ['news'], into: 'headlines' });
    expect(renamed.settings.tagsKeptApart).toEqual([
      ['new', 'headlines'],
      ['tired', 'tires'],
    ]);
    // two sets that become one are kept once
    const merged = changeTags(
      [],
      {
        ...base,
        tagsKeptApart: [
          ['a', 'c'],
          ['b', 'c'],
        ],
      },
      { from: ['a'], into: 'b' },
    );
    expect(merged.settings.tagsKeptApart).toEqual([['b', 'c']]);
  });

  it("merging tags from two groups into an ungrouped one: it goes to the first one's group, and leaves no copy in the other", () => {
    const settings = {
      ...base,
      tagGroups: [
        { name: 'Emotion', tags: ['calm', 'fomo'] },
        { name: 'Setup', tags: ['FOMO', 'pullback'] },
      ],
    };
    const out = changeTags([tagged(1, ['fomo']), tagged(1, ['FOMO'])], settings, {
      from: ['fomo', 'FOMO'],
      into: 'chased',
    });
    expect(tagsOf(out.trades)).toEqual([['chased'], ['chased']]);
    expect(out.settings.tagGroups).toEqual([
      { name: 'Emotion', tags: ['calm', 'chased'] },
      { name: 'Setup', tags: ['pullback'] },
    ]);
  });

  it('takes a new name as it would be typed again; a blank one changes nothing', () => {
    const trades = [tagged(1, ['fomo'])];
    expect(tagsOf(changeTags(trades, base, { from: ['fomo'], into: '  chased   the entry ' }).trades)).toEqual([
      ['chased the entry'],
    ]);
    const blank = changeTags(trades, base, { from: ['fomo'], into: '   ' });
    expect(blank.trades).toBe(trades);
    expect(blank.settings).toBe(base);
  });
});

describe('moving a tag to the mistakes', () => {
  const FOMO = 'Entered early (FOMO)';

  it('takes the tag off and gives every trade that had it the mistake, once', () => {
    const trades = [tagged(-10, ['fomo', 'x']), tagged(-10, ['FOMO'], { mistakes: [FOMO] }), tagged(10, ['x'])];
    const out = changeTags(trades, base, { from: ['fomo', 'FOMO'], into: null, mistake: FOMO });
    expect(tagsOf(out.trades)).toEqual([['x'], [], ['x']]);
    expect(out.trades.map((t) => t.mistakes)).toEqual([[FOMO], [FOMO], undefined]);
    // already on the list: the list is left as it is
    expect(out.settings.mistakes).toBeUndefined();
  });

  it('a new mistake joins the list, after the ones there', () => {
    const out = changeTags([tagged(-10, ['tired'])], base, { from: ['tired'], into: null, mistake: 'Traded tired' });
    expect(out.trades[0].mistakes).toEqual(['Traded tired']);
    expect(out.settings.mistakes).toEqual([...STARTING_MISTAKES, 'Traded tired']);
    const own = changeTags(
      [tagged(-10, ['tired'])],
      { ...base, mistakes: ['A'] },
      {
        from: ['tired'],
        into: null,
        mistake: 'Traded tired',
      },
    );
    expect(mistakeList(own.settings)).toEqual(['A', 'Traded tired']);
  });

  it('a mistake typed like a listed one is that one, with its capitals; a blank one changes nothing', () => {
    const trades = [tagged(-10, ['big size'])];
    const out = changeTags(trades, base, { from: ['big size'], into: null, mistake: ' oversized ' });
    expect(out.trades[0].mistakes).toEqual(['Oversized']);
    expect(out.trades[0].tags).toEqual([]);
    expect(out.settings.mistakes).toBeUndefined();
    const blank = changeTags(trades, base, { from: ['big size'], into: null, mistake: '  ' });
    expect(blank.trades).toBe(trades);
    expect(blank.settings).toBe(base);
  });

  it('offers first the mistake the tag most likely is', () => {
    const list = [...STARTING_MISTAKES];
    expect(likelyMistake(['fomo'], list)).toBe(FOMO);
    expect(likelyMistake(['moved-stop'], list)).toBe('Moved my stop');
    expect(likelyMistake(['Oversized'], list)).toBe('Oversized');
    expect(likelyMistake(['revenge trades'], list)).toBe('Revenge trade');
    // "No stop" has fewer other words than "Moved my stop"
    expect(likelyMistake(['stop'], list)).toBe('No stop');
    expect(likelyMistake(['tired', 'TIRED'], list)).toBeNull();
    expect(likelyMistake(['FOMO', 'fomo'], list)).toBe(FOMO);
    expect(likelyMistake(['  '], list)).toBeNull();
  });
});

describe('tag groups', () => {
  const groups: TagGroup[] = [
    { name: 'Emotion', tags: ['calm', 'tired'] },
    { name: 'Source', tags: ['scanner', 'X'] },
  ];

  it('a new group goes last; an edited one stays where it was, renamed', () => {
    expect(saveGroup(groups, null, { name: ' Catalyst ', tags: ['earnings'] }).map((g) => g.name)).toEqual([
      'Emotion',
      'Source',
      'Catalyst',
    ]);
    expect(saveGroup(groups, 'Emotion', { name: 'Feelings', tags: ['calm', 'tired', 'calm'] })).toEqual([
      { name: 'Feelings', tags: ['calm', 'tired'] },
      groups[1],
    ]);
  });

  it('an edited group in the middle or last stays where it was; one that is gone goes last', () => {
    const three = [...groups, { name: 'Market', tags: ['trend'] }];
    expect(saveGroup(three, 'Source', { name: 'Idea source', tags: ['scanner'] }).map((g) => g.name)).toEqual([
      'Emotion',
      'Idea source',
      'Market',
    ]);
    expect(saveGroup(three, 'Market', { name: 'Market', tags: ['range'] }).map((g) => g.name)).toEqual([
      'Emotion',
      'Source',
      'Market',
    ]);
    expect(saveGroup(groups, 'Gone', { name: 'Gone', tags: ['x'] })).toEqual([
      ...groups,
      { name: 'Gone', tags: ['x'] },
    ]);
  });

  it('a tag put in a group leaves the one it was in', () => {
    expect(saveGroup(groups, 'Source', { name: 'Source', tags: ['scanner', 'X', 'tired'] })).toEqual([
      { name: 'Emotion', tags: ['calm'] },
      { name: 'Source', tags: ['scanner', 'X', 'tired'] },
    ]);
  });

  it("the trade form's suggestions: a group's tags together, in the groups' order, the rest after as they were", () => {
    expect(arrangeByGroup(['x', 'scanner', 'tired', 'y', 'calm'], groups)).toEqual([
      'tired',
      'calm',
      'scanner',
      'x',
      'y',
    ]);
    expect(arrangeByGroup(['b', 'a'], [])).toEqual(['b', 'a']);
  });

  it("Reports: a table per group with each of its tags' trades, win rate, net and average R, the best net first", () => {
    const withStop = (net: number, tags: string[]) =>
      trade({ tags, entryPrice: 100, exitPrice: 100 + net, stopLoss: 95, quantity: 1 });
    const trades = [
      withStop(10, ['calm']), // +2R
      withStop(-5, ['calm']), // -1R
      tagged(30, ['calm']), // no stop, so no R
      tagged(-20, ['tired', 'calm']),
      tagged(-50, ['tired'], { excluded: true }),
      tagged(5, ['scanner']),
    ];
    const [emotion, source] = groupTables(trades, groups);
    expect(emotion.name).toBe('Emotion');
    expect(emotion.rows).toEqual([
      { tag: 'calm', trades: 4, winRate: 50, net: 15, avgR: 0.5 },
      { tag: 'tired', trades: 1, winRate: 0, net: -20, avgR: null },
    ]);
    // one trade has both, and counts in each row
    expect(emotion.shared).toBe(1);
    expect(source).toEqual({
      name: 'Source',
      rows: [{ tag: 'scanner', trades: 1, winRate: 100, net: 5, avgR: null }],
      shared: 0,
    });
    expect(groupTables([], groups).map((g) => g.rows)).toEqual([[], []]);
  });

  it('Reports: a break-even trade is not a win, a tag twice on a trade is one trade, and test trades count', () => {
    const trades = [
      tagged(0, ['calm']),
      tagged(0, ['calm', 'calm']),
      tagged(10, ['calm'], { isSample: true }),
      tagged(-4, ['tired']),
      tagged(4, ['tired']),
    ];
    const [emotion] = groupTables(trades, groups);
    expect(emotion.rows).toEqual([
      { tag: 'calm', trades: 3, winRate: expect.closeTo(100 / 3), net: 10, avgR: null },
      { tag: 'tired', trades: 2, winRate: 50, net: 0, avgR: null },
    ]);
    // a trade with one of the group's tags twice is not shared
    expect(emotion.shared).toBe(0);
  });
});

describe('tag groups in the journal file', () => {
  it('keeps well-formed groups and kept-apart sets exactly as they are', () => {
    const tagGroups = [
      { name: 'Emotion', tags: ['calm', 'tired'] },
      { name: 'Source', tags: [] },
    ];
    const tagsKeptApart = [['new', 'news']];
    const clean = cleanSettings({ tagGroups, tagsKeptApart }, base);
    expect(clean.tagGroups).toEqual(tagGroups);
    expect(clean.tagsKeptApart).toEqual(tagsKeptApart);
  });

  it('a group named like one before it joins that one; a tag stays in the first group that lists it; what is not a name goes', () => {
    const clean = cleanSettings(
      {
        tagGroups: [
          { name: ' Emotion ', tags: ['calm', 3, '', 'calm', 'tired'] },
          { name: 'emotion', tags: ['x'] },
          { name: '  ', tags: ['y'] },
          { tags: ['z'] },
          'Source',
          { name: 'Source', tags: 'scanner' },
          { name: 'Market', tags: ['tired', 'trend'] },
        ],
      },
      base,
    );
    // "emotion" brings its "x" to "Emotion" instead of losing it
    expect(clean.tagGroups).toEqual([
      { name: 'Emotion', tags: ['calm', 'tired', 'x'] },
      { name: 'Source', tags: [] },
      { name: 'Market', tags: ['trend'] },
    ]);
  });

  it('a kept-apart set listed twice, in any order, is kept once', () => {
    expect(
      cleanSettings(
        {
          tagsKeptApart: [
            ['new', 'news'],
            ['news', 'new', 'new'],
            ['a', 'b'],
          ],
        },
        base,
      ).tagsKeptApart,
    ).toEqual([
      ['new', 'news'],
      ['a', 'b'],
    ]);
  });

  it('absent, or not a list, is none; a kept-apart set needs two names', () => {
    expect(cleanSettings({}, base).tagGroups).toBeUndefined();
    expect(cleanSettings({ tagGroups: 'Emotion' }, base).tagGroups).toBeUndefined();
    expect(cleanSettings({ tagGroups: [] }, base).tagGroups).toEqual([]);
    expect(cleanSettings({ tagsKeptApart: [['new'], ['a', 'a'], 'x', ['b', 2, 'c']] }, base).tagsKeptApart).toEqual([
      ['b', 'c'],
    ]);
    expect(cleanSettings({ tagsKeptApart: [['new']] }, base).tagsKeptApart).toBeUndefined();
    expect(cleanSettings({ tagsKeptApart: {} }, base).tagsKeptApart).toBeUndefined();
  });

  it('a journal from before groups opens with none; a backup keeps them', () => {
    const old = normalize(JSON.parse(JSON.stringify({ ...createDefaultData(), trades: [tagged(1, ['calm'])] })));
    expect(old.settings.tagGroups).toBeUndefined();
    expect(old.settings.tagsKeptApart).toBeUndefined();
    const journal = {
      ...createDefaultData(),
      settings: { ...base, tagGroups: [{ name: 'Emotion', tags: ['calm'] }], tagsKeptApart: [['new', 'news']] },
    };
    const restored = normalize(parseBackup(JSON.stringify(journal, null, 2)).data);
    expect(restored.settings.tagGroups).toEqual([{ name: 'Emotion', tags: ['calm'] }]);
    expect(restored.settings.tagsKeptApart).toEqual([['new', 'news']]);
  });
});
