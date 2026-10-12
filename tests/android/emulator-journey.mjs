// The Android app on an emulator: restore and erase with their safety copies,
// the journal surviving a force-stop, a corrupted journal, a save the phone
// refuses, the back button and the share sheet. Works on a debug build and,
// on an emulator image that allows `adb root`, on a release build too.
//
//   npm run build:mobile && npx cap sync android, build and install the app,
//   start an emulator, then:  npm run e2e:android
//
// Emulator only: it replaces the app's journal with the generated sample in
// fixtures/ while it runs, and puts back whatever was there at the end.
// Needs the Android SDK (ANDROID_HOME, or the usual Windows location).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PKG = 'com.sniperjournal.app';
const APP = `/data/data/${PKG}`;
const sdk = process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
const adbPath = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const adb = (...args) => execFileSync(adbPath, args, { encoding: 'utf8', maxBuffer: 64 << 20 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = mkdtempSync(join(tmpdir(), 'sj-android-'));
const sample = join(import.meta.dirname, 'fixtures', 'sample-journal.json');
let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? `  (${detail})` : ''}`);
};

// ---- the device: an emulator with the app on it ------------------------------
if (!existsSync(adbPath)) throw new Error(`No adb at ${adbPath}. Set ANDROID_HOME to the Android SDK.`);
if (!/emulator-\d+\s+device/.test(adb('devices')))
  throw new Error('No emulator running (this test never runs on a real phone).');
if (!adb('shell', 'pm', 'list', 'packages', PKG).includes(PKG))
  throw new Error(`${PKG} is not installed on the emulator.`);

// A debug build lets `run-as` into the app's folder; a release build doesn't,
// so then the test works as root and hands every file it writes back to the app.
const debuggable = (() => {
  try {
    adb('shell', 'run-as', PKG, 'true');
    return true;
  } catch {
    return false;
  }
})();
let rooted = false;
if (!debuggable) {
  adb('root');
  await sleep(2500);
  adb('wait-for-device');
  rooted = adb('shell', 'whoami').trim() === 'root';
  if (!rooted)
    throw new Error(
      'A release build needs `adb root`, which this emulator image does not allow. Install a debug build instead.',
    );
}
const quote = (a) => `'${String(a).replace(/'/g, `'\\''`)}'`;
const inApp = (...args) =>
  debuggable ? adb('shell', 'run-as', PKG, ...args) : adb('shell', `cd ${APP} && ${args.map(quote).join(' ')}`);
const owner = debuggable ? null : adb('shell', `stat -c %U ${APP}`).trim();
const handBack = (path) => {
  if (!debuggable) adb('shell', `cd ${APP} && chown ${owner}:${owner} ${quote(path)} && restorecon ${quote(path)}`);
};
const backups = () => inApp('ls', 'files/backups').split(/\s+/).filter(Boolean);
const fileJson = (path) => JSON.parse(inApp('cat', path));
async function pushJournal(local) {
  adb('push', local, '/data/local/tmp/sj-journal.json');
  adb('shell', 'am', 'force-stop', PKG);
  inApp('cp', '/data/local/tmp/sj-journal.json', 'files/journal.json');
  handBack('files/journal.json');
  adb('shell', 'rm', '/data/local/tmp/sj-journal.json');
}

// ---- the page inside the app, over DevTools ------------------------------------
async function ev(expression) {
  const pid = adb('shell', 'pidof', PKG).trim();
  const sock = (adb('shell', 'cat', '/proc/net/unix').match(/webview_devtools_remote_\d+/g) ?? []).find((s) =>
    s.endsWith(`_${pid}`),
  );
  if (!sock) throw new Error('The app\'s WebView cannot be inspected (a release build on a "user" image?)');
  adb('forward', 'tcp:9333', `localabstract:${sock}`);
  const page = (await (await fetch('http://127.0.0.1:9333/json')).json()).find((p) => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  const res = await new Promise((resolve) => {
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id === 1) resolve(m);
    });
    ws.send(
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true },
      }),
    );
  });
  ws.close();
  if (res.result?.exceptionDetails)
    throw new Error(res.result.exceptionDetails.exception?.description ?? 'eval failed');
  return res.result?.result?.value;
}
async function until(expression, label, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await ev(expression)) return true;
    } catch {}
    await sleep(250);
  }
  throw new Error(`timed out waiting for: ${label}`);
}
const seen = (expression, label, timeout) =>
  until(expression, label, timeout).then(
    () => true,
    () => false,
  );
