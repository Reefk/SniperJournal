# Working on the code

Sniper Journal is an ordinary Next.js project in TypeScript. Everything you see
in the app is in `src/`, about 6,700 lines, no build tricks and no generated
code. Edit a file, save, and the browser updates.

## Running it while you edit

```
npm install     # once
npm run dev     # development server with live reload
```

Then open <http://localhost:3000>. Changes appear as soon as you save.

`npm run dev` is for editing. `npm run build` followed by `npm start` is the
faster version you use day to day — that is what `start.bat` runs.

Two more commands worth knowing:

```
npm run typecheck   # catches mistakes before you see them in the browser
npm run build       # fails loudly if anything is broken
```

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

| What you want to change | File |
| --- | --- |
| Colours, fonts, dark and light themes | `src/app/globals.css` |
| Which items appear in the sidebar | `src/components/layout/Sidebar.tsx` |
| How P&L, R multiples and risk are calculated | `src/lib/trade-math.ts` |
| Win rate, profit factor, expectancy, SQN, drawdown | `src/lib/stats.ts` |
| The Sniper Score axes and how they are scored | `sniperScore()` in `src/lib/stats.ts` |
| The wording and rules of the AI insights | `src/lib/insights.ts` |
| Which CSV column names are recognised | `ALIASES` in `src/lib/csv.ts` |
| How partial fills are combined into one trade | `src/lib/merge.ts` |
| Chart image upload, scaling and storage | `src/lib/screenshots.ts`, `src/app/api/screenshot/` |
| The app icon | `assets/icon.svg`, then rebuild `sniper-journal.ico` and `src/app/icon.png` from it |
| The trade entry form | `src/components/trades/TradeFormModal.tsx` |
| Trading session hours | `src/lib/sessions.ts` |
| The generated test data | `src/lib/sample.ts` |

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
  → 350ms later it is PUT to /api/journal
  → the route writes data/journal.json (to a temp file first, then renames)
```

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
