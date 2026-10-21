/**
 * The app's logo: a sniper's scope over rising candles, a trend arrowed out
 * of it, on its dark tile.
 *
 * The same picture as the launcher icon and the browser tab, so the mark in the
 * header matches the one the app was opened from: scripts/make-icons.mjs draws
 * this file from assets/logo.png along with every other icon. 192 pixels
 * across keeps it sharp at 40px on a 4x screen.
 *
 * Next to the name written out, pass alt="" so a screen reader doesn't say it twice.
 */
export function LogoMark({ size = 30, alt = 'Sniper Journal' }: { size?: number; alt?: string }) {
  return (
    // a static export has no image optimiser for next/image to use
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icon-192.png" width={size} height={size} alt={alt} className="shrink-0" draggable={false} />
  );
}
