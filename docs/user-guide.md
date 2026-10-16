# Sniper Journal — desktop user guide

A trading journal and performance analytics dashboard that runs on your own PC.
(The Android app works the same way, but keeps its journal on the phone; see the
[project README](../README.md).)
You enter the trades. Nothing is uploaded anywhere, and there is no sample data
unless you explicitly ask for it.

---

## Setting it up (once)

**Before unzipping**, right-click `sniper-journal.zip`, choose **Properties**,
tick **Unblock** at the bottom of the General tab, and click OK. Windows marks
everything that arrives from the internet; clearing it on the ZIP means nothing
inside is marked, and no security warning appears at all. It is one checkbox and
it saves the whole dance below.

1. **Install Node.js.** Get the LTS version from <https://nodejs.org> and accept
   the default options in the installer.
2. **Unzip this folder** somewhere permanent, such as `C:\SniperJournal`.
   Your journal file lives inside it, so avoid the Downloads folder.
3. **Double-click `INSTALLER.bat`.** It takes a few minutes: it installs what the
   app needs, builds it, clears the download mark from every file, puts a
   shortcut on your desktop, and sets the app to run quietly in the background.
4. The app opens, and from then on it is simply there. **No black window to keep
   open, nothing to close.** It starts with Windows and waits for you.
5. **Install it as a proper app** (worth the ten seconds): in Chrome, click the
   three dots at the top right → _Cast, save and share_ → **Install page as
   app**. Sniper Journal then gets its own window with no address bar, its own
   icon in the Start menu and on the taskbar, and behaves like any other
   installed program.

### If you skipped the Unblock step

You will see one blue screen saying _Windows protected your PC_ when you run the
installer. Click **More info**, then **Run anyway**. That is the only time: part
of the installer's job is clearing that mark from every file in the folder, so
the desktop icon and the launcher open straight away afterwards.

The warning is not about anything being wrong with the app. Windows shows it for
any script it has not seen signed by a paid-for certificate, which this is not.

The desktop shortcut is created once, on that first run, so if you delete it on
purpose it stays deleted. To get it back — or after moving the folder somewhere
else — double-click `create-shortcut.bat`.

### Running it in the background

The server is the app. It runs hidden, with no console window, and starts when
you sign in to Windows, so <http://localhost:3000> always answers.

| If you want to                 | Double-click                                  |
| ------------------------------ | --------------------------------------------- |
| Open the app                   | the desktop icon, or the installed app's icon |
| Shut it down                   | `stop.bat`                                    |
| Stop it starting with Windows  | `autostart-off.bat`                           |
| Turn that back on              | `autostart-on.bat`                            |
| Watch the server while it runs | `stop.bat`, then `start.bat`                  |

Stopping it never loses anything: your journal is written to disk within a third
of a second of every change.

`start.bat` is the visible version, useful when something is wrong and you want
to read the error. If the background copy is already running, it will say so and
just open the app rather than fighting it for the port.

On macOS or Linux there is no installer: run `./start.sh`, which sets itself up
on the first run. The desktop shortcut is a Windows thing; elsewhere, keep a
bookmark to <http://localhost:3000>.

A black console window stays open while the app runs. Keep it open while you
are using the journal and close it when you are finished.

---

## Where your data lives

| What                    | Where                                         |
| ----------------------- | --------------------------------------------- |
| Your journal            | `data/journal.json`                           |
| Chart screenshots       | `data/screenshots/`                           |
| Automatic daily backups | `data/backups/` (the last 30 are kept)        |
| Manual backups          | wherever you save them, from the profile menu |

`data/journal.json` is plain text. You can copy it, put it in Dropbox or
OneDrive, or move it to another computer. To move your journal, use
**Download a backup** on one machine and **Restore from a backup** in Settings
on the other.

The app saves automatically about a third of a second after every change, and
writes to a temporary file first so a crash can never corrupt your journal. It
also keeps a copy in the browser, so nothing is lost if the server stops while
you are mid-edit.

---

## First steps

1. On first launch you are asked for your name, account name, currency and
   starting balance. The starting balance is what the equity curve and the
   drawdown percentages are measured against.
2. Press **N**, or click **Log trade**, and enter your first trade, by hand or
   from your broker's CSV file.
3. Statistics appear as soon as you have closed trades. The Insights page
   stays quiet until there are at least five, because fewer than that is noise
   rather than a pattern.

### Want to look around first?

