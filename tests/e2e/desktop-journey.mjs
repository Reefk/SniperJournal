// End-to-end journey through the real desktop build, in a headless browser:
// first run, CSV import, metrics, edit, delete, CSV export, backup, restore
// (with its safety copy), a save while another program holds the journal
// file (Windows), a server restart, the keyboard inside dialogs, and chart
// images going with a deleted account, a restore, an erase and a merge, and
// reclaimed in Settings once nothing uses them, and trades logged from a CSV
// file in the trade form, with the same file again adding nothing. Synthetic data
// only, in a throwaway folder; your own data/ folder is never touched.
//
//   npm run build && npm run e2e
//
// Needs Microsoft Edge or Google Chrome installed (or CHROME_PATH set).
// No extra packages: it speaks the DevTools protocol over Node's WebSocket.

import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PAGE, drive } from './cdp.mjs';
import { excelSerial, makeXlsx } from '../xlsx-writer.mjs';

const project = resolve(import.meta.dirname, '..', '..');
const port = 3200 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${port}`;
// The server runs in this folder, and next start can't find a project on
// another drive from there (it joins the two paths). GitHub's Windows runner
// has the checkout on D: and the system temp folder on C:, so on GitHub the
// folder goes in the runner's own temp folder, on the checkout's drive.
const work = mkdtempSync(join(process.env.RUNNER_TEMP ?? tmpdir(), 'sj-e2e-'));
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
// on GitHub, a failure is also an annotation, which shows on the run's page
// (and through its API) without opening the log
const annotate = (text) => {
  if (process.env.GITHUB_ACTIONS)
    console.log(
      `::error title=desktop E2E::${text.slice(0, 900).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`,
    );
};
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  const line = `${label}${!ok && detail ? `  (${detail})` : ''}`;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`);
  if (!ok) annotate(line);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the server, run with the throwaway folder as its working directory -----
