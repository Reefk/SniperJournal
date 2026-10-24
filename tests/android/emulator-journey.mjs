// The Android app on an emulator: restore and erase with their safety copies,
// the journal surviving a force-stop, a corrupted journal, a save the phone
// refuses, reclaiming chart images nothing uses, the back button and the
// share sheet. Works on a debug build and,
// on an emulator image that allows `adb root`, on a release build too.
//
//   npm run build:mobile && npx cap sync android, build and install the app,
//   start an emulator, then:  npm run e2e:android
//
// Emulator only: it replaces the app's journal with the generated sample in
// fixtures/ while it runs, and puts back whatever was there at the end: the
// journal (or none), the backups, and the copy of the journal the app keeps in
// its WebView. It works on an app just installed, with no journal or folders
// yet, as on a CI emulator (.github/workflows/android.yml).
// Needs the Android SDK (ANDROID_HOME, or the usual Windows location).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PKG = 'com.sniperjournal.app';
const APP = `/data/data/${PKG}`;
const sdk = process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
const adbPath = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
// what adb says on stderr goes into the error, not the console: a fresh install
// has no files to list, and that is not worth a line
const adb = (...args) =>
  execFileSync(adbPath, args, { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
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
const isThere = (path) => {
  try {
    inApp('ls', '-d', path);
    return true;
  } catch {
    return false;
  }
};
/** the kept copies; none while the folder isn't there (an app just installed) */
const backups = () => (isThere('files/backups') ? inApp('ls', 'files/backups').split(/\s+/).filter(Boolean) : []);
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

// ---- what the app showed when a check failed ----------------------------------
// printed before the emulator is put back; on GitHub (SNIPER_E2E_ARTIFACTS) the
// screen is saved too, and the workflow keeps it with the run
const artifacts = process.env.SNIPER_E2E_ARTIFACTS;
/** `promise`, or an error once `ms` have passed: a WebView that hangs never answers */
const within = (promise, ms = 5000) =>
  Promise.race([
    promise,
    sleep(ms).then(() => {
      throw new Error(`no answer in ${ms / 1000} s`);
    }),
  ]);
async function diagnose() {
  console.log('\n---- the app when the test failed ----');
  try {
    const page = await within(
      ev(`({ url: location.href, text: (document.body?.innerText ?? '').replace(/\\s+/g, ' ').trim() })`),
    );
    console.log(`URL: ${page.url}`);
    console.log(`text: ${page.text ? page.text.slice(0, 1500) + (page.text.length > 1500 ? ' …' : '') : '(none)'}`);
  } catch (e) {
    console.log(`the page did not answer: ${e.message}`);
  }
  console.log(`on screen: ${resumed().trim() || 'unknown'}`);
  if (artifacts) {
    try {
      mkdirSync(artifacts, { recursive: true });
      const png = execFileSync(adbPath, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 });
      writeFileSync(join(artifacts, 'screen.png'), png);
      console.log(`screenshot: ${join(artifacts, 'screen.png')}`);
    } catch (e) {
      console.log(`no screenshot: ${e.message}`);
    }
  }
  console.log('---- end ----\n');
}

// ---- what was on the emulator, to put back afterwards ---------------------------
// An app just installed has no folders yet. The two the test writes into
// first are made now, as the app's own; any it made is removed at the end if
// it is empty again.
const madeHere = ['files', 'files/backups', 'files/screenshots'].filter((dir) => !isThere(dir));
for (const dir of madeHere.filter((d) => d !== 'files/screenshots')) {
  inApp('mkdir', dir);
  handBack(dir);
}
// The copy of the journal the app keeps in its WebView (src/store/mirror.ts):
// a phone writes it when a save fails, and opens it rather than the file while
// it is newer. Kept and cleared before the test, so the journals it puts in
// place open from the file, and put back at the end.
const MIRROR = JSON.stringify('sniper-journal:v1');
let keptMirror = null;
let mirrorKept = false;
const keptJournal = join(work, 'kept.json');
let hadJournal = false;
try {
  writeFileSync(keptJournal, inApp('cat', 'files/journal.json'));
  hadJournal = true;
} catch {}
const copiesBefore = new Set(backups());
const original = JSON.parse(readFileSync(sample, 'utf8'));

/** a file from this PC into the app's folder, owned by the app */
function pushFile(local, path) {
  adb('push', local, '/data/local/tmp/sj-file');
  inApp('cp', '/data/local/tmp/sj-file', path);
  handBack(path);
  adb('shell', 'rm', '/data/local/tmp/sj-file');
}
// Settings can delete the chart images no journal or backup mentions. While
// the emulator's own journal is swapped out, a copy of it waits among the
// backups, with the names of every image already on the emulator, so the
// test's reclaim takes only what it planted itself. Removed at the end.
const KEPT_COPY = 'files/backups/sj-e2e-kept.json';
let imagesBefore = [];
try {
  imagesBefore = inApp('ls', 'files/screenshots').split(/\s+/).filter(Boolean);
} catch {
  // no screenshots folder yet
}
// whole JSON whatever the emulator's journal holds: a damaged copy stops the reclaim
writeFileSync(
  join(work, 'kept-copy.json'),
  JSON.stringify({ journal: hadJournal ? readFileSync(keptJournal, 'utf8') : null, images: imagesBefore }),
);
pushFile(join(work, 'kept-copy.json'), KEPT_COPY);
const SWEEP_COPY = 'files/backups/conflict-20260101-000000.json';
const PLANTED = ['droidused1.png', 'droidcopy1.png', 'droidorph1.png', 'droidnew01.png'];

try {
  // the app as it is, for its own copy: opening the journal writes nothing
  await launch();
  keptMirror = await ev(`localStorage.getItem(${MIRROR})`);
  mirrorKept = true;
  await ev(`localStorage.removeItem(${MIRROR}); true`);

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
    // a busy emulator can take seconds to draw the page: wait for the count, up to 15 s
    for (let i = 0; i < 60 && !/(\\d+) trades in/.test(document.body.innerText); i++)
      await new Promise((r) => setTimeout(r, 250));
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

  // ---- Settings reclaims the chart images nothing uses ----------------------------
  // planted a month old: one the journal shows, one only a kept copy mentions,
  // one nothing uses; and one nothing uses that was just added
  const withChart = structuredClone(original);
  withChart.trades[0].screenshotFile = 'droidused1.png';
  writeFileSync(join(work, 'with-chart.json'), JSON.stringify(withChart));
  await pushJournal(join(work, 'with-chart.json'));
  writeFileSync(join(work, 'copy.json'), JSON.stringify({ version: 1, trades: [{ id: 'c', screenshotFile: 'droidcopy1.png' }], accounts: [] }));
  pushFile(join(work, 'copy.json'), SWEEP_COPY);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  writeFileSync(join(work, 'chart.png'), png);
  inApp('mkdir', '-p', 'files/screenshots');
  for (const name of PLANTED) {
    pushFile(join(work, 'chart.png'), `files/screenshots/${name}`);
    if (name !== 'droidnew01.png') inApp('touch', '-t', '202601010000', `files/screenshots/${name}`);
  }
  const shots = () => inApp('ls', 'files/screenshots').split(/\s+/).filter((f) => PLANTED.includes(f)).sort();
  await launch();
  await ev(goSettings);
  await until(`[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Reclaim unused chart images'))`, 'reclaim button');
  await ev(clickText('Reclaim unused chart images'));
  await until(`[...document.querySelectorAll('[data-modal-root] button')].some((b) => b.textContent.trim() === 'Delete it')`, 'reclaim confirmation');
  const asking = await ev(`document.querySelector('[data-modal-root]').innerText`);
  check(
    'Reclaim unused chart images says how many there are and the space they take',
    asking.includes('Delete 1 unused chart image?') && asking.includes(`frees ${png.length} bytes`) && shots().length === PLANTED.length,
    asking,
  );
  await ev(clickText('Delete it'));
  let left = shots();
  for (let i = 0; i < 40 && left.includes('droidorph1.png'); i++) {
    await sleep(250);
    left = shots();
  }
  check(
    'confirmed, it deletes the image nothing uses; ones in use, in a kept copy, or new stay',
    JSON.stringify(left) === JSON.stringify(['droidcopy1.png', 'droidnew01.png', 'droidused1.png']),
    JSON.stringify(left),
  );
  check('and says how much space it freed', await seen(`document.body.innerText.includes('${png.length} bytes freed: 1 unused chart image deleted')`, 'freed toast', 5000));

  // ---- the App and Share plugins ------------------------------------------------
  adb('logcat', '-c');
  await launch();
  // waits rather than fixed pauses: a busy emulator can take seconds to draw a page
  await ev(goTrades);
  await seen(`location.pathname.startsWith('/trades') && /(\\d+) trades? in/.test(document.body.innerText)`, 'trades', 15000);
  const onTrades = await ev('location.pathname');
  adb('shell', 'input', 'keyevent', 'BACK');
  await seen(`!location.pathname.startsWith('/trades')`, 'back from trades', 15000);
  check(
    'the back button goes back inside the app (App plugin)',
    onTrades.startsWith('/trades') &&
      resumed().includes('sniperjournal') &&
      !(await ev('location.pathname')).startsWith('/trades'),
  );
  await ev(goTrades);
  await seen(
    `[...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith('Export'))`,
    'export button',
    15000,
  );
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
  // while the app still shows where it failed
  if (failures) await diagnose();

  // put the emulator back as it was: its journal, or none on an app just installed
  if (hadJournal) await pushJournal(keptJournal).catch(() => undefined);
  else {
    adb('shell', 'am', 'force-stop', PKG);
    inApp('rm', '-f', 'files/journal.json', 'files/journal.tmp');
  }
  // and the app's own copy, which it would otherwise open over that journal.
  // Opening it writes nothing, so the journal above stays as it is.
  let mirrorBack = !mirrorKept;
  if (mirrorKept) {
    try {
      await launch();
      await ev(
        keptMirror == null
          ? `localStorage.removeItem(${MIRROR}); true`
          : `localStorage.setItem(${MIRROR}, ${JSON.stringify(keptMirror)}); true`,
      );
      mirrorBack = (await ev(`localStorage.getItem(${MIRROR})`)) === keptMirror;
    } catch (err) {
      console.log(`note: the app's own copy could not be put back: ${err.message}`);
    }
  }
  adb('shell', 'am', 'force-stop', PKG);
  // every copy made while the test ran holds one of its journals, the app's
  // daily one included
  for (const f of backups()) if (!copiesBefore.has(f)) inApp('rm', `files/backups/${f}`);
  try {
    inApp('rm', '-f', KEPT_COPY, SWEEP_COPY, ...PLANTED.map((n) => `files/screenshots/${n}`));
  } catch {}
  // the folders it made, deepest first, if nothing else is in them
  for (const dir of [...madeHere].reverse())
    try {
      inApp('rmdir', dir);
    } catch {}
  const journalBack = hadJournal
    ? inApp('cat', 'files/journal.json') === readFileSync(keptJournal, 'utf8')
    : !isThere('files/journal.json');
  const backupsBack = backups().every((f) => copiesBefore.has(f));
  check(
    'afterwards the emulator has its own journal, backups and app copy back',
    journalBack && backupsBack && mirrorBack,
    JSON.stringify({ journalBack, backupsBack, mirrorBack }),
  );
  if (rooted) adb('unroot');
  rmSync(work, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
