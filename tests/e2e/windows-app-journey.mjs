// End-to-end journey through the built Windows app (src-tauri), in its own
// WebView2 window: first run, where the journal is kept, a CSV import, a chart
// image served by the app, a change saved although the window is closed
// straight after it, a second launch, a restart, the daily backup, a restore
// with its safety copy, a save while another program holds the journal, the
// earlier version's chart images brought over, and the app's own limits: no
// network, nothing outside its folder. Synthetic data only, in a throwaway
// folder (SNIPER_JOURNAL_DIR); your own Documents\Sniper Journal is never
// touched.
//
//   npm run build:desktop && npm run e2e:desktop
//
// Windows only. It drives the window over the DevTools protocol, which
// WebView2 opens when WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS asks it to.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PAGE, drive } from './cdp.mjs';

const project = resolve(import.meta.dirname, '..', '..');
const exe = join(project, 'src-tauri', 'target', 'release', 'Sniper Journal.exe');
// on GitHub, the runner's own temp folder, on the checkout's drive (as in desktop-journey.mjs)
const work = mkdtempSync(join(process.env.RUNNER_TEMP ?? tmpdir(), 'sj-app-e2e-'));
const folder = join(work, 'journal');

let failures = 0;
// on GitHub, a failure is also an annotation, readable without the job log
const annotate = (text) => {
  if (process.env.GITHUB_ACTIONS)
    console.log(
      `::error title=Windows app E2E::${text.slice(0, 900).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`,
    );
};
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  const line = `${label}${!ok && detail ? `  (${detail})` : ''}`;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`);
  if (!ok) annotate(line);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exited = (proc) =>
  proc.exitCode !== null || proc.signalCode !== null ? Promise.resolve() : new Promise((r) => proc.once('exit', r));
const running = () =>
  spawnSync('tasklist', ['/FI', 'IMAGENAME eq Sniper Journal.exe', '/NH'], { encoding: 'utf8' }).stdout.includes(
    'Sniper Journal.exe',
  );

// ---- the app, with the throwaway folder and its own WebView2 profile ---------
// The variable replaces the browser flags the app ships with (tauri.conf.json)
// rather than adding to them, so they are passed again with the DevTools port.
const shippedArgs =
  JSON.parse(readFileSync(join(project, 'src-tauri', 'tauri.conf.json'), 'utf8')).app.windows[0]
    .additionalBrowserArgs ?? '';
const env = (debugPort) => ({
  ...process.env,
  SNIPER_JOURNAL_DIR: folder,
  WEBVIEW2_USER_DATA_FOLDER: join(work, 'webview'),
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `${shippedArgs} --remote-debugging-port=${debugPort}`.trim(),
  // the same port, asked of the app itself: GitHub's Windows runner ignores
  // the WebView2 variable above (see src-tauri/src/lib.rs, setup)
  SNIPER_JOURNAL_DEVTOOLS_PORT: String(debugPort),
});
let app;
/** what the page logged: CSP refusals, errors */
const logged = [];
/** the WebView2 runtime Windows has, for when the window never opens */
function webview2() {
  const client = 'Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  for (const key of [
    `HKLM\\SOFTWARE\\WOW6432Node\\${client}`,
    `HKLM\\SOFTWARE\\${client}`,
    `HKCU\\Software\\${client}`,
  ]) {
    const version = spawnSync('reg', ['query', key, '/v', 'pv'], { encoding: 'utf8' }).stdout?.match(
      /pv\s+REG_SZ\s+(\S+)/,
    );
    if (version) return `WebView2 ${version[1]}`;
  }
  return 'no WebView2 runtime found';
}
/** what Windows says about the app's processes and its DevTools port, for when the window never opens */
function processes(debugPort) {
  // tasklist /v /fo csv: image, PID, session name, session #, memory, status, user, CPU time, window title
  const list = (image) =>
    spawnSync('tasklist', ['/v', '/fo', 'csv', '/nh', '/fi', `IMAGENAME eq ${image}`], { encoding: 'utf8' })
      .stdout.split(/\r?\n/)
      .filter((line) => line.startsWith('"'))
      .map((line) => line.slice(1, -1).split('","'));
  const apps = list('Sniper Journal.exe').map((c) => `session ${c[2]} #${c[3]}, window "${c[8]}"`);
  const views = list('msedgewebview2.exe').length;
  const listening = spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' }).stdout.includes(`:${debugPort} `);
  return `app: ${apps.join('; ') || 'not running'}; ${views} WebView2 processes; port ${debugPort} ${listening ? 'open' : 'not open'}`;
}
async function launch() {
  const debugPort = 9600 + Math.floor(Math.random() * 300);
  app = spawn(exe, [], { env: env(debugPort), stdio: 'ignore' });
  let ws;
  /** what the DevTools port last said, for when the window never opens */
  let answer = 'no answer';
  // up to a minute: the first launch on a fresh CI runner is slow
  for (let i = 0; i < 300 && !ws; i++) {
    await sleep(200);
    if (app.exitCode !== null) throw new Error(`the app quit as it started (exit ${app.exitCode}; ${webview2()})`);
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
      answer = JSON.stringify(targets.map((t) => `${t.type} ${t.url}`));
      const target = targets.find((t) => t.type === 'page' && t.url.startsWith('http://tauri.localhost'));
      if (target) ws = new WebSocket(target.webSocketDebuggerUrl);
    } catch {}
  }
  if (!ws)
    throw new Error(`the app did not open its window (DevTools: ${answer}; ${webview2()}; ${processes(debugPort)})`);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Log.entryAdded') logged.push(m.params.entry.text);
    if (m.method === 'Runtime.exceptionThrown')
      logged.push(m.params.exceptionDetails.exception?.description ?? 'error');
  });
  const page = drive(ws);
  await page.send('Log.enable');
  await page.send('Runtime.enable');
  // from the top, so that anything the page refuses while loading is logged
  await page.send('Page.reload');
  await page.until(
    `document.readyState === 'complete' && !!document.querySelector('aside, [data-modal-root]')`,
    'the app',
    20000,
  );
  await page.run(PAGE);
  return page;
}
/** the close button, as Windows sends it (WM_CLOSE) */
const pressClose = () =>
  spawnSync('powershell', ['-NoProfile', '-Command', `(Get-Process -Id ${app.pid}).CloseMainWindow() | Out-Null`]);