Click **Load test data** on the dashboard or in Settings. It generates about
80 realistic trades, marked as test data, and a yellow banner appears with a
one-click **Remove test data** button that deletes only those trades, along with
any chart image you attached to one of them. Your own entries are never touched.

---

## What each page does

| Page                   | What it is for                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**          | Net profit, win rate, profit factor, average R:R, expectancy, SQN, equity curve, daily P&L and your Sniper Score.    |
| **Calendar**           | A month at a glance: each day shows its net P&L and trade count. Click a day to see the trades behind the number.    |
| **The Playbook**       | The setups you allow yourself to trade and their rules, with the real performance of each one underneath.            |
| **Trades**             | The full table, with filters for pair, session, leverage, setup, date, direction and result. Click a row to edit it. |
| **Insights & Signals** | Patterns found in your own trades: your best session, revenge trading, holding losers too long, fee drag, and more.  |
| **Resources**          | Your own shortlist of tools and links.                                                                               |
| **Support**            | How the app works, where your data is, and the keyboard shortcuts.                                                   |
| **Reports**            | A printable summary, month by month and per symbol and setup.                                                        |

---

## Keyboard shortcuts

| Key               | Action              |
| ----------------- | ------------------- |
| `N`               | Log a new trade     |
| `Ctrl + K` or `/` | Jump to search      |
| `Ctrl + Enter`    | Save the trade form |
| `Esc`             | Close a dialog      |

---

## Logging trades accurately

- **Leave the exit price empty** while a position is still open. Open trades are
  kept out of the statistics until you close them.
- **Record a stop loss.** It is what lets the app measure your risk, your R
  multiples and your true reward-to-risk ratio.
- **Futures and forex:** open _Futures, forex and manual P&L_ in the trade form
  and set the contract multiplier. ES is 50, NQ is 20, MES is 5, and one
  standard forex lot is 100,000 units. If it is easier, switch P&L to manual and
  paste the number straight from your broker.
- **The eye icon** in the trades table keeps a trade in your journal but leaves
  it out of every statistic, which is useful for a mistake fill or a test trade.
  It is left out of the account balance too, unless you tick **Count excluded
  trades in the balance** in Settings → Accounts, so the balance matches your
  broker's statement. The statistics leave it out either way.
- **Trades marked "needs details"** are imported rows that are still missing a
  date, a quantity or an entry price. They never count towards a statistic until
  you complete them, so your numbers are never built on half a trade.

### Importing from your broker

Trades → **Import**, or **Log trade** → **From a file**: the same
import, for one trade or a whole history. Log trade remembers which of the two
you used last on this device, so if you log every trade from your broker's
file, it opens on the file. You get a preview of exactly what was understood
before anything is added, and nothing is imported until you confirm.

**Importing the same trades again adds nothing**, so a daily export that
overlaps yesterday's is safe:

- where the file numbers its trades or fills (see paired exports below), those
  numbers decide;
- otherwise a trade with the same account, symbol, side, entry time (to the
  minute) and size as one already in your journal is **left out**. The preview
  lists it, with **Import it anyway** for the rare second trade that really is
  identical;
- a trade your journal still has as open, which the file now closes, is
  imported closed, and the preview asks you to delete the open copy.

**Only a `symbol` column is required.** Everything else is optional. A file
without one, such as TradingView's list of trades, asks you to type the symbol
for every row. Rows that are missing a date, a quantity or an entry price still
import; they are marked **needs details**, kept out of every statistic, and
listed at the top of the Trades page so you can fill the gaps by hand.

