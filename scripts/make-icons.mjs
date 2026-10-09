// Draws every icon the app ships from the one logo defined in `mark()` below:
// a sniper's scope with a rising trend arrowed through the middle.
//
//   node scripts/make-icons.mjs
//
// Writes the Android launcher icons and launch screen, the PWA icons in
// public/, the browser tab icon, the Windows shortcut's .ico, and the artwork
// the Play Store listing asks for. Nothing reads these at build time, so the
// results are committed; re-run after editing the logo. The in-app mark is
// src/components/ui/Logo.tsx — keep the two in step.

import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const RES = 'android/app/src/main/res';

/* ---------------------------------------------------------------- the logo */

const C = {
  navy: '#1b2747',
  navyMid: '#0f1830',
  navyDeep: '#070c18',
  indigo: '#6366f1',
  emerald: '#34d399',
  emeraldDeep: '#0ea06f',
  white: '#f4f7ff',
  wash: '#ccd6f6',
};

/**
 * The scope and the arrow, in a 1024-unit square. The widest feature — the
 * scope's four ticks — spans 820 of those units, i.e. 80% of the square.
 */
const MARK_SPAN = 820 / 1024;
function mark() {
  return `
  <g stroke="url(#ring)" stroke-width="46" stroke-linecap="round" fill="none">
    <circle cx="512" cy="512" r="296"/>
    <path d="M512 92V176M512 932V848M92 512H176M932 512H848"/>
  </g>
  <g stroke="url(#trend)" stroke-width="50" stroke-linecap="round" stroke-linejoin="round" fill="none" filter="url(#lift)">
    <path d="M356 668 668 356"/>
    <path d="M560 356H668V464"/>
  </g>`;
}

/** Gradients and the arrow's glow, shared by every drawing below. */
function defs() {
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C.navy}"/>
      <stop offset="55%" stop-color="${C.navyMid}"/>
      <stop offset="100%" stop-color="${C.navyDeep}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.28" cy="0.2" r="0.85">
      <stop offset="0%" stop-color="${C.indigo}" stop-opacity="0.55"/>
      <stop offset="60%" stop-color="${C.indigo}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${C.indigo}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="${C.white}"/>
      <stop offset="100%" stop-color="${C.wash}"/>
    </linearGradient>
    <linearGradient id="trend" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.emeraldDeep}"/>
      <stop offset="100%" stop-color="${C.emerald}"/>
    </linearGradient>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="26" flood-color="${C.emerald}" flood-opacity="0.45"/>
    </filter>
  </defs>`;
}

/**
 * The logo on its background.
 *   shape: 'squircle' for a standalone icon, 'circle' for Android's round
 *          launcher icon, 'square' for one a launcher's mask will crop.
 *   span:  how much of the square the mark may use. A mask only leaves the
 *          middle, so those icons pass a smaller span.
 */
function icon({ shape = 'squircle', span = MARK_SPAN } = {}) {
  const base =
    shape === 'circle'
      ? (fill) => `<circle cx="512" cy="512" r="512" fill="${fill}"/>`
      : (fill) => `<rect width="1024" height="1024" rx="${shape === 'squircle' ? 232 : 0}" fill="${fill}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${defs()}
  ${base('url(#bg)')}
  ${base('url(#glow)')}
  ${scaled(span)}
</svg>`;
}

/** The adaptive icon's foreground: the mark alone, on nothing. */
function foreground() {
  // of the adaptive icon's 108dp, only the middle 72dp is always on screen
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${defs()}
  ${scaled(72 / 108)}
</svg>`;
}

/** The adaptive icon's background layer, which the launcher's mask crops. */
function background() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${defs()}
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>
</svg>`;
}

/**
 * The mark on nothing, for the launch screen. res/drawable/splash.xml centres
 * this over the app's background colour, so it never has to stretch to the
 * shape of the screen and there is one of these per density, not per screen.
 */
function logoOnly() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${defs()}
  ${scaled(MARK_SPAN)}
</svg>`;
}

/**
 * The 1024x500 banner at the top of the Play Store listing. Play crops it on
 * some surfaces, so the logo and the words stay near the middle.
 */
