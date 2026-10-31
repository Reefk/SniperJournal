// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InfoTip } from '@/components/ui/InfoTip';
import { mount } from './render';

/**
 * A metric's info bubble (src/components/ui/InfoTip.tsx), on hover or focus.
 * It is drawn above the page, under its icon and inside the window, so no box
 * around it cuts it: the Dashboard's metric strip, which hides what sticks out
 * of its rounded corners, cut it at 1180 and 1366 px. jsdom lays nothing out,
 * so the icon's place and the bubble's size (240 × 60 px) are given here, in
 * a 1024 × 768 window.
 */

const TEXT = 'What you earn on an average trade, after costs.';

let app: Awaited<ReturnType<typeof mount>> | undefined;
let iconAt = { left: 500, top: 100 };

beforeEach(() => {
  iconAt = { left: 500, top: 100 };
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(60);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute('role') === 'tooltip') return new DOMRect();
    // the icon: 12 × 12 px
    return new DOMRect(iconAt.left, iconAt.top, 12, 12);
  });
});

afterEach(async () => {
  await app?.unmount();
  app = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function tip() {
  app = await mount(h(InfoTip, { text: TEXT }));
  const bubble = app.container.querySelector<HTMLElement>('[role="tooltip"]');
  const icon = bubble?.parentElement;
  if (!bubble || !icon) throw new Error('no bubble');
  return { bubble, icon };
}

const shown = (bubble: HTMLElement) => !bubble.classList.contains('hidden');
const at = (bubble: HTMLElement) => [bubble.style.left, bubble.style.top];

function pointer(icon: HTMLElement, type: 'pointerover' | 'pointerout', pointerType: string) {
  act(() => {
    icon.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType }));
  });
}

describe('an info bubble', () => {
  it('is unseen, and takes no room, until it is wanted; its text is there all along', async () => {
    const { bubble, icon } = await tip();
    expect(shown(bubble)).toBe(false);
    expect(bubble.textContent).toBe(TEXT);
    // what a screen reader reads on the icon
    expect(icon.getAttribute('aria-label')).toBe(TEXT);
  });

  it('shows while the mouse is over its icon', async () => {
    const { bubble, icon } = await tip();
    pointer(icon, 'pointerover', 'mouse');
    expect(shown(bubble)).toBe(true);
    pointer(icon, 'pointerout', 'mouse');
    expect(shown(bubble)).toBe(false);
  });

  it('shows while its icon has the focus, the mouse gone or not', async () => {
    const { bubble, icon } = await tip();
    act(() => icon.focus());
    expect(shown(bubble)).toBe(true);
    pointer(icon, 'pointerover', 'mouse');
    pointer(icon, 'pointerout', 'mouse');
    expect(shown(bubble)).toBe(true);
    act(() => icon.blur());
    expect(shown(bubble)).toBe(false);
  });

  it('on a phone, opens with the tap (the focus), not with the finger that leaves at once', async () => {
    const { bubble, icon } = await tip();
    pointer(icon, 'pointerover', 'touch');
    expect(shown(bubble)).toBe(false);
    act(() => icon.focus());
    pointer(icon, 'pointerout', 'touch');
    expect(shown(bubble)).toBe(true);
  });

  it('sits centred under its icon', async () => {
    const { bubble, icon } = await tip();
    act(() => icon.focus());
    // 506 - 120 across; 112 + 8 down
    expect(at(bubble)).toEqual(['386px', '120px']);
  });

  it("is moved in from the window's edge, on either side", async () => {
    iconAt = { left: 20, top: 100 };
    const near = await tip();
    act(() => near.icon.focus());
    expect(at(near.bubble)).toEqual(['8px', '120px']);
    await app?.unmount();

    iconAt = { left: 1000, top: 100 };
    const far = await tip();
    act(() => far.icon.focus());
    // 1024 - 8 - 240
    expect(at(far.bubble)).toEqual(['776px', '120px']);
  });

  it('goes over its icon when the window has no room below it', async () => {
    iconAt = { left: 500, top: 730 };
    const { bubble, icon } = await tip();
    act(() => icon.focus());
    // 730 - 8 - 60
    expect(at(bubble)).toEqual(['386px', '662px']);
  });

  it('stays under its icon in a window with room neither below nor above it', async () => {
    vi.stubGlobal('innerHeight', 100);
    iconAt = { left: 500, top: 20 };
    const { bubble, icon } = await tip();
    act(() => icon.focus());
    // 32 + 60 is past 100 - 8, and 20 - 8 - 60 is above the window
    expect(at(bubble)).toEqual(['386px', '40px']);
  });

  it('stays by its icon while the page scrolls under it, or the window changes size', async () => {
    const { bubble, icon } = await tip();
    act(() => icon.focus());
    iconAt = { left: 500, top: 40 };
    act(() => {
      document.body.dispatchEvent(new Event('scroll'));
    });
    expect(at(bubble)).toEqual(['386px', '60px']);
    vi.stubGlobal('innerWidth', 600);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    // 600 - 8 - 240
    expect(at(bubble)).toEqual(['352px', '60px']);
  });

  it('once closed, no longer follows the page', async () => {
    const { bubble, icon } = await tip();
    act(() => icon.focus());
    act(() => icon.blur());
    iconAt = { left: 100, top: 300 };
    act(() => {
      document.body.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));
    });
    expect(at(bubble)).toEqual(['386px', '120px']);
  });

  it('is put above everything as a popover, where the browser has them, and taken down when closed', async () => {
    const showPopover = vi.fn();
    const hidePopover = vi.fn();
    Object.assign(HTMLElement.prototype, { showPopover, hidePopover });
    try {
      const { bubble, icon } = await tip();
      expect(bubble.getAttribute('popover')).toBe('manual');
      act(() => icon.focus());
      expect(showPopover).toHaveBeenCalledTimes(1);
      expect(showPopover.mock.contexts[0]).toBe(bubble);
      expect(hidePopover).not.toHaveBeenCalled();
      act(() => icon.blur());
      expect(hidePopover).toHaveBeenCalledTimes(1);
      expect(hidePopover.mock.contexts[0]).toBe(bubble);
      // open when its page goes: taken down with it
      act(() => icon.focus());
      await app?.unmount();
      app = undefined;
      expect(showPopover).toHaveBeenCalledTimes(2);
      expect(hidePopover).toHaveBeenCalledTimes(2);
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
      delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
    }
  });
});
