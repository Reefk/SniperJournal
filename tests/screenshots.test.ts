import { describe, expect, it } from 'vitest';
import { imagesOnlyIn } from '@/lib/screenshots';
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
