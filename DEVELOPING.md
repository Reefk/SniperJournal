# Working on the code

Sniper Journal is an ordinary Next.js project in TypeScript. Everything you see
in the app is in `src/`, about 6,700 lines, no build tricks and no generated
code. Edit a file, save, and the browser updates.

## Opening it in VS Code

Get **Visual Studio Code** from <https://code.visualstudio.com> — not Visual
Studio, which is a different product built for C# and C++ and does not handle a
Next.js project well.

1. Open VS Code
2. **File → Open Folder**, and pick the `sniper-journal` folder
3. When it offers the recommended extensions, accept — they are Tailwind
   class-name completion, ESLint, and Prettier
4. Open a terminal inside VS Code with **Ctrl + `**

This folder already carries its own VS Code settings: the editor uses the same
TypeScript as `npm run typecheck`, so it never disagrees with the build, and
Tailwind completion is pointed at `globals.css`, which is where Tailwind v4 keeps
its configuration.

**Stop the background app before you start editing.** Double-click `stop.bat`,
or run it from the terminal. The installed copy runs a server on port 3000 and
writes to the same `data/journal.json` — leaving it running means two servers
fighting over the port and over your journal. Turn it back on with the desktop
icon when you are done.

Useful while you work:

- **Ctrl + Shift + B** — typecheck the whole project
- **F5** — start the dev server and attach a debugger
- **Ctrl + P** — jump to any file by name
- **F2** on a symbol — rename it everywhere safely

## Running it while you edit

```
npm install     # once
npm run dev     # development server with live reload
```

Then open <http://localhost:3000>. Changes appear as soon as you save.

`npm run dev` is for editing. `npm run build` followed by `npm start` is the
faster version you use day to day — that is what `start.bat` runs.

More commands worth knowing:

```
npm run typecheck   # catches mistakes before you see them in the browser
npm run lint        # React, hooks, accessibility and TypeScript rules (ESLint)
npm run build       # fails loudly if anything is broken
npm test            # the calculation, CSV, storage and API tests (a few seconds)
npm run test:watch  # the same, again on every save
npm run check       # typecheck, lint, formatting and tests in one go
npm run coverage    # the tests, with a coverage report
npm run e2e         # after npm run build: the whole app in a headless Edge/Chrome,
                    # with made-up trades in a throwaway folder
npm run e2e:android # the Android app on a running emulator (tests/android/)
npm run desktop     # the Windows app in its own window, from a dev server on port 3100;
                    # its journal is Documents\Sniper Journal (development)
npm run build:desktop  # the Windows app: src-tauri/target/release/Sniper Journal.exe
npm run package:desktop  # after build:desktop: the .msix for the Microsoft Store
                    # (identity from Partner Center in src-tauri/msix/AppxManifest.xml)
npm run e2e:desktop # after build:desktop: the Windows app, with made-up trades
                    # in a throwaway folder (never Documents\Sniper Journal)
npm run screenshots:store  # after build:desktop: the Microsoft Store screenshots,
                    # from the app's test trades (assets/microsoft-store/screenshots)
npm run bench       # timings for 100 to 50,000 trades
npm run format -- <files>   # Prettier on the files you name (VS Code does it on save)
npm run format -- .         # the same on every file
npm run format:check        # lists any file Prettier would change
npm run clean       # delete build leftovers: .next/dev and cache, out/, the Android and Windows app builds
```

The tests are in `tests/` and only ever use made-up trades. They never open
`data/` or anything else of yours. `docs/QUALITY_AUDIT.md` explains what they
cover and what they don't.

A test named **current behaviour, under review** pins down something known to
be wrong or still undecided, with a comment above it saying what is planned.
It is there so the behaviour can't change by accident in the meantime; the
change that settles it updates that test on purpose. `grep -rn "under review"
tests/` lists them.

GitHub runs typecheck, lint, a formatting check, the tests, both builds
(desktop and the Android export) and `npm run e2e` on Windows (in Edge) and
Linux (in Chrome) for every push to `main` and every pull request:
`.github/workflows/ci.yml`. It only reads the code; nothing is signed or
published. Lint warnings don't fail it, errors do. The warnings left today are
known (see the comment in `eslint.config.mjs`); don't add new ones. A file
Prettier would change fails it too: `npm run format -- .` fixes them all.
A Windows job of its own also builds the Windows app (`npm run build:desktop`)
and runs `npm run e2e:desktop` on it: Smart App Control on the developer's PC
can block the unsigned programs a Rust build runs. `npm run e2e:android` is
still run by hand.

Every file was formatted at once in one commit, listed in
`.git-blame-ignore-revs` so that GitHub's blame skips it. To skip it locally
too: `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

## Where everything lives