async function quit() {
  pressClose();
  return Promise.race([exited(app).then(() => true), sleep(10000).then(() => false)]);
}

// ---- another program holding the journal open, as antivirus or OneDrive does --
const holders = new Set();
async function holdJournal(ms) {
  const proc = spawn('powershell', [
    '-NoProfile',
    '-Command',
    `$f = [IO.File]::Open('${join(folder, 'journal.json')}', 'Open', 'Read', 'Read'); 'held'; Start-Sleep -Milliseconds ${ms}; $f.Close()`,
  ]);
  holders.add(proc);
  await new Promise((resolve, reject) => {
    proc.stdout.once('data', resolve);
    proc.once('exit', (code) => reject(new Error(`could not hold the journal open (exit ${code})`)));
  });
  return { released: exited(proc).then(() => holders.delete(proc)) };
}

// ---- synthetic files ---------------------------------------------------------
const csvPath = join(work, 'trades.csv');
writeFileSync(
  csvPath,
  [
    'symbol,side,opened_at,closed_at,quantity,entry_price,exit_price,fees,tags,notes',
    'AAPL,Buy,2026-03-02 09:30,2026-03-02 10:15,10,100,110,1,breakout,first',
    'MSFT,Sell,2026-03-03 10:00,2026-03-03 11:00,5,200,190,2,,second',
    'TSLA,Buy,2026-03-04 09:45,2026-03-04 12:00,4,250,240,1.5,fomo,third',
    'ES,Sell Short,2026-03-05 14:00,2026-03-05 15:00,1,5000,4990,4.5,,fourth',
  ].join('\n'),
);
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const png = join(work, 'chart.png');
writeFileSync(png, PNG);
const journalOf = (symbols) => ({
  version: 1,
  onboarded: true,
  updatedAt: '2026-03-01T00:00:00.000Z',
  accounts: [{ id: 'acc1', name: 'Main Portfolio', startingBalance: 1000, createdAt: '2026-03-01T00:00:00.000Z' }],
  trades: symbols.map((symbol, i) => ({
    id: `r${i}`,
    accountId: 'acc1',
    symbol,
    side: 'long',
    quantity: 1,
    entryPrice: 10,
    exitPrice: 11,
    openedAt: '2026-03-02T09:30:00.000Z',
    closedAt: '2026-03-02T10:00:00.000Z',
  })),
});
const backupPath = join(work, 'backup.json');
writeFileSync(backupPath, JSON.stringify(journalOf(['RST1', 'RST2'])));
// the earlier version's folder: a journal, two chart images and a file that is not one
const old = join(work, 'old');
mkdirSync(join(old, 'data', 'screenshots'), { recursive: true });
writeFileSync(join(old, 'data', 'journal.json'), JSON.stringify(journalOf(['OLD1'])));
writeFileSync(join(old, 'data', 'screenshots', 'oldchart01.png'), PNG);
writeFileSync(join(old, 'data', 'screenshots', 'oldchart02.jpg'), PNG);
writeFileSync(join(old, 'data', 'screenshots', 'notes.txt'), 'not a chart');

