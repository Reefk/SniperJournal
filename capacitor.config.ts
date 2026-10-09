import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android app: a webview showing the static export from
 * `npm run build:mobile`. The journal is stored by src/lib/storage/capacitor.ts.
 */
/**
 * For working on the UI only: `CAP_LIVE_URL=http://localhost:3000 npx cap sync android`
 * makes the app load from `npm run dev` (via `adb reverse tcp:3000 tcp:3000`),
 * so edits appear on the phone as you save. Run a plain `npx cap sync android`
 * afterwards to go back to the offline build.
 */
const live = process.env.CAP_LIVE_URL;

const config: CapacitorConfig = {
  appId: 'com.sniperjournal.app',
  appName: 'Sniper Journal',
  webDir: 'out',
  // the app's own dark background, so there is no white flash while it loads
  backgroundColor: '#0b1120',
  plugins: {
    // light status bar icons to match the default dark theme; JournalProvider
    // switches them when the theme changes
    SystemBars: { style: 'DARK' },
  },
  ...(live ? { server: { url: live, cleartext: true } } : {}),
};

export default config;
