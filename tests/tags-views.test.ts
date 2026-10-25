// @vitest-environment jsdom
import { createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalData, Trade } from '@/lib/types';
import { ReportsView } from '@/views/ReportsView';
import { SettingsView } from '@/views/SettingsView';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { UIProvider } from '@/store/UIProvider';
import { STARTING_MISTAKES } from '@/lib/mistakes';
import { thinMark } from '@/lib/stats';
import { pnl, trade } from './helpers';
import { button, click, field, mount, type, until } from './render';

/**
 * Tags where they are managed and seen: Settings → Tags (rename, merge,
 * delete, look-alikes, Move to mistakes, groups), saving through the real
 * journal, and Reports' table for each tag group. Rendered in jsdom against
 * a stand-in for the PC's storage.
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

let journal: ReturnType<typeof useJournal> | null;
const rendered = (j: ReturnType<typeof useJournal>) => {
  journal = j;
};
/** hands the test the journal's own state */
function Probe({ onRender }: { onRender: typeof rendered }) {
  onRender(useJournal());
  return null;
}

const tagged = (net: number, tags: string[], overrides: Partial<Trade> = {}) => pnl(net, { tags, ...overrides });

function journalWith(trades: Trade[], settings: Partial<JournalData['settings']> = {}): JournalData {
  return {
    version: 1,
    updatedAt: '2026-10-14T09:00:00.000Z',
    onboarded: true,
    profile: { name: 'Test' },
    settings: {
      currency: 'USD',
      theme: 'dark',
      timezone: 'local',
      maxDailyLoss: null,
      maxTradesPerDay: null,
      ...settings,
    },
    accounts: [
      { id: 'acc1', name: 'Main', startingBalance: 1000, createdAt: '' },
      { id: 'acc2', name: 'Second', startingBalance: 1000, createdAt: '' },
    ],
    activeAccountId: 'all',
    trades,
    setups: [],
    resources: [],
  };
}

let app: Awaited<ReturnType<typeof mount>> | null;
async function show(view: typeof ReportsView | typeof SettingsView, data: JournalData) {
  disk.journal = data;
  app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Probe, { onRender: rendered }), h(view))));
  await until(() => journal?.ready === true);
}

beforeEach(() => {
  localStorage.clear();
  journal = null;
  app = null;
});
afterEach(async () => {
  await app?.unmount();
});

const section = (title: string) =>
  [...document.querySelectorAll('section')].find((s) => s.querySelector('h2, h3')?.textContent === title) ?? null;
const tags = () => section('Tags');
const dialog = () => [...document.querySelectorAll<HTMLElement>('[data-modal-root]')].at(-1) ?? null;
const toast = () => [...document.querySelectorAll('[role="status"]')].map((t) => t.textContent).join(' | ');
const rows = () =>
  [...(tags()?.querySelectorAll('ul[aria-label="Your tags"] > li') ?? [])].map((li) =>
    li.textContent?.replace(/\s+/g, ' ').trim(),
  );
const alike = () =>
  [...(tags()?.querySelectorAll('li') ?? [])]
    .filter((li) => li.querySelector('button')?.textContent?.includes('Merge…'))
    .map((li) => [...li.querySelectorAll('span.whitespace-pre')].map((s) => s.firstChild?.textContent));
