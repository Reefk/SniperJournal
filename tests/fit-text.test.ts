// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FitText, fitFontSize } from '@/components/ui/FitText';
import { mount } from './render';

/**
 * A figure too wide for its card gets a smaller font instead of "…"
 * (src/components/ui/FitText.tsx): Spanish writes "+11.179,87 US$" where
 * English writes "+$11,179.87". jsdom lays nothing out, so the box's room and
 * the text's width are given here; the real thing was measured in Edge.
 */

describe('the font size that fits', () => {
  it('stays the same when the line fits', () => {
    expect(fitFontSize(27, 214, 214, 0.7)).toBe(27);
    expect(fitFontSize(27, 214, 180, 0.7)).toBe(27);
  });

  it('shrinks by the share that fits, rounded down to half a pixel', () => {
    // the Dashboard's net profit in Spanish on a laptop: 223px of text in 214px
    expect(fitFontSize(27, 214, 223, 0.7)).toBe(25.5);
    // the Calendar's on a phone: 173px in 150px
    expect(fitFontSize(21, 150, 173, 0.7)).toBe(18);
  });

  it('never goes below its least share; beyond that the line is cut', () => {
    expect(fitFontSize(27, 100, 223, 0.7)).toBeCloseTo(18.9);
  });

  it('leaves a box with no room yet (not laid out) alone', () => {
    expect(fitFontSize(27, 0, 223, 0.7)).toBe(27);
  });
});

describe('a figure in its box', () => {
  let room = 214;
  let wide = 223;
  const watchers: Array<() => void> = [];
  const watched: Element[] = [];
  let stopped = 0;

  beforeEach(() => {
    room = 214;
    wide = 223;
    watchers.length = 0;
    watched.length = 0;
    stopped = 0;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => room);
    // `wide` at the full 27px; a smaller font draws the line narrower in step
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return Math.ceil((wide * parseFloat(this.style.fontSize || '27')) / 27);
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private cb: () => void) {}
        observe(el: Element) {
          watchers.push(this.cb);
          watched.push(el);
        }
        disconnect() {
          stopped += 1;
        }
      },
    );
    const style = document.createElement('style');
    style.textContent = '.big { font-size: 27px; }';
    document.head.append(style);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'fonts');
    document.head.innerHTML = '';
  });

  // jsdom has no document.fonts: one whose fonts arrive when the test says
  const fontsArriving = () => {
    let arrive = () => {};
    const ready = new Promise<void>((resolve) => (arrive = resolve));
    Object.defineProperty(document, 'fonts', { value: { ready }, configurable: true });
    return async () => {
      await act(async () => {
        arrive();
        await ready;
      });
    };
  };

  const figure = (c: HTMLElement) => c.querySelector('div') as HTMLDivElement;

  it('gets the font size that fits, and its full size back when the box widens', async () => {
    const { container, unmount } = await mount(h(FitText, { className: 'big', children: '+11.179,87 US$' }));
    expect(figure(container).style.fontSize).toBe('25.5px');
    // the window made wider: the box now has room for the whole line
    room = 260;
    await act(async () => watchers.forEach((w) => w()));
    expect(figure(container).style.fontSize).toBe('');
    await unmount();
  });

  it('keeps its size when the line fits, as English does', async () => {
    wide = 178;
    const { container, unmount } = await mount(h(FitText, { className: 'big', children: '+$11,179.87' }));
    expect(figure(container).style.fontSize).toBe('');
    // still cut with "…" past the least size, as before
    expect(figure(container).className).toContain('truncate');
    await unmount();
  });

  it('fits again when its text changes', async () => {
    wide = 178;
    const { container, render, unmount } = await mount(h(FitText, { className: 'big', children: '+$11,179.87' }));
    wide = 223;
    await render(h(FitText, { className: 'big', children: '+11.179,87 US$' }));
    expect(figure(container).style.fontSize).toBe('25.5px');
    await unmount();
  });

  it('goes half a pixel smaller while the line is still too wide', async () => {
    // letters drawn a whole number of pixels wide (0.6 of the font, rounded), so the line
    // narrows less than its font: 24.5px still draws 11 letters 15px wide, 165px in 160px
    room = 160;
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return 11 * Math.round(0.6 * parseFloat(this.style.fontSize || '27'));
    });
    const { container, unmount } = await mount(h(FitText, { className: 'big', children: '+$15,622.29' }));
    expect(figure(container).style.fontSize).toBe('24px');
    await unmount();
  });

  it('goes no smaller than its least share of the full size; past that the line is cut', async () => {
    wide = 500;
    const { container, render, unmount } = await mount(h(FitText, { className: 'big', children: '+11.179,87 US$' }));
    expect(figure(container).style.fontSize).toBe('18.9px');
    await render(h(FitText, { className: 'big', least: 0.5, children: '+11.179,87 US$' }));
    expect(figure(container).style.fontSize).toBe('13.5px');
    await unmount();
  });

  it('watches its own box once, not on every render, and stops when it goes', async () => {
    const { container, render, unmount } = await mount(h(FitText, { className: 'big', children: '+11.179,87 US$' }));
    await render(h(FitText, { className: 'big', children: '+5079,64 US$' }));
    expect(watched).toEqual([figure(container)]);
    expect(stopped).toBe(0);
    await unmount();
    expect(stopped).toBe(1);
  });

  it('fits again once the figures’ font has arrived', async () => {
    const fontsArrive = fontsArriving();
    wide = 178;
    const { container, unmount } = await mount(h(FitText, { className: 'big', children: '+11.179,87 US$' }));
    expect(figure(container).style.fontSize).toBe('');
    // the figures' own font is wider than the one drawn first
    wide = 223;
    await fontsArrive();
    expect(figure(container).style.fontSize).toBe('25.5px');
    await unmount();
  });

  it('leaves a figure that has gone alone when the font arrives', async () => {
    const fontsArrive = fontsArriving();
    wide = 178;
    const { container, unmount } = await mount(h(FitText, { className: 'big', children: '+11.179,87 US$' }));
    const gone = figure(container);
    await unmount();
    wide = 223;
    await fontsArrive();
    expect(gone.style.fontSize).toBe('');
  });

  it('still fits as it is drawn where the browser has no ResizeObserver', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { container, unmount } = await mount(h(FitText, { className: 'big', children: '+11.179,87 US$' }));
    expect(figure(container).style.fontSize).toBe('25.5px');
    await unmount();
  });
});
