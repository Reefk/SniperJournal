import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JournalData } from '@/lib/types';
import { webStorage } from '@/lib/storage/web';

/**
 * The PC's storage, for the requests tests/storage-web.test.ts doesn't make:
 * a failed read, kept copies, chart images and an export. `fetch` answers
 * what each test tells it to, and records what it was asked.
 */
type Asked = { url: string; init?: RequestInit };
function answering(...bodies: unknown[]): Asked[] {
  const asked: Asked[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      asked.push({ url, init });
      return new Response(JSON.stringify(bodies.shift() ?? { ok: true }));
    }),
  );
  return asked;
}
const journal = { version: 1, trades: [], accounts: [] } as unknown as JournalData;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reading the journal', () => {
  it("throws the server's own message when it could not read the file", async () => {
    answering({ ok: false, error: 'The journal file is not valid JSON.' });
    await expect(webStorage.readJournal()).rejects.toThrow('The journal file is not valid JSON.');
  });

  it('throws a message of its own when the server gives none', async () => {
    answering({ ok: false });
    await expect(webStorage.readJournal()).rejects.toThrow('Could not read the journal.');
  });
});

describe('keeping a copy', () => {
  it('posts the journal with the reason, and says where the copy went', async () => {
    const asked = answering({ ok: true, path: 'C:\\journal\\data\\backups\\before-erase-1.json' });
    await expect(webStorage.keepCopy(journal, 'before-erase')).resolves.toBe(
      'C:\\journal\\data\\backups\\before-erase-1.json',
    );
    expect(asked[0].url).toBe('/api/journal?copy=before-erase');
    expect(asked[0].init?.method).toBe('POST');
    expect(JSON.parse(String(asked[0].init?.body))).toEqual(journal);
  });

  it('says nothing of where when the server does not, and throws when it refuses', async () => {
    answering({ ok: true }, { ok: false, error: 'No space left on the disk.' }, { ok: false });
    await expect(webStorage.keepCopy(journal, 'conflict')).resolves.toBeNull();
    await expect(webStorage.keepCopy(journal, 'conflict')).rejects.toThrow('No space left on the disk.');
    await expect(webStorage.keepCopy(journal, 'conflict')).rejects.toThrow('Could not keep a copy of the journal.');
  });
});

describe('chart images', () => {
  it('uploads an image as a form and returns the name the server gave it', async () => {
    const asked = answering({ ok: true, name: 'abc123.png' });
    await expect(webStorage.saveImage(new Blob(['x'], { type: 'image/png' }))).resolves.toBe('abc123.png');
    expect(asked[0].url).toBe('/api/screenshot');
    const file = (asked[0].init?.body as FormData).get('file');
    expect(file).toBeInstanceOf(File);
    expect((file as File).type).toBe('image/png');
  });

  it("throws the server's message when the upload is refused, or no name comes back", async () => {
    answering({ ok: false, error: 'That image type cannot be saved.' }, { ok: true }, { ok: false });
    const blob = new Blob(['x'], { type: 'image/bmp' });
    await expect(webStorage.saveImage(blob)).rejects.toThrow('That image type cannot be saved.');
    await expect(webStorage.saveImage(blob)).rejects.toThrow('Could not save the image.');
    await expect(webStorage.saveImage(blob)).rejects.toThrow('Could not save the image.');
  });

  it('shows and deletes an image by its name, made safe for the address', async () => {
    expect(webStorage.imageSrc('a b.png')).toBe('/api/screenshot?name=a%20b.png');
    const asked = answering();
    await webStorage.deleteImage('a&b.png');
    expect(asked[0]).toMatchObject({ url: '/api/screenshot?name=a%26b.png', init: { method: 'DELETE' } });
  });
});

describe('exporting a file', () => {
  it('downloads it through a link to its contents, and lets the link go afterwards', async () => {
    vi.useFakeTimers();
    const clicked: Array<{ href: string; download: string }> = [];
    const link = {
      href: '',
      download: '',
      click() {
        clicked.push({ href: link.href, download: link.download });
      },
      remove: vi.fn(),
    };
    const appended: unknown[] = [];
    vi.stubGlobal('document', { createElement: () => link, body: { appendChild: (el: unknown) => appended.push(el) } });
    const created: Blob[] = [];
    const revoked: string[] = [];
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => {
        created.push(blob);
        return 'blob:trades';
      },
      revokeObjectURL: (url: string) => revoked.push(url),
    });
    try {
      await webStorage.exportFile('trades.csv', 'a,b', 'text/csv');
      expect(created[0].type).toBe('text/csv;charset=utf-8');
      await expect(created[0].text()).resolves.toBe('a,b');
      expect(appended).toEqual([link]);
      expect(clicked).toEqual([{ href: 'blob:trades', download: 'trades.csv' }]);
      expect(link.remove).toHaveBeenCalled();
      expect(revoked).toEqual([]);
      vi.advanceTimersByTime(1000);
      expect(revoked).toEqual(['blob:trades']);
    } finally {
      vi.useRealTimers();
    }
  });
});
