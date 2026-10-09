// Builds the signed Android App Bundle (.aab) that Google Play takes.
//
//   npm run bundle
//
// From scratch every time: static export, a clean Capacitor sync (never the
// live-reload dev server), then a release bundle signed with the upload key
// from android/keystore.properties, and a check that the signature is there.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const fail = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true, ...options });
  if (result.status !== 0) fail(`${command} ${args.join(' ')} failed.`);
};

if (!existsSync('android/keystore.properties')) {
  fail(
    'No upload key yet. Copy android/keystore.properties.example to android/keystore.properties,\n' +
      '  make the key with the keytool command written at the top of it, and fill in the passwords.',
  );
}

// a JDK: JAVA_HOME if set, otherwise the one the Android SDK installs
let javaHome = process.env.JAVA_HOME;
if (!javaHome) {
  const root = 'C:\\Program Files\\Android\\openjdk';
  const jdk = existsSync(root) ? readdirSync(root).filter((d) => d.startsWith('jdk')).sort().at(-1) : undefined;
  if (!jdk) fail('No JDK found. Set JAVA_HOME to a JDK 21.');
  javaHome = join(root, jdk);
}

// the Android SDK: ANDROID_HOME, android/local.properties, or where the SDK installs itself
let androidHome = process.env.ANDROID_HOME;
if (!androidHome && !existsSync('android/local.properties')) {
  androidHome = join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
  if (!existsSync(androidHome)) fail('No Android SDK found. Set ANDROID_HOME.');
}

// the store build must never carry the dev-server setting
const env = { ...process.env, JAVA_HOME: javaHome, ...(androidHome ? { ANDROID_HOME: androidHome } : {}) };
delete env.CAP_LIVE_URL;

run('npm', ['run', 'build:mobile'], { env });
run('npx', ['cap', 'sync', 'android'], { env });

const synced = JSON.parse(readFileSync('android/app/src/main/assets/capacitor.config.json', 'utf8'));
if (synced.server?.url) fail('capacitor.config.json still points at a dev server; refusing to build.');

// by full path: cmd does not look in the working folder for a bare name here
const gradlew = resolve('android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
run(`"${gradlew}"`, ['bundleRelease', '--console=plain'], { cwd: 'android', env });

const aab = 'android/app/build/outputs/bundle/release/app-release.aab';
if (!existsSync(aab)) fail(`Expected ${aab}, but it is not there.`);

const verify = spawnSync(join(javaHome, 'bin', 'jarsigner'), ['-verify', aab], { encoding: 'utf8' });
if (!/jar verified/i.test(verify.stdout ?? '')) fail(`${aab} is not signed:\n${verify.stdout}${verify.stderr}`);

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const size = (statSync(aab).size / 1024 / 1024).toFixed(1);
console.log(`\n  Signed bundle ready: ${aab} (${size} MB, version ${version})`);
console.log('  Upload it in Play Console. Next time, run "npm version patch" first: Play refuses a version it has already seen.\n');
