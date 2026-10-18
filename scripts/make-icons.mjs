// Draws every icon the app ships from the one logo, assets/logo.png: a
// sniper's scope over rising candles, a trend arrowed out of it, on a dark
// rounded tile.
//
//   node scripts/make-icons.mjs
//
// assets/logo.png and assets/banner.png were cut from the "Sniper Journal
// Banner" design (2026-10-18). To change the logo, replace those two files
// and re-run; if the tile's background changes, re-measure TILE_BG and
// MARK_SPAN below.
//
// Writes the Android launcher icons and launch screen, the PWA icons in
// public/, the browser tab icon, the Windows shortcut's .ico, the Windows
// app's icon in src-tauri/icons, and the artwork the Play Store listing asks for. Nothing reads these at build time, so the
// results are committed. The in-app mark (src/components/ui/Logo.tsx) shows
// public/icon-192.png, so it follows by itself.

import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const RES = 'android/app/src/main/res';

/* ---------------------------------------------------------------- the logo */

/** Every drawing is made this many pixels across, then scaled to each size. */
const S = 1024;

/** The logo on its tile, S across; transparent outside the tile's rounded edge. */
const LOGO = await sharp('assets/logo.png').resize(S, S).png().toBuffer();

/**
 * How much of the tile the scope's ticks span, end to end (measured on the
 * logo). Every `span` below means this distance, so a span is how much of
 * its canvas the scope takes.
 */
const MARK_SPAN = 0.822;

/**
 * The tile's background is a flat slope of colour, darkest at the bottom
 * right; these are its top-left, top-right and bottom-left corners, measured
 * on the logo. Drawings that leave the tile's edge out carry it on with this.
 */
const TILE_BG = { tl: [0x1d, 0x1b, 0x3a], tr: [0x1a, 0x18, 0x35], bl: [0x15, 0x14, 0x2b] };

/** Where the tile sits when the scope spans `span` of the canvas. */
function place(span) {
  const size = Math.round((S * span) / MARK_SPAN);
  return { size, offset: Math.round((S - size) / 2) };
}

/** The tile's background slope, carried on over the whole canvas. */
function background(span) {
  const { size, offset } = place(span);
  const { tl, tr, bl } = TILE_BG;
  const raw = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x - offset) / size;
      const v = (y - offset) / size;
      const i = (y * S + x) * 4;
      for (let c = 0; c < 3; c++) raw[i + c] = Math.round(tl[c] + (tr[c] - tl[c]) * u + (bl[c] - tl[c]) * v);
      raw[i + 3] = 255;
    }
  }
  return raw;
}

/**
 * The logo without its tile's edge: the middle of the tile, faded out in a
 * circle just past the ticks' glow, over the same background carried on to
 * the canvas's edges. `onNothing` leaves out that background — the adaptive
 * icon's foreground, whose background is a layer of its own.
 */
