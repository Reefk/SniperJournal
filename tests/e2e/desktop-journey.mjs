// End-to-end journey through the real desktop build, in a headless browser:
// first run, CSV import, metrics, edit, delete, CSV export, backup, restore
// (with its safety copy), a save while another program holds the journal
// file (Windows), and a server restart. Synthetic data only, in a throwaway
// folder; your own data/ folder is never touched.
//
//   npm run build && npm run e2e
//
// Needs Microsoft Edge or Google Chrome installed (or CHROME_PATH set).
// No extra packages: it speaks the DevTools protocol over Node's WebSocket.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const project = resolve(import.meta.dirname, '..', '..');
const port = 3200 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${port}`;
const work = mkdtempSync(join(tmpdir(), 'sj-e2e-'));
const downloads = join(work, 'downloads');
const browserPath =
  process.env.CHROME_PATH ??
  [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find(existsSync);

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? `  (${detail})` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the server, run with the throwaway folder as its working directory -----
let server;
async function startServer() {
  const next = join(project, 'node_modules', 'next', 'dist', 'bin', 'next');
  server = spawn(process.execPath, [next, 'start', project, '-H', '127.0.0.1', '-p', String(port)], { cwd: work, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/api/journal`)).ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error('the server did not start');
}
const exited = (proc) => (proc.exitCode !== null || proc.signalCode !== null ? Promise.resolve() : new Promise((r) => proc.once('exit', r)));
async function stopServer() {
  server.kill();
  await exited(server);
}

// ---- another program holding the journal open (Windows only) ---------------
// The way antivirus or OneDrive does: share 'Read' lets others read the file
// but not replace it; 'None' shuts everyone out. Resolves once it is open,
// with `released` for when it is let go. (Wrapped in an object: an async
// function returning a bare promise only resolves once that one does.)
const holders = new Set();
async function holdJournal(ms, share) {
  const file = join(work, 'data', 'journal.json');
  const proc = spawn('powershell', ['-NoProfile', '-Command', `$f = [IO.File]::Open('${file}', 'Open', 'Read', '${share}'); 'held'; Start-Sleep -Milliseconds ${ms}; $f.Close()`]);
  holders.add(proc);
  await new Promise((resolve, reject) => {
    proc.stdout.once('data', resolve);
    proc.once('exit', (code) => reject(new Error(`could not hold the journal open (exit ${code})`)));
  });
  return { released: exited(proc).then(() => holders.delete(proc)) };
}

// ---- a browser with a fresh profile, driven over the DevTools protocol ------
const browsers = new Set(); // still open, so a failed run can close them too
async function openBrowser() {
  const debugPort = 9500 + Math.floor(Math.random() * 400);
  const profile = mkdtempSync(join(work, 'profile-')); // removed with the work folder
  const proc = spawn(browserPath, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  let ws;
  for (let i = 0; i < 100 && !ws; i++) {
    await sleep(150);
    try {
      const page = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find((t) => t.type === 'page');
      if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
    } catch {}
  }
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
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
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
  const run = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.result?.exceptionDetails) throw new Error(`${expression.slice(0, 80)}: ${res.result.exceptionDetails.exception?.description}`);
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
  // Edge hands off to another process at launch, so killing the one started
  // here leaves the real browser running: ask the browser itself to quit,
  // then wait until its debugging port has gone away
  const close = async () => {
    browsers.delete(close);
    await Promise.race([send('Browser.close'), sleep(3000)]);
    ws.close();
    for (let i = 0; i < 50; i++) {
      try {
        await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      } catch {
        break;
      }
      await sleep(100);
    }
    proc.kill();
  };
  browsers.add(close);
  return { send, run, until, setFile, close };
}

