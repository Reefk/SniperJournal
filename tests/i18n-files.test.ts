// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, createElement as h } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JournalData } from '@/lib/types';
import { LANGUAGES, messagesOf, setLanguage, tr, type Language, type MessageKey } from '@/lib/i18n';
import { files } from '@/lib/i18n/en/files';
import { parseBackup } from '@/lib/backup';
import { JOURNAL_VERSION } from '@/lib/journal-version';
import { mergeTrades } from '@/lib/merge';
import { uploadScreenshot } from '@/lib/screenshots';
import { findUnused, type SweepFiles } from '@/lib/storage/sweep';
import { said, useBringOver } from '@/hooks/useBringOver';
import { JournalProvider, useJournal } from '@/store/JournalProvider';
import { MIRROR_KEY, encodeMirror } from '@/store/mirror';
import { UIProvider } from '@/store/UIProvider';
import { RecoveredNotice } from '@/components/layout/SaveConflict';
import { trade } from './helpers';
import { button, click, mount, until } from './render';
import { ENGLISH, withoutKept } from './i18n-kept';

/**
 * What the journal's files say, in every language: a backup that can't be
 * restored, Bring over (its question, what it did, and the Windows app's
 * refusals), a chart image that can't be saved, the reclaim of unused images
 * stopped before it deletes anything, and the note a merge writes.
 */
const disk = vi.hoisted(() => ({
  journal: null as unknown,
  /** the file's version, as the storage says it */
  version: null as string | null,
  /** where a copy goes: a path, null when the storage can't say, or 'fail' */
  copy: null as string | null,
}));
vi.mock('@/lib/storage', () => ({
  JournalConflict: class extends Error {},
  storage: {
    kind: 'native',
    device: 'pc',
    async init() {},
    async readJournal() {
      return disk.journal;
    },
    version: () => disk.version,
    location: () => 'C:\\journal\\journal.json',
    async writeJournal() {
      return 'C:\\journal\\journal.json';
    },
    async keepCopy() {
      if (disk.copy === 'fail') throw new Error('EIO');
      return disk.copy;
    },
    // a failed fetch, as when the data folder is out of reach
    async saveImage() {
      throw new TypeError('Failed to fetch');
    },
    imageSrc: () => '',
    async deleteImage() {},
  },
}));
/** the earlier version's folder, as the Windows app reads it */
const old = vi.hoisted(() => ({
  read: async (): Promise<unknown> => null,
  copy: async (): Promise<number> => 0,
}));
vi.mock('@/lib/storage/tauri', () => ({
  readOldJournal: () => old.read(),
  copyOldImages: () => old.copy(),
}));

const OTHERS = LANGUAGES.filter((l) => l.code !== 'en');

/** English left in a text: two Latin letters in a row, or for Spanish an English word, once the kept names are out */
function english(code: Language, text: string): boolean {
  const rest = withoutKept(text);
  return code === 'es' ? ENGLISH.test(rest) : /[A-Za-z]{2}/.test(rest);
}

/** a text in the language on screen: not English, and not the English text either */
function spoken(code: Language, text: string | undefined, key: MessageKey) {
  expect(text).toBeTruthy();
  expect(english(code, text ?? '')).toBe(false);
  expect(text).not.toBe(messagesOf('en')[key]);
}

afterEach(() => setLanguage('en'));