```
src/
  app/              one folder per page — the URL is the folder name
    layout.tsx      wraps every page, loads fonts and the providers
    globals.css     all the colours and fonts live here
    api/journal/    reads and writes data/journal.json on disk
  views/            the actual content of each page
  components/
    layout/         sidebar, header, search, account switcher, first-run setup
    trades/         the trade form, the CSV import dialog, bulk editing
    dashboard/      the four charts
    ui/             small reusable pieces: Button, Modal, MetricCard, …
  store/
    JournalProvider every trade, account and setting, plus saving to disk
    UIProvider      modals, confirmations and toasts
  lib/              the thinking parts, plain functions with no React
  hooks/            small bits of shared React behaviour
src-tauri/          the Windows app: its window, and the only code that
                    touches its folder (src/folder.rs), in Rust
data/               your journal and its backups, created at runtime
```

## The parts you are most likely to want to change

| What you want to change                            | File                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Colours, fonts, dark and light themes              | `src/app/globals.css`                                                               |
| Which items appear in the sidebar                  | `src/components/layout/Sidebar.tsx`                                                 |
| How P&L, R multiples and risk are calculated       | `src/lib/trade-math.ts`                                                             |
| Win rate, profit factor, expectancy, SQN, drawdown | `src/lib/stats.ts`                                                                  |
| The Sniper Score axes and how they are scored      | `sniperScore()` in `src/lib/stats.ts`                                               |
| The wording and rules of the insights              | `src/lib/insights.ts`                                                               |
| Which CSV column names are recognised              | the `alias(...)` lists in `src/lib/import/columns.ts`                               |
| How a name not in those lists is read by its words | the `words(...)` lists and `RULES` in `src/lib/import/words.ts`                     |
| How a file of single fills becomes trades          | `src/lib/import/fills.ts`                                                           |
| Futures point values the importer knows            | `POINT_VALUES` in `src/lib/import/instruments.ts`                                   |
| How partial fills are combined into one trade      | `src/lib/merge.ts`                                                                  |
| Chart image upload, scaling and storage            | `src/lib/screenshots.ts`, `src/app/api/screenshot/`                                 |
| The app icon and the store artwork                 | `assets/logo.png` and `assets/banner.png`, then `npm run icons` redraws all of them |
| The trade entry form                               | `src/components/trades/TradeFormModal.tsx`                                          |
| Trading session hours                              | `src/lib/sessions.ts`                                                               |
| The generated test data                            | `src/lib/sample.ts`                                                                 |

### Changing the colours

Every colour in the app is a CSS variable defined twice in `globals.css`, once
for dark and once for light:

```css
:root       { --profit: #34d399; --loss: #ff6879; --accent: #818cf8; … }
:root.light { --profit: #056e4c; --loss: #ba0236; --accent: #4f46e5; … }
```

Change those two blocks and the whole app follows, charts included. The charts
need real colour values rather than variables, so they are mirrored once in
`src/hooks/useChartTheme.ts` — change them in both places.

Text colours must stay readable: at least 4.5:1 contrast (WCAG AA) on the
`app`, `surface` and `raised` backgrounds, and for `profit`, `loss` and `warn`
also on the 10–15% tinted fills of the badges that put them behind their own
text. Check a new shade with any WCAG contrast checker before using it.

Keep every colour token a plain hex value. Tailwind writes tints like
`bg-profit/15` with `color-mix()`, which Android WebViews older than
Chrome 111 don't know; there Tailwind's fallback is the solid colour, and the
text on it disappears. `scripts/postcss-old-webview.mjs` (run after Tailwind,
see `postcss.config.mjs`) turns each of those fallbacks into the same tint in
the old syntax, `rgb(var(--profit-rgb) / 15%)`, and adds the `--profit-rgb`
channels next to every hex token. It can only do that for hex. It also gives
`100dvh` a `100vh` fallback (Chrome 108). Phones on an older WebView were
the first place both showed up.

### Adding a page

1. Create `src/views/MyThingView.tsx`.
2. Create `src/app/mything/page.tsx` that renders it.
3. Add an entry to the `NAV` array in `src/components/layout/Sidebar.tsx`.

### Adding a field to a trade

1. Add it to the `Trade` interface in `src/lib/types.ts`.
2. Add an input for it in `TradeFormModal.tsx` — the form state, the validator
   and the JSX all sit in that one file.
3. If it should survive a CSV round trip, add it to `CSV_COLUMNS` in
   `src/lib/csv.ts`, give it a role and its column names in
   `src/lib/import/columns.ts`, and read it in `assembleTrade`
   (`src/lib/import/rows.ts`), and in `assemblePosition`
   (`src/lib/import/positions.ts`) if a file of single fills can carry it.

Old journals keep working: `normalize()` in `src/lib/journal.ts` fills in
anything an existing `journal.json` does not have yet.

## How the data flows

```
you type in the form
  → JournalProvider updates its state
  → the whole journal is written to localStorage immediately (src/store/mirror.ts)
  → 350ms later it goes to storage.writeJournal()   (src/store/autosave.ts)
  → on a PC that is a PUT to /api/journal, which writes data/journal.json:
    one save at a time, to a temp file flushed to the disk, then renamed
    over the journal (tried again for about 1.5s while antivirus or
    OneDrive briefly holds the file)
  → a save that still fails is tried again after 1s, 2s, 5s, 10s, then
    every 30s, with the newest journal, until one succeeds
```

