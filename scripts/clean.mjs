// Deletes what builds and test runs leave behind, all of it recreated when
// needed. Keeps the desktop build in .next (what start.bat runs) and never
// touches data/ (your journal).
//
//   npm run clean

import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LEFTOVERS = [
  '.next/dev', // the development server's build
  '.next/cache', // build cache
  'out', // the Android export, made again by build:mobile
  'coverage',
  'android/app/build', // Gradle output
  'android/build',
  'src-tauri/target', // the Windows app's Rust build, made again by build:desktop (a few GB)
  'tsconfig.tsbuildinfo',
];

function size(path) {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (!stat) return 0;
  if (!stat.isDirectory()) return stat.size;
  return readdirSync(path).reduce((sum, name) => sum + size(join(path, name)), 0);
}

let freed = 0;
for (const path of LEFTOVERS) {
  if (!existsSync(path)) continue;
  const bytes = size(path);
  rmSync(path, { recursive: true, force: true, maxRetries: 5 });
  freed += bytes;
  console.log(`  removed ${path} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
}
console.log(`  ${(freed / 1024 / 1024).toFixed(0)} MB freed`);
