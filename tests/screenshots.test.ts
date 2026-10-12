import { describe, expect, it } from 'vitest';
import { chartsToDiscard, imagesOnlyIn } from '@/lib/screenshots';
import { trade } from './helpers';

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