A journal file that cannot be read when the app starts is tried twice more
(after 0.5s and 1.5s). If it still cannot be read, it is never written over
for the rest of that session, and the sidebar says "Journal file unreadable".

**Two tabs, windows or servers on the same journal.** Every read of the journal
comes with a version: a hash of the file's exact contents, so the file format
doesn't change. Each save sends back the version it was made on top of
(`If-Match`), and the server checks it, in the same queue as the write,
before writing. A save made on top of an older version is refused (412), the
file is left alone, and `src/store/autosave.ts` stops: a refused save is never
tried again. That window keeps its own version as
`data/backups/conflict-<time>.json` and shows a dialog with **Reload** (the
journal as it is saved now) and **Download this window's version**.

All tabs share one copy of the journal in the browser, so that copy records
which tab wrote it and which file version it was made on top of
(`src/store/mirror.ts`). At startup it only wins over the file while it is
newer _and_ based on the file as it is now; a newer copy made on top of an
older file is kept as a conflict copy instead of being opened.

**When the browser can't keep its copy.** A copy over `MIRROR_LIMIT` (4
million characters, about 7,500 trades; browsers allow about 5 million per
site) isn't tried, and one the browser refuses (full, or storage turned off)
is caught. Either way the previous copy is left as it was (it is older than
the file, so the file still opens) and `copyMiss` in the journal context says
why. While the file is saved as usual that only loses the spare, and a notice
says so calmly, once a session (`CopyNotice` in
`src/components/layout/SaveConflict.tsx`). If the file can't be written
either, the status is `unsaved` rather than `browser`: the sidebar says "Not
saved" and the notice comes back, offering a backup download. On a phone, which
only keeps a copy while its folder can't be written, only the second can
happen.

**When something crashes.** A page that throws while drawing is replaced by
`src/app/error.tsx`, inside the app: the sidebar, the journal and saving
carry on. A crash in the app around the pages (the journal's state, the
sidebar, the header) shows `src/app/global-error.tsx` instead, which has none
of the app's providers, so it reads the journal straight from storage
(`src/store/rescue.ts`). Both offer a backup download and say where the
journal file is (`storage.location()`, known from the first read).

The Android app doesn't need any of this: it runs one WebView (`singleTask`),
its saves are already queued one at a time, and nothing else writes its
folder. Its storage keeps no versions (`version` is left out), so it behaves
exactly as before.

Every read and write — the journal, chart images, exported files — goes through
the one interface in `src/lib/storage/types.ts`. Nothing else in the app touches
the filesystem or the network. Supporting a new platform means writing one file
that implements that interface and adding it to `pick()` in
`src/lib/storage/index.ts`: its `kind`, its `device`, and a `load()` that
imports it, so that only the running platform's file is ever loaded (in
`storage.init()`); `src/lib/storage/capacitor.ts`, the Android app's storage,
is the worked example, and `src/lib/storage/tauri.ts`, the Windows app's,
follows it.

`storage.kind` says how the journal is kept (`web`: a browser and the server,
several tabs, the browser's copy; `native`: one app window writing its own
folder). `storage.device` says what it runs on (`pc` or `phone`): keyboard
focus, the print button, the back button, the share sheet and the words
"phone" and "PC" go by that one. The Windows app is `native` on a `pc`.

The Windows app's window speaks British English whatever Windows is set to:
`additionalBrowserArgs` in `src-tauri/tauri.conf.json` ends in `--lang=en-GB`,
so the browser's own parts (the date and time fields, their date picker, the
right-click menu) match the app's English, with day/month/year and a 24-hour
clock. Without it, a Hebrew Windows showed `dd/מ״מ/YYYY`. The rest of that
setting is Tauri's own default, which a custom value replaces. Scripts that set
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` (the Windows app's E2E, the Store
screenshots) pass the same flags again: that variable replaces them too. The
phone and the browser version still follow the phone's or the browser's
language.

The Windows app is like the phone in one more way: its window can be closed
within the 350ms a change waits before saving. So it holds the close, has the
page save that change at once, and closes once it is written
(`storage.whenClosing`, and `CloseRequested` in `src-tauri/src/lib.rs`).

Nothing is fetched from anywhere. Every number on every screen is computed from
that one object in memory, which is why the app works offline.

## Git

The folder is already a git repository with one commit, so you can experiment
freely:

```
git status          # what you changed
git diff            # the changes themselves
git checkout -- .   # throw away your changes and go back
git commit -am "my change"
```

Your journal is in `.gitignore`, so your trades are never committed.

## A warning about sharing

`data/journal.json` holds your real trades. It is excluded from git, but it is
**not** excluded if you zip the folder by hand. Before you send this to anyone,
delete `data/journal.json` and `data/backups/`, or send them the original zip
rather than your own copy.