const tagsOf = (id: string) => journal?.data.trades.find((t) => t.id === id)?.tags;
const menu = async (tag: string, item: string) => {
  await click(document.querySelector<HTMLElement>(`button[aria-label="Change “${tag}”"]`));
  await click(button(item, document.querySelector('[data-popover]') ?? document));
  await until(() => Boolean(dialog()));
};
/** a button of the `i`th look-alike set */
const inSetAt = (i: number, label: string) => {
  const set = [...(tags()?.querySelectorAll('li') ?? [])].filter((li) =>
    li.querySelector('button')?.textContent?.includes('Merge…'),
  )[i];
  return [...(set?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.trim().startsWith(label)) ?? null;
};

describe('Settings → Tags', () => {
  let a: Trade, b: Trade, c: Trade, d: Trade, e: Trade;
  beforeEach(async () => {
    a = tagged(100, ['fomo', 'breakout']);
    b = tagged(-40, ['FOMO'], { accountId: 'acc2' });
    c = tagged(-10, ['fomo', 'tired']);
    d = tagged(30, ['breakout', 'news']);
    e = tagged(5, ['new'], { excluded: true });
    await show(SettingsView, journalWith([a, b, c, d, e]));
  });

  it('lists every tag in every account with its trades and net, and the look-alikes', () => {
    expect(rows()).toEqual([
      'breakout2 trades+$130.00',
      'fomo2 trades+$90.00',
      'FOMO1 trade-$40.00',
      // only an excluded trade has it: no net
      'new1 trade—',
      'news1 trade+$30.00',
      'tired1 trade-$10.00',
    ]);
    expect(alike()).toEqual([
      ['fomo', 'FOMO'],
      ['new', 'news'],
    ]);
  });

  it('merges a look-alike set into the spelling picked, on every trade in every account', async () => {
    await click(inSetAt(0, 'Merge…'));
    await until(() => Boolean(dialog()));
    // the most used is picked first
    const radios = [...(dialog()?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? [])];
    expect(radios.map((r) => r.checked)).toEqual([true, false]);
    await click(radios[1]);
    await click(button('Merge', dialog() ?? document));
    await until(() => toast().includes('Merged into “FOMO” on 3 trades, in every account'));
    expect([a, b, c].map((t) => tagsOf(t.id))).toEqual([['FOMO', 'breakout'], ['FOMO'], ['FOMO', 'tired']]);
    expect(alike()).toEqual([['new', 'news']]);
  });

  it('keeps a set apart: it is no longer listed, and the journal remembers it', async () => {
    await click(inSetAt(1, 'Keep apart'));
    await until(() => toast().includes('Kept apart'));
    expect(alike()).toEqual([['fomo', 'FOMO']]);
    expect(journal?.data.settings.tagsKeptApart).toEqual([['new', 'news']]);
    expect(tagsOf(d.id)).toEqual(['breakout', 'news']);
  });

  it('moves a set to the mistakes, offering the mistake it most likely is', async () => {
    await click(inSetAt(0, 'Move to mistakes…'));
    await until(() => Boolean(dialog()));
    const picked = field('The mistake', dialog() ?? document) as HTMLSelectElement | null;
    expect(picked?.selectedOptions[0]?.textContent).toBe('Entered early (FOMO)');
    expect(dialog()?.textContent).toContain('These tags come off 3 trades, in every account');
    await click(button('Move to mistakes', dialog() ?? document));
    await until(() => toast().includes('Moved to the mistakes as “Entered early (FOMO)” on 3 trades'));
    expect([a, b, c].map((t) => tagsOf(t.id))).toEqual([['breakout'], [], ['tired']]);
    expect([a, b, c, d].map((t) => journal?.data.trades.find((x) => x.id === t.id)?.mistakes)).toEqual([
      ['Entered early (FOMO)'],
      ['Entered early (FOMO)'],
      ['Entered early (FOMO)'],
      undefined,
    ]);
    // on the list already
    expect(journal?.data.settings.mistakes).toBeUndefined();
  });

  it('moves one tag to a new mistake, which joins the list; one typed like a listed mistake is that one', async () => {
    await menu('tired', 'Move to mistakes…');
    // nothing on the list looks like it: a new one, named after the tag
    expect(field('The mistake', dialog() ?? document)?.value).toBe('-1');
    await type(field('Its name', dialog() ?? document), ' Traded tired ');
    await click(button('Move to mistakes', dialog() ?? document));
    await until(() => toast().includes('“Traded tired”'));
    expect(journal?.data.settings.mistakes).toEqual([...STARTING_MISTAKES, 'Traded tired']);
    expect(journal?.data.trades.find((t) => t.id === c.id)?.mistakes).toEqual(['Traded tired']);

    await menu('breakout', 'Move to mistakes…');
    await type(field('The mistake', dialog() ?? document), '-1');
    await type(field('Its name', dialog() ?? document), 'oversized');
    await click(button('Move to mistakes', dialog() ?? document));
    await until(() => toast().includes('as “Oversized”'));
    expect(journal?.data.settings.mistakes).toEqual([...STARTING_MISTAKES, 'Traded tired']);
    expect([a, d].map((t) => journal?.data.trades.find((x) => x.id === t.id)?.mistakes)).toEqual([
      ['Oversized'],
      ['Oversized'],
    ]);
    expect([a, d].map((t) => tagsOf(t.id))).toEqual([['fomo'], ['news']]);
  });

  it('renames a tag; renamed onto one there already, says it merges them', async () => {
    await menu('tired', 'Rename…');
    const name = () => field('New name', dialog() ?? document);
    expect(name()?.value).toBe('tired');
    // unchanged, or blank: nothing to do
    expect(button('Rename', dialog() ?? document)?.disabled).toBe(true);
    await type(name(), '   ');
    expect(button('Rename', dialog() ?? document)?.disabled).toBe(true);
    await type(name(), '  worn   out ');
    await click(button('Rename', dialog() ?? document));
    await until(() => toast().includes('Renamed on 1 trade, in every account'));
    expect(tagsOf(c.id)).toEqual(['fomo', 'worn out']);

    await menu('FOMO', 'Rename…');
    await type(field('New name', dialog() ?? document), 'fomo');
    expect(dialog()?.textContent).toContain('“fomo” is a tag already: the two become one');
    await click(button('Merge', dialog() ?? document));
    await until(() => toast().includes('Merged into “fomo” on 1 trade'));
    expect(tagsOf(b.id)).toEqual(['fomo']);
  });

  it('merges one tag into another picked from the list', async () => {
    await menu('news', 'Merge into…');
    await type(field('Into', dialog() ?? document), 'new');
    await click(button('Merge', dialog() ?? document));
    await until(() => toast().includes('Merged into “new” on 1 trade'));
    expect(tagsOf(d.id)).toEqual(['breakout', 'new']);
  });

  it('deletes a tag from every trade after asking, and leaves the trades', async () => {
    await click(document.querySelector<HTMLElement>('button[aria-label="Change “fomo”"]'));
    await click(button('Delete…', document.querySelector('[data-popover]') ?? document));
    await until(() => Boolean(dialog()?.textContent?.includes('It comes off 2 trades, in every account')));
    await click(button('Delete tag', dialog() ?? document));
    await until(() => toast().includes('“fomo” deleted from 2 trades'));
    expect([a, c].map((t) => tagsOf(t.id))).toEqual([['breakout'], ['tired']]);
    expect(journal?.data.trades).toHaveLength(5);
  });

  it('makes a group, takes a tag from another group into it, and deletes one', async () => {
    await click(button('New group'));
    await until(() => Boolean(dialog()));
    const box = (tag: string) =>
      [...(dialog()?.querySelectorAll('label') ?? [])]
        .find((l) => l.querySelector('span')?.textContent === tag)
        ?.querySelector<HTMLInputElement>('input') ?? null;
    // a name is needed
    await click(button('Save group', dialog() ?? document));
    expect(dialog()?.textContent).toContain('Name the group');
    await type(field('Name', dialog() ?? document), ' Emotion ');
    await click(box('tired'));
    await click(box('fomo'));
    await click(button('Save group', dialog() ?? document));
    await until(() => toast().includes('Group made'));
    expect(journal?.data.settings.tagGroups).toEqual([{ name: 'Emotion', tags: ['tired', 'fomo'] }]);
    expect(rows()).toContain('fomo2 trades · Emotion+$90.00');

    await click(button('New group'));
    await until(() => Boolean(dialog()));
    await type(field('Name', dialog() ?? document), 'emotion');
    await click(button('Save group', dialog() ?? document));
    expect(dialog()?.textContent).toContain('There is a group with that name');
    await type(field('Name', dialog() ?? document), 'Mood');
    expect(dialog()?.textContent).toContain('in Emotion');
    await click(box('fomo'));
    await click(button('Save group', dialog() ?? document));
    await until(() => !dialog());
    expect(journal?.data.settings.tagGroups).toEqual([
      { name: 'Emotion', tags: ['tired'] },
      { name: 'Mood', tags: ['fomo'] },
    ]);

    await click(document.querySelector<HTMLElement>('button[aria-label="Edit the group Emotion"]'));
    await until(() => Boolean(dialog()));
    await click(button('Delete group', dialog() ?? document));
    await until(() =>
      Boolean(button('Delete group', dialog() ?? document) && dialog()?.textContent?.includes('Its tags stay')),
    );
    await click(button('Delete group', dialog() ?? document));
    await until(() => toast().includes('Group deleted'));
    expect(journal?.data.settings.tagGroups).toEqual([{ name: 'Mood', tags: ['fomo'] }]);
    expect(tagsOf(c.id)).toEqual(['fomo', 'tired']);
  });

  it("opens a tag's menu upwards when it would run past the bottom of the screen and fits above", async () => {
    // jsdom lays nothing out: the menu's button, 36px tall, sits at `top`, and the menu is 200px tall
    let top = 0;
    const box = (y: number, height: number) => ({ top: y, bottom: y + height }) as DOMRect;
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.querySelector(':scope > [data-popover]') ? box(top, 36) : box(0, 0);
    });
    const opened = async (at: number) => {
      top = at;
      const trigger = document.querySelector<HTMLElement>('button[aria-label="Change “tired”"]');
      await click(trigger);
      const side = document.querySelector<HTMLElement>('[data-popover]')?.dataset.side ?? 'below';
      await click(trigger);
      return side;
    };
    const height = window.innerHeight;
    try {
      window.innerHeight = 768;
      expect(await opened(100)).toBe('below');
      expect(await opened(600)).toBe('top');
      // no room above either: it stays below, where the page can scroll to it
      window.innerHeight = 300;
      expect(await opened(150)).toBe('below');
    } finally {
      window.innerHeight = height;
      vi.restoreAllMocks();
    }
  });

  it('a renamed or deleted tag keeps its group in step', async () => {
    await app?.unmount();
    await show(SettingsView, journalWith([a, c], { tagGroups: [{ name: 'Emotion', tags: ['tired', 'calm'] }] }));
    await menu('tired', 'Rename…');
    await type(field('New name', dialog() ?? document), 'drained');
    await click(button('Rename', dialog() ?? document));
    await until(() => toast().includes('Renamed'));
    expect(journal?.data.settings.tagGroups).toEqual([{ name: 'Emotion', tags: ['drained', 'calm'] }]);
  });

  it("lists a group's tag that no trade has any more, so it can be taken out", async () => {
    await app?.unmount();
    await show(SettingsView, journalWith([a, c], { tagGroups: [{ name: 'Emotion', tags: ['tired', 'calm'] }] }));
    await click(document.querySelector<HTMLElement>('button[aria-label="Edit the group Emotion"]'));
    await until(() => Boolean(dialog()));
    const calm = [...(dialog()?.querySelectorAll('label') ?? [])].find(
      (l) => l.querySelector('span')?.textContent === 'calm',
    );
    expect(calm?.textContent).toContain('no trades');
    await click(calm?.querySelector('input') ?? null);
    await click(button('Save group', dialog() ?? document));
    await until(() => toast().includes('Group saved'));
    expect(journal?.data.settings.tagGroups).toEqual([{ name: 'Emotion', tags: ['tired'] }]);
  });
});

