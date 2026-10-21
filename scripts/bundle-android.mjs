// Builds the signed Android app: the App Bundle (.aab) that Google Play takes,
// or the .apk people download and install themselves.
//
//   npm run bundle
//   npm run apk
//
// From scratch every time: static export, a clean Capacitor sync (never the
// live-reload dev server), then a release build signed with the key from
// android/keystore.properties, and a check that the signature is there. The
// .apk's key is the app's for good: an update signed with another one won't
// install over it.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const apk = process.argv.includes('--apk');

// the certificate of the key the APK has been signed with since 1.1.0
// (android/upload-keystore.jks): Android won't install an APK signed with any
// other key over the app people already have
const RELEASE_CERT_SHA256 = 'D4F0DE81FC2D9F56191AB970F4CBD18741E4BF20F574AC3F4D672260D9A17940';

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
  const jdk = existsSync(root)
    ? readdirSync(root)
        .filter((d) => d.startsWith('jdk'))
        .sort()
        .at(-1)
    : undefined;
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

const out = apk
  ? 'android/app/build/outputs/apk/release/app-release.apk'
  : 'android/app/build/outputs/bundle/release/app-release.aab';
// an older build left behind must not pass for this one
rmSync(out, { force: true });

// by full path: cmd does not look in the working folder for a bare name here
const gradlew = resolve('android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
run(`"${gradlew}"`, [apk ? 'assembleRelease' : 'bundleRelease', '--console=plain'], { cwd: 'android', env });

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
// without a signing key gradle names the APK app-release-unsigned.apk
if (!existsSync(out)) fail(`Expected ${out}, but it is not there. Is storeFile set in android/keystore.properties?`);
const size = (statSync(out).size / 1024 / 1024).toFixed(1);

if (apk) {
  // from Android 7 up the APK is signed in a way only apksigner reads (jarsigner calls it unsigned)
  const sdk = androidHome ?? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
  const tools = join(sdk, 'build-tools');
  const name = process.platform === 'win32' ? 'apksigner.bat' : 'apksigner';
  const latest = existsSync(tools)
    ? readdirSync(tools)
        .filter((d) => existsSync(join(tools, d, name)))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .at(-1)
    : undefined;
  if (!latest) fail(`No apksigner in ${tools}, so the signature can't be checked.`);
  const apksigner = join(tools, latest, name);
  const verify = spawnSync(`"${apksigner}"`, ['verify', '--print-certs', out], { encoding: 'utf8', shell: true, env });
  const sha256 = verify.stdout?.match(/certificate SHA-256 digest: ([0-9a-f]+)/i)?.[1];
  if (verify.status !== 0 || !sha256) {
    fail(`${out} is not signed (apksigner exit ${verify.status}):\n${verify.stdout}${verify.stderr}`);
  }
  const fingerprint = sha256.match(/../g).join(':').toUpperCase();
  if (sha256.toUpperCase() !== RELEASE_CERT_SHA256) {
    fail(`${out} is signed with another key (SHA-256 ${fingerprint}); it would not install over the released app.`);
  }
  console.log(`\n  Signed APK ready: ${out} (${size} MB, version ${version})`);
  console.log(`  Signed with the release key, certificate SHA-256 ${fingerprint}\n`);
} else {
  const verify = spawnSync(join(javaHome, 'bin', 'jarsigner'), ['-verify', out], { encoding: 'utf8' });
  if (!/jar verified/i.test(verify.stdout ?? '')) fail(`${out} is not signed:\n${verify.stdout}${verify.stderr}`);
  console.log(`\n  Signed bundle ready: ${out} (${size} MB, version ${version})`);
  console.log(
    '  Upload it in Play Console. Next time, run "npm version patch" first: Play refuses a version it has already seen.\n',
  );
}