async function launch() {
  adb('shell', 'am', 'force-stop', PKG);
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await sleep(2500);
  await until(`document.readyState === 'complete' && !!document.querySelector('main')`, 'app started', 20000);
}
const resumed = () =>
  (adb('shell', 'dumpsys', 'activity', 'activities').match(/(?:mResumedActivity|topResumedActivity)[^\n]*/) ?? [''])[0];
const goSettings = `(async () => {
  const more = [...document.querySelectorAll('nav button')].find((b) => b.textContent.includes('More'));
  if (more) { more.click(); await new Promise((r) => setTimeout(r, 600)); }
  [...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/settings').click();
  return true;
})()`;
const goTrades = `(() => { [...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/trades').click(); return true; })()`;
const clickText = (text) =>
  `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().includes(${JSON.stringify(text)})); b.click(); return !!b; })()`;
const setCurrency = (v) => `(() => {
  const l = [...document.querySelectorAll('label')].find((x) => x.textContent.startsWith('Currency'));
  const el = document.getElementById(l.htmlFor);
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(v)});
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return el.value;
})()`;

// ---- what was on the emulator, to put back afterwards ---------------------------
const keptJournal = join(work, 'kept.json');
let hadJournal = false;
try {
  writeFileSync(keptJournal, inApp('cat', 'files/journal.json'));
  hadJournal = true;
} catch {}
const copiesBefore = new Set(backups());
const original = JSON.parse(readFileSync(sample, 'utf8'));

