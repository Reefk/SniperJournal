import { describe, expect, it, vi } from 'vitest';
import type { JournalData } from '@/lib/types';
import {
  decodeMirror,
  encodeMirror,
  MIRROR_KEY,
  MIRROR_LIMIT,
  pickJournal,
  rebaseMirror,
  storeMirror,
} from '@/store/mirror';

const journal = (updatedAt: string, note = updatedAt) =>
  ({ version: 1, updatedAt, trades: [{ id: note }], accounts: [] }) as unknown as JournalData;

describe('the browser copy of the journal', () => {
  it('records the journal, the file version it was made on top of, and the tab that wrote it', () => {
    const raw = encodeMirror(journal('2026-10-12T10:00:00Z'), 'v1', 'tabA');
    expect(decodeMirror(raw)).toEqual({ journal: journal('2026-10-12T10:00:00Z'), base: 'v1', tab: 'tabA' });
  });

  it('reads a copy written by an older app, before copies recorded their version', () => {
    const old = journal('2026-10-12T10:00:00Z');
    expect(decodeMirror(JSON.stringify(old))).toEqual({ journal: old, base: null, tab: null, legacy: true });
  });

  it('ignores nothing, rubbish and a broken copy', () => {
    expect(decodeMirror(null)).toBeNull();
    expect(decodeMirror('not json')).toBeNull();
    expect(decodeMirror('7')).toBeNull();
    expect(decodeMirror(JSON.stringify({ journal: null, base: 'v1' }))).toBeNull();
  });
});

describe('putting the copy in the browser', () => {
  it('stores a copy that fits, under the one key every tab shares', () => {
    const setItem = vi.fn();
    expect(storeMirror('x'.repeat(MIRROR_LIMIT), () => ({ setItem }))).toBeNull();
    expect(setItem).toHaveBeenCalledWith(MIRROR_KEY, 'x'.repeat(MIRROR_LIMIT));
  });

  it('does not even try a copy over the limit, and says it is too big', () => {
    const setItem = vi.fn();
    expect(storeMirror('x'.repeat(MIRROR_LIMIT + 1), () => ({ setItem }))).toBe('too-big');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('says the browser refused it when its storage is full', () => {
    const full = () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    };
    expect(storeMirror('{}', () => ({ setItem: full }))).toBe('refused');
  });

  it('says the same when the browser has storage turned off altogether', () => {
    const blocked = () => {
      throw new DOMException('Access is denied for this document.', 'SecurityError');
    };
    expect(storeMirror('{}', blocked)).toBe('refused');
  });
});

describe('which journal opens', () => {
  const disk = journal('2026-10-12T10:00:00Z', 'disk');
  const newer = journal('2026-10-12T10:05:00Z', 'browser');
  const mirror = (base: string | null, j = newer) => decodeMirror(encodeMirror(j, base, 'tab'));

  it('the file, when the browser has nothing', () => {
    expect(pickJournal(disk, 'v1', null)).toEqual({ journal: disk, stale: null });
  });

  it('the browser copy, when there is no file (or it could not be read)', () => {
    expect(pickJournal(null, null, mirror('v1'))).toEqual({ journal: newer, stale: null });
  });

  it('the file, when the browser copy is not newer', () => {
    expect(pickJournal(disk, 'v1', mirror('v1', journal('2026-10-12T09:00:00Z')))).toEqual({
      journal: disk,
      stale: null,
    });
  });

  it('the browser copy, when it holds newer changes made on top of the file as it is (the app closed before saving)', () => {
    expect(pickJournal(disk, 'v1', mirror('v1'))).toEqual({ journal: newer, stale: null });
  });

  it('the file, when the newer browser copy was made on top of an older file; that copy comes back to be kept', () => {
    expect(pickJournal(disk, 'v2', mirror('v1'))).toEqual({ journal: disk, stale: newer });
  });

  it('the newer one, as before, for a copy from an older app or a phone (no versions there)', () => {
    expect(pickJournal(disk, 'v2', decodeMirror(JSON.stringify(newer)))).toEqual({ journal: newer, stale: null });
    expect(pickJournal(disk, null, mirror(null))).toEqual({ journal: newer, stale: null });
  });
});

describe('after a save', () => {
  it("this tab's copy moves on to the version it just wrote", () => {
    const raw = encodeMirror(journal('t2'), 'v1', 'tabA');
    expect(decodeMirror(rebaseMirror(raw, 'tabA', 'v1', 'v2'))).toEqual({
      journal: journal('t2'),
      base: 'v2',
      tab: 'tabA',
    });
  });

  it("another tab's copy is left alone: it does not hold the changes this save wrote", () => {
    expect(rebaseMirror(encodeMirror(journal('t2'), 'v1', 'tabB'), 'tabA', 'v1', 'v2')).toBeNull();
  });

  it('a copy made on top of some other version is left alone', () => {
    expect(rebaseMirror(encodeMirror(journal('t2'), 'v0', 'tabA'), 'tabA', 'v1', 'v2')).toBeNull();
  });

  it('a copy from an older app, or no copy, is left alone', () => {
    expect(rebaseMirror(JSON.stringify(journal('t2')), 'tabA', 'v1', 'v2')).toBeNull();
    expect(rebaseMirror(null, 'tabA', 'v1', 'v2')).toBeNull();
  });
});

describe('two tabs open on the same journal', () => {
  // one browser copy shared by both tabs, and the file's version
  it('A saves first; B is refused; after a reload B opens what A saved, not its own copy', () => {
    let browser: string | null = null;
    const a1 = journal('2026-10-12T10:01:00Z', 'A');
    const b1 = journal('2026-10-12T10:02:00Z', 'B');
    // both opened file v1; A edits, then B edits (B's copy is the newest in the browser)
    browser = encodeMirror(a1, 'v1', 'A');
    browser = encodeMirror(b1, 'v1', 'B');
    // A's save takes the file to v2; the copy is B's, so it is not moved on
    expect(rebaseMirror(browser, 'A', 'v1', 'v2')).toBeNull();
    // B's save is refused, B keeps its version as a conflict copy and drops its browser copy
    browser = decodeMirror(browser)?.tab === 'B' ? null : browser;
    // B reloads
    expect(pickJournal(a1, 'v2', decodeMirror(browser))).toEqual({ journal: a1, stale: null });
  });

  it('if B was closed before its save, its newer copy does not open over A on the next start', () => {
    const a1 = journal('2026-10-12T10:01:00Z', 'A');
    const b1 = journal('2026-10-12T10:02:00Z', 'B');
    const browser = encodeMirror(b1, 'v1', 'B'); // B's last change, made on top of v1
    // meanwhile A saved: the file is a1, version v2
    expect(pickJournal(a1, 'v2', decodeMirror(browser))).toEqual({ journal: a1, stale: b1 });
  });

  it('one tab alone: a change made while its save was on the way still opens after a crash', () => {
    const c1 = journal('2026-10-12T10:01:00Z', 'c1');
    const c2 = journal('2026-10-12T10:02:00Z', 'c2');
    let browser = encodeMirror(c1, 'v1', 'T');
    browser = encodeMirror(c2, 'v1', 'T'); // the next change, before the first save came back
    browser = rebaseMirror(browser, 'T', 'v1', 'v2') ?? browser; // c1 is in the file now (v2)
    // the app is killed before c2 is saved
    expect(pickJournal(c1, 'v2', decodeMirror(browser))).toEqual({ journal: c2, stale: null });
  });
});
