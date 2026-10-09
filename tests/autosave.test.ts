import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosave, readPatiently } from '@/store/autosave';

/**
 * When the journal gets written, on fake timers. Each write is held until the
 * test answers it, so a test can have a save "on its way" when it wants one.
 */
function harness() {
  const writes: { snapshot: string; answer: (ok: boolean) => Promise<void> }[] = [];
  const events: string[] = [];
  const save = createAutosave<string>(
    (snapshot) =>
      new Promise<void>((resolve, reject) => {
        writes.push({
          snapshot,
          // answering also lets the promise callbacks run
          answer: async (ok) => {
            if (ok) resolve();
            else reject(new Error('Could not write the journal file.'));
            await vi.advanceTimersByTimeAsync(0);
          },
        });
      }),
    {
      saved: () => events.push('saved'),
      saving: () => events.push('saving'),
      failed: (newest) => events.push(`failed:${newest}`),
    },
  );
  return { save, writes, events, sent: () => writes.map((w) => w.snapshot), last: () => events.at(-1) };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('saving changes', () => {
  it('a burst of changes becomes one save, after a short pause', async () => {
    const h = harness();
    h.save.change('a');
    await vi.advanceTimersByTimeAsync(100);
    h.save.change('b');
    await vi.advanceTimersByTimeAsync(100);
    h.save.change('c');
    await vi.advanceTimersByTimeAsync(349);
    expect(h.sent()).toEqual([]);
    expect(h.last()).toBe('saving');
    await vi.advanceTimersByTimeAsync(1);
    expect(h.sent()).toEqual(['c']);
    await h.writes[0].answer(true);
    expect(h.last()).toBe('saved');
  });

  it('a change made while a save is on its way goes next, and only then is it "saved"', async () => {
    const h = harness();
    h.save.change('a');
    await vi.advanceTimersByTimeAsync(350);
    h.save.change('b');
    await vi.advanceTimersByTimeAsync(350);
    expect(h.sent()).toEqual(['a', 'b']);
    await h.writes[0].answer(true);
    expect(h.events).not.toContain('saved');
    await h.writes[1].answer(true);
    expect(h.last()).toBe('saved');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.sent()).toEqual(['a', 'b']); // nothing written twice
  });

  it('the app being hidden writes a waiting change at once', async () => {
    const h = harness();
    h.save.change('a');
    await vi.advanceTimersByTimeAsync(100);
    h.save.flush();
    expect(h.sent()).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.sent()).toEqual(['a']);
  });
});

describe('when a save fails', () => {
  it('it is tried again with the newest journal, and saving recovers on its own', async () => {
    const h = harness();
    h.save.change('a');
    await vi.advanceTimersByTimeAsync(350);
    await h.writes[0].answer(false);
    expect(h.last()).toBe('failed:a');
    expect(h.save.failing).toBe(true);

    // a change meanwhile is not sent on its own; it goes with the next try
    h.save.change('b');
    expect(h.last()).toBe('failed:b');
    await vi.advanceTimersByTimeAsync(999);
    expect(h.sent()).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.sent()).toEqual(['a', 'b']);

    await h.writes[1].answer(true);
    expect(h.last()).toBe('saved');
    expect(h.save.failing).toBe(false);

    // and the next change is saved the normal way again
    h.save.change('c');
    await vi.advanceTimersByTimeAsync(350);
    expect(h.sent()).toEqual(['a', 'b', 'c']);
  });

  it('the pause between tries grows to 30s, and the tries never stop', async () => {
    const h = harness();
    h.save.change('a');
    await vi.advanceTimersByTimeAsync(350);
    const gaps: number[] = [];
    for (let i = 0; i < 7; i++) {
      await h.writes.at(-1)!.answer(false);
      const before = h.writes.length;
      let waited = 0;
      while (h.writes.length === before) {
        await vi.advanceTimersByTimeAsync(100);
        waited += 100;
      }
      gaps.push(waited);
    }
    expect(gaps).toEqual([1000, 2000, 5000, 10000, 30000, 30000, 30000]);
    await h.writes.at(-1)!.answer(true);
    expect(h.last()).toBe('saved');
  });

  it('a change made while a retry is on its way is written once the disk is back', async () => {
    const h = harness();
    h.save.change('a');
    await vi.advanceTimersByTimeAsync(350);
    await h.writes[0].answer(false);
    await vi.advanceTimersByTimeAsync(1000); // the retry of 'a' is now on its way
    h.save.change('b');
    await h.writes[1].answer(true);
    expect(h.events).not.toContain('saved'); // 'b' is not in the file yet
    expect(h.last()).toBe('saving');
    await vi.advanceTimersByTimeAsync(350);
    expect(h.sent()).toEqual(['a', 'a', 'b']);
    await h.writes[2].answer(true);
    expect(h.last()).toBe('saved');
  });

  it('being hidden does not cut short the pause after a failure', async () => {
    const h = harness();
    h.save.change('a');
    await vi.advanceTimersByTimeAsync(350);
    await h.writes[0].answer(false);
    h.save.flush();
    expect(h.sent()).toEqual(['a']);
  });

  it('nothing is written after it is disposed', async () => {
    const h = harness();
    h.save.change('a');
    h.save.dispose();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.sent()).toEqual([]);
  });
});

describe('reading at startup', () => {
  it('a read that fails is tried again after 0.5s and 1.5s', async () => {
    let calls = 0;
    const read = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error('EBUSY');
      return 'journal';
    });
    const result = readPatiently(read);
    await vi.advanceTimersByTimeAsync(499);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1500);
    await expect(result).resolves.toBe('journal');
  });

  it('gives up after three tries, with the last error', async () => {
    const read = vi.fn(async () => {
      throw new Error('Could not read the journal file.');
    });
    const result = readPatiently(read);
    const outcome = expect(result).rejects.toThrow('Could not read the journal file.');
    await vi.advanceTimersByTimeAsync(2000);
    await outcome;
    expect(read).toHaveBeenCalledTimes(3);
  });
});
