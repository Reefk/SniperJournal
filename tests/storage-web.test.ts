import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JournalData } from '@/lib/types';
import { webStorage } from '@/lib/storage/web';
import { JournalConflict } from '@/lib/storage/types';

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

describe('saving from two windows', () => {
  /** a fetch that records each request and answers from a list, in order */
  function scripted(answers: { status: number; body: unknown }[]) {
    const requests: { method: string; ifMatch: string | null }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        requests.push({ method: init?.method ?? 'GET', ifMatch: headers.get('If-Match') });
        const next = answers.shift();
        if (!next) throw new Error('no answer left');
        return new Response(JSON.stringify(next.body), { status: next.status });
      }),
    );
    return requests;
  }

  it('each save names the version of the file this window last read or wrote', async () => {
    const requests = scripted([
      { status: 200, body: { ok: true, data: journal(1), version: 'v1' } },
      { status: 200, body: { ok: true, path: 'p', version: 'v2' } },
      { status: 200, body: { ok: true, path: 'p', version: 'v3' } },
    ]);
    await webStorage.readJournal();
    expect(webStorage.version?.()).toBe('v1');
    await webStorage.writeJournal(journal(2));
    await webStorage.writeJournal(journal(3));
    expect(requests.map((r) => r.ifMatch)).toEqual([null, 'v1', 'v2']);
    expect(webStorage.version?.()).toBe('v3');
  });

  it('a save the server refuses because the file changed is a JournalConflict, and changes nothing here', async () => {
    scripted([
      { status: 200, body: { ok: true, data: journal(1), version: 'v1' } },
      { status: 412, body: { ok: false, conflict: true, error: 'The journal was changed in another window since this one opened it.' } },
    ]);
    await webStorage.readJournal();
    const refused = webStorage.writeJournal(journal(2));
    await expect(refused).rejects.toBeInstanceOf(JournalConflict);
    await expect(refused).rejects.toThrow('changed in another window');
    expect(webStorage.version?.()).toBe('v1');
  });

  it('knows where the journal is kept from the first read, before any save', async () => {
    scripted([{ status: 200, body: { ok: true, data: null, version: 'none', path: 'C:\journal\data\journal.json' } }]);
    await webStorage.readJournal();
    expect(webStorage.location()).toBe('C:\journal\data\journal.json');
  });

  it('on a first run the window is based on "no file yet"', async () => {
    const requests = scripted([
      { status: 200, body: { ok: true, data: null, version: 'none' } },
      { status: 200, body: { ok: true, path: 'p', version: 'v1' } },
    ]);
    expect(await webStorage.readJournal()).toBeNull();
    await webStorage.writeJournal(journal(1));
    expect(requests[1].ifMatch).toBe('none');
  });
});

describe('reclaiming the chart images', () => {
  it('asks the server, which holds the journal and its backups, naming the images this window shows', async () => {
    const sent: { url: string; method?: string; body: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        sent.push({ url, method: init?.method, body: JSON.parse(String(init?.body)) });
        return new Response(JSON.stringify({ ok: true, images: [{ name: 'orphan01.png', bytes: 70 }] }));
      }),
    );
    expect(await webStorage.findUnusedImages(['shown001.png'])).toEqual([{ name: 'orphan01.png', bytes: 70 }]);
    expect(await webStorage.removeUnusedImages(['shown001.png'], ['orphan01.png'])).toEqual([{ name: 'orphan01.png', bytes: 70 }]);
    expect(sent).toEqual([
      { url: '/api/screenshot?unused', method: 'POST', body: { inUse: ['shown001.png'] } },
      // only the images the person was shown
      { url: '/api/screenshot?unused', method: 'POST', body: { inUse: ['shown001.png'], remove: ['orphan01.png'] } },
    ]);
  });

  it("an answer the server could not give is an error carrying the server's reason", async () => {
    const reason = 'Your journal file is damaged (it is not a complete journal), so no chart image was deleted.';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: reason }), { status: 500 })));
    await expect(webStorage.findUnusedImages([])).rejects.toThrow(reason);
  });
});