try {
  await pushJournal(sample);
  await launch();
  check('the generated 78-trade sample journal opens', (await fileJson('files/journal.json')).trades.length === 78);

  // ---- restore, with a safety copy of what it replaces ------------------------
  const small = { ...original, trades: original.trades.slice(0, 3), updatedAt: new Date().toISOString() };
  await ev(goSettings);
  await until(`!!document.querySelector('input[type=file][accept*=json]')`, 'settings');
  await ev(`(() => {
    const input = document.querySelector('input[type=file][accept*=json]');
    const dt = new DataTransfer();
    dt.items.add(new File([${JSON.stringify(JSON.stringify(small))}], 'backup.json', { type: 'application/json' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await until(
    `[...document.querySelectorAll('[data-modal-root] button')].some((b) => b.textContent.includes('Replace my journal'))`,
    'restore confirm',
  );
  await ev(clickText('Replace my journal'));
  await until(`document.body.innerText.includes('Journal restored')`, 'restored toast');
  await sleep(800);
  const restoreCopies = backups().filter((f) => f.startsWith('before-restore-') && !copiesBefore.has(f));
  check('restore keeps a before-restore copy in files/backups', restoreCopies.length === 1, backups().join(','));
  check(
    'the before-restore copy is the replaced 78-trade journal',
    restoreCopies.length === 1 && fileJson(`files/backups/${restoreCopies[0]}`).trades.length === 78,
  );
  check(
    'the journal on disk is now the restored 3-trade backup',
    (await fileJson('files/journal.json')).trades.length === 3,
  );

  // ---- persistence across a force-stop ----------------------------------------
  await launch();
  const persisted = await ev(
    `Capacitor.Plugins.Filesystem.readFile({ path: 'journal.json', directory: 'DATA', encoding: 'utf8' }).then((r) => JSON.parse(r.data).trades.length)`,
  );
  check('after a force-stop and relaunch the app still has the 3 trades', persisted === 3);
  await ev(goTrades);
  check(
    'the Trades screen shows the 3 trades',
    await seen(`/3 trades in/.test(document.body.innerText)`, 'trades page'),
  );

  // ---- erase, with a safety copy -------------------------------------------------
  await ev(goSettings);
  await until(
    `[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Erase all data'))`,
    'erase button',
  );
  await ev(clickText('Erase all data'));
  await until(
    `[...document.querySelectorAll('[data-modal-root] button')].some((b) => b.textContent.includes('Erase my journal'))`,
    'erase confirm',
  );
  await ev(clickText('Erase my journal'));
  await until(`document.body.innerText.includes('Journal erased')`, 'erased toast');
  await sleep(800);
  const eraseCopies = backups().filter((f) => f.startsWith('before-erase-') && !copiesBefore.has(f));
  check('erase keeps a before-erase copy', eraseCopies.length === 1, backups().join(','));
  check(
    'the before-erase copy holds the 3 trades',
    eraseCopies.length === 1 && fileJson(`files/backups/${eraseCopies[0]}`).trades.length === 3,
  );
  check('the journal on disk is now empty', (await fileJson('files/journal.json')).trades.length === 0);

  // ---- a corrupted journal on disk ----------------------------------------------
  const bad = structuredClone(original);
  bad.settings.currency = 'US';
  bad.trades[0].tags = 'oops';
  bad.trades[0].symbol = 42;
  bad.trades[2].id = bad.trades[1].id; // two trades sharing an id
  bad.trades.push(null, 'junk');
  bad.accounts.push({ ...bad.accounts[0], name: 'Duplicate id' });
  bad.resources = [{ id: 'bad', title: 'Evil link', url: 'javascript:alert(1)', category: 'Tools', createdAt: '' }];
  const corrupt = join(work, 'corrupt.json');
  writeFileSync(corrupt, JSON.stringify(bad));
  await pushJournal(corrupt);
  await launch();
  const state = await ev(`(async () => {
    [...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/trades').click();
    await new Promise((r) => setTimeout(r, 1500));
    return { text: document.body.innerText.match(/(\\d+) trades in/)?.[1], crashed: /Application error|Something went wrong/.test(document.body.innerText) };
  })()`);
  check('a corrupted journal still opens (no crash screen)', !state.crashed);
  check(
    'junk entries are dropped and the duplicate-id trade is kept (78 trades shown)',
    state.text === '78',
    JSON.stringify(state),
  );
  check(
    'opening it does not rewrite the file (the junk stays until the next change)',
    fileJson('files/journal.json').trades.includes(null),
  );
  // one real change, so the cleaned journal is saved: currency to EUR and back
  await ev(goSettings);
  await until(`[...document.querySelectorAll('label')].some((l) => l.textContent.startsWith('Currency'))`, 'settings');
  await ev(setCurrency('EUR'));
  await sleep(800);
  await ev(setCurrency('USD'));
  await sleep(2000);
  const saved = fileJson('files/journal.json');
  const ids = saved.trades.map((t) => t.id);
  check('trade ids are unique again', ids.length === new Set(ids).size);
  check('the duplicate account is dropped', saved.accounts.length === 1);
  check('the javascript: link is gone', !JSON.stringify(saved.resources).includes('javascript:'));
  check('the bad currency is repaired', saved.settings.currency !== 'US');

  // ---- a save the phone refuses is tried again until it lands ---------------------
  const status = `(document.querySelector('aside')?.textContent ?? '')`;
  inApp('chmod', '500', 'files'); // the app can no longer write its own folder
  try {
    await ev(setCurrency('EUR'));
    check(
      'a refused save shows "Saved temporarily"',
      await seen(`${status}.includes('Saved temporarily')`, 'failed save shown', 15000),
    );
    check('meanwhile the journal on disk is unchanged', fileJson('files/journal.json').settings.currency === 'USD');
  } finally {
    inApp('chmod', '771', 'files');
  }
  check(
    'once the folder can be written again it says "Saved on this device"',
    await seen(`${status}.includes('Saved on this device')`, 'saving recovered', 20000),
  );
  check(
    'and the change is in the file, with no further edit',
    fileJson('files/journal.json').settings.currency === 'EUR',
  );

  // ---- the App and Share plugins ------------------------------------------------
  adb('logcat', '-c');
  await launch();
  await ev(goTrades);
  await sleep(1500);
  const onTrades = await ev('location.pathname');
  adb('shell', 'input', 'keyevent', 'BACK');
  await sleep(1500);
  check(
    'the back button goes back inside the app (App plugin)',
    onTrades.startsWith('/trades') &&
      resumed().includes('sniperjournal') &&
      !(await ev('location.pathname')).startsWith('/trades'),
  );
  await ev(goTrades);
  await sleep(1500);
  await ev(
    `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Export'))?.click(); true`,
  );
  let sheet = '';
  for (let i = 0; i < 20 && !/chooser|Chooser|intentresolver|ResolverActivity/.test(sheet); i++) {
    await sleep(300);
    sheet = resumed();
  }
  check(
    'exporting opens the Android share sheet (Share plugin)',
    /chooser|Chooser|intentresolver|ResolverActivity/.test(sheet),
    sheet,
  );
  adb('shell', 'input', 'keyevent', 'BACK');
  await sleep(1000);
  const crashes = adb('logcat', '-d')
    .split('\n')
    .filter((l) => /FATAL EXCEPTION|ClassNotFoundException|NoSuchMethodException|NoClassDefFoundError/.test(l));
  check('no crash or missing-class error in the log', crashes.length === 0, crashes.slice(0, 3).join(' | '));
} catch (err) {
  failures++;
  console.log(`FAIL  ${err.message}`);
} finally {
  // put the emulator back as it was
  await pushJournal(hadJournal ? keptJournal : sample).catch(() => undefined);
  for (const f of backups())
    if (!copiesBefore.has(f) && /^before-(restore|erase)-/.test(f)) inApp('rm', `files/backups/${f}`);
  adb('shell', 'am', 'force-stop', PKG);
  if (rooted) adb('unroot');
  rmSync(work, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
