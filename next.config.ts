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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  ...(mobile ? { output: 'export' } : { pageExtensions: ['desktop.ts', 'tsx', 'ts', 'jsx', 'js'] }),
};

export default nextConfig;