describe.each(OTHERS)('$name', ({ code }) => {
  it('says why a backup cannot be restored', () => {
    setLanguage(code);
    const cases: Array<[string, MessageKey]> = [
      ['5', 'backup.notBackup'],
      [JSON.stringify({ version: JOURNAL_VERSION + 1, trades: [], accounts: [] }), 'backup.newer'],
      [JSON.stringify({ trades: 1 }), 'backup.noLists'],
      ['{', 'backup.notJson'],
    ];
    for (const [text, key] of cases) {
      const { error } = parseBackup(text);
      expect(error).toBe(tr(key));
      spoken(code, error, key);
    }
  });

  it('says why a chart image cannot be saved', async () => {
    setLanguage(code);
    const image = (type: string) => new File([new Uint8Array([1, 2, 3])], 'chart', { type });
    const cases: Array<[string, MessageKey]> = [
      ['text/plain', 'img.notImage'],
      ['image/heic', 'img.unsupported'],
      ['image/png', 'img.unreachable'],
    ];
    for (const [type, key] of cases) {
      const { error } = await uploadScreenshot(image(type));
      expect(error).toBe(tr(key));
      spoken(code, error, key);
    }
  });

  it('says why reclaiming unused chart images stopped, naming the backup it could not use', async () => {
    setLanguage(code);
    const BACKUP = 'backups/journal-2026-10-01.json';
    const sweep = (over: Partial<SweepFiles>): SweepFiles => ({
      images: async () => [{ name: 'abcdef12.png', modified: 0, bytes: 10 }],
      journals: async () => ['journal.json', BACKUP],
      read: async () => '{}',
      remove: async () => {},
      ...over,
    });
    const fail = async () => {
      throw new Error('EIO');
    };
    const cases: Array<[Partial<SweepFiles>, MessageKey]> = [
      [{ images: fail }, 'sweep.shotsUnreadable'],
      [{ journals: fail }, 'sweep.backupsUnreadable'],
      [{ journals: async () => [] }, 'sweep.journalUnreadable'],
      [{ read: async (path) => (path === BACKUP ? '{}' : null) }, 'sweep.journalUnreadable'],
      [{ read: async (path) => (path === BACKUP ? '{}' : '{') }, 'sweep.journalDamaged'],
      [{ read: async (path) => (path === BACKUP ? fail() : '{}') }, 'sweep.backupUnreadable'],
      [{ read: async (path) => (path === BACKUP ? '{' : '{}') }, 'sweep.backupDamaged'],
    ];
    for (const [over, key] of cases) {
      const error = await findUnused(sweep(over), [], Date.now()).then(
        () => null,
        (err: Error) => err.message,
      );
      expect(error).toBe(tr(key, { file: 'journal-2026-10-01.json' }));
      // the file's name is as it is on disk
      spoken(code, error?.replace('journal-2026-10-01.json', ' '), key);
      if (key.startsWith('sweep.backup') && key !== 'sweep.backupsUnreadable') {
        expect(error).toContain('journal-2026-10-01.json');
      }
    }
  });

  it("says the Windows app's refusals in the language on screen, and anything else as it came", () => {
    setLanguage(code);
    for (const key of ['bring.refused.noJournal', 'bring.refused.unreadable'] as const) {
      const text = said(messagesOf('en')[key]);
      expect(text).toBe(tr(key));
      spoken(code, text, key);
    }
    spoken(code, said(new Error('no')), 'bring.folderUnreadable');
    // a file system error the app passes on is the system's own wording
    expect(said('Access is denied. (os error 5)')).toBe('Access is denied. (os error 5)');
  });

  it("writes a merged trade's other chart links after a note in the language on screen, with no direction marks", () => {
    setLanguage(code);
    const legs = ['https://a.example/1', 'https://a.example/2', 'https://a.example/3'].map((url, i) =>
      trade({ openedAt: `2026-10-21T09:0${i}`, closedAt: `2026-10-21T09:0${i}`, symbol: 'X', screenshotUrl: url }),
    );
    const { notes, screenshotUrl } = mergeTrades(legs);
    expect(screenshotUrl).toBe('https://a.example/1');
    expect(notes).toBe(`${tr('merge.chartLinks')} https://a.example/2 https://a.example/3`);
    spoken(code, tr('merge.chartLinks'), 'merge.chartLinks');
    expect(notes).not.toMatch(/[\u2066-\u2069]/);
  });
});

