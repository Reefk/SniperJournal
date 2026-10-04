# Brief: turn Sniper Journal into an iPhone app with local storage

> Hand this file to Claude Code in VS Code. Start with:
> _"Read MOBILE-PLAN.md and do Phase 1."_
> Work one phase at a time and verify each before moving on.

---

## The goal

Ship Sniper Journal as a real iPhone app, installed from Xcode, where the
journal lives **on that phone** in the app's own private storage. No server, no
account, no sync. Each device holds its own journal, exactly as each PC does
today.

The desktop version must keep working, unchanged, throughout.

---

## What you are starting from

A working Next.js 16 / React 19 / TypeScript / Tailwind v4 desktop app, about
6,700 lines. It currently runs as a local Node server on a PC and writes to
`data/journal.json` beside the app.

### The three layers, and how they differ

| Layer                                                    | Lines  | What happens to it                                                                     |
| -------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `src/lib/*` — stats, insights, CSV, trade maths, merging | ~1,900 | **Nothing. Do not touch.** Pure TypeScript, no DOM, no Node. It already runs anywhere. |
| `src/components`, `src/views`, `src/app`                 | ~4,700 | Runs as-is inside the webview. Needs a **responsive pass** (Phase 3), not a rewrite.   |
| `src/app/api/*`, storage                                 | ~530   | Node-only. **Excluded from the mobile build**; replaced by Phase 1.                    |

### Storage is already abstracted — this is the important part

Every filesystem and network call in the app goes through one interface:

```
src/lib/storage/types.ts    the contract: init, readJournal, writeJournal,
                            saveImage, imageSrc, deleteImage, exportFile
src/lib/storage/web.ts      the desktop implementation (calls /api/*)
src/lib/storage/index.ts    picks the implementation at runtime
```

Nothing else in the codebase touches storage directly. Adding iOS means
**writing one new file** that implements `JournalStorage`, and returning it from
`pick()` in `index.ts`. Do not scatter platform checks anywhere else.

---

## Phase 1 — Capacitor shell and native storage

### 1a. Install and initialise

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/filesystem @capacitor/share
npx cap init "Sniper Journal" com.sniperjournal.app --web-dir=out
```

### 1b. A static build for mobile

Capacitor serves static files; it cannot run API routes. Add a mobile-only
build that sets `output: 'export'` and leaves `src/app/api` out, **without
breaking `npm run build` for the desktop app**. Suggested approach: an env var
(`MOBILE_BUILD=1`) read in `next.config.ts`, plus `npm run build:mobile`.

Facts that make this straightforward, already verified:

- All nine views are `'use client'` — no server components to untangle
- No `next/image` anywhere, so no image-optimisation blocker
- No dynamic routes; every page is static

### 1c. Write `src/lib/storage/capacitor.ts`

Implement `JournalStorage` using `@capacitor/filesystem`, writing to
`Directory.Data` (private to the app, included in the user's iCloud backup).

- `readJournal` / `writeJournal` → `journal.json` in `Directory.Data`.
  Write to `journal.tmp` then rename, so a crash cannot corrupt the file.
  Return the folder path from `writeJournal` so the Support page can show it.
- `init()` → resolve the base URI once with `Filesystem.getUri` and cache it.
  This is why `imageSrc` is allowed to be synchronous; honour that.
- `saveImage` → write into a `screenshots/` subfolder, return the file name.
- `imageSrc` → `Capacitor.convertFileSrc(baseUri + '/screenshots/' + name)`.
  A raw `file://` path will **not** load in the webview; it must be converted.
- `deleteImage` → `Filesystem.deleteFile`.
- `exportFile` → write to `Directory.Cache`, then `Share.share({ url })`.
  There is no download folder on iOS; the share sheet is the equivalent.

Then wire it into `pick()`:

```ts
import { Capacitor } from '@capacitor/core';
if (Capacitor.isNativePlatform()) return capacitorStorage;
```

**On the question of SQLite.** The journal is a single JSON object and the app
loads all of it into memory to compute from. Ten thousand trades is roughly
5 MB — a file is the right tool, and it matches the desktop version exactly.
If the journal ever outgrows that, `@capacitor-community/sqlite` can replace
the implementation behind the same interface, touching nothing else. Start
with the file.

### Phase 1 is done when

