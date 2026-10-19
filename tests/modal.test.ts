// @vitest-environment jsdom
import { createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '@/components/ui/Modal';
import { button, mount, press, pretendLayout } from './render';

/**
 * The dialog every form and confirmation opens in (src/components/ui/Modal.tsx):
 * the keyboard stays in the dialog on top, the page behind it stays still,
 * and focus goes back to where it came from.
 *
 * jsdom has no Tab key of its own, so moving from one field to the next is
 * left to the browser and checked in a real one (tests/e2e/desktop-journey.mjs,
 * section 11). What the dialog does itself is checked here: going round at
 * either end, and bringing focus back in.
 */
const onCloseFirst = vi.fn();
const onCloseSecond = vi.fn();

/** the page: an opener, then the form, then a confirmation over it, as the app renders them */
function Page({ first = false, second = false }: { first?: boolean; second?: boolean }) {
  return h(
    'main',
    { 'data-page-scroll': '' },
    h('button', { type: 'button' }, 'Open'),
    h(Modal, {
      open: first,
      onClose: onCloseFirst,
      title: 'Edit trade',
      children: [
        h('input', { key: 'notes', 'aria-label': 'Notes' }),
        h('button', { key: 'delete', type: 'button' }, 'Delete'),
        // after the last item Tab can reach, so going round has to pass over them
        h('button', { key: 'disabled', type: 'button', disabled: true }, 'Disabled'),
        h('div', { key: 'hidden', hidden: true }, h('button', { type: 'button' }, 'Hidden')),
      ],
    }),
    h(Modal, {
      open: second,
      onClose: onCloseSecond,
      title: 'Delete this trade?',
      closable: false,
      children: h('button', { type: 'button', autoFocus: true }, 'Delete trade'),
    }),
  );
}

let page: Awaited<ReturnType<typeof mount>>;
const dialogs = () => [...document.querySelectorAll<HTMLElement>('[data-modal-root]')];
const scroller = () => document.querySelector<HTMLElement>('main') ?? document.body;
const focused = () => document.activeElement;
/** the dialog's own close button, an icon named by its aria-label */
const closeButton = () => document.querySelector<HTMLElement>('button[aria-label="Close"]');

beforeEach(async () => {
  pretendLayout();
  onCloseFirst.mockClear();
  onCloseSecond.mockClear();
  page = await mount(h(Page));
});
afterEach(async () => {
  await page.unmount();
  vi.restoreAllMocks();
});

describe('Tab and Shift+Tab stay inside the dialog', () => {
  beforeEach(async () => {
    await page.render(h(Page, { first: true }));
  });

  it('Tab on the last item goes round to the first, not to the page behind', async () => {
    button('Delete')?.focus();
    const tab = await press('Tab');
    expect(tab.defaultPrevented).toBe(true);
    expect(focused()).toBe(closeButton());
  });

  it('Shift+Tab on the first item goes round to the last, past disabled and hidden ones', async () => {
    closeButton()?.focus();
    const tab = await press('Tab', { shift: true });
    expect(tab.defaultPrevented).toBe(true);
    expect(focused()).toBe(button('Delete'));
  });

  it('Shift+Tab right after it opens, with focus on the dialog itself, goes to the last item', async () => {
    expect(focused()).toBe(dialogs()[0]);
    await press('Tab', { shift: true });
    expect(focused()).toBe(button('Delete'));
  });

  it('Tab between items is left to the browser', async () => {
    document.querySelector<HTMLElement>('[aria-label="Notes"]')?.focus();
    expect((await press('Tab')).defaultPrevented).toBe(false);
    expect((await press('Tab', { shift: true })).defaultPrevented).toBe(false);
  });

  it('focus that gets out some other way is brought back in', async () => {
    button('Open')?.focus();
    expect(focused()).toBe(closeButton());
  });

  it('in a confirmation over the form, Tab stays in the confirmation', async () => {
    await page.render(h(Page, { first: true, second: true }));
    const confirmation = dialogs()[1];
    expect(focused()).toBe(button('Delete trade'));
    await press('Tab');
    expect(focused()).toBe(button('Delete trade', confirmation));
    await press('Tab', { shift: true });
    expect(focused()).toBe(button('Delete trade', confirmation));
  });
});

describe('the page behind does not scroll', () => {
  beforeEach(() => {
    scroller().style.overflow = 'auto';
    // a 15px scrollbar: 1015 wide with it, 1000 without
    Object.defineProperty(scroller(), 'offsetWidth', { configurable: true, value: 1015 });
    Object.defineProperty(scroller(), 'clientWidth', { configurable: true, value: 1000 });
  });

  it('is locked while a dialog is open, with the scrollbar given back as padding, and restored on close', async () => {
    await page.render(h(Page, { first: true }));
    expect(scroller().style.overflow).toBe('hidden');
    expect(scroller().style.paddingRight).toBe('15px');
    await page.render(h(Page));
    expect(scroller().style.overflow).toBe('auto');
    expect(scroller().style.paddingRight).toBe('');
  });

  it('stays locked when a dialog over another closes, until the last one does', async () => {
    await page.render(h(Page, { first: true, second: true }));
    await page.render(h(Page, { first: true }));
    expect(scroller().style.overflow).toBe('hidden');
    await page.render(h(Page));
    expect(scroller().style.overflow).toBe('auto');
  });
});

describe('Escape', () => {
  it('closes only the dialog on top of two, even one with no close button of its own', async () => {
    await page.render(h(Page, { first: true, second: true }));
    await press('Escape');
    expect(onCloseSecond).toHaveBeenCalledTimes(1);
    expect(onCloseFirst).not.toHaveBeenCalled();
    // once the confirmation has gone, the form is on top
    await page.render(h(Page, { first: true }));
    await press('Escape');
    expect(onCloseFirst).toHaveBeenCalledTimes(1);
    expect(onCloseSecond).toHaveBeenCalledTimes(1);
  });
});

describe('focus', () => {
  it('moves into a dialog as it opens, and back to the button that opened it on close', async () => {
    button('Open')?.focus();
    await page.render(h(Page, { first: true }));
    expect(dialogs()[0].contains(focused())).toBe(true);
    await page.render(h(Page));
    expect(focused()).toBe(button('Open'));
  });

  it('goes back to the opener when the dialog took focus itself as it opened (autoFocus)', async () => {
    button('Open')?.focus();
    await page.render(h(Page, { second: true }));
    expect(focused()).toBe(button('Delete trade'));
    await page.render(h(Page));
    expect(focused()).toBe(button('Open'));
  });

  it('closing a confirmation over the form goes back to the button in the form that opened it', async () => {
    await page.render(h(Page, { first: true }));
    button('Delete')?.focus();
    await page.render(h(Page, { first: true, second: true }));
    expect(focused()).toBe(button('Delete trade'));
    await page.render(h(Page, { first: true }));
    expect(focused()).toBe(button('Delete'));
  });
});