// the whole app drawn in jsdom: alone the first one takes a quarter of a second, beside the rest of the suite it can take more than 5
describe('Bring over, on screen', { timeout: 30_000 }, () => {
  const journalIn = (language: Language, trades: number): JournalData => ({
    version: 1,
    updatedAt: '2026-10-14T09:00:00.000Z',
    onboarded: true,
    profile: { name: 'A' },
    settings: {
      currency: 'USD',
      theme: 'dark',
      timezone: 'local',
      maxDailyLoss: null,
      maxTradesPerDay: null,
      language,
    },
    accounts: [{ id: 'acc1', name: 'A', startingBalance: 0, createdAt: '' }],
    activeAccountId: 'acc1',
    trades: Array.from({ length: trades }, () => trade({ symbol: 'X' })),
    setups: [],
    resources: [],
  });

  /** the earlier version's journal: from before languages, so it has none */
  const earlier = (trades = 3) => {
    const journal = journalIn('en', trades);
    delete journal.settings.language;
    return { text: JSON.stringify(journal), folder: 'C:\\old\\data' };
  };

  let journal: ReturnType<typeof useJournal> | null = null;
  function Bring() {
    journal = useJournal();
    const bringOver = useBringOver();
    return h('button', { type: 'button', 'data-bring': '', onClick: () => void bringOver() }, '→');
  }
  /** every text shown, and the labels a screen reader reads */
  const shown = () =>
    [
      ...[...document.querySelectorAll('body *')].flatMap((el) =>
        [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent?.trim() ?? ''),
      ),
      ...[...document.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label') ?? ''),
    ].filter(Boolean);

  let app: Awaited<ReturnType<typeof mount>> | null = null;
  afterEach(async () => {
    await app?.unmount();
    app = null;
    journal = null;
    disk.copy = null;
    // the browser's copy each journal leaves
    localStorage.clear();
  });

  /** the app in `code`, and Bring over clicked; on a first run there is nothing to ask about */
  async function open(code: Language, onboarded = true) {
    disk.journal = { ...journalIn(code, 1), onboarded };
    app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Bring))));
    await until(() => journal?.ready === true);
    await click(document.querySelector<HTMLButtonElement>('[data-bring]'));
  }
  const showing = (text: string) => () => document.body.textContent?.includes(text) ?? false;

  it.each([1, 3])('English, word for word as before: %i trades', async (count) => {
    const trades = count === 1 ? '1 trade' : `${count} trades`;
    old.read = async () => earlier(count);
    old.copy = async () => 0;
    await open('en');
    await until(() => Boolean(document.querySelector('[data-modal-root]')));
    const dialog = document.querySelector('[data-modal-root]')?.textContent ?? '';
    expect(dialog).toContain('Bring over this journal?');
    expect(dialog).toContain(
      `The earlier version's journal holds ${trades}. Bringing it over replaces everything currently in your journal. The one it replaces is kept in your backups, without its chart images.`,
    );
    await click(button('Replace my journal'));
    await until(showing(`Brought over ${trades} from the earlier version. Its folder was left as it was.`));
  });

  // each with a count that takes another plural form: Spanish one, Russian many, Arabic two
  it.each([
    ['es', 1],
    ['ru', 5],
    ['ar', 2],
    ['hi', 3],
  ] as const)(
    '%s: asks about %i trades, then says what it brought over, and stays in the language',
    async (code, count) => {
      old.read = async () => earlier(count);
      old.copy = async () => 0;
      await open(code);
      await until(() => Boolean(document.querySelector('[data-modal-root]')));
      const dialog = document.querySelector('[data-modal-root]')?.textContent ?? '';
      expect(dialog).toContain(tr('bring.title'));
      expect(dialog).toContain(tr('bring.message', { count }));
      expect(shown().filter((t) => english(code, t))).toEqual([]);

      await click(button(tr('settings.restore.confirm')));
      await until(showing(tr('bring.done', { count })));
      expect(journal?.data.trades).toHaveLength(count);
      expect(journal?.data.settings.language).toBe(code);
      expect(shown().filter((t) => english(code, t))).toEqual([]);
    },
  );

  it.each(OTHERS)('$name: on the first run, brought straight over, with nothing to ask', async ({ code }) => {
    old.read = async () => earlier(3);
    old.copy = async () => 0;
    await open(code, false);
    await until(showing(tr('bring.done', { count: 3 })));
    expect(document.querySelector('[data-modal-root]')).toBeNull();
    expect(shown().filter((t) => english(code, t))).toEqual([]);
  });

  it.each(OTHERS)('$name: no copy of the journal could be kept, nothing changed', async ({ code }) => {
    old.read = async () => earlier(3);
    disk.copy = 'fail';
    await open(code);
    await until(() => Boolean(document.querySelector('[data-modal-root]')));
    await click(button(tr('settings.restore.confirm')));
    await until(showing(tr('settings.noCopy')));
    expect(journal?.data.trades).toHaveLength(1);
    expect(shown().filter((t) => english(code, t))).toEqual([]);
  });

  it.each(OTHERS)('$name: a journal that is not one', async ({ code }) => {
    old.read = async () => ({ text: '{', folder: 'C:\\old\\data' });
    await open(code);
    await until(showing(tr('backup.notJson')));
    expect(journal?.data.trades).toHaveLength(1);
    expect(shown().filter((t) => english(code, t))).toEqual([]);
  });

  it.each(OTHERS)("$name: the earlier version's chart images not copied, nothing changed", async ({ code }) => {
    old.read = async () => earlier();
    old.copy = async () => {
      throw new Error('EIO');
    };
    await open(code);
    await until(() => Boolean(document.querySelector('[data-modal-root]')));
    await click(button(tr('settings.restore.confirm')));
    await until(() => document.body.textContent?.includes(tr('bring.imagesFailed')) ?? false);
    expect(journal?.data.trades).toHaveLength(1);
    expect(shown().filter((t) => english(code, t))).toEqual([]);
  });

  it.each(
    OTHERS.flatMap(({ code }) =>
      (['bring.refused.noJournal', 'bring.refused.unreadable'] as const).map((key) => [code, key] as const),
    ),
  )("%s: the Windows app's refusal %s", async (code, key) => {
    old.read = async () => {
      throw messagesOf('en')[key];
    };
    await open(code);
    await until(showing(tr(key)));
    expect(shown().filter((t) => english(code, t))).toEqual([]);
  });
});