let server;
async function startServer() {
  const next = join(project, 'node_modules', 'next', 'dist', 'bin', 'next');
  server = spawn(process.execPath, [next, 'start', project, '-H', '127.0.0.1', '-p', String(port)], {
    cwd: work,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  // the end of what it printed as errors, to say why it stopped if it does
  let said = '';
  server.stderr.on('data', (chunk) => (said = (said + chunk).slice(-1500)));
  // up to a minute: a warm PC takes a few seconds, a fresh CI runner (antivirus
  // reading node_modules for the first time) far longer
  for (let i = 0; i < 300; i++) {
    if (server.exitCode !== null) throw new Error(`the server stopped (exit ${server.exitCode}): ${said.trim()}`);
    try {
      if ((await fetch(`${base}/api/journal`)).ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`the server did not start within a minute${said ? `: ${said.trim()}` : ''}`);
}
const exited = (proc) =>
  proc.exitCode !== null || proc.signalCode !== null ? Promise.resolve() : new Promise((r) => proc.once('exit', r));
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
  const proc = spawn('powershell', [
    '-NoProfile',
    '-Command',
    `$f = [IO.File]::Open('${file}', 'Open', 'Read', '${share}'); 'held'; Start-Sleep -Milliseconds ${ms}; $f.Close()`,
  ]);
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
  const proc = spawn(
    browserPath,
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let ws;
  // up to a minute too: a browser's first start on a fresh runner is slow
  for (let i = 0; i < 400 && !ws; i++) {
    await sleep(150);
    try {
      const page = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find((t) => t.type === 'page');
      if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
    } catch {}
  }
  if (!ws) {
    proc.kill();
    throw new Error(`the browser did not start (${browserPath})`);
  }
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  const page = drive(ws);
  const { send } = page;
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
  // a second tab in the same browser: same profile, so the same browser copy of the journal
  const newTab = async () => {
    const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
    const tabWs = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => tabWs.addEventListener('open', r, { once: true }));
    return {
      ...drive(tabWs),
      close: async () => {
        tabWs.close();
        await fetch(`http://127.0.0.1:${debugPort}/json/close/${target.id}`);
      },
    };
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
  return { ...page, newTab, close };
}

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
writeFileSync(
  fillsPath,
  [
    'time,symbol,side,qty,price',
    '2026-03-06 09:30,NVDA,Buy,10,100',
    '2026-03-06 09:45,NVDA,Buy,10,102',
    '2026-03-06 10:00,NVDA,Sell,20,105',
  ].join('\n'),
);
// columns no importer could know, set by hand in the preview
const oddPath = join(work, 'odd.csv');
writeFileSync(
  oddPath,
  ['Instrument Ref,Clip,Way,Fill,When', 'AMD,10,B,150,2026-03-06 11:00', 'AMD,10,S,155,2026-03-06 11:30'].join('\n'),
);
// column names in no list, read by their words: 2 fills, 1 trade
const wordsPath = join(work, 'words.csv');
writeFileSync(
  wordsPath,
  [
    'Execution Timestamp,Ticker Name,Buy Or Sell Flag,Lots Traded,Exec Px',
    '2026-03-06 12:00,AMD,B,10,150',
    '2026-03-06 12:30,AMD,S,10,156',
  ].join('\n'),
);
// a platform's own export, read as it comes: NinjaTrader 8 executions, 4 fills, 2 trades
const ninjaPath = join(work, 'ninjatrader-executions.csv');
writeFileSync(
  ninjaPath,
  [
    'Instrument,Action,Quantity,Price,Time,ID,E/X,Position,Order ID,Name,Commission,Rate,Account,Connection',
    'MNQ 03-26,Buy,2,21000.25,3/9/2026 9:31:05 AM,e1,Entry,2 L,o1,Entry,$0.62,1,Sim101,Playback',
    'MNQ 03-26,Sell,2,21010.75,3/9/2026 9:45:10 AM,e2,Exit,-,o2,Exit,$0.62,1,Sim101,Playback',
    'MNQ 03-26,Sell,1,21020.00,3/9/2026 10:02:00 AM,e3,Entry,1 S,o3,Entry,$0.31,1,Sim101,Playback',
    'MNQ 03-26,Buy,1,21025.50,3/9/2026 10:10:30 AM,e4,Exit,-,o4,Exit,$0.31,1,Sim101,Playback',
  ].join('\n'),
);
// the same executions saved for Excel, with real date cells, behind a summary sheet
const workbookPath = join(work, 'ninjatrader-executions.xlsx');
const at = (h, m, s) => ({ serial: excelSerial(2026, 3, 9, h, m, s), format: 22 });
writeFileSync(
  workbookPath,
  makeXlsx([
    {
      name: 'Summary',
      rows: [
        ['Account', 'Balance'],
        ['Sim101', 10000],
      ],
    },
    {
      name: 'Executions',
      rows: [
        ['Instrument', 'Action', 'Quantity', 'Price', 'Time', 'ID', 'E/X', 'Commission', 'Account'],
        ['MNQ 03-26', 'Buy', 2, 21000.25, at(9, 31, 5), 'x1', 'Entry', 0.62, 'Sim101'],
        ['MNQ 03-26', 'Sell', 2, 21010.75, at(9, 45, 10), 'x2', 'Exit', 0.62, 'Sim101'],
        ['MNQ 03-26', 'Sell', 1, 21020, at(10, 2, 0), 'x3', 'Entry', 0.31, 'Sim101'],
        ['MNQ 03-26', 'Buy', 1, 21025.5, at(10, 10, 30), 'x4', 'Exit', 0.31, 'Sim101'],
      ],
    },
  ]),
);
// 11 MB: past the 10 MB one import takes
const bigPath = join(work, 'too-large.csv');
writeFileSync(bigPath, `symbol,qty\n${'AAPL,1\n'.repeat((11 * 1024 * 1024 - 11) / 7)}`);
const mapOdd = `$role('Instrument Ref', 'symbol'); $role('Clip', 'quantity'); $role('Way', 'side'); $role('Fill', 'price'); $role('When', 'time'); true`;

async function journey() {
  await startServer();
  const page = await fetch(base);
  check(
    "pages refuse to load inside another site's frame",
    page.headers.get('x-frame-options') === 'DENY' &&
      /frame-ancestors 'none'/.test(page.headers.get('content-security-policy') ?? ''),
  );
  check('the server does not advertise itself', !page.headers.has('x-powered-by'));
  const foreign = await fetch(`${base}/api/journal`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' },
    body: '{}',
  });
  check('the journal API refuses a cross-site request', foreign.status === 403);
  let b = await openBrowser();
  // waits that end in a PASS or FAIL rather than stopping the run
  const seen = (expression, label, timeout) =>
    b.until(expression, label, timeout).then(
      () => true,
      () => false,
    );
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
  await b.until(
    `document.readyState === 'complete' && document.body.innerText.includes('Set up your journal')`,
    'welcome screen',
  );
  await b.run(PAGE);

  // ---- 1. first run --------------------------------------------------------
  await b.run(
    `$type($field('Your name'), 'E2E'); $type($field('Starting balance'), '10000'); $t('Start journalling').click(); true`,
  );
  await b.until(`!$text().includes('Set up your journal')`, 'welcome closed');
  check(
    'starts empty, with no sample data',
    await b.run(`$text().includes('Your dashboard builds itself from your trades')`),
  );

  // ---- 2. import -----------------------------------------------------------
  await b.run(`$nav('/trades'); true`);
  await b.until(`!!$t('Import')`, 'trades page');
  await b.run(`$t('Import').click(); true`);
  await b.until(`!!$modal()?.querySelector('input[type=file]')`, 'import dialog');
  await b.setFile('[data-modal-root] input[type=file]', csvPath);
  await b.until(`$modal().innerText.includes('ready to import')`, 'import preview');
  check('preview counts every row', await b.run(`/4\\s*ready to import/.test($modal().innerText)`));
  check('preview reports no row errors', await b.run(`!$modal().querySelector('p.text-loss')`));
  await b.run(`$tStarts('Import 4 trades').click(); true`);
  await b.until(`!$modal()`, 'import dialog closed');
  check('4 trades in the journal', await b.run(`$text().includes('4 trades in Main Portfolio')`));
  check(
    '"Sell Short" imported as a short',
    await b.run(
      `[...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('ES') && r.innerText.includes('SHORT'))`,
    ),
  );

  // ---- 2b. other layouts in the preview: fills, and columns set by hand -------
  await b.run(`$t('Import').click(); true`);
  await b.until(`!!$modal()?.querySelector('input[type=file]')`, 'import dialog');
  await b.setFile('[data-modal-root] input[type=file]', fillsPath);
  await b.until(`/1\\s*ready to import/.test($modal().innerText)`, 'fills preview');
  check(
    'a file of single fills is put back together (3 fills, 1 trade)',
    await b.run(`$modal().innerText.includes('3 fills were put back together into 1 trade')`),
  );
  await b.run(`$type($field('Each row is', $modal()), 'trades'); true`);
  check(
    'read as whole trades instead, the same file gives 3 rows',
    await seen(`/3\\s*ready to import/.test($modal().innerText)`, 'whole-trade preview', 5000),
  );
  await b.setFile('[data-modal-root] input[type=file]', oddPath);
  await b.until(`$modal().innerText.includes('No symbol column found')`, 'unknown columns');
  check(
    'columns it cannot read open the Columns panel',
    await b.run(`!!$modal().querySelector('details[open]')?.innerText.includes('Columns:')`),
  );
  await b.run(mapOdd);
  check(
    'columns set by hand read the file (2 fills, 1 trade)',
    await seen(`/1\\s*ready to import/.test($modal().innerText)`, 'mapped preview', 5000),
  );
  await b.setFile('[data-modal-root] input[type=file]', wordsPath);
  check(
    'names in no list are read by their words, and the preview says so (2 fills, 1 trade)',
    await seen(
      `/1\\s*ready to import/.test($modal().innerText) && $modal().innerText.includes('Read from the words in their names: "Execution Timestamp" as Date and time') && $modal().innerText.includes('5 guessed from their names')`,
      'guessed preview',
      5000,
    ),
  );
  await b.setFile('[data-modal-root] input[type=file]', ninjaPath);
  check(
    "a platform's own export is read as it comes, and named (NinjaTrader 8 executions: 2 trades)",
    await seen(
      `/2\\s*ready to import/.test($modal().innerText) && $modal().innerText.includes('Recognised: NinjaTrader 8, executions')`,
      'recognised preview',
      5000,
    ),
  );
  await b.setFile('[data-modal-root] input[type=file]', workbookPath);
  check(
    'an Excel workbook is read from the sheet of trades (2 trades), and the sheet can be changed',
    await seen(
      `/2\\s*ready to import/.test($modal().innerText) && $modal().innerText.includes('Recognised: NinjaTrader 8, executions') && $field('Sheet', $modal())?.selectedOptions[0]?.textContent === 'Executions'`,
      'workbook preview',
      5000,
    ),
  );
  await b.run(`$type($field('Sheet', $modal()), '0'); true`);
  check(
    'the other sheet, a summary, has no trades to read',
    await seen(`$modal().innerText.includes('No symbol column found')`, 'summary sheet', 5000),
  );
  await b.setFile('[data-modal-root] input[type=file]', bigPath);
  check(
    'a file over 10 MB is refused before it is read, with what to do instead',
    await seen(
      `$modal().innerText.includes('This file is 11.0 MB, more than one import takes (10 MB).') && !$modal().innerText.includes('ready to import')`,
      'too large',
      5000,
    ),
  );
  await b.setFile('[data-modal-root] input[type=file]', ninjaPath);
  check(
    'the next file is read as usual',
    await seen(
      `/2\\s*ready to import/.test($modal().innerText) && !$modal().innerText.includes('more than one import takes')`,
      'after too large',
      5000,
    ),
  );
  check(
    'the import window lists which file to export from each platform',
    await b.run(
      `[...$modal().querySelectorAll('summary')].some((s) => s.textContent.includes('Which file to export from your platform'))`,
    ),
  );
  await b.run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true`);
  await b.until(`!$modal()`, 'import dialog closed');

  // ---- 3. metrics ----------------------------------------------------------
  const dashboard = async (expectNet, expectWinRate, label) => {
    await b.run(`$nav('/'); true`);
    await b.until(`!!$t('All')`, 'dashboard');
    // "All" is in the page before React has hooked it up (right after a
    // restart, say), so a click can be lost: click until the figures change
    const net = `${expectNet >= 0 ? '+' : '-'}${money(expectNet)}`;
    for (let i = 0; i < 10; i++) {
      await b.run(`$t('All').click(); true`);
      if (await seen(`$text().includes(${JSON.stringify(net)})`, 'net profit', 800)) break;
    }
    const text = await b.run(`$text()`);
    check(`${label}: net profit ${money(expectNet)}`, text.includes(net), text.match(/Net profit[^\n]*\n[^\n]+/)?.[0]);
    check(`${label}: win rate ${expectWinRate.toFixed(1)}%`, text.includes(`${expectWinRate.toFixed(1)}%`));
    const sidebar = await b.run(`document.querySelector('aside').innerText`);
    check(
      `${label}: sidebar balance equals the equity curve's current balance`,
      sidebar.includes(money(10000 + expectNet)) && text.includes(money(10000 + expectNet)),
    );
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
  // the header's search goes through every trade; a screen reader tells the two apart by name (SJ-40)
  check(
    'the header search and the Trades page search have different names',
    await b.run(
      `document.querySelectorAll('input[aria-label="Search trades"]').length === 1 && !!document.querySelector('header input[aria-label="Search all trades"]')`,
    ),
  );
  const tick = (symbol) =>
    `[...document.querySelectorAll('input[aria-label="Select ${symbol} trade"]')].find((c) => c.offsetParent !== null).click(); true`;
  const selectedCount = `Number(document.body.innerText.match(/(\\d+)\\s*selected/)?.[1] ?? 0)`;
  await b.run(tick('TSLA'));
  await b.run(tick('AAPL'));
  await b.until(`${selectedCount} === 2`, '2 selected');
  await b.run(`$type(document.querySelector('main input[aria-label="Search trades"]'), 'AAPL'); true`);
  await b.until(
    `![...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('TSLA')) && [...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('AAPL'))`,
    'search applied',
  );
  check(
    'filtering a selected trade out of view drops it from the selection',
    await b.run(`${selectedCount} === 1`),
    `selected: ${await b.run(selectedCount)}`,
  );
  await b.run(`$type(document.querySelector('main input[aria-label="Search trades"]'), ''); true`);
  await b.until(
    `[...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('TSLA'))`,
    'search cleared',
  );
  check(
    'clearing the search does not bring the hidden one back into the selection',
    await b.run(`${selectedCount} === 1`),
  );
  await b.run(tick('AAPL'));
  await b.until(`${selectedCount} === 0`, 'selection cleared');

  // ---- 5c. the insights are rules over your own trades, and say so ----------
  await b.run(`$nav('/insights'); true`);
  await b.until(`document.querySelector('main h1')?.textContent === 'Insights & Signals'`, 'insights page');
  check(
    'the Insights page and the menu make no claim to be AI',
    await b.run(
      `!/\\bAI\\b/.test(document.querySelector('main').innerText + document.querySelector('aside').innerText)`,
    ),
  );

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
  check(
    'CSV export holds the 3 trades',
    csvOut && readFileSync(join(downloads, csvOut), 'utf8').trim().split('\n').length === 4,
  );
  check('backup downloaded', Boolean(backup));
  check(
    'backup holds the 3 trades',
    backup && JSON.parse(readFileSync(join(downloads, backup), 'utf8')).trades.length === 3,
  );

  // ---- 7. change, then restore the backup ----------------------------------
  await b.run(`document.querySelector('button[aria-label="Delete AAPL trade"]').click(); true`);
  await b.until(`!!$modal() && !!$t('Delete trade', $modal())`, 'confirm');
  await b.run(`$t('Delete trade', $modal()).click(); true`);
  await b.until(`$text().includes('2 trades in Main Portfolio')`, 'second delete');
  await b.run(
    `[...document.querySelectorAll('aside a')].find((a) => a.getAttribute('href') === '/settings').click(); true`,
  );
  await b.until(`!!document.querySelector('input[type=file][accept*=json]')`, 'settings');
  await b.setFile('input[type=file][accept*=json]', join(downloads, backup));
  await b.until(`!!$modal() && !!$t('Replace my journal', $modal())`, 'restore confirm');
  await b.run(`$t('Replace my journal', $modal()).click(); true`);
  await b.until(`$text().includes('Journal restored')`, 'restored');
  const copies = readdirSync(join(work, 'data', 'backups')).filter((f) => f.startsWith('before-restore-'));
  check('a safety copy was kept before the restore', copies.length === 1);
  check(
    'the safety copy holds the journal that was replaced (2 trades)',
    copies.length === 1 &&
      JSON.parse(readFileSync(join(work, 'data', 'backups', copies[0]), 'utf8')).trades.length === 2,
  );
  await dashboard(143, 100, 'after restoring the backup');

  // ---- 8. accessibility spot checks ----------------------------------------
  // each chart says in words what it draws (the dashboard as section 7 left it,
  // on All: AAPL +99 on 2 Mar, TSLA +38.50 on 4 Mar, ES +5.50 on 5 Mar)
  const chartSummary = (title) =>
    b.run(
      `[...document.querySelectorAll('main section')].find((s) => s.querySelector('h3')?.textContent === ${JSON.stringify(title)})?.querySelector('p.sr-only')?.textContent ?? ''`,
    );
  const equityWords = await chartSummary('Equity curve');
  check(
    'the equity curve has a text alternative: its trades, days, start, end, lowest and highest',
    equityWords ===
      'Account balance after each of 3 closed trades, 02 Mar 2026 to 05 Mar 2026: from $10,000.00 to $10,143.00, lowest $10,000.00, highest $10,143.00.',
    equityWords,
  );
  const dailyWords = await chartSummary('Daily P&L');
  check(
    'the daily P&L has a text alternative: its days, worst, best and last',
    dailyWords ===
      'Net P&L of each of 3 trading days, 02 Mar 2026 to 05 Mar 2026: worst +$5.50, best +$99.00, last day +$5.50.',
    dailyWords,
  );
  const scoreWords = await chartSummary('Sniper Score');
  check('the Sniper Score has a text alternative', /^Sniper Score.+\.$/.test(scoreWords), scoreWords);
  check(
    "the sidebar's logo is left unnamed beside the name, so a screen reader says it once",
    await b.run(
      `document.querySelector('aside img')?.getAttribute('alt') === '' && document.querySelector('aside').innerText.includes('Sniper Journal')`,
    ),
  );
  // a laptop's width puts the eight smaller figures in one row, the narrowest they get
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1536, height: 864, deviceScaleFactor: 1, mobile: false });
  const strip = await b.run(`(() => {
    // a cell: its label, its figure, the line under it
    const label = [...document.querySelectorAll('main span')].find((s) => s.textContent === 'Avg win / loss');
    const cell = label?.parentElement?.parentElement;
    const cells = [...(cell?.parentElement?.children ?? [])];
    return {
      columns: cell?.parentElement ? getComputedStyle(cell.parentElement).gridTemplateColumns.split(' ').length : 0,
      lines: cells.map((c) => c.children[2]).filter(Boolean).length,
      cut: cells.map((c) => c.children[2]).filter((l) => l && l.scrollWidth > l.clientWidth + 1).map((l) => l.textContent),
      hold: cell?.children[2]?.textContent ?? '',
    };
  })()`);
  await b.send('Emulation.clearDeviceMetricsOverride');
  check(
    'at laptop width every line under the smaller figures is shown whole, "held … on average" included',
    strip.columns === 8 && strip.lines >= 7 && strip.cut.length === 0 && /^held .+ on average$/.test(strip.hold),
    JSON.stringify(strip),
  );
  // $10,000 to $10,143: compact labels read "$10K" at every tick
  const equityTicks = await b.run(
    `[...[...document.querySelectorAll('main section')].find((s) => s.querySelector('h3')?.textContent === 'Equity curve').querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')].map((t) => t.textContent)`,
  );
  check(
    "the equity curve's axis labels tell its ticks apart, $10,000 to $10,143",
    equityTicks.length >= 3 && new Set(equityTicks).size === equityTicks.length,
    equityTicks.join(' '),
  );
  // a narrow phone: the note under the Sniper Score wraps to the most lines
  await b.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  const scoreCard = await b.run(`new Promise((r) => setTimeout(() => {
    const card = [...document.querySelectorAll('main section')].find((s) => s.querySelector('h3')?.textContent === 'Sniper Score');
    const note = [...(card?.querySelectorAll('p') ?? [])].find((p) => p.textContent.startsWith('Not yet rated'));
    const bottom = (el) => Math.round(el.getBoundingClientRect().bottom);
    r(card && note ? { card: bottom(card), note: bottom(note), chart: Math.round(card.querySelector('.recharts-wrapper')?.getBoundingClientRect().height ?? 0) } : null);
  }, 500))`);
  await b.send('Emulation.clearDeviceMetricsOverride');
  check(
    'on a phone the note under the Sniper Score stays inside its card, beside the chart',
    scoreCard !== null && scoreCard.note <= scoreCard.card && scoreCard.chart >= 100,
    JSON.stringify(scoreCard),
  );
  const live = `document.querySelector('p.sr-only[aria-live=polite]')?.textContent`;
  check(
    'the save status is a polite live region for screen readers',
    (await seen(`document.querySelector('aside').innerText.includes('Saved to disk')`, 'restore saved', 8000)) &&
      (await b.run(live)) === 'Saved to disk',
  );
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
  check(
    'every icon-only button on the Trades page has an accessible name',
    a11y.buttons.length === 0,
    a11y.buttons.join(' | '),
  );
  await b.run(`window.$opener = $t('Import'); $opener.focus(); $opener.click(); true`);
  await b.until(`!!$modal()`, 'dialog');
  check(
    'a dialog is named by its title',
    await b.run(
      `document.getElementById($modal().getAttribute('aria-labelledby'))?.textContent.trim() === 'Import trades from a file'`,
    ),
  );
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
    await b.until(
      `[...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('AAPL'))`,
      'trades table',
    );
    await b.run(`[...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes('AAPL')).click(); true`);
    await b.until(`!!$modal() && !!$field('Notes', $modal())`, 'trade form');
    await b.run(`$type($field('Notes', $modal()), ${JSON.stringify(note)}); $t('Save changes').click(); true`);
    await b.until(`!$modal()`, 'form closed');
    check(
      'a save refused by a held file says the change is kept in the browser',
      await seen(`${status}.includes('Saved in browser')`, 'failed save shown', 10000),
    );
    check('meanwhile the file on disk is left as it was', !onDisk());
    check('a screen reader is told so too (the live region)', (await b.run(live)) === 'Saved in browser');
    await released;
    check(
      'once the file is free the change is saved, with no further edit',
      await seen(`${status}.includes('Saved to disk')`, 'saving recovered', 20000),
    );
    check('and it is in the file on disk', onDisk());
    check('and a screen reader is told it is saved again', (await b.run(live)) === 'Saved to disk');
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
  check(
    'turned on, the sidebar balance counts the excluded trade',
    await seen(sidebarShows(10143), 'balance with AAPL', 5000),
  );
  check('the setting is saved in the journal file', await savedSoon((j) => j.settings.countExcludedInBalance === true));
  await b.run(`$nav('/'); true`);
  await b.until(`!!$t('All')`, 'dashboard');
  await b.run(`$t('All').click(); true`);
  await b.until(`$text().includes('Net profit')`, 'metrics');
  const withExcluded = await b.run(`$text()`);
  check('the statistics still leave it out (net profit +$44.00)', withExcluded.includes(`+${money(44)}`));
  check(
    'the dashboard balance counts it, and says so',
    withExcluded.includes(money(10143)) && withExcluded.includes('incl. excluded trades'),
  );
  await b.run(`$nav('/settings'); true`);
  await b.until(`!!${balanceBox}`, 'balance setting');
  await b.run(`${balanceBox}.click(); true`);
  check('turned off again, the balance leaves it out', await seen(sidebarShows(10044), 'balance without AAPL', 5000));

  // ---- 8d. faded placeholders (Settings → Profile and display) --------------
  const hints = `$field('Example text in empty fields')`;
  const hintColour = `getComputedStyle($field('Your name'), '::placeholder').color`;
  const clearColour = await b.run(hintColour);
  check('example text in empty fields starts clear', await b.run(`${hints}.value === 'clear'`));
  await b.run(`$type(${hints}, 'faded'); true`);
  check(
    '"Faded" makes it paler',
    await seen(`${hintColour} !== ${JSON.stringify(clearColour)}`, 'faded placeholders', 5000),
  );
  check('and is saved in the journal file', await savedSoon((j) => j.settings.fadedPlaceholders === true));
  await b.run(`$type(${hints}, 'clear'); true`);
  check(
    '"Clear" brings it back',
    await seen(`${hintColour} === ${JSON.stringify(clearColour)}`, 'clear placeholders', 5000),
  );
  // ---- 8e. Settings → Tags: rename, move to the mistakes, a group in Reports ----
  const tagMenu = (tag, item) =>
    `document.querySelector(${JSON.stringify(`button[aria-label="Change “${tag}”"]`)}).click();
     setTimeout(() => $t(${JSON.stringify(item)}, document.querySelector('[data-popover]')).click(), 50); true`;
  const tradeOnDisk = (j, symbol) => j.trades.find((t) => t.symbol === symbol);
  await b.until(`!!document.querySelector('ul[aria-label="Your tags"]')`, 'tag list');
  check(
    'Settings → Tags lists the imported tags',
    await b.run(
      `['breakout', 'fomo'].every((t) => document.querySelector('ul[aria-label="Your tags"]').innerText.includes(t))`,
    ),
  );
  await b.run(tagMenu('breakout', 'Rename…'));
  await b.until(`!!$modal() && !!$field('New name', $modal())`, 'rename dialog');
  await b.run(`$type($field('New name', $modal()), 'Breakout setup'); $t('Rename', $modal()).click(); true`);
  check(
    'a renamed tag is renamed on its trade',
    await savedSoon((j) => tradeOnDisk(j, 'AAPL')?.tags.join() === 'Breakout setup'),
  );
  await b.until(`!$modal()`, 'rename dialog closed');
  await b.run(tagMenu('fomo', 'Move to mistakes…'));
  await b.until(`!!$modal() && !!$field('The mistake', $modal())`, 'move dialog');
  check(
    '"fomo" is offered as "Entered early (FOMO)"',
    await b.run(`$field('The mistake', $modal()).selectedOptions[0].textContent === 'Entered early (FOMO)'`),
  );
  await b.run(`$t('Move to mistakes', $modal()).click(); true`);
  check(
    'moved to the mistakes: the tag comes off the trade, the mistake goes on',
    await savedSoon(
      (j) =>
        tradeOnDisk(j, 'TSLA')?.tags.length === 0 && tradeOnDisk(j, 'TSLA')?.mistakes?.[0] === 'Entered early (FOMO)',
    ),
  );
  await b.until(`!$modal()`, 'move dialog closed');
  await b.run(`$t('New group').click(); true`);
  await b.until(`!!$modal() && !!$field('Name', $modal())`, 'group editor');
  await b.run(
    `$type($field('Name', $modal()), 'Setup type');
     [...$modal().querySelectorAll('label')].find((l) => l.innerText.includes('Breakout setup')).querySelector('input').click();
     true`,
  );
  await b.run(`$t('Save group', $modal()).click(); true`);
  check(
    'a group is saved in the journal file',
    await savedSoon(
      (j) => JSON.stringify(j.settings.tagGroups) === '[{"name":"Setup type","tags":["Breakout setup"]}]',
    ),
  );
  const groupTable = `[...document.querySelectorAll('section')].find((s) => s.querySelector('h3')?.textContent === 'Setup type')`;
  await b.run(`$nav('/reports'); true`);
  check(
    'Reports shows a table for the group; its one trade (AAPL) is still excluded, so it has none',
    await seen(`${groupTable}?.innerText.includes('No trade in this range has its tags')`, 'empty group table', 5000),
  );

  await b.run(`$nav('/trades'); true`);
  await b.until(`[...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('AAPL'))`, 'trades table');
  await b.run(eye('AAPL', 'Excluded'));
  await dashboard(143, 100, 'AAPL included again');
  await b.run(`$nav('/reports'); true`);
  check(
    'included again, AAPL is in the group table under its tag',
    await seen(`/Breakout setup\\s+1\\b/.test(${groupTable}?.innerText ?? '')`, 'group table row', 5000),
  );
  // section 9 opens a fresh browser with no copy of its own, so the last
  // changes must be in the file before this one closes (saves wait 350ms)
  check(
    'the last changes are in the file before the browser closes',
    await savedSoon(
      (j) =>
        j.settings.countExcludedInBalance !== true &&
        j.settings.fadedPlaceholders !== true &&
        j.trades.some((t) => t.symbol === 'AAPL' && !t.excluded),
    ),
  );
  await b.close();

  // ---- 9. restart: the journal comes back from disk, not from the browser ---
  await stopServer();
  await startServer();
  b = await openBrowser(); // a brand new profile: no browser copy to fall back on
  // on Windows the file is also busy for a moment just as the app opens: the
  // app waits for it rather than starting empty
  // (1.5s: the first read lands inside it, and the app's last retry, about 2s
  // after its first read, lands after it.)
  const busy = windows ? await holdJournal(1500, 'None') : null;
  await b.send('Page.navigate', { url: base });
  await b.until(`document.readyState === 'complete' && !!document.querySelector('aside')`, 'app after restart');
  await b.run(PAGE);
  await dashboard(143, 100, `after a server restart, in a fresh browser${windows ? ', the file busy at first' : ''}`);
  await busy?.released;

  // ---- 10. columns set by hand are remembered for the next file like it -------
  await b.run(`$nav('/trades'); true`);
  await b.until(`!!$t('Import')`, 'trades page');
  const importOdd = async () => {
    await b.run(`$t('Import').click(); true`);
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
  // the same file, so its one trade is now in the journal: read the same way,
  // it is recognised (before 2026-10-16 it would have been added again)
  check(
    'the next file with the same columns is read the same way, without asking',
    await seen(
      `/1\\s*looks like a trade already in your journal/.test($modal().innerText) && $modal().innerText.includes('as you set them for this layout last time')`,
      'remembered layout',
      5000,
    ),
  );
  await b.run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true`);
  await b.until(`!$modal()`, 'import dialog closed');

  // ---- 11. the keyboard stays in the dialog on top --------------------------
  const press = async (key, shift = false) => {
    const code = { Tab: 9, Escape: 27, Enter: 13 }[key];
    const event = { key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers: shift ? 8 : 0 };
    await b.send('Input.dispatchKeyEvent', {
      ...event,
      ...(key === 'Enter' ? { type: 'keyDown', text: '\r' } : { type: 'rawKeyDown' }),
    });
    await b.send('Input.dispatchKeyEvent', { ...event, type: 'keyUp' });
  };
  // how many of `times` presses of Tab left the dialog on top
  const tabsOutside = async (times, shift = false) => {
    let out = 0;
    for (let i = 0; i < times; i++) {
      await press('Tab', shift);
      if (!(await b.run(`$modal()?.contains(document.activeElement) === true`))) out++;
    }
    return out;
  };
  await b.run(`document.querySelector('tbody tr').click(); true`);
  await b.until(`!!$modal() && !!$t('Delete', $modal())`, 'trade form');
  check(
    'Tab and Shift+Tab go round the trade form, never to the page behind',
    (await tabsOutside(40)) + (await tabsOutside(40, true)) === 0,
  );
  await b.run(`$t('Delete', $modal()).focus(); true`);
  await press('Enter');
  await b.until(`document.querySelectorAll('[data-modal-root]').length === 2`, 'confirmation over the form');
  check('in a confirmation over the form, Tab stays in the confirmation', (await tabsOutside(10)) === 0);
  await press('Escape');
  await b.until(`document.querySelectorAll('[data-modal-root]').length === 1`, 'confirmation closed');
  check(
    'Escape closes only the confirmation, and focus goes back to Delete',
    await b.run(`document.activeElement === $t('Delete', $modal())`),
  );
  await press('Escape');
  await b.until(`!$modal()`, 'trade form closed');

  // ---- 12. deleting an account deletes its charts, and only its charts --------
  const png = join(work, 'chart.png');
  writeFileSync(
    png,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    ),
  );
  const images = () =>
    existsSync(join(work, 'data', 'screenshots')) ? readdirSync(join(work, 'data', 'screenshots')) : [];
  const logWithChart = async (symbol) => {
    await b.run(`$tStarts('Log trade').click(); true`);
    await b.until(`!!$modal() && !!$field('Symbol', $modal())`, 'trade form');
    await b.run(
      `$type($field('Symbol', $modal()), '${symbol}'); $type($field('Quantity', $modal()), '1'); $type($field('Entry price', $modal()), '10'); true`,
    );
    await b.setFile('[data-modal-root] input[type=file]', png);
    await b.until(`!!$modal().querySelector('img')`, 'chart saved');
    await b.run(`$t('Save trade', $modal()).click(); true`);
    await b.until(`!$modal()`, 'trade saved');
  };
  await logWithChart('KEEP');
  const kept = images();
  await b.run(`$nav('/settings'); true`);
  await b.until(`!!$field('Add an account')`, 'settings');
  await b.run(
    `$type($field('Add an account'), 'Second'); $tStarts('Add', $field('Add an account').closest('form')).click(); true`,
  );
  await b.until(`!!document.querySelector('button[aria-label="Delete Second"]')`, 'second account');
  await logWithChart('GONE');
  const both = images();
  await b.run(`document.querySelector('button[aria-label="Delete Second"]').click(); true`);
  await b.until(`!!$modal() && !!$t('Delete account', $modal())`, 'delete account confirmation');
  await b.run(`$t('Delete account', $modal()).click(); true`);
  await b.until(`!document.querySelector('button[aria-label="Delete Second"]')`, 'account deleted');
  let left = images();
  for (let i = 0; i < 30 && left.length !== 1; i++) {
    await sleep(100);
    left = images();
  }
  check(
    "deleting an account deletes its trades' chart images, and only those",
    kept.length === 1 && both.length === 2 && left.length === 1 && left[0] === kept[0],
    JSON.stringify({ kept, both, left }),
  );
  const imagesSoon = async (count) => {
    for (let i = 0; i < 30 && images().length !== count; i++) await sleep(100);
    return images();
  };
  // the backup from step 6 has no charts, so restoring it takes KEEP's chart away
  await b.setFile('input[type=file][accept*=json]', join(downloads, backup));
  await b.until(`!!$modal() && !!$t('Replace my journal', $modal())`, 'restore confirmation');
  await b.run(`$t('Replace my journal', $modal()).click(); true`);
  await b.until(`$text().includes('Journal restored')`, 'restored');
  check(
    "restoring a backup deletes the chart images its trades don't use",
    (await imagesSoon(0)).length === 0,
    JSON.stringify(images()),
  );
  await logWithChart('ERASEME');
  const beforeErase = images();
  await b.run(`$nav('/settings'); true`);
  await b.until(`!!$tStarts('Erase all data')`, 'settings');
  await b.run(`$tStarts('Erase all data').click(); true`);
  await b.until(`!!$modal() && !!$t('Erase my journal', $modal())`, 'erase confirmation');
  await b.run(`$t('Erase my journal', $modal()).click(); true`);
  await b.until(`$text().includes('Journal erased')`, 'erased');
  check(
    'Erase all data deletes every chart image',
    beforeErase.length === 1 && (await imagesSoon(0)).length === 0,
    JSON.stringify({ beforeErase, after: images() }),
  );

  // ---- 13. two tabs on the same journal: neither writes over the other -------
  const logTrade = async (tab, symbol) => {
    await tab.run(`$tStarts('Log trade').click(); true`);
    await tab.until(`!!$modal() && !!$field('Symbol', $modal())`, 'trade form');
    await tab.run(
      `$type($field('Symbol', $modal()), '${symbol}'); $type($field('Quantity', $modal()), '1'); $type($field('Entry price', $modal()), '10'); $t('Save trade', $modal()).click(); true`,
    );
    await tab.until(`!$modal()`, 'trade saved');
  };
  const symbolsOnDisk = () => journalOnDisk().trades.map((t) => t.symbol);
  const second = await b.newTab();
  await second.send('Page.navigate', { url: base });
  await second.until(`document.readyState === 'complete' && !!document.querySelector('aside')`, 'second tab');
  await second.run(PAGE);
  // the first tab saves after the second one opened the journal
  await logTrade(b, 'TABA');
  check('the first tab saves as usual', await savedSoon((j) => j.trades.some((t) => t.symbol === 'TABA')));
  // the second tab's save is now based on an older file
  await logTrade(second, 'TABB');
  const refused = await second
    .until(
      `/changed in another window/.test($modal()?.innerText ?? '') && /conflict-/.test($modal().innerText)`,
      'conflict dialog',
      10000,
    )
    .then(
      () => true,
      () => false,
    );
  check("the second tab's save is refused, and it says so", refused);
  check(
    "the first tab's trade is still in the file, the second's is not",
    symbolsOnDisk().includes('TABA') && !symbolsOnDisk().includes('TABB'),
    JSON.stringify(symbolsOnDisk()),
  );
  const conflictCopies = readdirSync(join(work, 'data', 'backups')).filter((f) => f.startsWith('conflict-'));
  const keptB =
    conflictCopies.length === 1 && JSON.parse(readFileSync(join(work, 'data', 'backups', conflictCopies[0]), 'utf8'));
  check(
    "the second tab's version is kept as a conflict copy, with its trade",
    Boolean(keptB) && keptB.trades.some((t) => t.symbol === 'TABB'),
    conflictCopies.join(','),
  );
  check(
    'the sidebar of the second tab says it is not saving',
    await second.run(`document.querySelector('aside').innerText.includes('Changed elsewhere')`),
  );
  // the old page looks ready until the reload has actually begun, so it is
  // marked first, and only a page without the mark counts as reloaded
  const reloaded = async (tab, how, label) => {
    await tab.run(`window.__beforeReload = true; true`);
    await tab.run(how);
    await tab.until(
      `!window.__beforeReload && document.readyState === 'complete' && !!document.querySelector('aside')`,
      label,
      15000,
    );
    await tab.run(PAGE);
  };
  // reload the second tab: it opens what the first saved, not its own copy from the browser
  await reloaded(
    second,
    `[...document.querySelectorAll('[data-modal-root] button')].find((x) => x.textContent.includes('Reload')).click(); true`,
    'second tab reloaded',
  );
  check('after Reload the conflict dialog is gone', await second.run(`!document.querySelector('[data-modal-root]')`));
  await second.run(`$nav('/trades'); true`);
  await second.until(
    `[...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('TABA'))`,
    'trades after reload',
  );
  check(
    'after Reload the second tab shows what the first saved, and not its own refused trade',
    await second.run(`![...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('TABB'))`),
  );
  // both carry on, one after the other, with nothing refused
  await logTrade(second, 'TABC');
  check('the reloaded second tab saves again', await savedSoon((j) => j.trades.some((t) => t.symbol === 'TABC')));
  await reloaded(b, `location.reload(); true`, 'first tab reloaded');
  await logTrade(b, 'TABD');
  check(
    'and so does the first, after a reload',
    await savedSoon((j) => ['TABA', 'TABC', 'TABD'].every((s) => j.trades.some((t) => t.symbol === s))),
    JSON.stringify(symbolsOnDisk()),
  );
  await second.close();

  // ---- 14. the trade form deletes a chart only once the trade is saved -------
  await logWithChart('CHART');
  const chartOf = () => journalOnDisk().trades.find((t) => t.symbol === 'CHART')?.screenshotFile;
  await savedSoon((j) => j.trades.some((t) => t.symbol === 'CHART' && t.screenshotFile));
  const original = chartOf();
  const openChart = async () => {
    await b.run(`$nav('/trades'); true`);
    await b.until(
      `[...document.querySelectorAll('tbody tr')].some((r) => r.innerText.includes('CHART'))`,
      'trades table',
    );
    await b.run(`[...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes('CHART')).click(); true`);
    await b.until(`!!$modal()?.querySelector('img')`, 'trade form with its chart');
  };
  const replaceChart = async () => {
    await b.setFile('[data-modal-root] input[type=file]', png);
    await b.until(`!$modal().querySelector('img').getAttribute('src').includes('${original}')`, 'replacement uploaded');
  };
  const closeWith = async (label) => {
    await b.run(`$t('${label}', $modal()).click(); true`);
    await b.until(`!$modal()`, 'form closed');
    await sleep(500);
  };
  await openChart();
  await b.run(`$modal().querySelector('button[aria-label="Remove chart"]').click(); true`);
  await b.until(`!$modal().querySelector('img')`, 'chart removed in the form');
  await closeWith('Cancel');
  check(
    'Remove chart, then Cancel: the image file is still there, and the trade still shows it',
    images().includes(original) && chartOf() === original,
    JSON.stringify({ original, files: images(), now: chartOf() }),
  );
  await openChart();
  await replaceChart();
  await closeWith('Cancel');
  check(
    'Replace, then Cancel: the original stays, and the unsaved upload is deleted',
    JSON.stringify(await imagesSoon(1)) === JSON.stringify([original]) && chartOf() === original,
    JSON.stringify({ original, files: images() }),
  );
  await openChart();
  await replaceChart();
  await closeWith('Save changes');
  await savedSoon((j) => j.trades.some((t) => t.symbol === 'CHART' && t.screenshotFile !== original));
  const replaced = chartOf();
  check(
    'Replace, then Save: the trade shows the new image, and the old file is deleted',
    Boolean(replaced) && replaced !== original && JSON.stringify(await imagesSoon(1)) === JSON.stringify([replaced]),
    JSON.stringify({ original, replaced, files: images() }),
  );

  // ---- 14b. merging keeps one chart; Settings reclaims images nothing uses ----
  // a part with a chart image and a chart link; returns the image's file name
  const logMergeLeg = async (link) => {
    const before = images();
    await b.run(`$tStarts('Log trade').click(); true`);
    await b.until(`!!$modal() && !!$field('Symbol', $modal())`, 'trade form');
    await b.run(
      `$type($field('Symbol', $modal()), 'MERGE'); $type($field('Quantity', $modal()), '1'); $type($field('Entry price', $modal()), '10'); [...$modal().querySelectorAll('button[aria-expanded]')].find((x) => x.textContent.includes('Futures, forex')).click(); true`,
    );
    await b.until(`!!$field('Chart link', $modal())`, 'chart link field');
    await b.run(`$type($field('Chart link', $modal()), '${link}'); true`);
    await b.setFile('[data-modal-root] input[type=file]', png);
    await b.until(`!!$modal().querySelector('img')`, 'chart saved');
    await b.run(`$t('Save trade', $modal()).click(); true`);
    await b.until(`!$modal()`, 'trade saved');
    return images().find((f) => !before.includes(f));
  };
  await b.run(`$nav('/trades'); true`);
  await b.until(`!!$tStarts('Log trade')`, 'trades page');
  const firstLeg = await logMergeLeg('https://charts.example/first');
  const secondLeg = await logMergeLeg('https://charts.example/second');
  const tickMerge = `[...document.querySelectorAll('input[aria-label="Select MERGE trade"]')].find((c) => c.offsetParent !== null && !c.checked).click(); true`;
  await b.run(tickMerge);
  await b.until(`${selectedCount} === 1`, '1 selected');
  await b.run(tickMerge);
  await b.until(`${selectedCount} === 2`, '2 selected');
  await b.run(`$tStarts('Merge into one').click(); true`);
  await b.until(`!!$modal() && !!$t('Merge into one trade', $modal())`, 'merge confirmation');
  check(
    "the merge confirmation says the other part's chart image is deleted and its chart link goes into the notes",
    await b.run(
      `$modal().innerText.includes('the other chart image is deleted') && $modal().innerText.includes('the other link is added to its notes')`,
    ),
    await b.run(`$modal().innerText`),
  );
  await b.run(`$t('Merge into one trade', $modal()).click(); true`);
  await b.until(`!$modal()`, 'merged');
  // the merged trade itself (both parts' quantity): one MERGE trade alone can
  // also be the file from before the merge, when the merge came within the
  // second part's autosave pause and only the first part had been saved
  const mergedOnDisk = await savedSoon((j) => {
    const merge = j.trades.filter((t) => t.symbol === 'MERGE');
    return merge.length === 1 && merge[0].quantity === 2;
  });
  const mergedTrade = journalOnDisk().trades.find((t) => t.symbol === 'MERGE');
  const mergedChart = mergedTrade?.screenshotFile;
  check(
    "merging keeps the first part's chart and deletes the other part's image",
    Boolean(firstLeg && secondLeg) &&
      mergedOnDisk &&
      mergedChart === firstLeg &&
      JSON.stringify((await imagesSoon(2)).sort()) === JSON.stringify([firstLeg, replaced].sort()),
    JSON.stringify({ firstLeg, secondLeg, mergedChart, files: images() }),
  );
  check(
    "it keeps the first part's chart link, and the other part's link is in its notes",
    mergedTrade?.screenshotUrl === 'https://charts.example/first' &&
      (mergedTrade?.notes ?? '').includes('https://charts.example/second'),
    JSON.stringify({ link: mergedTrade?.screenshotUrl, notes: mergedTrade?.notes }),
  );

  // left behind by older versions, a form never closed, or a failed delete
  const shots = join(work, 'data', 'screenshots');
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const plant = (name, modified = monthAgo) => {
    writeFileSync(join(shots, name), readFileSync(png));
    utimesSync(join(shots, name), modified, modified);
  };
  plant('orphan0001.png'); // nothing uses it
  plant('orphan0002.png'); // nothing uses it either
  plant('copykeep01.png'); // only a kept copy mentions it
  plant('fresh00001.png', new Date()); // nothing uses it, but it was just added
  writeFileSync(
    join(work, 'data', 'backups', 'conflict-20260101-000000.json'),
    JSON.stringify({ version: 1, trades: [{ id: 'x', screenshotFile: 'copykeep01.png' }], accounts: [] }),
  );
  for (const name of [replaced, firstLeg]) utimesSync(join(shots, name), monthAgo, monthAgo); // in use, and old
  const planted = images();
  const reclaim = async () => {
    await b.run(`$nav('/settings'); true`);
    await b.until(`!!$t('Reclaim unused chart images')`, 'settings');
    await b.run(`$t('Reclaim unused chart images').click(); true`);
  };
  await reclaim();
  await b.until(`!!$modal() && !!$t('Delete them', $modal())`, 'reclaim confirmation');
  const asking = await b.run(`$modal().innerText`);
  check(
    'Reclaim unused chart images says how many there are and the space they take before deleting anything',
    /Delete 2 unused chart images\?/.test(asking) &&
      asking.includes(`frees ${2 * statSync(png).size} bytes`) &&
      images().length === planted.length,
    asking,
  );
  await b.run(`$t('Cancel', $modal()).click(); true`);
  await b.until(`!$modal()`, 'reclaim cancelled');
  check('Cancel deletes nothing', JSON.stringify(images()) === JSON.stringify(planted));
  await reclaim();
  await b.until(`!!$modal() && !!$t('Delete them', $modal())`, 'reclaim confirmation');
  await b.run(`$t('Delete them', $modal()).click(); true`);
  const freed = await seen(
    `$text().includes('${2 * statSync(png).size} bytes freed: 2 unused chart images deleted')`,
    'reclaimed',
    10000,
  );
  check(
    'confirmed, it deletes the images nothing uses and reports the space freed; ones in use, in a kept copy, or new stay',
    freed &&
      JSON.stringify(images().sort()) ===
        JSON.stringify(['copykeep01.png', 'fresh00001.png', firstLeg, replaced].sort()),
    JSON.stringify(images()),
  );
  await reclaim();
  check(
    'asked again, it says there is nothing left to reclaim',
    (await seen(`$text().includes('There is nothing to reclaim')`, 'nothing to reclaim', 10000)) &&
      !(await b.run(`!!$modal()`)),
  );

  // removing the test data takes a chart attached to a test trade with it
  const balanceBefore = journalOnDisk().accounts[0].startingBalance;
  await b.run(`$tStarts('Load test data').click(); true`);
  await savedSoon((j) => j.trades.some((t) => t.isSample));
  const onDisk = journalOnDisk();
  const mine = new Set(onDisk.trades.filter((t) => !t.isSample).map((t) => t.symbol));
  const sampleSymbol = onDisk.trades.find((t) => t.isSample && !mine.has(t.symbol))?.symbol;
  const search = `document.querySelector('main input[aria-label="Search trades"]')`;
  const sampleRow = `[...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes(${JSON.stringify(sampleSymbol)}))`;
  await b.run(`$nav('/trades'); true`);
  await b.until(`!!${search}`, 'trades page');
  await b.run(`$type(${search}, ${JSON.stringify(sampleSymbol)}); true`);
  await b.until(`!!${sampleRow}`, 'a test trade');
  await b.run(`${sampleRow}.click(); true`);
  await b.until(`!!$modal()?.querySelector('input[type=file]')`, 'test trade form');
  const beforeSample = images();
  await b.setFile('[data-modal-root] input[type=file]', png);
  await b.until(`!!$modal().querySelector('img')`, 'chart on a test trade');
  await b.run(`$t('Save changes', $modal()).click(); true`);
  await b.until(`!$modal()`, 'test trade saved');
  const sampleChart = images().find((f) => !beforeSample.includes(f));
  await savedSoon((j) => j.trades.some((t) => t.isSample && t.screenshotFile === sampleChart));
  await b.run(`$type(${search}, ''); $nav('/settings'); true`);
  await b.until(`!!$tStarts('Remove test data', document.querySelector('main'))`, 'settings');
  await b.run(`$tStarts('Remove test data', document.querySelector('main')).click(); true`);
  await b.until(`!!$modal() && !!$t('Remove test data', $modal())`, 'remove test data confirmation');
  const removing = await b.run(`$modal().innerText`);
  await b.run(`$t('Remove test data', $modal()).click(); true`);
  let afterSample = images();
  for (let i = 0; i < 30 && afterSample.includes(sampleChart); i++) {
    await sleep(100);
    afterSample = images();
  }
  check(
    'Remove test data says it takes their charts, and deletes the chart attached to a test trade (and only that)',
    Boolean(sampleChart) &&
      removing.includes('any chart images you attached to them') &&
      JSON.stringify(afterSample) === JSON.stringify(beforeSample),
    JSON.stringify({ sampleSymbol, sampleChart, removing, afterSample }),
  );
  // loading test data gave the account a starting balance; section 15 needs the old one
  await b.run(`$type(document.querySelector('input[aria-label="Starting balance"]'), '${balanceBefore}'); true`);
  await savedSoon((j) => j.accounts[0].startingBalance === balanceBefore && !j.trades.some((t) => t.isSample));

  // ---- 15. a crash shows a calm screen that still hands over the journal ------
  // Nothing in the app can crash on purpose, so the test makes money formatting
  // throw for one amount, named in the address (?sj-crash=), before the app loads.
  const logClosed = async (symbol, exit) => {
    await b.run(`$tStarts('Log trade').click(); true`);
    await b.until(`!!$modal() && !!$field('Symbol', $modal())`, 'trade form');
    await b.run(
      `$type($field('Symbol', $modal()), '${symbol}'); $type($field('Quantity', $modal()), '1'); $type($field('Entry price', $modal()), '100'); $type($field('Exit price', $modal()), '${exit}'); $t('Save trade', $modal()).click(); true`,
    );
    await b.until(`!$modal()`, 'trade saved');
  };
  await logClosed('BOOM', '4342.42'); // its P&L is 4,242.42
  await logClosed('EXTRA', '200'); // with it, the balance is 4,342.42
  await savedSoon((j) => ['BOOM', 'EXTRA'].every((s) => j.trades.some((t) => t.symbol === s)));
  await b.send('Page.enable'); // without it the script below only applies from the second page load
  const { result: crashScript } = await b.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      const target = Number(new URLSearchParams(location.search).get('sj-crash'));
      if (!target) return;
      const Real = Intl.NumberFormat;
      function Crashing(...args) {
        const nf = new Real(...args);
        const format = nf.format.bind(nf);
        return new Proxy(nf, {
          get(t, p) {
            if (p === 'format') return (v) => { if (Math.abs(Math.abs(Number(v)) - target) < 0.005) throw new Error('test crash at ' + target); return format(v); };
            const x = Reflect.get(t, p);
            return typeof x === 'function' ? x.bind(t) : x;
          },
        });
      }
      Crashing.prototype = Real.prototype;
      Crashing.supportedLocalesOf = Real.supportedLocalesOf;
      Intl.NumberFormat = Crashing;
    })();`,
  });
  // a backup downloaded today has the same name as the one from step 6, and
  // the browser writes over it, so a new download is told by its time
  const newDownload = async (since) => {
    for (let i = 0; i < 50; i++) {
      const fresh = (existsSync(downloads) ? readdirSync(downloads) : []).filter(
        (f) => f.endsWith('.json') && statSync(join(downloads, f)).mtimeMs >= since,
      );
      if (fresh.length) {
        try {
          return JSON.parse(readFileSync(join(downloads, fresh[0]), 'utf8'));
        } catch {
          /* still being written */
        }
      }
      await sleep(200);
    }
    return null;
  };
  // a page that crashes: the page is replaced, the app around it carries on
  await b.send('Page.navigate', { url: `${base}/trades?sj-crash=4242.42` });
  const pageError = await seen(
    `document.readyState === 'complete' && document.body.innerText.includes("This page couldn't be shown")`,
    'page error screen',
    10000,
  );
  await b.run(PAGE);
  check(
    'a page that crashes shows a calm error screen, inside the app',
    pageError && (await b.run(`!!document.querySelector('aside')`)),
  );
  check(
    'it says where the journal is kept',
    await b.run(`document.querySelector('main').innerText.includes('journal.json')`),
  );
  let since = Date.now() - 1000;
  await b.run(`$tStarts('Download a backup', document.querySelector('main')).click(); true`);
  const fromPage = await newDownload(since);
  check(
    'its "Download a backup" hands over the whole journal',
    Boolean(fromPage?.trades?.some((t) => t.symbol === 'BOOM')),
  );
  await b.run(`$nav('/settings'); true`);
  check(
    'the rest of the app still works (Settings opens from the sidebar)',
    await seen(`!!$tStarts('Erase all data')`, 'settings', 8000),
  );
  // the app itself crashing (the sidebar shows the balance): the whole page is replaced
  await b.send('Page.navigate', { url: `${base}/?sj-crash=4342.42` });
  const appError = await seen(
    `document.readyState === 'complete' && document.body.innerText.includes('Sniper Journal ran into a problem')`,
    'global error screen',
    10000,
  );
  check(
    'a crash in the app itself shows its own calm screen',
    appError && (await b.run(`!document.querySelector('aside')`)),
  );
  check(
    'it still finds the journal on its own, and says where it is',
    await seen(
      `/The backup holds \\d+ trades/.test(document.body.innerText) && document.body.innerText.includes('journal.json')`,
      'rescued journal',
      8000,
    ),
  );
  since = Date.now() - 1000;
  await b.run(
    `[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Download a backup').click(); true`,
  );
  const fromApp = await newDownload(since);
  check(
    'its "Download a backup" hands over the whole journal too',
    Boolean(fromApp?.trades?.some((t) => t.symbol === 'BOOM')),
  );
  await b.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: crashScript.identifier });
  await b.send('Page.navigate', { url: base });
  check(
    'opened normally again, the app is back',
    await seen(
      `document.readyState === 'complete' && !!document.querySelector('aside') && !document.body.innerText.includes('ran into a problem')`,
      'app back',
      10000,
    ),
  );

  // ---- 16. a browser too full for its copy of the journal says so -----------
  // The browser's storage is filled for real, to the last character, so the
  // copy can't grow; every new trade then makes it bigger than there is room.
  await b.run(PAGE);
  const sidebar = `document.querySelector('aside').innerText`;
  const notice = `(document.querySelector('main [role=status]')?.innerText ?? '')`;
  const inCopy = (symbol) =>
    b.run(`(localStorage.getItem('sniper-journal:v1') ?? '').includes('"symbol":"${symbol}"')`);
  const filler = await b.run(`(() => {
    let lo = 0, hi = 12e6;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      try { localStorage.setItem('sj-filler', 'x'.repeat(mid)); lo = mid; } catch { hi = mid - 1; }
    }
    localStorage.setItem('sj-filler', 'x'.repeat(lo));
    return lo;
  })()`);
  check('the browser storage is full (test setup)', filler > 1e6, String(filler));
  await logClosed('FULL1', '110');
  check(
    'a copy the browser refuses brings a calm notice',
    await seen(`${notice}.includes("won't keep a spare copy")`, 'copy notice', 8000),
    await b.run(notice),
  );
  check(
    'it offers no backup download while the file is saved as usual',
    !(await b.run(`${notice}.includes('Download a backup')`)),
  );
  check('the change is in the file all the same', await savedSoon((j) => j.trades.some((t) => t.symbol === 'FULL1')));
  check(
    'and the sidebar says "Saved to disk", as it is',
    await seen(`${sidebar}.includes('Saved to disk')`, 'saved', 8000),
  );
  check(
    'the browser copy is the one from before, untouched',
    !(await inCopy('FULL1')) && Boolean(await b.run(`localStorage.getItem('sniper-journal:v1')`)),
  );
  await b.run(`$t('OK', document.querySelector('main [role=status]')).click(); true`);
  await logClosed('FULL2', '120');
  await savedSoon((j) => j.trades.some((t) => t.symbol === 'FULL2'));
  await sleep(500);
  check('once dismissed, it is not said again for the next change', (await b.run(notice)) === '');
  if (windows) {
    const { released } = await holdJournal(6000, 'Read');
    await logClosed('FULL3', '130');
    check(
      'when the file cannot be written either, the sidebar says "Not saved"',
      await seen(`${sidebar}.includes('Not saved')`, 'not saved', 10000),
      await b.run(sidebar),
    );
    check(
      'and the notice comes back, this time offering a backup',
      await seen(
        `${notice}.includes("aren't saved anywhere") && ${notice}.includes('Download a backup')`,
        'lost notice',
        5000,
      ),
      await b.run(notice),
    );
    check('meanwhile the file on disk is left as it was', !journalOnDisk().trades.some((t) => t.symbol === 'FULL3'));
    await released;
    check(
      'once the file is free the change is saved, and the sidebar says so',
      await seen(`${sidebar}.includes('Saved to disk')`, 'saved again', 20000),
    );
    check(
      'the warning goes once the change is in the file',
      (await b.run(notice)) === '' && journalOnDisk().trades.some((t) => t.symbol === 'FULL3'),
    );
  }
  await b.run(`localStorage.removeItem('sj-filler'); true`);
  await logClosed('FULL4', '140');
  check(
    'with room again, the browser keeps its copy',
    await seen(`(localStorage.getItem('sniper-journal:v1') ?? '').includes('"symbol":"FULL4"')`, 'copy kept', 5000),
  );

  // ---- 17. Log a trade from a CSV file, and the same file again adds nothing ----
  const dayPath = join(work, 'day.csv');
  writeFileSync(
    dayPath,
    [
      'symbol,side,opened_at,closed_at,quantity,entry_price,exit_price,fees',
      'CSVA,Buy,2026-03-09 09:30,2026-03-09 09:50,2,50,53,1',
      'CSVB,Sell,2026-03-09 10:15,2026-03-09 10:40,1,80,82,0.5',
    ].join('\n'),
  );
  const csvInput = '[data-modal-root] input[type=file][accept*=csv]';
  const pressed = (label) => `$t('${label}', $modal())?.getAttribute('aria-pressed') === 'true'`;
  const openLog = async () => {
    await b.run(`$tStarts('Log trade').click(); true`);
    await b.until(`!!$modal() && !!$t('By hand', $modal())`, 'log a trade');
  };
  await openLog();
  check('Log a trade opens by hand the first time', await b.run(pressed('By hand')));
  await b.run(`$t('From a file', $modal()).click(); true`);
  await b.until(`!!document.querySelector(${JSON.stringify(csvInput)})`, 'csv side');
  await b.setFile(csvInput, dayPath);
  await b.until(`/2\\s*ready to import/.test($modal().innerText)`, 'csv preview in the form');
  await b.run(`$t('Import 2 trades', $modal()).click(); true`);
  await b.until(`!$modal()`, 'imported from the form');
  check(
    'a file of two trades logged from the form: both in the journal, P&L as in the file',
    await savedSoon((j) => {
      const a = j.trades.find((t) => t.symbol === 'CSVA');
      const s = j.trades.find((t) => t.symbol === 'CSVB');
      return a?.side === 'LONG' && a.exitPrice === 53 && a.fees === 1 && s?.side === 'SHORT' && s.exitPrice === 82;
    }),
  );
  await openLog();
  check(
    'the next time it opens on the file, as last used',
    await b.run(`${pressed('From a file')} && !!document.querySelector(${JSON.stringify(csvInput)})`),
  );
  await b.setFile(csvInput, dayPath);
  await b.until(`$modal().innerText.includes('already in your journal')`, 'likely duplicates');
  check(
    'the same file again: both are likely duplicates, nothing to import',
    await b.run(
      `/0\\s*ready to import/.test($modal().innerText) && /2\\s*look like trades already in your journal/.test($modal().innerText) && $tStarts('Import trades', $modal()).disabled`,
    ),
  );
  await b.run(
    `[...$modal().querySelectorAll('label')].find((l) => l.textContent.includes('Import them anyway')).querySelector('input').click(); true`,
  );
  check(
    'asked for, they can still be imported',
    await seen(`$t('Import 2 trades', $modal())?.disabled === false`, 'import anyway', 5000),
  );
  await b.run(`$t('By hand', $modal()).click(); true`);
  check(
    'back to by hand: the form, with nothing imported',
    await seen(
      `!!$field('Symbol', $modal())?.offsetParent && !document.querySelector(${JSON.stringify(csvInput)})`,
      'form',
      5000,
    ),
  );
  await b.run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true`);
  await b.until(`!$modal()`, 'closed');
  await openLog();
  check('and it opens by hand again', await b.run(pressed('By hand')));
  check(
    'the journal still has each of the two once',
    journalOnDisk().trades.filter((t) => t.symbol === 'CSVA' || t.symbol === 'CSVB').length === 2,
  );
  await b.run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true`);
  await b.until(`!$modal()`, 'closed');

  // ---- 18. a position across two exports: the second finishes the trade ------
  const openPath = join(work, 'fills-monday.csv');
  const closePath = join(work, 'fills-tuesday.csv');
  writeFileSync(openPath, ['time,symbol,side,qty,price,fee', '2026-03-10 15:50,CRSX,Buy,3,40,0.3'].join('\n'));
  writeFileSync(closePath, ['time,symbol,side,qty,price,fee', '2026-03-11 09:40,CRSX,Sell,3,42,0.3'].join('\n'));
  const crsx = (j) => j.trades.filter((t) => t.symbol === 'CRSX');
  const openImport = async (path) => {
    await b.run(`$t('Import').click(); true`);
    await b.until(`!!$modal()?.querySelector('input[type=file]')`, 'import dialog');
    await b.setFile('[data-modal-root] input[type=file]', path);
  };
  await b.run(`$nav('/trades'); true`);
  await b.until(`!!$t('Import')`, 'trades page');
  await openImport(openPath);
  await b.until(`/1\\s*ready to import/.test($modal().innerText)`, 'open position preview');
  await b.run(`$t('Import 1 trade', $modal()).click(); true`);
  await b.until(`!$modal()`, 'imported');
  check(
    'an export that ends with a position open imports an open trade',
    await savedSoon((j) => crsx(j).length === 1 && crsx(j)[0].exitPrice == null),
  );
  const openId = crsx(journalOnDisk())[0].id;
  await openImport(closePath);
  await b.until(`$modal().innerText.includes('your journal has open')`, 'finishing preview');
  check(
    'the export that closes it says it finishes that trade, and adds nothing',
    await b.run(
      `/0\\s*ready to import/.test($modal().innerText) && /1\\s*open trade finished/.test($modal().innerText) && $modal().innerText.includes('This file closes a trade your journal has open') && !!$t('Finish 1 open trade', $modal())`,
    ),
  );
  const leaveOpen = `[...$modal().querySelectorAll('label')].find((l) => l.textContent.startsWith('Leave it open')).querySelector('input')`;
  await b.run(`${leaveOpen}.click(); true`);
  check(
    '"Leave it open" imports the closing fill as a trade of its own instead',
    await seen(
      `/1\\s*ready to import/.test($modal().innerText) && !!$t('Import 1 trade', $modal())`,
      'left open',
      5000,
    ),
  );
  await b.run(`${leaveOpen}.click(); true`);
  await b.until(`!!$t('Finish 1 open trade', $modal())`, 'finishing again');
  await b.run(`$t('Finish 1 open trade', $modal()).click(); true`);
  await b.until(`!$modal()`, 'finished');
  check(
    'the same trade is finished: one CRSX trade, closed at 42, with both fills’ fees',
    await savedSoon((j) => {
      const [t, ...more] = crsx(j);
      return (
        !more.length && t?.id === openId && t.exitPrice === 42 && t.closedAt === '2026-03-11T09:40' && t.fees === 0.6
      );
    }),
  );
  await openImport(closePath);
  await b.until(`$modal().innerText.includes('already in your journal')`, 'again');
  check(
    'importing that export again changes nothing',
    await b.run(
      `/0\\s*ready to import/.test($modal().innerText) && !$modal().innerText.includes('your journal has open') && $tStarts('Import trades', $modal()).disabled`,
    ),
  );
  await b.run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true`);
  await b.until(`!$modal()`, 'closed');

  // ---- 18b. a file with no fees: a fee per contract added in the preview ------
  const noFeesPath = join(work, 'no-fees.csv');
  writeFileSync(
    noFeesPath,
    [
      'symbol,side,opened_at,closed_at,quantity,entry_price,exit_price',
      'FEEX,Buy,2026-03-12 10:00,2026-03-12 10:30,4,20,21',
    ].join('\n'),
  );
  await openImport(noFeesPath);
  await b.until(`$modal().innerText.includes('There are no fees in this file')`, 'fee box');
  check(
    'a file with no fees offers a fee to add, and says it has none once',
    await b.run(
      `$modal().innerText.split('There are no fees in this file').length === 2 && $field('Fee to add', $modal())?.value === 'none' && $modal().innerText.includes('Fees on these trades $0.00')`,
    ),
  );
  await b.run(`$type($field('Fee to add', $modal()), 'contract'); true`);
  await b.until(`!!$field('Amount', $modal())`, 'amount field');
  await b.run(`$type($field('Amount', $modal()), '0.25'); true`);
  check(
    'a fee per contract, each side: 0.25 × 4 contracts in and out, taken off the P&L in the preview',
    await seen(
      `$modal().innerText.includes('Fees on these trades $2.00') && $modal().querySelector('tbody').innerText.includes('+$2.00')`,
      'fee in the preview',
      5000,
    ),
  );
  await b.run(`$t('Import 1 trade', $modal()).click(); true`);
  await b.until(`!$modal()`, 'imported');
  check(
    'the trade is saved with that fee',
    await savedSoon((j) => j.trades.some((t) => t.symbol === 'FEEX' && t.fees === 2)),
  );
  await openImport(noFeesPath);
  await b.until(`$modal().innerText.includes('already in your journal')`, 'again');
  check(
    'the next file into that account starts with the fee remembered',
    await b.run(`$field('Fee to add', $modal())?.value === 'contract' && $field('Amount', $modal())?.value === '0.25'`),
  );
  await b.run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); true`);
  await b.until(`!$modal()`, 'closed');

  // ---- 18c. a file with fees of its own: yours in their place, if you like ----
  const withFeesPath = join(work, 'with-fees.csv');
  writeFileSync(
    withFeesPath,
    [
      'symbol,side,opened_at,closed_at,quantity,entry_price,exit_price,fees',
      'FEEY,Buy,2026-03-13 10:00,2026-03-13 10:30,2,20,21,1.5',
    ].join('\n'),
  );
  await openImport(withFeesPath);
  await b.until(`$modal().innerText.includes('The fees come from this file')`, 'fee box for a file with fees');
  check(
    'a file with fees keeps them unless told otherwise, and the box says what they come to',
    await b.run(
      `$field('Fees', $modal())?.value === 'none' && !$field('Amount', $modal()) && $modal().innerText.includes('Fees on these trades $1.50') && !$field('Fee to add', $modal())`,
    ),
  );
  await b.run(`$type($field('Fees', $modal()), 'contract'); true`);
  await b.until(`!!$field('Amount', $modal())`, 'amount field');
  await b.run(`$type($field('Amount', $modal()), '0.25'); true`);
  check(
    "your own fee per contract replaces the file's in the preview: 0.25 × 2 contracts in and out",
    await seen(`$modal().innerText.includes('Fees on these trades $1.00')`, 'replaced fee', 5000),
  );
  await b.run(`$t('Import 1 trade', $modal()).click(); true`);
  await b.until(`!$modal()`, 'imported');
  check(
    'the trade is saved with your fee',
    await savedSoon((j) => j.trades.some((t) => t.symbol === 'FEEY' && t.fees === 1)),
  );

  // Trades → Add details: a fee per contract on the trades selected
  await b.run(`$nav('/trades'); true`);
  const feeyBox = `[...document.querySelectorAll('input[aria-label="Select FEEY trade"]')].find((c) => c.offsetParent !== null)`;
  await b.until(`!!${feeyBox}`, 'FEEY on the Trades page');
  await b.run(`${feeyBox}.click(); true`);
  await b.until(`!!$t('Add details')`, 'Add details button');
  await b.run(`$t('Add details').click(); true`);
  await b.until(`!!$field('Charged', $modal())`, 'Add details dialog');
  await b.run(`$type($field('Fees', $modal()), '0.4'); $type($field('Charged', $modal()), 'contract'); true`);
  await b.run(`$t('Apply to 1', $modal()).click(); true`);
  check(
    'Add details charges a fee per contract by size: 0.4 × 2 contracts in and out',
    await savedSoon((j) => j.trades.some((t) => t.symbol === 'FEEY' && t.fees === 1.6)),
  );
  await b.close();

  // ---- 19. a journal a newer version saved is neither opened nor written over ----
  await stopServer();
  const newerFile = join(work, 'data', 'journal.json');
  const newer = JSON.stringify({ ...journalOnDisk(), version: 2, goals: [{ id: 'g1', target: 5000 }] }, null, 2);
  writeFileSync(newerFile, newer);
  await startServer();
  b = await openBrowser(); // no browser copy to open instead
  await b.send('Page.navigate', { url: base });
  // as at every navigation: until the new page has loaded it may have no
  // <body> yet, and reading one would throw instead of waiting
  await b.until(
    `document.readyState === 'complete' && document.body.innerText.includes('This journal needs a newer Sniper Journal')`,
    'newer journal',
  );
  check(
    'a journal a newer version saved opens nothing, and says to update the app',
    await b.run(
      `!document.querySelector('aside') && document.body.innerText.includes('Update Sniper Journal, then open it again.')`,
    ),
  );
  // nothing on this screen can change the journal, so this catches a write
  // made as it opens; that edits never save is tests/journal-newer.test.ts
  await sleep(1000);
  check('nothing was written over it as the app opened', readFileSync(newerFile, 'utf8') === newer);

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
  annotate(err.message);
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