async function borderless(span, { onNothing = false } = {}) {
  const { size, offset } = place(span);
  // the glow ends 0.425 of the tile from the middle, the tile's edge at 0.5
  const fade = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <radialGradient id="f"><stop offset="0.86" stop-color="#fff"/><stop offset="0.96" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <rect width="${size}" height="${size}" fill="url(#f)"/>
</svg>`;
  const middle = await sharp(LOGO)
    .resize(size, size, { kernel: 'lanczos3' })
    .composite([{ input: Buffer.from(fade), blend: 'dest-in' }])
    .png()
    .toBuffer();
  const base = onNothing
    ? sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    : sharp(background(span), { raw: { width: S, height: S, channels: 4 } });
  return base
    .composite([{ input: middle, left: offset, top: offset }])
    .png()
    .toBuffer();
}

/** A drawing cut to a circle: Android's round launcher icon. */
async function circle(drawing) {
  const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="#fff"/></svg>`;
  return sharp(drawing)
    .composite([{ input: Buffer.from(mask), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

/**
 * The adaptive icon as a flat silhouette, for phones set to themed icons:
 * Android throws away the colours and tints the shape with the wallpaper's.
 * The shape is the strokes: they stand about 200 above the tile's
 * background in their brightest channel, while their glow and the scope's
 * thin inner circle stay under 155.
 */
async function monochrome(span) {
  const bg = background(span);
  const { data } = await sharp(await borderless(span))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(S * S * 4, 255);
  for (let i = 0; i < S * S * 4; i += 4) {
    const lift = Math.max(data[i] - bg[i], data[i + 1] - bg[i + 1], data[i + 2] - bg[i + 2]);
    out[i + 3] = Math.round(255 * Math.min(1, Math.max(0, (lift - 155) / 30)));
  }
  return sharp(out, { raw: { width: S, height: S, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * The logo, `size` across, centred on a transparent w x h canvas: the
 * Windows Start menu's tiles, which keep space around a logo. Drawn with the
 * logo at full size; render() scales it down.
 */
async function tile(w, h, size) {
  const k = S / size;
  const width = Math.round(w * k);
  const height = Math.round(h * k);
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: LOGO, left: Math.round((width - S) / 2), top: Math.round((height - S) / 2) }])
    .png()
    .toBuffer();
}

/**
 * The 1024x500 banner at the top of the Play Store listing: the 16:9 banner,
 * cut to its middle. Play crops it on some surfaces, and the logo is in the
 * middle of it.
 */
async function featureGraphic() {
  const w = 1024;
  const h = 500;
  const resized = await sharp('assets/banner.png').resize({ width: w }).png().toBuffer();
  const { height } = await sharp(resized).metadata();
  return sharp(resized)
    .extract({ left: 0, top: Math.round((height - h) / 2), width: w, height: h })
    .png()
    .toBuffer();
}

/* ------------------------------------------------------------ the writing */

const render = (drawing, w, h = w) => sharp(drawing).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();

/** The same, with no alpha channel at all — what the Play Store listing wants. */
const renderOpaque = (drawing, w, h = w) =>
  sharp(drawing).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).flatten({ background: '#121126' }).png().toBuffer();

function write(path, buffer) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
  console.log(`  ${path}`);
}

/** A .ico holding one PNG per size — what Windows shortcuts want. */
async function ico(drawing, sizes) {
  const images = await Promise.all(sizes.map((s) => render(drawing, s)));
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

// the logo with its tile's rounded corners, for a standalone icon
const squircle = LOGO;
// full squares, for an icon something else rounds or masks
const square = await borderless(MARK_SPAN);
const round = await circle(square);
// of the adaptive icon's 108dp, only the middle 72dp is always on screen;
// the scope takes as much of that as it does of the tile
const ADAPTIVE = (72 / 108) * MARK_SPAN;

// mdpi is 1x; every other bucket is a multiple of it
const DPI = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const SPLASH_LOGO_DP = 160;

console.log('Android launcher icons');
const foreground = await borderless(ADAPTIVE, { onNothing: true });
const adaptiveBackground = await sharp(background(ADAPTIVE), { raw: { width: S, height: S, channels: 4 } })
  .png()
  .toBuffer();
const silhouette = await monochrome(ADAPTIVE);
for (const [bucket, factor] of Object.entries(DPI)) {
  const dir = `${RES}/mipmap-${bucket}`;
  write(join(dir, 'ic_launcher.png'), await render(squircle, 48 * factor));
  write(join(dir, 'ic_launcher_round.png'), await render(round, 48 * factor));
  write(join(dir, 'ic_launcher_foreground.png'), await render(foreground, 108 * factor));
  write(join(dir, 'ic_launcher_background.png'), await render(adaptiveBackground, 108 * factor));
  write(join(dir, 'ic_launcher_monochrome.png'), await render(silhouette, 108 * factor));
}

console.log('Android launch screen');
// res/drawable/splash.xml centres this over the app's background colour, so
// it never has to stretch to the shape of the screen
for (const [bucket, factor] of Object.entries(DPI)) {
  write(`${RES}/drawable-${bucket}/splash_logo.png`, await render(squircle, SPLASH_LOGO_DP * factor));
}

console.log('PWA, browser tab and Windows shortcut');
write('public/icon-192.png', await render(squircle, 192));
write('public/icon-512.png', await render(squircle, 512));
// a maskable icon may be cropped to a circle, so keep the scope well inside
write('public/icon-maskable-512.png', await render(await borderless(0.6), 512));
write('public/apple-touch-icon.png', await render(square, 180));
write('src/app/icon.png', await render(squircle, 64));
write('assets/sniper-journal.ico', await ico(squircle, [16, 32, 48, 64, 128, 256]));

console.log('Windows app');
// the program's own icon (title bar, taskbar, Alt+Tab), built into the .exe
write('src-tauri/icons/icon.ico', await ico(squircle, [16, 24, 32, 48, 64, 128, 256]));
write('src-tauri/icons/icon.png', await render(squircle, 512));

console.log('Windows app package (MSIX): Start menu, taskbar and Store logos');
// Windows picks the file for the screen's scaling (scale-200 at 200%) and,
// for the taskbar and Start list, the one drawn at the exact pixel size it
// needs (targetsize-24); "unplated" is the same, drawn without a tile behind
const MSIX = 'src-tauri/msix/Assets';
const SCALES = [100, 200, 400];
const square150 = await tile(150, 150, 100);
const wide310 = await tile(310, 150, 100);
for (const s of SCALES) {
  const f = s / 100;
  write(`${MSIX}/Square44x44Logo.scale-${s}.png`, await render(squircle, 44 * f));
  write(`${MSIX}/StoreLogo.scale-${s}.png`, await render(squircle, 50 * f));
  write(`${MSIX}/Square150x150Logo.scale-${s}.png`, await render(square150, 150 * f));
  write(`${MSIX}/Wide310x150Logo.scale-${s}.png`, await render(wide310, 310 * f, 150 * f));
}
for (const size of [16, 24, 32, 48, 256]) {
  const png = await render(squircle, size);
  write(`${MSIX}/Square44x44Logo.targetsize-${size}.png`, png);
  write(`${MSIX}/Square44x44Logo.targetsize-${size}_altform-unplated.png`, png);
}

console.log('Play Store listing');
// Play wants a full-bleed 512 square — it rounds the corners itself, and a
// transparent corner would show as a notch
const storeIcon = await borderless(0.62);
write('assets/play-store/icon-512.png', await renderOpaque(storeIcon, 512));
write('assets/play-store/feature-graphic-1024x500.png', await renderOpaque(await featureGraphic(), 1024, 500));

console.log('Microsoft Store listing');
// the 1:1 App tile icon, opaque like the Play icon: a full square the Store
// shapes itself. Poster and box art are for games and Xbox, so there are none
write('assets/microsoft-store/app-tile-icon-300.png', await renderOpaque(storeIcon, 300));