describe('changes kept as a copy, on screen', { timeout: 30_000 }, () => {
  let journal: ReturnType<typeof useJournal> | null = null;
  function Notice() {
    journal = useJournal();
    return h(RecoveredNotice);
  }
  let app: Awaited<ReturnType<typeof mount>> | null = null;
  afterEach(async () => {
    await app?.unmount();
    app = null;
    journal = null;
    disk.version = null;
    disk.copy = null;
    localStorage.clear();
  });

  /** another window's changes, in the browser, made on top of the file before it last changed */
  async function open(code: Language, copy: string | null) {
    const journalOf = (updatedAt: string): JournalData => ({
      version: 1,
      updatedAt,
      onboarded: true,
      profile: { name: 'A' },
      settings: {
        currency: 'USD',
        theme: 'dark',
        timezone: 'local',
        maxDailyLoss: null,
        maxTradesPerDay: null,
        language: code,
      },
      accounts: [{ id: 'acc1', name: 'A', startingBalance: 0, createdAt: '' }],
      activeAccountId: 'acc1',
      trades: [],
      setups: [],
      resources: [],
    });
    localStorage.setItem(MIRROR_KEY, encodeMirror(journalOf('2026-10-15T09:00:00.000Z'), 'v1', 'another-tab'));
    disk.journal = journalOf('2026-10-14T09:00:00.000Z');
    disk.version = 'v2';
    disk.copy = copy;
    app = await mount(h(JournalProvider, null, h(UIProvider, null, h(Notice))));
    await until(() => journal?.ready === true);
  }

  it('English, word for word as before, when the storage could not say where the copy went', async () => {
    await open('en', null);
    await until(
      () => document.body.textContent?.includes('kept as a copy instead of being opened: your backups') ?? false,
    );
  });

  it.each(OTHERS)(
    '$name: where the copy went, in the language on screen, and in a language chosen after',
    async ({ code }) => {
      await open(code, null);
      // the banner's text up to where the copy went, and where it went (in Arabic set apart by direction marks)
      const lead = tr('recovered.body').split('<path>')[0];
      await until(() => {
        const text = document.body.textContent ?? '';
        return text.includes(lead) && text.includes(tr('recovered.backups'));
      });
      spoken(code, tr('recovered.backups'), 'recovered.backups');
      const next = code === 'ar' ? 'ru' : 'ar';
      await act(async () => journal?.actions.updateSettings({ language: next }));
      await until(() => document.body.textContent?.includes(messagesOf(next)['recovered.backups'] as string) ?? false);
    },
  );

  it('a copy the storage named shows its path', async () => {
    await open('ru', 'C:\\journal\\backups\\journal-conflict.json');
    await until(() => document.body.textContent?.includes('C:\\journal\\backups\\journal-conflict.json') ?? false);
  });
});

describe('the texts of the journal files', () => {
  it('are the words the Windows app refuses with, so they can be told apart', () => {
    const rust = readFileSync(join(__dirname, '..', 'src-tauri', 'src', 'lib.rs'), 'utf8');
    for (const key of ['bring.refused.noJournal', 'bring.refused.unreadable'] as const) {
      expect(rust).toContain(`"${files[key]}"`);
    }
  });

  it('are each used by the app, so none is left behind by a screen going back to English', () => {
    const SRC = join(__dirname, '..', 'src');
    const code = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
      .filter((path) => /\.tsx?$/.test(path) && !path.split(/[\\/]/).includes('i18n'))
      .map((path) => readFileSync(join(SRC, path), 'utf8'))
      .join('\n');
    expect(Object.keys(files).filter((key) => !code.includes(`'${key}'`))).toEqual([]);
  });
});
