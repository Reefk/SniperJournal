import type { NextConfig } from 'next';

/**
 * `npm run build` makes the desktop app: a Node server with the API routes
 * that read and write data/journal.json.
 *
 * `npm run build:mobile` (scripts/build-mobile.mjs) sets MOBILE_BUILD=1 and
 * makes a static export into `out/` for Capacitor, which can only serve files.
 * The API routes are named `route.desktop.ts`, and only the desktop build
 * counts `.desktop.ts` as a route file, so the mobile build leaves them out
 * without moving anything.
 */
const mobile = process.env.MOBILE_BUILD === '1';

/**
 * The desktop server's pages must never load inside another site's frame,
 * where a page could trick a click onto "Erase all data". (A static export
 * sends no headers; the Android app is not reachable by other sites anyway.)
 */
const desktopHeaders: NextConfig['headers'] = async () => [
  {
    source: '/:path*',
    headers: [
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
    ],
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  ...(mobile
    ? { output: 'export' }
    : { pageExtensions: ['desktop.ts', 'tsx', 'ts', 'jsx', 'js'], headers: desktopHeaders }),
};

export default nextConfig;