// helpers that run inside the page
const PAGE = `
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
const money = (v) => `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// a synthetic broker export: 4 trades, nets 99, 48, -41.5, 5.5 (total 111)
const csvPath = join(work, 'trades.csv');
writeFileSync(
  csvPath,
  [
    'symbol,side,opened_at,closed_at,quantity,entry_price,exit_price,fees,tags,notes',
    'AAPL,Buy,2026-03-02 09:30,2026-03-02 10:15,10,100,110,1,breakout,first',
    'MSFT,Sell,2026-03-03 10:00,2026-03-03 11:00,5,200,190,2,,second',
    'TSLA,Buy,2026-03-04 09:45,2026-03-04 12:00,4,250,240,1.5,fomo,third',
    'ES,Sell Short,2026-03-05 14:00,2026-03-05 15:00,1,5000,4990,4.5,,"short, written ""Sell Short"""',
  ].join('\n'),
);

// a broker's execution report: three fills that make one trade
const fillsPath = join(work, 'fills.csv');
writeFileSync(fillsPath, ['time,symbol,side,qty,price', '2026-03-06 09:30,NVDA,Buy,10,100', '2026-03-06 09:45,NVDA,Buy,10,102', '2026-03-06 10:00,NVDA,Sell,20,105'].join('\n'));
// columns no importer could know, set by hand in the preview
const oddPath = join(work, 'odd.csv');
writeFileSync(oddPath, ['Ticker Name,Lots Traded,Buy Or Sell Flag,Fill,When', 'AMD,10,B,150,2026-03-06 11:00', 'AMD,10,S,155,2026-03-06 11:30'].join('\n'));
const mapOdd = `$role('Ticker Name', 'symbol'); $role('Lots Traded', 'quantity'); $role('Buy Or Sell Flag', 'side'); $role('Fill', 'price'); $role('When', 'time'); true`;

