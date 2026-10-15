// Screenshots for the Microsoft Store listing, taken from the built Windows
// app (src-tauri) with the app's own test trades, in a throwaway folder: your
// own Documents\Sniper Journal is never touched. The "Test data is loaded"
// banner is hidden on the live page for the captures; nothing else is changed.
//
//   npm run build:desktop && npm run screenshots:store
//
// Each page is laid out at SIZE (CSS pixels, a 1920 x 1080 laptop at 125%)
// and captured at SCALE, so the files come out at 2560 x 1440: inside the
// Store's 1366 x 768 to 3840 x 2160 for desktop screenshots.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PAGE, drive } from '../tests/e2e/cdp.mjs';

const SIZE = { width: 1536, height: 864 };
const SCALE = 5 / 3;

const project = resolve(import.meta.dirname, '..');
const exe = join(project, 'src-tauri', 'target', 'release', 'Sniper Journal.exe');
const out = join(project, 'assets', 'microsoft-store', 'screenshots');
const work = mkdtempSync(join(tmpdir(), 'sj-store-shots-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const debugPort = 9600 + Math.floor(Math.random() * 300);
const app = spawn(exe, [], {
  stdio: 'ignore',
  env: {
    ...process.env,
    SNIPER_JOURNAL_DIR: join(work, 'journal'),
    WEBVIEW2_USER_DATA_FOLDER: join(work, 'webview'),
    // US English whatever Windows is set to: dates and the date fields' placeholders
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort} --lang=en-US`,
  },
});

async function connect() {
  for (let i = 0; i < 150; i++) {
    await sleep(200);
    try {
      const target = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(
        (t) => t.type === 'page' && t.url.startsWith('http://tauri.localhost'),
      );
      if (target) {
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((r) => ws.addEventListener('open', r, { once: true }));
        return drive(ws);
      }
    } catch {}
  }
  throw new Error('the app did not open its window');
}

async function main() {
  const page = await connect();
  await page.send('Emulation.setDeviceMetricsOverride', { ...SIZE, deviceScaleFactor: SCALE, mobile: false });
  await page.until(`document.readyState === 'complete' && !!document.querySelector('aside')`, 'the app', 20000);
  await page.run(PAGE);

  // first run: the welcome screen's own "Explore with test data first"
  await page.until(`!!$t('Explore with test data first')`, 'the welcome screen', 10000);
  await page.run(`$t('Explore with test data first').click(); true`);
  await page.until(`$text().includes('Test data is loaded')`, 'the test trades', 10000);
  await sleep(5000); // the "loaded" toast fades

  const hideBanner = `(() => {
    const banner = [...document.querySelectorAll('main > div')].find((d) => d.textContent.startsWith('Test data is loaded'));
    if (banner) banner.style.display = 'none';
    return true;
  })()`;
  const open = async (href) => {
    await page.run(`document.querySelector('aside a[href="${href}"]').click(); true`);
    await page.until(`location.pathname.replace(/\\.html$|\\/$/, '') === '${href}'.replace(/\\/$/, '')`, href);
    await sleep(2500); // charts finish drawing
  };
  mkdirSync(out, { recursive: true });
  for (const old of readdirSync(out)) if (old.endsWith('.png')) rmSync(join(out, old));
  const shoot = async (name) => {
    await page.run(hideBanner);
    // the pointer off anything that lights up when hovered
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: SIZE.height - 1 });
    await sleep(300);
    const { result } = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, `${name}.png`), Buffer.from(result.data, 'base64'));
    console.log(`saved ${name}.png`);
  };

  await open('/');
  await shoot('01-dashboard');
  await open('/trades');
  await shoot('02-trades');
  // the newest trade, scrolled just far enough that its Save button shows
  await page.run(`document.querySelector('main tbody tr').click(); true`);
  await page.until(`!!$modal()`, 'the trade');
  await sleep(1000);
  await page.run(`(() => {
    const m = $modal();
    m.scrollTop = Math.max(0, m.firstElementChild.getBoundingClientRect().bottom - (innerHeight - 16));
    return true;
  })()`);
  await shoot('03-trade');
  await page.run(`$t('Cancel', $modal()).click(); true`);
  await page.until(`!$modal()`, 'the trade closed');
  await open('/insights');
  await shoot('04-insights');
  await open('/reports');
  await shoot('05-reports');
  // the light theme, on last month's calendar: a whole month of trades
  await page.run(
    `[...document.querySelectorAll('[aria-label="Color theme"] button')].find((b) => b.textContent.trim() === 'light').click(); true`,
  );
  await open('/calendar');
  await page.run(`document.querySelector('[aria-label="Previous month"]').click(); true`);
  await sleep(1000);
  await shoot('06-calendar-light');
  await page.run(
    `[...document.querySelectorAll('[aria-label="Color theme"] button')].find((b) => b.textContent.trim() === 'dark').click(); true`,
  );
  await open('/playbook');
  await shoot('07-playbook');
}

try {
  await main();
} finally {
  spawnSync('powershell', ['-NoProfile', '-Command', `(Get-Process -Id ${app.pid}).CloseMainWindow() | Out-Null`]);
  await Promise.race([new Promise((r) => app.once('exit', r)), sleep(10000)]);
  if (app.exitCode === null) app.kill();
  await sleep(500);
  rmSync(work, { recursive: true, force: true });
}
