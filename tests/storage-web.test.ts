import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JournalData } from '@/lib/types';
import { webStorage } from '@/lib/storage/web';

/**
 * The PC's storage as the page sees it, with `fetch` replaced by one whose
 * answers the test hands out itself, so it can hold a save "in flight".
 */
type Call = { body: string; answer: (ok: boolean) => void };
function heldFetch(): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((resolve) => {
          calls.push({
            body: String(init?.body),
            answer: (ok) =>
              resolve(
                new Response(JSON.stringify(ok ? { ok: true, path: 'C:\\journal\\data\\journal.json' } : { ok: false, error: 'Could not write the journal file.' }), {
                  status: ok ? 200 : 500,
                }),
              ),
          });
        }),
    ),
  );
  return calls;
}
const journal = (n: number) => ({ version: 1, updatedAt: `n${n}`, trades: [], accounts: [] }) as unknown as JournalData;
const settle = () => new Promise((r) => setTimeout(r, 0));
const sent = (call: Call) => JSON.parse(call.body).updatedAt;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saving from the page', () => {
  it('sends one save at a time: the next waits until the one before has been answered', async () => {
    const calls = heldFetch();
    const first = webStorage.writeJournal(journal(1));
    const second = webStorage.writeJournal(journal(2));
    await settle();
    expect(calls.map(sent)).toEqual(['n1']);

    calls[0].answer(true);
    await expect(first).resolves.toBe('C:\\journal\\data\\journal.json');
    await settle();
    expect(calls.map(sent)).toEqual(['n1', 'n2']);

    calls[1].answer(true);
    await expect(second).resolves.toBe('C:\\journal\\data\\journal.json');
  });

  it('a failed save is reported, and does not hold up the ones after it', async () => {
    const calls = heldFetch();
    const first = webStorage.writeJournal(journal(1));
    const second = webStorage.writeJournal(journal(2));
    await settle();
    calls[0].answer(false);
    await expect(first).rejects.toThrow('Could not write the journal file.');
    await settle();
    expect(calls.map(sent)).toEqual(['n1', 'n2']);
    calls[1].answer(true);
    await expect(second).resolves.toBe('C:\\journal\\data\\journal.json');
  });
});
