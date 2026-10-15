// Packages the Windows app for the Microsoft Store: an .msix holding
// Sniper Journal.exe, its Start menu and Store logos, and the manifest with
// the app's identity from Partner Center (src-tauri/msix/AppxManifest.xml).
//
//   npm run build:desktop     # first, the program itself
//   npm run package:desktop   # then src-tauri/target/msix/SniperJournal_<version>_x64.msix
//
// The package is left unsigned: the Store signs what it publishes. The
// package is put together in a folder of its own from a fixed list of files,
// so nothing else in the project (your data/ folder above all) can end up in
// it. Needs the Windows SDK (makeappx and makepri), which Visual Studio's C++
// tools install.

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';

const project = resolve(import.meta.dirname, '..');
const exe = join(project, 'src-tauri', 'target', 'release', 'Sniper Journal.exe');
const source = join(project, 'src-tauri', 'msix');
const out = join(project, 'src-tauri', 'target', 'msix');
const layout = join(out, 'layout');

/** 1.2.3 in package.json is 1.2.3.0 to Windows; the Store wants the last part 0 */
const { version } = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`package.json version ${version} is not x.y.z`);
const msixVersion = `${version}.0`;

/** the newest Windows SDK that has the tool, e.g. bin\10.0.26100.0\x64\makeappx.exe */
function sdkTool(name) {
  const bin = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  const found = existsSync(bin)
    ? readdirSync(bin)
        .filter((v) => /^10\.\d+\.\d+\.\d+$/.test(v))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        .map((v) => join(bin, v, 'x64', name))
        .find(existsSync)
    : undefined;
  if (!found)
    throw new Error(`${name} not found: install the Windows SDK (Visual Studio Installer, C++ desktop tools)`);
  return found;
}
const run = (tool, args) => execFileSync(sdkTool(tool), args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });

if (!existsSync(exe)) throw new Error('Build the Windows app first: npm run build:desktop');
console.log(`  program   ${relative(project, exe)}, built ${statSync(exe).mtime.toLocaleString()}`);

// ---- the folder that becomes the package ------------------------------------
rmSync(out, { recursive: true, force: true });
mkdirSync(join(layout, 'Assets'), { recursive: true });
copyFileSync(exe, join(layout, 'Sniper Journal.exe'));
for (const name of readdirSync(join(source, 'Assets'))) {
  if (name.endsWith('.png')) copyFileSync(join(source, 'Assets', name), join(layout, 'Assets', name));
}
const manifest = readFileSync(join(source, 'AppxManifest.xml'), 'utf8').replace('$VERSION$', msixVersion);
writeFileSync(join(layout, 'AppxManifest.xml'), manifest);

// every file in it must be one of these, or nothing is packaged
const allowed = (path) =>
  path === 'Sniper Journal.exe' || path === 'AppxManifest.xml' || /^Assets[\\/][\w.-]+\.png$/.test(path);
const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [relative(layout, join(dir, e.name))],
  );
const stray = files(layout).filter((f) => !allowed(f));
if (stray.length) throw new Error(`refusing to package unexpected files: ${stray.join(', ')}`);

// ---- resources.pri: lets Windows pick each logo for the screen's scale ------
const priconfig = join(out, 'priconfig.xml');
run('makepri.exe', ['createconfig', '/cf', priconfig, '/dq', 'en-US', '/pv', '10.0.0', '/o']);
// one resources.pri for one package; the default splits it per scale and
// language, which only a bundle of several packages can use
writeFileSync(priconfig, readFileSync(priconfig, 'utf8').replace(/\s*<packaging>[\s\S]*?<\/packaging>/, ''));
run('makepri.exe', [
  'new',
  '/pr',
  layout,
  '/cf',
  priconfig,
  '/mn',
  join(layout, 'AppxManifest.xml'),
  '/of',
  join(layout, 'resources.pri'),
  '/o',
]);

// ---- the package ----------------------------------------------------------------
const msix = join(out, `SniperJournal_${msixVersion}_x64.msix`);
run('makeappx.exe', ['pack', '/d', layout, '/p', msix, '/o', '/h', 'SHA256']);

console.log(`  version   ${msixVersion}`);
console.log(`  files     ${files(layout).length}`);
console.log(`  package   ${relative(project, msix)} (${(statSync(msix).size / 1024 / 1024).toFixed(1)} MB, unsigned)`);
