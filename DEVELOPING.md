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
npm run build       # fails loudly if anything is broken
npm test            # the calculation, CSV, storage and API tests (a few seconds)
npm run coverage    # the same, with a coverage report
npm run e2e         # after npm run build: the whole app in a headless Edge/Chrome,
                    # with made-up trades in a throwaway folder
npm run bench       # timings for 100 to 50,000 trades
```

The tests are in `tests/` and only ever use made-up trades. They never open
`data/` or anything else of yours. `docs/QUALITY_AUDIT.md` explains what they
cover and what they don't.

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
| Which CSV column names are recognised              | `ALIASES` in `src/lib/csv.ts`                                                       |
| How partial fills are combined into one trade      | `src/lib/merge.ts`                                                                  |
| Chart image upload, scaling and storage            | `src/lib/screenshots.ts`, `src/app/api/screenshot/`                                 |
| The app icon                                       | `assets/icon.svg`, then rebuild `sniper-journal.ico` and `src/app/icon.png` from it |
| The trade entry form                               | `src/components/trades/TradeFormModal.tsx`                                          |
| Trading session hours                              | `src/lib/sessions.ts`                                                               |
| The generated test data                            | `src/lib/sample.ts`                                                                 |

### Changing the colours

Every colour in the app is a CSS variable defined twice in `globals.css`, once
for dark and once for light:

```css
:root       { --profit: #34d399; --loss: #f43f5e; --accent: #818cf8; … }
:root.light { --profit: #059669; --loss: #e11d48; --accent: #4f46e5; … }
```

Change those two blocks and the whole app follows, charts included. The charts
need real colour values rather than variables, so they are mirrored once in
`src/hooks/useChartTheme.ts` — change them in both places.

### Adding a page

1. Create `src/views/MyThingView.tsx`.
2. Create `src/app/mything/page.tsx` that renders it.
3. Add an entry to the `NAV` array in `src/components/layout/Sidebar.tsx`.

### Adding a field to a trade

1. Add it to the `Trade` interface in `src/lib/types.ts`.
2. Add an input for it in `TradeFormModal.tsx` — the form state, the validator
   and the JSX all sit in that one file.
3. If it should survive a CSV round trip, add it to `CSV_COLUMNS` and `ALIASES`
   in `src/lib/csv.ts`.

Old journals keep working: `normalize()` in `JournalProvider.tsx` fills in
anything an existing `journal.json` does not have yet.

## How the data flows

```
you type in the form
  → JournalProvider updates its state
  → the whole journal is written to localStorage immediately
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

Every read and write — the journal, chart images, exported files — goes through
the one interface in `src/lib/storage/types.ts`. Nothing else in the app touches
the filesystem or the network. Supporting a new platform means writing one file
that implements that interface and returning it from `pick()` in
`src/lib/storage/index.ts`; `src/lib/storage/capacitor.ts`, the Android app's
storage, is the worked example.

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
