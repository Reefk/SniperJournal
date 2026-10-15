// The DevTools protocol helpers both end-to-end journeys drive their pages
// with: the desktop build in a headless browser (desktop-journey.mjs) and the
// Windows app in its own WebView2 window (windows-app-journey.mjs).

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** send / run / until / setFile for one page, over its DevTools WebSocket */
export function drive(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const n = ++id;
      pending.set(n, r);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const run = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.result?.exceptionDetails)
      throw new Error(`${expression.slice(0, 80)}: ${res.result.exceptionDetails.exception?.description}`);
    return res.result?.result?.value;
  };
  const until = async (expression, label, timeout = 8000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await run(expression)) return true;
      await sleep(100);
    }
    throw new Error(`timed out waiting for: ${label}`);
  };
  const setFile = async (selector, path) => {
    const { result } = await send('DOM.getDocument', { depth: -1 });
    const { result: q } = await send('DOM.querySelector', { nodeId: result.root.nodeId, selector });
    await send('DOM.setFileInputFiles', { nodeId: q.nodeId, files: [path] });
  };
  return { send, run, until, setFile };
}

// helpers that run inside the page
export const PAGE = `
  window.$t = (text, root = document) => [...root.querySelectorAll('button, a')].find((b) => b.textContent.trim() === text);
  window.$tStarts = (text, root = document) => [...root.querySelectorAll('button, a')].find((b) => b.textContent.trim().startsWith(text));
  window.$field = (label, root = document) => {
    const l = [...root.querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(label));
    return l && document.getElementById(l.htmlFor);
  };
  window.$type = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : el instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  };
  window.$modal = () => [...document.querySelectorAll('[data-modal-root]')].at(-1);
  window.$text = () => document.body.innerText;
  window.$nav = (href) => [...document.querySelectorAll('aside a')].find((a) => a.getAttribute('href') === href).click();
  window.$role = (header, role) => {
    const s = [...document.querySelectorAll('select')].find((x) => x.getAttribute('aria-label') === 'What "' + header + '" is');
    if (s) $type(s, role);
    return !!s;
  };
  true;
`;