**The exports of 30 platforms work as they are** (see
[Which file to export](#which-file-to-export) below), and the preview says
**Recognised:** and the platform when it knows the file. Most other brokers'
files work too: the importer finds the table even when the file opens with a
title or account details, skips total lines and deposits, and recognises the
many ways brokers name their columns (`Qty`, `Filled`, `Market pos.`,
`Comm/Fee`, `Net P&L (USD)`, `Date/Time`, separate date and time columns,
several fee columns that add up, NinjaTrader's column names in French). It
reads files that list:

- **whole trades**, with the entry and exit on one row (NinjaTrader trades,
  MetaTrader, cTrader, TopstepX, Rithmic's performance report, ATAS and most
  journals). Where there is no direction column, a size below zero is a short;
- **individual fills or orders**, one buy or sell per row (NinjaTrader
  executions, Tradovate, Rithmic, Quantower, Sierra Chart, TradingView's order
  history, Interactive Brokers, Thinkorswim, tastytrade, Schwab, Fidelity,
  Webull, Robinhood, Binance, Coinbase and more). These are put back together by
  following your position in each symbol: scaling in and out stays one trade at
  the average price, a fill that takes you from long to short closes one trade
  and opens the next, cancelled orders are left out, and a position still open
  at the end of the file is imported as open;
- **entry and exit rows paired by a trade number** (TradingView's strategy
  tester).

**Numbers and dates are read the way the file writes them.** A file that uses
decimal commas, as most of Europe does (`21000,25`, `0,62 $`), is read that
way throughout, so `1,085` is one and a bit rather than a thousand. Dates that
could go either way (`03/04/2026`) follow the rest of the file; written with
dots (`03.04.2026`), or in a file of decimal commas, they are read day first.

The preview says how it read the file. If something is wrong, change it there:
whether **each row is** a whole trade or one fill, which way round **dates like
03/04/2026** go, and, under **Columns**, what each column is. Your choices are
remembered on this device for the next file with the same columns.

**What one point is worth** comes from a multiplier column if there is one,
otherwise from the amount against the price, or from the P&L the file reports.
Failing all of those, futures are recognised from a full contract code such as
`ESH6` or `MNQ 03-26` (never from a bare `ES`, which is also a stock) and options
count as 100 shares. The preview tells you whenever it worked one out, so you
can check it.

Times that carry a time zone (`Z`, `+02:00`, or a column marked `UTC`, such as
`Date(UTC)` or `DateUtc`) are converted to this device's local time; times
without one are kept as written, and the preview says so. If your platform
writes another zone's time (the exchange's, say), those trades are off by the
difference.

**Paired buy/sell exports** — the format Tradovate and similar futures platforms
produce, with `buyPrice`, `sellPrice`, `boughtTimestamp` and `soldTimestamp` and
no direction column — are handled directly:

- The fill that happened **first** is treated as the entry, which is how the
  direction is worked out. Sold first means it was a short.
- Where the file reports a P&L, the **contract multiplier is derived from it**,
  so a 2-lot MNQ trade comes out at $2 a point and an MES trade at $5, and the
  prices and the P&L stay consistent if you edit either later.
- `buyFillId` and `sellFillId` are remembered, so **re-importing the same export
  adds nothing twice**. Exporting your whole history every week is safe.

### Which file to export

The same list is in the import window, under **Which file to export from your
platform**.

| Platform                    | The export to choose                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **NinjaTrader 8**           | In Trade Performance, display Executions or Trades and generate, then right-click the list and export it as CSV. Any language.                                                                                           |
| **Tradovate**               | The Performance report, or the Orders list, downloaded as CSV.                                                                                                                                                           |
| **TopstepX**                | The Trades or the Orders of your account, exported as CSV.                                                                                                                                                               |
| **Rithmic R \| Trader Pro** | Orders History: choose the account and the day, then export the Completed Orders as CSV, one day at a time. The trade performance report works too.                                                                      |
| **Quantower**               | The Trades history panel, exported as CSV.                                                                                                                                                                               |
| **ATAS**                    | The journal in Statistics, exported to Excel: the .xlsx file imports as it is.                                                                                                                                           |
| **Sierra Chart**            | The Trade Activity Log showing Fills, saved with File > Save Log As.                                                                                                                                                     |
| **TradeStation**            | The Orders report, exported as CSV.                                                                                                                                                                                      |
| **Deepcharts**              | The trade list, exported as CSV.                                                                                                                                                                                         |
| **TradingView**             | Paper Trading or a connected broker: in Order History, tick every column under Column setup, then Download data > Order history. Or the Strategy Tester: List of trades > Download, then type the symbol in the preview. |
| **FTMO**                    | The trading journal of your account in the Client Area, exported as CSV.                                                                                                                                                 |
| **MetaTrader 4 and 5**      | History tab: right-click and save a report. MetaTrader 5's Excel report imports as it is; MetaTrader 4's web-page report opens in Excel, to be saved as CSV. A prop firm's dashboard often exports CSV directly.         |
| **cTrader**                 | History, exported as CSV.                                                                                                                                                                                                |
| **IG**                      | History > Transactions, downloaded as CSV.                                                                                                                                                                               |
| **Interactive Brokers**     | An Activity Statement downloaded as CSV, or a Flex Query of trades in CSV.                                                                                                                                               |
| **Thinkorswim**             | Monitor > Account Statement for the dates you want, exported to a file.                                                                                                                                                  |
| **Charles Schwab**          | The transaction history of the account, exported as CSV.                                                                                                                                                                 |
| **Fidelity**                | Activity & Orders history, downloaded as CSV.                                                                                                                                                                            |
| **E\*TRADE**                | Transactions, downloaded as CSV.                                                                                                                                                                                         |
| **tastytrade**              | History > Transactions, downloaded as CSV.                                                                                                                                                                               |
| **Webull**                  | The order history, exported as CSV.                                                                                                                                                                                      |
| **Robinhood**               | Reports and statements: generate an account activity report.                                                                                                                                                             |
| **TradeZero**               | The trades for a date range, exported as CSV.                                                                                                                                                                            |
| **Trading 212**             | History, exported as CSV.                                                                                                                                                                                                |
| **DEGIRO**                  | Transactions, exported as CSV.                                                                                                                                                                                           |
| **Binance**                 | Orders > Trade History (spot or futures) > Export.                                                                                                                                                                       |
| **Coinbase**                | Statements: the transaction history as CSV; on Advanced, the fills export.                                                                                                                                               |
| **Kraken**                  | History > Export, choosing Trades.                                                                                                                                                                                       |
| **Hyperliquid**             | Trade History, exported as CSV.                                                                                                                                                                                          |
| **TradeZella**              | Your trades, exported as CSV.                                                                                                                                                                                            |

The importer reads **CSV files** (and the tab-separated `.tsv` and `.txt` kind)
and **Excel workbooks** (`.xlsx`). In a workbook with several sheets, the one
that looks most like a list of trades is read, and **Sheet** in the import
window lets you choose another; dates and times kept as Excel dates come
through as they are. An old Excel file (`.xls`) or an export saved as a web
page opens in Excel or Google Sheets, from where **Save as** gives an `.xlsx`
or a CSV. Platforms change their exports from time to time; if a column is
read wrongly, set it under **Columns** in the preview and the choice is
remembered for the next file like it.

### Scaling out: partial fills become one trade

If you open 5 contracts and close them in three pieces, the broker writes three
rows. Left alone that reads as three trades, your trade count is wrong and the
size on each one is only a fraction of the position you actually held.

The import dialog has **Combine partial exits into one trade**, on by default.
Rows that share an entry fill are folded back into a single position:

- the quantities add up, so 2 + 2 + 1 becomes one trade of 5
- entry and exit become **size-weighted averages**, so the price reflects what
  you really paid and really got
- the P&L stays **exactly** the sum of the parts, to the cent
- the hold time runs from the first entry to the last exit
- the row is labelled _3 fills_, so you can always see it was a scale-out

If your broker gives each piece its own entry id, or you want to combine trades
the importer could not see belong together, tick the rows in the Trades table
and choose **Merge into one**. You get a summary of the resulting trade before
anything changes. Merging cannot be undone, but re-importing the original CSV
brings the separate parts back. A trade has one chart, so the merged trade keeps
the earliest part's, and the other parts' chart images are deleted. It also has
one chart link: the earliest part's stays the link, and the other parts' links
are added to its notes, so none is lost. The summary says what happens to each.

Trades can only be merged when they share a symbol, a direction and an account,
and are either all closed or all open — otherwise the result would quietly lose
a realised profit.

### Attaching the chart

Every trade can carry a screenshot of the setup. In the trade form, the **Chart**
box on the right takes an image three ways: click it and pick a file, drag one
in, or just press **Ctrl + V** — screenshot your chart and paste it straight
into the open form, which is by far the quickest. Hover the thumbnail to view it
full size, replace it, or remove it.

Images are saved as ordinary files in `data/screenshots/`, **not** inside
`journal.json`. That keeps the journal file small and quick no matter how many
charts you attach. Large captures are scaled down to 1800px before saving, so a
few hundred charts stay in the tens of megabytes rather than gigabytes.

Two things worth knowing: the JSON backup contains your trades but not the
images, so copy `data/screenshots/` as well when moving to another computer, and
deleting a trade, or an account with its trades, deletes their images with them.
So does **Erase all data**, and restoring a backup deletes the images that the
backup's trades don't use. The copy of the old journal that both keep in your
backups is the journal only: restored later, its trades come back without those
charts.

Images can still be left behind, for example one pasted into a trade form that
was never saved because the app was closed. **Settings → Chart images → Reclaim
unused chart images** finds them and tells you how many there are and how much
space they take before deleting anything. An image is kept while your journal or
any of the copies in `data/backups/` uses it, and for a day after it was added,
in case a trade form open in another window is about to save it. If your journal
or one of the backups can't be read, or is damaged, nothing is deleted and the
message says which file. Files you put in the folder yourself, under names the
app did not give them, are never touched.

If you would rather link to a chart you host elsewhere, such as a TradingView
snapshot, there is still a **Chart link** field under _Futures, forex and manual
P&L_. You can use either, or both.

### Filling in what the broker did not record

A broker export has prices and times but none of the context that makes a
journal useful. Two ways to add it:

- **One trade:** click any row to open it and edit everything, including the
  stop loss, fees and your 1–5 self-ratings.
- **Many at once:** tick several rows, then **Add details**. You can set the
  playbook setup, session, fees and leverage, and add tags or a note across the
  whole selection in one go. Anything you leave untouched stays as it is on each
  trade.

---

## Troubleshooting

**On Android, colours or the layout look wrong.** The app draws its screens
with your phone's "Android System WebView". If that hasn't been updated for a
long time, some screens can look off. Open the Play Store, search for
**Android System WebView**, and update it (and Chrome).

**The window closes immediately.** Node.js is probably not installed. Install it
from <https://nodejs.org> and run `INSTALLER.bat` again.

**"This site can't be reached" / ERR_CONNECTION_REFUSED.** The background server
is not running — usually because something stopped it, or autostart is off. Open
the app from the desktop icon, which starts it again, and refresh.

**A security warning keeps coming back.** Run `INSTALLER.bat` once more — it
clears the download mark from the app's launchers and scripts (`.bat`, `.cmd`,
`.vbs`, `.ps1` and shortcuts). If it still appears, right-click the file, choose
Properties, and tick Unblock.

**"Port 3000 is already in use".** Another program is using that port, or a
previous copy of the app is still running. Close the other console window, or
edit the `dev` and `start` lines in `package.json` to use a different port.
`stop.bat` only stops the Sniper Journal in its own folder: if it says another
program is using port 3000, that program was left running, and it is the one to
close (or a copy of the app in a different folder).

**"This page couldn't be shown" or "Sniper Journal ran into a problem".**
Something in the app went wrong while drawing the screen. Your journal is saved
on its own and the screen doesn't change it. Use **Download a backup** there to
be safe, then **Try again** or reload. If it keeps happening, **Details for a
bug report** at the bottom says what went wrong.

**"This journal was changed in another window".** You had the app open in two
tabs or windows (or two copies of it on one journal), and the other one saved
after this one opened. Rather than write over that work, this window stopped
saving and kept its own version in `data/backups/` as `conflict-<date>.json`.
Press **Reload** to carry on with the journal as it is saved. If the window's
own version was the one you wanted, restore that file from **Settings →
Restore from a backup**.

**The sidebar says "Saved in browser".** The app could not reach its own data
folder, so it is holding your changes in the browser instead. Restart it with
`start.bat`; your work is written to disk as soon as it can be.

**"This browser won't keep a spare copy of your journal".** Every change is
also copied into the browser, in case the app is closed before its save is
done. A journal over about 7,500 trades is too big for that copy, and a browser
whose storage is full or turned off refuses it. Nothing else changes: the
journal file is saved after every change as before. The message is shown once
each time you open the app; **Support** says the same under "Your journal file".

**The sidebar says "Not saved".** The app can't reach its data folder _and_ the
browser can't keep a copy, so your latest changes are only on the screen. Keep
the app open: they are written to disk as soon as the folder can be reached
(restart it with `start.bat` if that doesn't happen). To be safe, use
**Download a backup** in the message at the top of the page.

**The launcher says it has not been set up.** You opened `start.bat` before
`INSTALLER.bat`. Run the installer first.

**Nothing appears in the statistics.** Statistics only count closed trades that
are complete. Check that the trade has an exit price, that it is not marked
_needs details_, and that you have not excluded it with the eye icon.

**An imported trade shows the wrong direction.** In paired buy/sell exports the
direction comes from which fill happened first. If your file has both fills at
the same minute, open the trade and set the side yourself. In a file of single
fills, a sell with nothing open reads as a short; if it actually closed a
position from an earlier export, import the exports together, or fix the trade
by hand.

**The importer did not understand my broker's file.** If your platform is in
[Which file to export](#which-file-to-export), check that the file is the
export named there, saved as CSV. Otherwise open **Columns** in the preview and
say what each column is; the file is read again as you choose, and the choice
is remembered for the next export like it.

---

## Built with

Next.js, React, TypeScript, Tailwind CSS, Recharts and Lucide icons. It runs
entirely on your machine: there is no account, no server and no telemetry, and
it works with your internet disconnected.