async function journey() {
  await startServer();
  const page = await fetch(base);
  check('pages refuse to load inside another site\'s frame', page.headers.get('x-frame-options') === 'DENY' && /frame-ancestors 'none'/.test(page.headers.get('content-security-policy') ?? ''));
  check('the server does not advertise itself', !page.headers.has('x-powered-by'));
  const foreign = await fetch(`${base}/api/journal`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' }, body: '{}' });
  check('the journal API refuses a cross-site request', foreign.status === 403);
  let b = await openBrowser();
  // waits that end in a PASS or FAIL rather than stopping the run
  const seen = (expression, label, timeout) => b.until(expression, label, timeout).then(() => true, () => false);
  const journalOnDisk = () => JSON.parse(readFileSync(join(work, 'data', 'journal.json'), 'utf8'));
  const savedSoon = async (test) => {
    for (let i = 0; i < 50; i++) {
      try {
        if (test(journalOnDisk())) return true;
      } catch {}
      await sleep(100);
    }
    return false;
  };
  await b.send('Page.navigate', { url: base });
  await b.until(`document.readyState === 'complete' && document.body.innerText.includes('Set up your journal')`, 'welcome screen');
  await b.run(PAGE);

  // ---- 1. first run --------------------------------------------------------
  await b.run(`$type($field('Your name'), 'E2E'); $type($field('Starting balance'), '10000'); $t('Start journaling').click(); true`);
  await b.until(`!$text().includes('Set up your journal')`, 'welcome closed');
  check('starts empty, with no sample data', await b.run(`$text().includes('Your dashboard builds itself from your trades')`));

  // ---- 2. import -----------------------------------------------------------
  await b.run(`$nav('/trades'); true`);
  await b.until(`!!$tStarts('Import CSV')`, 'trades page');
  await b.run(`$tStarts('Import CSV').click(); true`);
  await b.until(`!!$modal()?.querySelector('input[type=file]')`, 'import dialog');
  await b.setFile('[data-modal-root] input[type=file]', csvPath);
  await b.until(`$modal().innerText.includes('ready to import')`, 'import preview');
  check('preview counts every row', await b.run(`/4\\s*ready to import/.test($modal().innerText)`));
  check('preview reports no row errors', await b.run(`!$modal().querySelector('p.text-loss')`));
  await b.run(`$tStarts('Import 4 trades').click(); true`);
  await b.until(`!$modal()`, 'import dialog closed');
  check('4 trades in the journal', await b.run(`$text().includes('4 trades in Main Portfolio')`));
  check('"Sell Short" imported as a short', await b.run(`[...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('ES') && r.innerText.includes('SHORT'))`));

  // ---- 2b. other layouts in the preview: fills, and columns set by hand -------
  await b.run(`$tStarts('Import CSV').click(); true`);
  await b.until(`!!$modal()?.querySelector('input[type=file]')`, 'import dialog');
  await b.setFile('[data-modal-root] input[type=file]', fillsPath);
  await b.until(`/1\\s*ready to import/.test($modal().innerText)`, 'fills preview');
  check('a file of single fills is put back together (3 fills, 1 trade)', await b.run(`$modal().innerText.includes('3 fills were put back together into 1 trade')`));
  await b.run(`$type($field('Each row is', $modal()), 'trades'); true`);
  check('read as whole trades instead, the same file gives 3 rows', await seen(`/3\\s*ready to import/.test($modal().innerText)`, 'whole-trade preview', 5000));
  await b.setFile('[data-modal-root] input[type=file]', oddPath);
  await b.until(`$modal().innerText.includes('No symbol column found')`, 'unknown columns');
  check('columns it cannot read open the Columns panel', await b.run(`!!$modal().querySelector('details[open]')?.innerText.includes('Columns:')`));
  await b.run(mapOdd);
  check('columns set by hand read the file (2 fills, 1 trade)', await seen(`/1\\s*ready to import/.test($modal().innerText)`, 'mapped preview', 5000));
  await b.run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true`);
  await b.until(`!$modal()`, 'import dialog closed');

  // ---- 3. metrics ----------------------------------------------------------
  const dashboard = async (expectNet, expectWinRate, label) => {
    await b.run(`$nav('/'); true`);
    await b.until(`!!$t('All')`, 'dashboard');
    await b.run(`$t('All').click(); true`);
    await b.until(`$text().includes('Net profit')`, 'metrics');
    const text = await b.run(`$text()`);
    check(`${label}: net profit ${money(expectNet)}`, text.includes(`${expectNet >= 0 ? '+' : '-'}${money(expectNet)}`), text.match(/Net profit[^\n]*\n[^\n]+/)?.[0]);
    check(`${label}: win rate ${expectWinRate.toFixed(1)}%`, text.includes(`${expectWinRate.toFixed(1)}%`));
    const sidebar = await b.run(`document.querySelector('aside').innerText`);
    check(`${label}: sidebar balance equals the equity curve's current balance`, sidebar.includes(money(10000 + expectNet)) && text.includes(money(10000 + expectNet)));
  };
  await dashboard(111, 75, 'after import');

  // ---- 4. edit -------------------------------------------------------------
  await b.run(`$nav('/trades'); true`);
  await b.until(`[...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('TSLA'))`, 'trades table');
  await b.run(`[...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes('TSLA')).click(); true`);
  await b.until(`!!$modal() && !!$field('Exit price', $modal())`, 'trade form');
  check('form inputs are labelled (label -> input)', await b.run(`$field('Exit price', $modal()).value === '240'`));
  await b.run(`$type($field('Exit price', $modal()), '260'); $t('Save changes').click(); true`);
  await b.until(`!$modal()`, 'form closed');
  await dashboard(191, 100, 'after editing TSLA to a winner');

  // ---- 5. delete -----------------------------------------------------------
  await b.run(`$nav('/trades'); true`);
  await b.until(`!!document.querySelector('button[aria-label="Delete MSFT trade"]')`, 'delete button');
  await b.run(`document.querySelector('button[aria-label="Delete MSFT trade"]').click(); true`);
  await b.until(`!!$modal() && !!$t('Delete trade', $modal())`, 'confirm');
  await b.run(`$t('Delete trade', $modal()).click(); true`);
  await b.until(`$text().includes('3 trades in Main Portfolio')`, 'deleted');
  await dashboard(143, 100, 'after deleting MSFT');

  // ---- 5b. a bulk action only ever touches trades that are still shown ------
  await b.run(`$nav('/trades'); true`);
  await b.until(`!!document.querySelector('main input[aria-label="Search trades"]')`, 'trades page');
  const tick = (symbol) => `[...document.querySelectorAll('input[aria-label="Select ${symbol} trade"]')].find((c) => c.offsetParent !== null).click(); true`;
  const selectedCount = `Number(document.body.innerText.match(/(\\d+)\\s*selected/)?.[1] ?? 0)`;
  await b.run(tick('TSLA'));
  await b.run(tick('AAPL'));
  await b.until(`${selectedCount} === 2`, '2 selected');
  await b.run(`$type(document.querySelector('main input[aria-label="Search trades"]'), 'AAPL'); true`);
  await b.until(`![...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('TSLA')) && [...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('AAPL'))`, 'search applied');
  check('filtering a selected trade out of view drops it from the selection', await b.run(`${selectedCount} === 1`), `selected: ${await b.run(selectedCount)}`);
  await b.run(`$type(document.querySelector('main input[aria-label="Search trades"]'), ''); true`);
  await b.until(`[...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('TSLA'))`, 'search cleared');
  check('clearing the search does not bring the hidden one back into the selection', await b.run(`${selectedCount} === 1`));
  await b.run(tick('AAPL'));
  await b.until(`${selectedCount} === 0`, 'selection cleared');

  // ---- 5c. the insights are rules over your own trades, and say so ----------
  await b.run(`$nav('/insights'); true`);
  await b.until(`document.querySelector('main h1')?.textContent === 'Insights & Signals'`, 'insights page');
  check('the Insights page and the menu make no claim to be AI', await b.run(`!/\\bAI\\b/.test(document.querySelector('main').innerText + document.querySelector('aside').innerText)`));

  // ---- 6. export and backup ------------------------------------------------
  await b.run(`$nav('/trades'); true`);
  await b.until(`!!$tStarts('Export CSV')`, 'export button');
  await b.run(`$tStarts('Export CSV').click(); true`);
  await b.run(`document.querySelector('button[aria-label="Profile menu"]').click(); true`);
  await b.until(`!!$t('Download backup')`, 'profile menu');
  await b.run(`$t('Download backup').click(); true`);
  let files = [];
  for (let i = 0; i < 50 && files.length < 2; i++) {
    await sleep(200);
    files = existsSync(downloads) ? readdirSync(downloads).filter((f) => !f.endsWith('.crdownload')) : [];
  }
  const csvOut = files.find((f) => f.endsWith('.csv'));
  const backup = files.find((f) => f.endsWith('.json'));
  check('CSV export downloaded', Boolean(csvOut));
  check('CSV export holds the 3 trades', csvOut && readFileSync(join(downloads, csvOut), 'utf8').trim().split('\n').length === 4);
  check('backup downloaded', Boolean(backup));
  check('backup holds the 3 trades', backup && JSON.parse(readFileSync(join(downloads, backup), 'utf8')).trades.length === 3);

  // ---- 7. change, then restore the backup ----------------------------------
  await b.run(`document.querySelector('button[aria-label="Delete AAPL trade"]').click(); true`);
  await b.until(`!!$modal() && !!$t('Delete trade', $modal())`, 'confirm');
  await b.run(`$t('Delete trade', $modal()).click(); true`);
  await b.until(`$text().includes('2 trades in Main Portfolio')`, 'second delete');
  await b.run(`[...document.querySelectorAll('aside a')].find((a) => a.getAttribute('href') === '/settings').click(); true`);
  await b.until(`!!document.querySelector('input[type=file][accept*=json]')`, 'settings');
  await b.setFile('input[type=file][accept*=json]', join(downloads, backup));
  await b.until(`!!$modal() && !!$t('Replace my journal', $modal())`, 'restore confirm');
  await b.run(`$t('Replace my journal', $modal()).click(); true`);
  await b.until(`$text().includes('Journal restored')`, 'restored');
  const copies = readdirSync(join(work, 'data', 'backups')).filter((f) => f.startsWith('before-restore-'));
  check('a safety copy was kept before the restore', copies.length === 1);
  check('the safety copy holds the journal that was replaced (2 trades)', copies.length === 1 && JSON.parse(readFileSync(join(work, 'data', 'backups', copies[0]), 'utf8')).trades.length === 2);
  await dashboard(143, 100, 'after restoring the backup');

  // ---- 8. accessibility spot checks ----------------------------------------
  const a11y = await b.run(`(() => {
    const named = (el) => el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) || el.closest('label') || el.getAttribute('title');
    $nav('/trades');
    return new Promise((r) => setTimeout(() => {
      const fields = [...document.querySelectorAll('input:not([type=hidden]):not(.sr-only), select, textarea')].filter((el) => !named(el));
      const buttons = [...document.querySelectorAll('button')].filter((el) => !el.innerText.trim() && !named(el));
      r({ fields: fields.map((f) => f.outerHTML.slice(0, 80)), buttons: buttons.map((f) => f.outerHTML.slice(0, 80)) });
    }, 800));
  })()`);
  check('every field on the Trades page has an accessible name', a11y.fields.length === 0, a11y.fields.join(' | '));
  check('every icon-only button on the Trades page has an accessible name', a11y.buttons.length === 0, a11y.buttons.join(' | '));
  await b.run(`window.$opener = $tStarts('Import CSV'); $opener.focus(); $opener.click(); true`);
  await b.until(`!!$modal()`, 'dialog');
  check('a dialog is named by its title', await b.run(`document.getElementById($modal().getAttribute('aria-labelledby'))?.textContent.trim() === 'Import trades from CSV'`));
  check('focus moves into a dialog when it opens', await b.run(`$modal().contains(document.activeElement)`));
  await b.run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true`);
  await b.until(`!$modal()`, 'dialog closed by Escape');
  check('focus goes back to the button that opened it', await b.run(`document.activeElement === $opener`));

  // ---- 8b. a save refused by a held file is tried again until it lands ------
  const windows = process.platform === 'win32';
  if (windows) {
    const note = 'written while the file was held';
    const onDisk = () => journalOnDisk().trades.some((t) => t.notes === note);
    const status = `document.querySelector('aside').innerText`;
    const { released } = await holdJournal(6000, 'Read'); // longer than the server's own retries
    await b.run(`$nav('/trades'); true`);
    await b.until(`[...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('AAPL'))`, 'trades table');
    await b.run(`[...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes('AAPL')).click(); true`);
    await b.until(`!!$modal() && !!$field('Notes', $modal())`, 'trade form');
    await b.run(`$type($field('Notes', $modal()), ${JSON.stringify(note)}); $t('Save changes').click(); true`);
    await b.until(`!$modal()`, 'form closed');
    check('a save refused by a held file says the change is kept in the browser', await seen(`${status}.includes('Saved in browser')`, 'failed save shown', 10000));
    check('meanwhile the file on disk is left as it was', !onDisk());
    await released;
    check('once the file is free the change is saved, with no further edit', await seen(`${status}.includes('Saved to disk')`, 'saving recovered', 20000));
    check('and it is in the file on disk', onDisk());
  }

  // ---- 8c. excluded trades and the balance (Settings → Accounts) ------------
  const eye = (symbol, state) =>
    `[...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes('${symbol}')).querySelector('button[title^="${state} in statistics"], button[title^="${state} from statistics"]').click(); true`;
  const balanceBox = `[...document.querySelectorAll('label')].find((l) => l.textContent.startsWith('Count excluded trades in the balance'))?.querySelector('input[type=checkbox]')`;
  const sidebarShows = (v) => `document.querySelector('aside').innerText.includes(${JSON.stringify(money(v))})`;
  await b.run(`$nav('/trades'); true`);
  await b.until(`[...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('AAPL'))`, 'trades table');
  await b.run(eye('AAPL', 'Included'));
  await dashboard(44, 100, 'AAPL (+$99) excluded; by default the balance leaves it out too');
  await b.run(`$nav('/settings'); true`);
  await b.until(`!!${balanceBox}`, 'balance setting');
  check('"Count excluded trades in the balance" starts off', await b.run(`${balanceBox}.checked === false`));
  await b.run(`${balanceBox}.click(); true`);
  check('turned on, the sidebar balance counts the excluded trade', await seen(sidebarShows(10143), 'balance with AAPL', 5000));
  check('the setting is saved in the journal file', await savedSoon((j) => j.settings.countExcludedInBalance === true));
  await b.run(`$nav('/'); true`);
  await b.until(`!!$t('All')`, 'dashboard');
  await b.run(`$t('All').click(); true`);
  await b.until(`$text().includes('Net profit')`, 'metrics');
  const withExcluded = await b.run(`$text()`);
  check('the statistics still leave it out (net profit +$44.00)', withExcluded.includes(`+${money(44)}`));
  check('the dashboard balance counts it, and says so', withExcluded.includes(money(10143)) && withExcluded.includes('incl. excluded trades'));
  await b.run(`$nav('/settings'); true`);
  await b.until(`!!${balanceBox}`, 'balance setting');
  await b.run(`${balanceBox}.click(); true`);
  check('turned off again, the balance leaves it out', await seen(sidebarShows(10044), 'balance without AAPL', 5000));
  await b.run(`$nav('/trades'); true`);
  await b.until(`[...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('AAPL'))`, 'trades table');
  await b.run(eye('AAPL', 'Excluded'));
  await dashboard(143, 100, 'AAPL included again');
  await b.close();

  // ---- 9. restart: the journal comes back from disk, not from the browser ---
  await stopServer();
  await startServer();
  b = await openBrowser(); // a brand new profile: no browser copy to fall back on
  // on Windows the file is also busy for a moment just as the app opens: the
  // app waits for it rather than starting empty
  const busy = windows ? await holdJournal(2000, 'None') : null;
  await b.send('Page.navigate', { url: base });
  await b.until(`document.readyState === 'complete' && !!document.querySelector('aside')`, 'app after restart');
  await b.run(PAGE);
  await dashboard(143, 100, `after a server restart, in a fresh browser${windows ? ', the file busy at first' : ''}`);
  await busy?.released;

  // ---- 10. columns set by hand are remembered for the next file like it -------
  await b.run(`$nav('/trades'); true`);
  await b.until(`!!$tStarts('Import CSV')`, 'trades page');
  const importOdd = async () => {
    await b.run(`$tStarts('Import CSV').click(); true`);
    await b.until(`!!$modal()?.querySelector('input[type=file]')`, 'import dialog');
    await b.setFile('[data-modal-root] input[type=file]', oddPath);
  };
  await importOdd();
  await b.until(`$modal().innerText.includes('No symbol column found')`, 'unknown columns');
  await b.run(mapOdd);
  await b.until(`/1\\s*ready to import/.test($modal().innerText)`, 'mapped preview');
  await b.run(`$tStarts('Import 1 trade', $modal()).click(); true`);
  await b.until(`!$modal()`, 'imported');
  await importOdd();
  check(
    'the next file with the same columns is read the same way, without asking',
    await seen(`/1\\s*ready to import/.test($modal().innerText) && $modal().innerText.includes('as you set them for this layout last time')`, 'remembered layout', 5000),
  );
  await b.run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true`);
  await b.close();
  await stopServer();
}

try {
  if (!browserPath) throw new Error('No Edge or Chrome found; set CHROME_PATH.');
  if (!existsSync(join(project, '.next', 'BUILD_ID'))) throw new Error('Build the desktop app first: npm run build');
  await journey();
} catch (err) {
  failures++;
  console.log(`FAIL  ${err.message}`);
} finally {
  for (const close of [...browsers]) await close();
  for (const holder of holders) holder.kill();
  if (server && server.exitCode === null && server.signalCode === null) await stopServer();
  // Windows can hold a file for a moment after its process exits
  try {
    rmSync(work, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  } catch {
    console.log(`note: could not remove ${work}`);
  }
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
