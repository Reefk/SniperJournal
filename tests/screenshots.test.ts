import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chartsOnlyInSample,
  chartsToDiscard,
  findUnusedCharts,
  imagesOnlyIn,
  removeUnusedCharts,
  uploadScreenshot,
} from '@/lib/screenshots';
import { unsupportedImage } from '@/lib/storage/image-types';
import { mergeTrades } from '@/lib/merge';
import { trade } from './helpers';

const asked = vi.hoisted(() => [] as Array<[string, string[], string[]?]>);
/** the types of the images handed to the storage, and what it throws instead */
const saved = vi.hoisted(() => ({ types: [] as string[], fail: null as Error | null }));
vi.mock('@/lib/storage', () => ({
  storage: {
    async saveImage(blob: Blob) {
      if (saved.fail) throw saved.fail;
      saved.types.push(blob.type);
      return 'saved001.png';
    },
    async findUnusedImages(inUse: string[]) {
      asked.push(['find', inUse]);
      return [{ name: 'orphan01.png', bytes: 70 }];
    },
    async removeUnusedImages(inUse: string[], approved: string[]) {
      asked.push(['remove', inUse, approved]);
      return [{ name: 'orphan01.png', bytes: 70 }];
    },
  },
}));

describe('which chart images go with removed trades', () => {
  it('lists the images of the removed trades', () => {
    const removed = [trade({ screenshotFile: 'aaa111.png' }), trade(), trade({ screenshotFile: 'bbb222.webp' })];
    expect(imagesOnlyIn(removed, [trade({ screenshotFile: 'ccc333.png' })])).toEqual(['aaa111.png', 'bbb222.webp']);
  });

  it('keeps an image that a remaining trade still shows', () => {
    const shared = 'shared01.png';
    expect(imagesOnlyIn([trade({ screenshotFile: shared })], [trade({ screenshotFile: shared })])).toEqual([]);
  });

  it('names an image once, however many removed trades share it', () => {
    const removed = [trade({ screenshotFile: 'twice01.png' }), trade({ screenshotFile: 'twice01.png' })];
    expect(imagesOnlyIn(removed, [])).toEqual(['twice01.png']);
  });

  it('has nothing to delete when the removed trades have no images', () => {
    expect(imagesOnlyIn([trade(), trade()], [trade({ screenshotFile: 'kept0001.png' })])).toEqual([]);
    expect(imagesOnlyIn([], [])).toEqual([]);
  });
});

describe('which chart images go when the trade form closes', () => {
  const nobodyElse = () => false;

  it('Cancel after removing the chart: nothing goes, the trade keeps it', () => {
    expect(chartsToDiscard([], 'orig01.png', 'orig01.png', nobodyElse)).toEqual([]);
  });

  it('Cancel after replacing it: only the new upload goes', () => {
    expect(chartsToDiscard(['new001.webp'], 'orig01.png', 'orig01.png', nobodyElse)).toEqual(['new001.webp']);
  });

  it('Save after replacing it: the old chart goes, the new one stays', () => {
    expect(chartsToDiscard(['new001.webp'], 'orig01.png', 'new001.webp', nobodyElse)).toEqual(['orig01.png']);
  });

  it('Save after replacing it twice: the first replacement goes as well', () => {
    expect(chartsToDiscard(['new001.webp', 'new002.webp'], 'orig01.png', 'new002.webp', nobodyElse).sort()).toEqual([
      'new001.webp',
      'orig01.png',
    ]);
  });

  it('Save after removing it: the chart goes, unless another trade still shows it', () => {
    expect(chartsToDiscard([], 'orig01.png', undefined, nobodyElse)).toEqual(['orig01.png']);
    expect(chartsToDiscard([], 'orig01.png', undefined, (n) => n === 'orig01.png')).toEqual([]);
  });

  it('a new trade: Save keeps its chart, Cancel drops the upload', () => {
    expect(chartsToDiscard(['new001.webp'], undefined, 'new001.webp', nobodyElse)).toEqual([]);
    expect(chartsToDiscard(['new001.webp'], undefined, undefined, nobodyElse)).toEqual(['new001.webp']);
  });
});

describe('removing the test data', () => {
  it('takes the charts attached to test trades, but not one a trade of your own also shows', () => {
    const trades = [
      trade({ isSample: true, screenshotFile: 'sample01.png' }),
      trade({ isSample: true }),
      trade({ isSample: true, screenshotFile: 'shared01.png' }),
      trade({ screenshotFile: 'shared01.png' }),
      trade({ screenshotFile: 'mine0001.png' }),
    ];
    expect(chartsOnlyInSample(trades)).toEqual(['sample01.png']);
    expect(chartsOnlyInSample([trade({ screenshotFile: 'mine0001.png' })])).toEqual([]);
  });
});