describe('Settings → Tags with none yet', () => {
  it('says where they come from', async () => {
    await show(SettingsView, journalWith([trade()]));
    expect(tags()?.textContent).toContain('No tags yet');
  });
});

describe('Reports → a table for each tag group', () => {
  it("shows each of the group's tags, greys one of under 3 trades, marks one under 10, and says when trades count twice", async () => {
    const withStop = (net: number, t: string[]) =>
      trade({ tags: t, entryPrice: 100, exitPrice: 100 + net, stopLoss: 95, quantity: 1 });
    await show(
      ReportsView,
      journalWith(
        [
          ...Array.from({ length: 4 }, () => withStop(10, ['calm'])),
          tagged(-20, ['tired', 'calm']),
          tagged(-30, ['tired']),
          tagged(99, ['other']),
        ],
        {
          tagGroups: [
            { name: 'Emotion', tags: ['calm', 'tired', 'anxious'] },
            { name: 'Source', tags: ['scanner'] },
          ],
        },
      ),
    );
    const table = section('Emotion');
    const cells = [...(table?.querySelectorAll('tbody tr') ?? [])].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent),
    );
    expect(cells).toEqual([
      ['calm', '5', '80%', '+$20.00', '+2.00R'],
      ['tired', '2', '0%', '-$50.00', '—'],
    ]);
    expect([...(table?.querySelectorAll('tbody tr') ?? [])].map((tr) => tr.getAttribute('data-mark'))).toEqual([
      'thin',
      'few',
    ]);
    const note = table?.textContent?.replace(/\s+/g, ' ');
    expect(note).toContain('Greyed: under 3 trades. Dotted: under 10, too few to go by yet.');
    expect(note).toContain('1 trade has two of these tags and counts in each row.');
    expect(section('Source')?.textContent).toContain('No trade in this range has its tags.');
    expect(thinMark(2)).toBe('few');
    expect(thinMark(3)).toBe('thin');
    expect(thinMark(9)).toBe('thin');
    expect(thinMark(10)).toBeNull();
  });

  it('counts the trades of the account shown only', async () => {
    const data = journalWith([tagged(10, ['calm']), tagged(-4, ['calm'], { accountId: 'acc2' })], {
      tagGroups: [{ name: 'Emotion', tags: ['calm'] }],
    });
    await show(ReportsView, { ...data, activeAccountId: 'acc2' });
    const cells = [...(section('Emotion')?.querySelectorAll('tbody td') ?? [])].map((td) => td.textContent);
    expect(cells.slice(0, 4)).toEqual(['calm', '1', '0%', '-$4.00']);
  });

  it('without groups, shows none', async () => {
    await show(ReportsView, journalWith([tagged(10, ['calm'])]));
    expect(section('Emotion')).toBeNull();
    expect(document.body.textContent).not.toContain('Tag group');
  });
});
