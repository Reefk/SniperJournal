import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chartsOnlyInSample, chartsToDiscard, findUnusedCharts, imagesOnlyIn, removeUnusedCharts } from '@/lib/screenshots';
import { mergeTrades } from '@/lib/merge';
import { trade } from './helpers';

const asked = vi.hoisted(() => [] as Array<[string, string[]]>);
vi.mock('@/lib/storage', () => ({
  storage: {
    async findUnusedImages(inUse: string[]) {
      asked.push(['find', inUse]);
      return [{ name: 'orphan01.png', bytes: 70 }];
    },
    async removeUnusedImages(inUse: string[]) {
      asked.push(['remove', inUse]);
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

  it('names the images the open journal shows, once each, both to find them and to delete them', async () => {
    const trades = [trade({ screenshotFile: 'aaa111.png' }), trade(), trade({ screenshotFile: 'aaa111.png' })];
    expect(await findUnusedCharts(trades)).toEqual([{ name: 'orphan01.png', bytes: 70 }]);
    expect(await removeUnusedCharts(trades)).toEqual([{ name: 'orphan01.png', bytes: 70 }]);
    expect(asked).toEqual([
      ['find', ['aaa111.png']],
      ['remove', ['aaa111.png']],
    ]);
  });
});