- `npm run build` still produces the working desktop app
- `npm run build:mobile` produces `out/` with no API routes
- `npx cap sync ios` succeeds
- The app runs in the iOS simulator, you can log a trade, force-quit, reopen,
  and the trade is still there

---

## Phase 2 — the things that behave differently on iOS

These were found by inspecting the code; each one needs a decision.

| Where                                 | What breaks                                           | Fix                                                                                                                           |
| ------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/utils.ts` → `downloadFile`   | Anchor-tag downloads do nothing on iOS                | Already routed through `storage.exportFile`. Just implement it with Share.                                                    |
| `src/views/ReportsView.tsx:109`       | `window.print()` does nothing                         | Hide the Print button on native, or export a PDF                                                                              |
| `src/store/JournalProvider.tsx`       | Mirrors the journal into `localStorage` as a fallback | Redundant on native, where storage is already local. Skip it when `storage.kind === 'native'` — it doubles memory for nothing |
| `src/hooks/useOnlineStatus.ts`        | "Online" means nothing for a local app                | Hide the indicator on native, or relabel it                                                                                   |
| `src/app/manifest.ts`, `public/sw.js` | PWA-only                                              | Harmless, but irrelevant inside Capacitor                                                                                     |
| CSV import file picker                | Works, but iOS shows the Files app                    | Verify the flow end to end on a device                                                                                        |

**The one that matters most:** deleting the app deletes the journal with it.
Make the backup export genuinely easy to reach on mobile, and consider warning
the user once during onboarding.

---

## Phase 3 — make it fit a phone

The UI is currently built for a desktop and will be unusable otherwise.
`src/components/layout/AppShell.tsx:57` hard-codes `min-w-[1180px]`; an iPhone
is 390pt wide.

Work through, smallest screen first:

1. **AppShell** — drop the min-width. Below `md`, the 248px sidebar becomes a
   bottom tab bar; the eight nav items will not fit, so pick the four that
   matter (Dashboard, Trades, Calendar, Insights) and move the rest behind a
   "More" sheet.
2. **Dashboard** — `grid-cols-4` and `grid-cols-3` become one column on phones.
   Charts need a shorter fixed height. `MetricStrip` is 4×2 on desktop; make it
   2×4 on a phone.
3. **Trades table** — ten columns will never fit. Below `md`, render each trade
   as a card: symbol, side and P&L on the first line, date and tags below.
   Keep the table for tablets and up.
4. **Trade form** — currently a two-column modal. On a phone it should be a
   full-screen sheet, single column, with the live P&L panel moved to the top
   so it is visible while typing.
5. **Calendar** — the 7-column grid works, but cells need to shrink and the
   day detail should open as a bottom sheet.
6. **Safe areas** — add `viewport-fit=cover` and pad with
   `env(safe-area-inset-top/bottom)` so content clears the notch and the home
   indicator.
7. **Touch targets** — the icon buttons are 32px; iOS wants 44px minimum.

Test at 390×844 (iPhone 14/15) and 430×932 (Pro Max) throughout.

---

## Phase 4 — build and install

Requires a **Mac with Xcode**. There is no way around this; Apple does not
allow iOS builds from Windows.

```bash
npm run build:mobile
npx cap sync ios
npx cap open ios      # opens Xcode
```

In Xcode: set the signing team, pick your iPhone, press Run.

- With a **free** Apple ID the app works for 7 days, then needs re-signing
- The **Apple Developer Program** is $99/year and removes that limit
- Distributing to anyone else means App Store review

---

## Rules while working

1. **Never change `src/lib/*`** other than the new storage file. Those are the
   calculations; they are tested and correct.
2. **One platform check, in one place.** `pick()` in `src/lib/storage/index.ts`.
   If you need a platform branch in a component, expose it as `storage.kind`.
3. **The desktop app must keep working after every phase.** Run
   `npm run build` and open it on the PC before you call a phase done.
4. **Run `npm run typecheck` before finishing anything.** The project is strict.
5. The journal format is versioned (`JournalData.version`). If you change the
   shape, update `normalize()` in `JournalProvider.tsx` so existing journals
   still load.
6. Stop the background desktop app (`stop.bat`) before running a dev server, or
   two servers will fight over port 3000 and over `data/journal.json`.

---

## Useful background

- `DEVELOPING.md` — the map of the codebase, what lives where
- `README.md` — what the app does, from the user's side
- The app is deliberately offline-only and keeps no telemetry. Preserve that.
