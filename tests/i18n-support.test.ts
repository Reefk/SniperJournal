// @vitest-environment jsdom
import { createElement as h } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { LANGUAGES, type Language } from '@/lib/i18n';
import type { SaveStatus } from '@/store/JournalProvider';
import type { CopyMiss } from '@/store/mirror';
import { mount } from './render';
import { KEPT, SUPPORT_TYPED, looksEnglish } from './i18n-kept';

/**
 * The Support page as the browser version, the Windows app and the phone app
 * each draw it, in every save state, in each language: nothing English left
 * in it but names and what is typed as it is. (The screen test, i18n-views,
 * draws only the browser version with everything saved.)
 */
const here = vi.hoisted(() => ({
  kind: 'web' as 'web' | 'native',
  device: 'pc' as 'pc' | 'phone',
  saveStatus: 'saved' as SaveStatus,
  copyMiss: null as CopyMiss | null,
  filePath: 'C:\\journal\\data\\journal.json',
}));
vi.mock('@/lib/storage', () => ({
  storage: {
    get kind() {
      return here.kind;
    },
    get device() {
      return here.device;
    },
  },
}));
vi.mock('@/store/JournalProvider', () => ({
  useSaveState: () => ({ filePath: here.filePath, saveStatus: here.saveStatus, copyMiss: here.copyMiss }),
}));

/** each version, with texts only it draws (in one save state or another) and one it never does */
const VERSIONS = [
  {
    name: 'the browser version',
    kind: 'web',
    device: 'pc',
    shows: ['sup.file.error.web', 'sup.private.pc', 'sup.q.ownWindow'],
    hides: 'sup.q.bringOver',
  },
  {
    name: 'the Windows app',
    kind: 'native',
    device: 'pc',
    shows: ['sup.file.error.app', 'sup.private.pc', 'sup.a.where.app', 'sup.q.bringOver'],
    hides: 'sup.q.ownWindow',
  },
  {
    name: 'the phone app',
    kind: 'native',
    device: 'phone',
    shows: ['sup.file.error.app', 'sup.private.phone', 'sup.a.where.phone', 'sup.q.computers.phone'],
    hides: 'sup.q.window',
  },
] as const;

/** every save state, with the browser's spare copy missing where that changes the words */
const STATES: Array<[SaveStatus, CopyMiss | null]> = [
  ['saved', null],
  ['saved', 'too-big'],
  ['error', null],
  ['error', 'refused'],
  ['conflict', null],
  ['browser', null],
  ['unsaved', 'too-big'],
];

// what Spanish traders call it too
const ALLOWED = [...KEPT, ...SUPPORT_TYPED, here.filePath, 'stop loss']
  .sort((a, b) => b.length - a.length)
  .map((word) => new RegExp(`(^|[^A-Za-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^A-Za-z]|$)`, 'g'));
/** text with the names and what's typed as it is taken out */
const rest = (text: string) => ALLOWED.reduce((left, word) => left.replace(word, '$1 '), text);

describe.each(VERSIONS)('Support, $name', (version) => {
  let SupportView: typeof import('@/views/SupportView').SupportView;
  let i18n: typeof import('@/lib/i18n');

  // the page reads which version it is once, when it loads; loading it again can take a while beside the rest of the suite
  beforeAll(async () => {
    vi.resetModules();
    Object.assign(here, { kind: version.kind, device: version.device });
    ({ SupportView } = await import('@/views/SupportView'));
    i18n = await import('@/lib/i18n');
  }, 30_000);
  afterAll(() => i18n.setLanguage('en'));

  /** every piece of text the page shows in `code`, in each save state */
  async function texts(code: Language): Promise<string[]> {
    i18n.setLanguage(code);
    const out: string[] = [];
    for (const [saveStatus, copyMiss] of STATES) {
      Object.assign(here, { saveStatus, copyMiss });
      const app = await mount(h(SupportView));
      const walker = document.createTreeWalker(app.container, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.textContent?.trim()) out.push(node.textContent.trim());
      }
      await app.unmount();
    }
    return out;
  }

  it('draws its own answers and file states', { timeout: 30_000 }, async () => {
    const english = new Set(await texts('en'));
    expect(version.shows.filter((key) => !english.has(i18n.tr(key)))).toEqual([]);
    expect(english.has(i18n.tr(version.hides))).toBe(false);
  });

  // 14 pages drawn: alone it takes well under a second, beside the rest of the suite it can take more than 5
  it.each(LANGUAGES.filter((l) => l.code !== 'en'))(
    'has no English left in $name',
    { timeout: 30_000 },
    async ({ code }) => {
      const english = new Set(await texts('en'));
      const latin = (text: string) => /[A-Za-z]{2}/.test(rest(text));
      // Spanish shares the Latin letters: there a text is English when it is the English one, or has English words
      const left = (await texts(code)).filter((text) =>
        code === 'es' ? (latin(text) && english.has(text)) || looksEnglish(rest(text)) : latin(text),
      );
      expect(left).toEqual([]);
    },
  );
});