function featureGraphic() {
  const w = 1024;
  const h = 500;
  const logo = 232;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  ${defs()}
  <rect width="${w}" height="${h}" fill="${C.navyDeep}"/>
  <rect width="${w}" height="${h}" fill="url(#glow)" opacity="0.75"/>
  <g transform="translate(130 ${(h - logo) / 2}) scale(${(logo / 1024).toFixed(5)})">${mark()}</g>
  <text x="408" y="236" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif"
        font-size="62" font-weight="700" fill="${C.white}" letter-spacing="-1">Sniper Journal</text>
  <text x="410" y="296" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif"
        font-size="27" font-weight="400" fill="#8b97ad">Your trading journal and performance</text>
  <text x="410" y="334" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif"
        font-size="27" font-weight="400" fill="#8b97ad">analytics, kept on your own phone.</text>
</svg>`;
}

/** The mark, centred, taking `span` of the square's width. */
function scaled(span) {
  const scale = (span / MARK_SPAN).toFixed(4);
  return `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${mark()}</g>`;
}

/* ------------------------------------------------------------ the writing */

const render = (svg, w, h = w) =>
  sharp(Buffer.from(svg), { density: 384 }).resize(w, h, { fit: 'fill' }).png().toBuffer();

/** The same, with no alpha channel at all — what the Play Store listing wants. */
const renderOpaque = (svg, w, h = w) =>
  sharp(Buffer.from(svg), { density: 384 })
    .resize(w, h, { fit: 'fill' })
    .flatten({ background: C.navyDeep })
    .png()
    .toBuffer();

function write(path, buffer) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
  console.log(`  ${path}`);
}

/** A .ico holding one PNG per size — what Windows shortcuts want. */
async function ico(svg, sizes) {
  const images = await Promise.all(sizes.map((s) => render(svg, s)));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // an icon, not a cursor
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length + 16 * sizes.length;
  const entries = sizes.map((size, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size % 256, 0); // 256 is written as 0
    e.writeUInt8(size % 256, 1);
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(images[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += images[i].length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images]);
}

// mdpi is 1x; every other bucket is a multiple of it
const DPI = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const SPLASH_LOGO_DP = 160;

console.log('Android launcher icons');
for (const [bucket, factor] of Object.entries(DPI)) {
  const dir = `${RES}/mipmap-${bucket}`;
  write(join(dir, 'ic_launcher.png'), await render(icon({ shape: 'squircle' }), 48 * factor));
  write(join(dir, 'ic_launcher_round.png'), await render(icon({ shape: 'circle' }), 48 * factor));
  write(join(dir, 'ic_launcher_foreground.png'), await render(foreground(), 108 * factor));
  write(join(dir, 'ic_launcher_background.png'), await render(background(), 108 * factor));
}

console.log('Android launch screen');
for (const [bucket, factor] of Object.entries(DPI)) {
  write(`${RES}/drawable-${bucket}/splash_logo.png`, await render(logoOnly(), SPLASH_LOGO_DP * factor));
}

console.log('PWA, browser tab and Windows shortcut');
write('public/icon-192.png', await render(icon({ shape: 'squircle' }), 192));
write('public/icon-512.png', await render(icon({ shape: 'squircle' }), 512));
// a maskable icon may be cropped to a circle, so keep the mark well inside
write('public/icon-maskable-512.png', await render(icon({ shape: 'square', span: 0.6 }), 512));
write('public/apple-touch-icon.png', await render(icon({ shape: 'square' }), 180));
write('src/app/icon.png', await render(icon({ shape: 'squircle' }), 64));
write('assets/sniper-journal.ico', await ico(icon({ shape: 'squircle' }), [16, 32, 48, 64, 128, 256]));

console.log('Play Store listing');
// Play wants a full-bleed 512 square — it rounds the corners itself, and a
// transparent corner would show as a notch
write('assets/play-store/icon-512.png', await renderOpaque(icon({ shape: 'square', span: 0.62 }), 512));
write('assets/play-store/feature-graphic-1024x500.png', await renderOpaque(featureGraphic(), 1024, 500));

console.log('the master drawing');
write('assets/icon.svg', Buffer.from(icon({ shape: 'squircle' })));
