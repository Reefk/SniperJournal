import { describe, expect, it } from 'vitest';
import { SWEEP_GRACE_MS, findUnused, removeUnused, sweepCandidates, type SweepFiles } from '@/lib/storage/sweep';

/**
 * Which chart images "Reclaim unused chart images" finds and deletes, against
 * an in-memory folder: images with their ages and sizes, and the journal and
 * its copies as text.
 */
const NOW = Date.parse('2026-10-13T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const MONTH = 30 * 24 * HOUR;

function folder(images: Record<string, number>, journals: Record<string, string | Error>) {
  const left = new Map(Object.entries(images));
  const reads: string[] = [];
  const files: SweepFiles = {
    async images() {
      return [...left].map(([name, age]) => ({ name, modified: NOW - age, bytes: name.length * 100 }));
    },
    async journals() {
      return Object.keys(journals);
    },
    async read(name) {
      reads.push(name);
      const text = journals[name];
      if (text instanceof Error) throw text;
      return text;
    },
    async remove(name) {
      if (name.startsWith('locked')) throw new Error('EBUSY');
      left.delete(name);
    },
  };
  return { files, left: () => [...left.keys()].sort(), reads };
}

const journal = (...names: string[]) => JSON.stringify({ trades: names.map((n) => ({ screenshotFile: n })) });

describe('which chart images are unused', () => {
  it('an old image no trade uses is unused, with its size; one a trade in the open journal shows is not', async () => {
    const f = folder({ 'orphan01.png': MONTH, 'shown001.png': MONTH }, { 'journal.json': journal('shown001.png') });
    expect(await findUnused(f.files, ['shown001.png'], NOW)).toEqual([{ name: 'orphan01.png', bytes: 1200 }]);
    // finding deletes nothing
    expect(f.left()).toEqual(['orphan01.png', 'shown001.png']);
  });

  it('an image added in the last day is kept, whatever refers to it: a trade form may still hold it', async () => {
    const f = folder({ 'fresh001.png': 23 * HOUR, 'stale001.png': 24 * HOUR }, { 'journal.json': journal() });
    expect((await findUnused(f.files, [], NOW)).map((i) => i.name)).toEqual(['stale001.png']);
  });

  it('an image the saved journal or any kept copy mentions is in use', async () => {
    const f = folder(
      { 'saved001.png': MONTH, 'daily001.png': MONTH, 'other001.webp': MONTH, 'gone0001.jpg': MONTH },
      {
        // the window asking may be behind the file, or the file behind it
        'journal.json': journal('saved001.png'),
        'backups/journal-2026-10-01.json': journal('daily001.png'),
        // a window whose save was refused: its trades are only in this copy
        'backups/conflict-20261012-101500.json': journal('other001.webp'),
      },
    );
    expect((await findUnused(f.files, [], NOW)).map((i) => i.name)).toEqual(['gone0001.jpg']);
  });

  it('a journal or copy that cannot be read is an error, never "unused"', async () => {
    const held = folder(
      { 'orphan01.png': MONTH },
      { 'journal.json': journal(), 'backups/journal-2026-10-01.json': new Error('EBUSY: held by antivirus') },
    );
    await expect(findUnused(held.files, [], NOW)).rejects.toThrow('EBUSY');
    const missing = folder({ 'orphan01.png': MONTH }, { 'journal.json': new Error('ENOENT') });
    await expect(findUnused(missing.files, [], NOW)).rejects.toThrow('ENOENT');
  });

  it('reads nothing when every image is in use or new, and stops reading once none is left to check', async () => {
    const quiet = folder({ 'shown001.png': MONTH, 'fresh001.png': HOUR }, { 'journal.json': journal('shown001.png') });
    expect(await findUnused(quiet.files, ['shown001.png'], NOW)).toEqual([]);
    expect(quiet.reads).toEqual([]);

    const early = folder({ 'saved001.png': MONTH }, { 'journal.json': journal('saved001.png'), 'backups/b.json': journal() });
    expect(await findUnused(early.files, [], NOW)).toEqual([]);
    expect(early.reads).toEqual(['journal.json']);
  });

  it('the boundary of "the last day" is exact', () => {
    const images = [
      { name: 'a00001.png', modified: NOW - SWEEP_GRACE_MS, bytes: 1 },
      { name: 'b00001.png', modified: NOW - SWEEP_GRACE_MS + 1, bytes: 1 },
      { name: 'c00001.png', modified: NOW - 2 * SWEEP_GRACE_MS, bytes: 1 },
    ];
    expect(sweepCandidates(images, new Set(['c00001.png']), NOW).map((i) => i.name)).toEqual(['a00001.png']);
  });
});

describe('deleting the unused images', () => {
  it('deletes exactly the unused ones and says which went, with their sizes', async () => {
    const f = folder(
      { 'orphan01.png': MONTH, 'orphan02.webp': MONTH, 'shown001.png': MONTH, 'fresh001.png': HOUR },
      { 'journal.json': journal('shown001.png') },
    );
    expect(await removeUnused(f.files, ['shown001.png'], NOW)).toEqual([
      { name: 'orphan01.png', bytes: 1200 },
      { name: 'orphan02.webp', bytes: 1300 },
    ]);
    expect(f.left()).toEqual(['fresh001.png', 'shown001.png']);
  });

  it('deletes nothing when the journal or a copy cannot be read', async () => {
    const f = folder({ 'orphan01.png': MONTH }, { 'journal.json': journal(), 'backups/b.json': new Error('EACCES') });
    await expect(removeUnused(f.files, [], NOW)).rejects.toThrow('EACCES');
    expect(f.left()).toEqual(['orphan01.png']);
  });

  it('an image that cannot be deleted is left out of the answer, and the others still go', async () => {
    const f = folder({ 'locked01.png': MONTH, 'orphan01.png': MONTH }, { 'journal.json': journal() });
    expect((await removeUnused(f.files, [], NOW)).map((i) => i.name)).toEqual(['orphan01.png']);
    expect(f.left()).toEqual(['locked01.png']);
  });
});
