// Builds the static export in out/ that Capacitor copies into the Android app.
//
// A static export always uses .next for its working files, which would replace
// the desktop build that start.bat runs. So the desktop .next is moved aside
// for the length of the build and put back afterwards, even if the build fails.
// If a previous run was killed half way, the stash is restored first.

import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, rmSync } from 'node:fs';

const NEXT = '.next';
const STASH = '.next-desktop';

if (existsSync(STASH)) {
  rmSync(NEXT, { recursive: true, force: true });
  renameSync(STASH, NEXT);
}

if (existsSync(NEXT)) renameSync(NEXT, STASH);

let status = 1;
try {
  const result = spawnSync('npx', ['next', 'build'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, MOBILE_BUILD: '1' },
  });
  status = result.status ?? 1;
} finally {
  rmSync(NEXT, { recursive: true, force: true });
  if (existsSync(STASH)) renameSync(STASH, NEXT);
}

process.exit(status);
