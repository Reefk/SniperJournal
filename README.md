# Sniper Journal

A trading journal and performance analytics dashboard that runs on your own PC.
You enter the trades. Nothing is uploaded anywhere, and there is no sample data
unless you explicitly ask for it.

---

## Setting it up (once)

1. **Install Node.js.** Get the LTS version from <https://nodejs.org> and accept
   the default options in the installer.
2. **Unzip this folder** somewhere permanent, such as `C:\SniperJournal`.
   Your journal file lives inside it, so avoid the Downloads folder.
3. **Double-click `start.bat`.** The first run installs the components it needs
   and takes a few minutes. Later runs start in a couple of seconds.
4. Your browser opens at <http://localhost:3000>.

On macOS or Linux, run `./start.sh` instead.

A black console window stays open while the app runs. Keep it open while you
are using the journal and close it when you are finished.

---

## Where your data lives

| What | Where |
| --- | --- |
| Your journal | `data/journal.json` |
| Automatic daily backups | `data/backups/` (the last 30 are kept) |
| Manual backups | wherever you save them, from the profile menu |

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
2. Press **N**, or click **Log trade**, and enter your first trade.
3. Statistics appear as soon as you have closed trades. The AI Insights page
   stays quiet until there are at least five, because fewer than that is noise
   rather than a pattern.

### Want to look around first?

Click **Load test data** on the dashboard or in Settings. It generates about
80 realistic trades, marked as test data, and a yellow banner appears with a
one-click **Remove test data** button that deletes only those trades. Your own
entries are never touched.

---

## What each page does

| Page | What it is for |
| --- | --- |
| **Dashboard** | Net profit, win rate, profit factor, average R:R, expectancy, SQN, equity curve, daily P&L and your Sniper Score. |
| **Calendar** | A month at a glance: each day shows its net P&L and trade count. Click a day to see the trades behind the number. |
| **The Playbook** | The setups you allow yourself to trade and their rules, with the real performance of each one underneath. |
| **Trades** | The full table, with filters for pair, session, leverage, setup, date, direction and result. Click a row to edit it. |
| **AI Insights & Signals** | Patterns found in your own trades: your best session, revenge trading, holding losers too long, fee drag, and more. |
| **Resources** | Your own shortlist of tools and links. |
| **Support** | How the app works, where your data is, and the keyboard shortcuts. |
| **Reports** | A printable summary, month by month and per symbol and setup. |

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `N` | Log a new trade |
| `Ctrl + K` or `/` | Jump to search |
| `Ctrl + Enter` | Save the trade form |
| `Esc` | Close a dialog |

---

## Logging trades accurately

- **Leave the exit price empty** while a position is still open. Open trades are
  kept out of the statistics until you close them.
- **Record a stop loss.** It is what lets the app measure your risk, your R
  multiples and your true reward-to-risk ratio.
- **Futures and forex:** open *Futures, forex and manual P&L* in the trade form
  and set the contract multiplier. ES is 50, NQ is 20, MES is 5, and one
  standard forex lot is 100,000 units. If it is easier, switch P&L to manual and
  paste the number straight from your broker.
- **The eye icon** in the trades table keeps a trade in your journal but leaves
  it out of every statistic, which is useful for a mistake fill or a test trade.
- **Trades marked "needs details"** are imported rows that are still missing a
  date, a quantity or an entry price. They never count towards a statistic until
  you complete them, so your numbers are never built on half a trade.

### Importing from your broker

Trades → **Import CSV**. You get a preview of exactly what was understood before
anything is added, and nothing is imported until you confirm.

**Only a `symbol` column is required.** Everything else is optional. Rows that
are missing a date, a quantity or an entry price still import; they are marked
**needs details**, kept out of every statistic, and listed at the top of the
Trades page so you can fill the gaps by hand.

Column names are matched loosely, so common broker headings such as `qty`,
`ticker`, `commission` and `realized pnl` work without editing the file.

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

**The window closes immediately.** Node.js is probably not installed. Install it
from <https://nodejs.org> and try again.

**"Port 3000 is already in use".** Another program is using that port, or a
previous copy of the app is still running. Close the other console window, or
edit the `dev` and `start` lines in `package.json` to use a different port.

**The sidebar says "Saved in browser".** The app could not reach its own data
folder, so it is holding your changes in the browser instead. Restart it with
`start.bat`; your work is written to disk as soon as it can be.

**Nothing appears in the statistics.** Statistics only count closed trades that
are complete. Check that the trade has an exit price, that it is not marked
*needs details*, and that you have not excluded it with the eye icon.

**An imported trade shows the wrong direction.** In paired buy/sell exports the
direction comes from which fill happened first. If your file has both fills at
the same minute, open the trade and set the side yourself.

---

## Built with

Next.js, React, TypeScript, Tailwind CSS, Recharts and Lucide icons. It runs
entirely on your machine: there is no account, no server and no telemetry, and
it works with your internet disconnected.