describe('merging trades', () => {
  it("the merged trade keeps the earliest chart; the other parts' charts go, unless another trade shows them", () => {
    const legs = [
      trade({ symbol: 'ES', openedAt: '2026-03-02T10:05', screenshotFile: 'later001.png' }),
      trade({ symbol: 'ES', openedAt: '2026-03-02T10:00' }),
      trade({ symbol: 'ES', openedAt: '2026-03-02T10:01', screenshotFile: 'first001.png' }),
      trade({ symbol: 'ES', openedAt: '2026-03-02T10:10', screenshotFile: 'shared01.png' }),
    ];
    const merged = mergeTrades(legs);
    expect(merged.screenshotFile).toBe('first001.png');
    const elsewhere = trade({ screenshotFile: 'shared01.png' });
    expect(imagesOnlyIn(legs, [elsewhere, merged])).toEqual(['later001.png']);
  });
});

describe('reclaiming the chart images nothing uses', () => {
  beforeEach(() => {
    asked.length = 0;
  });

  it('names the images the open journal shows, once each, and deletes only the ones agreed to', async () => {
    const trades = [trade({ screenshotFile: 'aaa111.png' }), trade(), trade({ screenshotFile: 'aaa111.png' })];
    expect(await findUnusedCharts(trades)).toEqual([{ name: 'orphan01.png', bytes: 70 }]);
    expect(await removeUnusedCharts(trades, ['orphan01.png'])).toEqual([{ name: 'orphan01.png', bytes: 70 }]);
    expect(asked).toEqual([
      ['find', ['aaa111.png']],
      ['remove', ['aaa111.png'], ['orphan01.png']],
    ]);
  });
});

describe('saving a chart image', () => {
  const image = (type: string, bytes = 1000) => new File([new Uint8Array(bytes)], 'chart', { type });

  /** what the browser can draw: a bitmap this size, or nothing (a HEIC, say) */
  function browserDraws(size: { width: number; height: number } | null) {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        if (!size) throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
        return { ...size, close() {} };
      }),
    );
    // the canvas writes whatever type it is asked for, smaller than any image here
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage() {} }),
      toBlob: (done: (b: Blob) => void, type: string) => done(new Blob([new Uint8Array(4)], { type })),
    };
    vi.stubGlobal('document', { createElement: () => canvas });
  }

  beforeEach(() => {
    saved.types.length = 0;
    saved.fail = null;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves a small PNG, JPEG, WebP or GIF as it is', async () => {
    browserDraws({ width: 800, height: 600 });
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      expect(await uploadScreenshot(image(type))).toEqual({ name: 'saved001.png' });
    }
    expect(saved.types).toEqual(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
  });

  it('refuses a small AVIF or BMP, which would be kept as it came, instead of saving it as a .jpg', async () => {
    browserDraws({ width: 800, height: 600 });
    for (const type of ['image/avif', 'image/bmp']) {
      expect(await uploadScreenshot(image(type))).toEqual({ error: unsupportedImage() });
    }
    expect(saved.types).toEqual([]);
  });

  it('refuses an image the browser cannot draw (a HEIC), which is left as it came', async () => {
    browserDraws(null);
    expect(await uploadScreenshot(image('image/heic'))).toEqual({ error: unsupportedImage() });
    expect(saved.types).toEqual([]);
  });

  it('an AVIF big enough to be redrawn is saved as the WebP it becomes, as before', async () => {
    browserDraws({ width: 3600, height: 2000 });
    expect(await uploadScreenshot(image('image/avif'))).toEqual({ name: 'saved001.png' });
    expect(saved.types).toEqual(['image/webp']);
  });

  it('a file that is not an image is refused before anything is drawn or saved', async () => {
    browserDraws({ width: 800, height: 600 });
    expect(await uploadScreenshot(image('text/plain'))).toEqual({ error: 'That file is not an image.' });
    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(saved.types).toEqual([]);
  });

  it("passes on the storage's own reason, and says the data folder was out of reach for anything else", async () => {
    browserDraws({ width: 800, height: 600 });
    saved.fail = new Error('That image is larger than 8MB.');
    expect(await uploadScreenshot(image('image/png'))).toEqual({ error: 'That image is larger than 8MB.' });
    saved.fail = new TypeError('Failed to fetch');
    expect(await uploadScreenshot(image('image/png'))).toEqual({
      error: 'Images can only be saved while the app can reach its data folder.',
    });
  });
});
