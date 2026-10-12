@AGENTS.md

# Sniper Journal: ground rules for working on this code

`DEVELOPING.md` is the map of the codebase; read it first.

- **Offline, always.** No network requests, analytics, CDN fonts or remote error
  reporting. The journal never leaves the device.
- **The desktop app must keep working** after every change: `npm run build`,
  then it opens at <http://localhost:3000> and reads and writes
  `data/journal.json`.
- **`npm run check`** (typecheck, lint, tests) before calling anything done.
  `npm run e2e` after `npm run build` for anything a user can see;
  `npm run e2e:android` on an emulator for anything the phone touches.
- **A change to a calculation in `src/lib/` comes with a test** in `tests/`
  that shows the new behaviour. Every number in the app rests on them.
- **Old journals and backups must still load.** A change to the journal's shape
  goes through `normalize()` in `src/lib/journal.ts` and `src/store/sanitize.ts`.
- **No new runtime dependencies without asking.** Dev dependencies for tests and
  tooling are fine.
- **Don't change behaviour unless the task says so**, and say so when a number
  users see changes. Report bugs found along the way instead of quietly fixing
  them.
- **Synthetic data only** in tests and screenshots. Never read, print or commit
  `data/` (a real journal), `android/keystore.properties` or `*.jks`.
- **Small commits**, named like `fix(csv): parse date order once per file`.
- **Colour tokens stay hex values** (`src/app/globals.css`): the fallback for
  older Android WebViews (`scripts/postcss-old-webview.mjs`) needs them.
