import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, vi } from 'vitest';

/**
 * Helpers for the render tests (files that start with
 * `// @vitest-environment jsdom`). Components are drawn with React itself into
 * jsdom, and driven the way a person would: typing, clicking, pressing keys.
 */

/** draws `element` into a fresh container in the page; `render` draws it again with new props */
export async function mount(element: ReactElement) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const render = (next: ReactElement) =>
    act(async () => {
      root.render(next);
    });
  await render(element);
  return {
    container,
    render,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** waits, letting React work, until `check` holds (about 2 seconds at most, unless told otherwise) */
export async function until(check: () => boolean, ms = 2000) {
  for (let i = 0; i < ms / 20 && !check(); i++) {
    await act(async () => {
      await sleep(20);
    });
  }
  expect(check()).toBe(true);
}

/** the field whose label starts with `label` */
export function field(label: string, root: ParentNode = document): HTMLInputElement | HTMLSelectElement | null {
  const l = [...root.querySelectorAll('label')].find((x) => x.textContent?.trim().startsWith(label));
  const el = l?.htmlFor ? [...root.querySelectorAll('[id]')].find((x) => x.id === l.htmlFor) : null;
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement ? el : null;
}

/** the button whose text is exactly `text` */
export function button(text: string, root: ParentNode = document): HTMLButtonElement | null {
  return [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) ?? null;
}

/** types into a field the way a person does, so React sees the change */
export async function type(el: HTMLInputElement | HTMLSelectElement | null, value: string) {
  expect(el).toBeTruthy();
  if (!el) return;
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

export async function click(el: HTMLElement | null) {
  expect(el).toBeTruthy();
  await act(async () => {
    el?.click();
  });
}

/** a key pressed where focus is; returns the event, so a test can see whether it was handled */
export async function press(key: string, { shift = false } = {}) {
  const event = new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true, cancelable: true });
  await act(async () => {
    (document.activeElement ?? document.body).dispatchEvent(event);
  });
  return event;
}

/**
 * jsdom lays nothing out, so every element would look off screen to code that
 * asks for its boxes (getClientRects). Here everything has one, except what is
 * inside a [hidden] element, which is how a display:none part is told apart.
 */
export function pretendLayout() {
  return vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    return (this.closest('[hidden]') ? [] : [{}]) as unknown as DOMRectList;
  });
}
