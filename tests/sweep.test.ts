import { describe, expect, it } from 'vitest';
import {
  SWEEP_GRACE_MS,
  SweepError,
  findUnused,
  removeUnused,
  sweepCandidates,
  type SweepFiles,
} from '@/lib/storage/sweep';

/**
 * Which chart images "Reclaim unused chart images" finds and deletes, against
 * an in-memory folder: images with their ages and sizes, and the journal and
 * its copies as text. A copy given as null was deleted after it was listed.
 */
const NOW = Date.parse('2026-10-13T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const MONTH = 30 * 24 * HOUR;

function folder(images: Record<string, number>, journals: Record<string, string | Error | null>) {
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
const names = (images: { name: string }[]) => images.map((i) => i.name);

describe('which chart images are unused', () => {
  it('an old image no trade uses is unused, with its size; one a trade in the open journal shows is not', async () => {
    const f = folder({ 'orphan01.png': MONTH, 'shown001.png': MONTH }, { 'journal.json': journal('shown001.png') });
    expect(await findUnused(f.files, ['shown001.png'], NOW)).toEqual([{ name: 'orphan01.png', bytes: 1200 }]);
    // finding deletes nothing
    expect(f.left()).toEqual(['orphan01.png', 'shown001.png']);
  });

  it('an image added in the last day is kept, whatever refers to it: a trade form may still hold it', async () => {
    const f = folder({ 'fresh001.png': 23 * HOUR, 'stale001.png': 24 * HOUR }, { 'journal.json': journal() });
    expect(names(await findUnused(f.files, [], NOW))).toEqual(['stale001.png']);
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
    expect(names(await findUnused(f.files, [], NOW))).toEqual(['gone0001.jpg']);
  });

  it('names are compared ignoring case, as Windows does', async () => {
    const f = folder(
      { 'abc123def.png': MONTH, 'x1y2z3.png': MONTH, 'orphan01.png': MONTH },
      { 'journal.json': journal('ABC123DEF.PNG') },
    );
    expect(names(await findUnused(f.files, ['X1Y2Z3.PNG'], NOW))).toEqual(['orphan01.png']);
  });

  it('a name mentioned anywhere in a journal counts, in a link or a note as well', async () => {
    const f = folder(
      { 'linked01.png': MONTH, 'noted001.png': MONTH, 'orphan01.png': MONTH },
      {
        'journal.json': JSON.stringify({
          trades: [{ screenshotUrl: 'https://charts.example/linked01.png', notes: 'see noted001.png' }],
        }),
      },
    );
    expect(names(await findUnused(f.files, [], NOW))).toEqual(['orphan01.png']);
  });

  it('only images with a name the app gives are ever candidates', async () => {
    const f = folder(
      { 'desktop.ini': MONTH, 'notes.txt': MONTH, 'short.png': MONTH, 'orphan01.png': MONTH },
      { 'journal.json': journal() },
    );
    expect(names(await findUnused(f.files, [], NOW))).toEqual(['orphan01.png']);
  });

  it('reads nothing when every image is in use or new, and stops reading once none is left to check', async () => {
    const quiet = folder({ 'shown001.png': MONTH, 'fresh001.png': HOUR }, { 'journal.json': journal('shown001.png') });
    expect(await findUnused(quiet.files, ['shown001.png'], NOW)).toEqual([]);
    expect(quiet.reads).toEqual([]);

    const early = folder(
      { 'saved001.png': MONTH },
      { 'journal.json': journal('saved001.png'), 'backups/b.json': journal() },
    );
    expect(await findUnused(early.files, [], NOW)).toEqual([]);
    expect(early.reads).toEqual(['journal.json']);
  });

  it('the boundary of "the last day" is exact', () => {
    const images = [
      { name: 'a00001.png', modified: NOW - SWEEP_GRACE_MS, bytes: 1 },
      { name: 'b00001.png', modified: NOW - SWEEP_GRACE_MS + 1, bytes: 1 },
      { name: 'c00001.png', modified: NOW - 2 * SWEEP_GRACE_MS, bytes: 1 },
    ];
    expect(names(sweepCandidates(images, new Set(['c00001.png']), NOW))).toEqual(['a00001.png']);
  });
});

describe('when a journal or copy cannot be trusted, nothing is unused', () => {
  const failure = (journals: Record<string, string | Error | null>) =>
    findUnused(folder({ 'orphan01.png': MONTH }, journals).files, [], NOW);

  it('a journal cut short (the app opens it as unreadable) stops the search, and says so', async () => {
    const whole = journal('orphan01.png');
    const cut = whole.slice(0, whole.indexOf('orphan01'));
    const err = await failure({ 'journal.json': cut }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SweepError);
    expect((err as Error).message).toBe(
      'Your journal file is damaged (it is not a complete journal), so no chart image was deleted.',
    );
  });

  it('a damaged or unreadable copy stops it too, naming the copy', async () => {
    await expect(
      failure({ 'journal.json': journal(), 'C:\\data\\backups\\journal-2026-10-01.json': '{"trades": [' }),
    ).rejects.toThrow('The backup journal-2026-10-01.json is damaged');
    await expect(
      failure({ 'journal.json': journal(), 'backups/conflict-1.json': new Error('EBUSY: held by antivirus') }),
    ).rejects.toThrow('The backup conflict-1.json could not be read, so no chart image was deleted.');
  });

  it('a missing or unreadable journal stops it', async () => {
    await expect(failure({ 'journal.json': new Error('ENOENT') })).rejects.toThrow(
      'Your journal file could not be read',
    );
    await expect(failure({ 'journal.json': null })).rejects.toThrow('Your journal file could not be read');
    await expect(failure({})).rejects.toThrow('Your journal file could not be read');
  });

  it('a copy deleted since it was listed (a save prunes old backups) protects nothing, and the search goes on', async () => {
    const f = folder(
      { 'orphan01.png': MONTH, 'daily001.png': MONTH },
      { 'journal.json': journal(), 'backups/journal-2026-09-01.json': null, 'backups/b.json': journal('daily001.png') },
    );
    expect(names(await findUnused(f.files, [], NOW))).toEqual(['orphan01.png']);
  });

  it('folders that cannot be listed stop it, worded for the person', async () => {
    const files = folder({ 'orphan01.png': MONTH }, { 'journal.json': journal() }).files;
    await expect(
      findUnused({ ...files, journals: () => Promise.reject(new Error('EACCES')) }, [], NOW),
    ).rejects.toThrow('The backups folder could not be read, so no chart image was deleted.');
    await expect(findUnused({ ...files, images: () => Promise.reject(new Error('EIO')) }, [], NOW)).rejects.toThrow(
      'The screenshots folder could not be read',
    );
  });
});

describe('deleting the unused images', () => {
  it('deletes the unused images that were shown and agreed to, and says which went, with their sizes', async () => {
    const f = folder(
      { 'orphan01.png': MONTH, 'orphan02.webp': MONTH, 'shown001.png': MONTH, 'fresh001.png': HOUR },
      { 'journal.json': journal('shown001.png') },
    );
    expect(await removeUnused(f.files, ['shown001.png'], ['orphan01.png', 'orphan02.webp'], NOW)).toEqual([
      { name: 'orphan01.png', bytes: 1200 },
      { name: 'orphan02.webp', bytes: 1300 },
    ]);
    expect(f.left()).toEqual(['fresh001.png', 'shown001.png']);
  });

  it('never more than was agreed to: one that became unused meanwhile stays, and one in use again stays', async () => {
    const f = folder(
      { 'shown01.png': MONTH, 'agreed1.png': MONTH, 'usedagain.png': MONTH, 'newlyunused.png': MONTH },
      { 'journal.json': journal('usedagain.png') },
    );
    // the dialog showed agreed1 and usedagain; since then usedagain is in use again
    // and newlyunused has become unused
    expect(names(await removeUnused(f.files, ['shown01.png'], ['AGREED1.PNG', 'usedagain.png'], NOW))).toEqual([
      'agreed1.png',
    ]);
    expect(f.left()).toEqual(['newlyunused.png', 'shown01.png', 'usedagain.png']);
  });

  it('deletes nothing when the journal or a copy cannot be trusted', async () => {
    const f = folder({ 'orphan01.png': MONTH }, { 'journal.json': journal(), 'backups/b.json': new Error('EACCES') });
    await expect(removeUnused(f.files, [], ['orphan01.png'], NOW)).rejects.toThrow(SweepError);
    expect(f.left()).toEqual(['orphan01.png']);
  });

  it('an image that cannot be deleted is left out of the answer, and the others still go', async () => {
    const f = folder({ 'locked01.png': MONTH, 'orphan01.png': MONTH }, { 'journal.json': journal() });
    expect(names(await removeUnused(f.files, [], ['locked01.png', 'orphan01.png'], NOW))).toEqual(['orphan01.png']);
    expect(f.left()).toEqual(['locked01.png']);
  });
});