const onDisk = () => JSON.parse(readFileSync(join(folder, 'journal.json'), 'utf8'));
const savedSoon = async (test, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    try {
      if (test(onDisk())) return true;
    } catch {}
    await sleep(100);
  }
  return false;
};
const listed = (dir) => (existsSync(join(folder, dir)) ? readdirSync(join(folder, dir)) : []);
const today = new Date().toISOString().slice(0, 10);

async function journey() {
  let b = await launch();
  const seen = (expression, label, timeout) =>
    b.until(expression, label, timeout).then(
      () => true,
      () => false,
    );
  const sidebar = `document.querySelector('aside')?.innerText ?? ''`;
  const invoke = (cmd, args) =>
    b.run(
      `window.__TAURI_INTERNALS__.invoke('${cmd}', ${JSON.stringify(args)}).then((v) => ({ ok: v }), (e) => ({ error: String(e) }))`,
    );
  const logTrade = async (symbol, chart = false) => {
    await b.run(`$tStarts('Log trade').click(); true`);
    await b.until(`!!$modal() && !!$field('Symbol', $modal())`, 'trade form');
    await b.run(
      `$type($field('Symbol', $modal()), '${symbol}'); $type($field('Quantity', $modal()), '1'); $type($field('Entry price', $modal()), '10'); true`,
    );
    if (chart) {
      await b.setFile('[data-modal-root] input[type=file]', png);
      await b.until(`!!$modal().querySelector('img')`, 'chart saved');
    }
  };

  // ---- 1. first run --------------------------------------------------------
  check('the journal folder is made at the first start', existsSync(folder));
  await b.until(`$text().includes('Set up your journal')`, 'welcome screen');
  check('the welcome screen offers to bring over the earlier version', await b.run(`!!$t('Bring your journal over')`));
  check(
    "the window's own parts (date fields, menus) are in English: navigator.language is en-GB",
    (await b.run(`navigator.language`)) === 'en-GB',
    await b.run(`navigator.language`),
  );
  check(
    "it does not warn that uninstalling deletes the journal: it doesn't",
    !(await b.run(`$text().includes('Uninstalling it deletes')`)),
  );
  check(
    'the keyboard is ready in the first field, as on a PC',
    await b.run(`document.activeElement === $field('Your name')`),
  );
  await b.run(
    `$type($field('Your name'), 'E2E'); $type($field('Starting balance'), '10000'); $t('Start journalling').click(); true`,
  );
  await b.until(`!$text().includes('Set up your journal')`, 'welcome closed');
  check('the journal is written to its folder', await savedSoon((j) => j.onboarded === true));
  check(
    'readably, as the PC version wrote it',
    readFileSync(join(folder, 'journal.json'), 'utf8').startsWith('{\n  "version": 1'),
  );
  check(
    'the sidebar says it is saved on this device',
    await seen(`${sidebar}.includes('Saved on this device')`, 'saved'),
  );

  // ---- 2. the page itself: nothing refused, nothing reached --------------------
  check('nothing on the page was refused or failed while it loaded', logged.length === 0, logged.join(' | '));
  check(
    'the app cannot reach the internet: its pages may only talk to the app',
    (await b.run(`fetch('https://example.com').then(() => 'reached', () => 'blocked')`)) === 'blocked',
  );
  check(
    'every file the page loaded came from the app itself',
    await b.run(
      `performance.getEntriesByType('resource').every((r) => r.name.startsWith('http://tauri.localhost/') || r.name.startsWith('http://ipc.localhost/'))`,
    ),
  );
  logged.length = 0;

  // ---- 3. the Support page speaks of the Windows app -------------------------------
  await b.run(`$nav('/support'); true`);
  await b.until(`$text().includes('Common questions')`, 'support page');
  check(
    'it shows where the journal is',
    await b.run(`$text().includes(${JSON.stringify(join(folder, 'journal.json'))})`),
  );
  check('it lists the keyboard shortcuts', await b.run(`$text().includes('Shortcuts')`));
  check('it explains bringing the earlier version over', await b.run(`$text().includes('bring my journal over')`));
  check(
    'and leaves out the installer, the browser tab and the background server',
    await b.run(
      `!$text().includes('Why did Windows warn me') && !$text().includes('instead of a browser tab') && !$text().includes('Opening the app')`,
    ),
  );

  // ---- 4. import ------------------------------------------------------------------
  await b.run(`$nav('/trades'); true`);
  await b.until(`!!$t('Import')`, 'trades page');
  await b.run(`$t('Import').click(); true`);
  await b.until(`!!$modal()?.querySelector('input[type=file]')`, 'import dialog');
  await b.setFile('[data-modal-root] input[type=file]', csvPath);
  await b.until(`$modal().innerText.includes('ready to import')`, 'import preview');
  await b.run(`$tStarts('Import 4 trades').click(); true`);
  await b.until(`!$modal()`, 'import dialog closed');
  check('4 imported trades are written to the file', await savedSoon((j) => j.trades.length === 4));

  // ---- 5. a chart image, kept in the folder and shown by the app --------------
  await logTrade('CHART', true);
  const shot = listed('screenshots');
  check('the chart image is saved in the screenshots folder', shot.length === 1, shot.join());
  check(
    'and shown from the app itself',
    await seen(
      `(() => { const i = $modal().querySelector('img'); return i.src.startsWith('http://chart.localhost/') && i.complete && i.naturalWidth === 1; })()`,
      'chart shown',
    ),
    await b.run(`$modal().querySelector('img')?.src`),
  );
  await b.run(`$t('Save trade', $modal()).click(); true`);
  await b.until(`!$modal()`, 'trade saved');
  check(
    'the trade refers to it',
    await savedSoon((j) => j.trades.some((t) => t.symbol === 'CHART' && t.screenshotFile === shot[0])),
  );
  check(
    "today's backup holds the journal as it was before the day's first change",
    listed('backups').includes(`journal-${today}.json`),
  );

  // ---- 6. a change saved although the window is closed straight away ---------
  await logTrade('LAST');
  await b.run(`$t('Save trade', $modal()).click(); true`);
  const closed = await quit();
  check('closing the window ends the app', closed);
  check(
    'the change made just before closing is in the file',
    onDisk().trades.some((t) => t.symbol === 'LAST'),
    onDisk()
      .trades.map((t) => t.symbol)
      .join(),
  );

  // ---- 7. a restart, and a second launch -------------------------------------------
  b = await launch();
  await b.run(`$nav('/trades'); true`);
  await b.until(`$text().includes('LAST')`, 'trades after restart');
  check('after a restart the journal is all there', await b.run(`$text().includes('6 trades in Main Portfolio')`));
  check('and the welcome screen does not come back', !(await b.run(`$text().includes('Set up your journal')`)));
  const second = spawn(exe, [], { env: env(9999), stdio: 'ignore' });
  const handedOver = await Promise.race([exited(second).then(() => true), sleep(8000).then(() => false)]);
  check('starting it again while it is open brings the open window forward, not a second one', handedOver);
  if (!handedOver) second.kill();

  // ---- 8. restore a backup ----------------------------------------------------------
  await b.run(`$nav('/settings'); true`);
  await b.until(`!!document.querySelector('input[type=file][accept*=json]')`, 'settings');
  check(
    'Settings says where backups go on this PC',
    await b.run(`$text().includes('Sniper Journal folder in your Documents')`),
  );
  check(
    'and offers to bring over the earlier version',
    await b.run(`!!$tStarts('Bring over from the earlier version')`),
  );
  await b.setFile('input[type=file][accept*=json]', backupPath);
  await b.until(`!!$modal() && !!$t('Replace my journal', $modal())`, 'restore confirm');
  await b.run(`$t('Replace my journal', $modal()).click(); true`);
  await b.until(`$text().includes('Journal restored')`, 'restored');
  check(
    'the restored journal is written',
    await savedSoon((j) => j.trades.map((t) => t.symbol).join() === 'RST1,RST2'),
  );
  const copies = listed('backups').filter((f) => f.startsWith('before-restore-'));
  check(
    'a safety copy of the replaced journal (6 trades) was kept',
    copies.length === 1 && JSON.parse(readFileSync(join(folder, 'backups', copies[0]), 'utf8')).trades.length === 6,
  );
  check(
    "the replaced journal's chart image went with it",
    listed('screenshots').length === 0,
    listed('screenshots').join(),
  );

  // ---- 9. a save while another program holds the file ------------------------------
  const { released } = await holdJournal(4000);
  await b.run(`$nav('/trades'); true`);
  await b.until(`!!$tStarts('Log trade')`, 'trades page');
  await logTrade('HELD');
  await b.run(`$t('Save trade', $modal()).click(); true`);
  await b.until(`!$modal()`, 'trade saved');
  await sleep(1000);
  check('while the file is held, it is left as it was', !onDisk().trades.some((t) => t.symbol === 'HELD'));
  await released;
  check(
    'once it is free the change is saved, and the sidebar says so',
    (await savedSoon((j) => j.trades.some((t) => t.symbol === 'HELD'), 150)) &&
      (await seen(`${sidebar}.includes('Saved on this device')`, 'saved again', 5000)),
    await b.run(sidebar),
  );

  // ---- 10. the earlier version's chart images ---------------------------------------
  const copied = await invoke('import_old_images', { from: old });
  check('the chart images of the earlier version are copied over', copied.ok === 2, JSON.stringify(copied));
  check(
    'only files named the way the app names images',
    ['oldchart01.png', 'oldchart02.jpg'].every((f) => listed('screenshots').includes(f)) &&
      !listed('screenshots').includes('notes.txt'),
    listed('screenshots').join(),
  );
  check(
    'a folder without a journal is refused',
    'error' in (await invoke('import_old_images', { from: join(work, 'journal', 'backups') })),
  );

  // ---- 11. the app's limits ---------------------------------------------------------
  for (const [cmd, args] of [
    ['read_text', { path: '../trades.csv' }],
    ['read_text', { path: csvPath }],
    ['write_text', { path: 'backups/../../outside.json', text: '{}' }],
    ['remove', { path: 'screenshots/../journal.json' }],
    ['list', { dir: '..' }],
  ]) {
    check(
      `its pages cannot reach outside the folder: ${cmd} ${Object.values(args)[0]}`,
      'error' in (await invoke(cmd, args)),
    );
  }
  check(
    'nothing was written outside it',
    !existsSync(join(work, 'outside.json')) && existsSync(join(folder, 'journal.json')),
  );

  // ---- 12. reports ------------------------------------------------------------------
  await b.run(`$nav('/reports'); true`);
  // the Trades page has an Export CSV button too, so wait for the page itself
  await b.until(`location.pathname.startsWith('/reports') && !!$tStarts('Export CSV')`, 'reports page');
  check('Reports offers Print, as on any PC', await b.run(`!!$tStarts('Print')`));

  check('nothing on any page was refused or failed', logged.length === 0, logged.join(' | '));
  check('the window closes when asked', await quit());
}

try {
  if (process.platform !== 'win32') throw new Error('The Windows app runs on Windows only.');
  if (!existsSync(exe)) throw new Error('Build the Windows app first: npm run build:desktop');
  if (running()) throw new Error('Sniper Journal is open. Close it first: the test starts its own copy.');
  await journey();
} catch (err) {
  failures++;
  console.log(`FAIL  ${err.message}`);
  annotate(err.message);
} finally {
  for (const holder of holders) holder.kill();
  if (app && app.exitCode === null && app.signalCode === null) app.kill();
  if (app) await Promise.race([exited(app), sleep(5000)]);
  // Windows can hold a file for a moment after its process exits
  try {
    rmSync(work, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  } catch {
    console.log(`note: could not remove ${work}`);
  }
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
