# Microsoft Store listing — Sniper Journal

Copy each block into Partner Center → **Apps and games → SniperJournal**. The
limits are Microsoft's; every block here fits inside them (checked by
character count, not by eye). Artwork is in `assets/microsoft-store/`.

The package to upload is `src-tauri/target/msix/SniperJournal_<version>_x64.msix`
from `npm run package:desktop`, **unsigned**: the Store signs it.

---

## Store listing (English)

### Product name

**SniperJournal**, the name reserved in Partner Center ("Sniper Journal" with a
space was taken). The package's `Properties/DisplayName` has to be a reserved
name, so it says `SniperJournal`; the Start menu and the window title still say
"Sniper Journal".

### Description (10,000 characters max, plain text, no links)

```
Sniper Journal is a trading journal that turns the trades you log into the numbers that show whether you actually have an edge. Everything stays on your PC: no account, no sign-up, no ads, and the app makes no internet connections at all.

LOG EVERY TRADE PROPERLY
• Symbol, long or short, entry and exit time and price, size
• Stop loss and take profit, so risk, R multiples and reward-to-risk are measured
• Fees, leverage, trading session, playbook setup, tags and notes
• A screenshot of the chart, saved with the trade: paste it with Ctrl+V or drop the file in
• Rate your discipline, execution and patience from 1 to 5
• Futures and forex: set the contract multiplier, or enter the P&L by hand
• Leave the exit empty while a position is open; it stays out of your stats until you close it

SEE WHAT YOUR TRADING IS REALLY DOING
• Net profit, win rate, profit factor and average risk-to-reward
• Expectancy, system quality (SQN), commissions paid, streaks, best and worst day
• Equity curve with maximum drawdown
• Daily P&L chart
• Sniper Score: seven axes, from win rate and consistency to your own discipline ratings
• View the last 7, 30 or 90 days, year to date, or all time

PERFORMANCE CALENDAR
Every day's net P&L at a glance. Click a day to see the trades behind the number.

INSIGHTS AND SIGNALS
Patterns found in your own trades, explained in plain language: your most profitable session, the weekday that costs you, whether the trade after a loss performs worse, whether you hold losers longer than winners, and which tags lose money. Set a daily loss limit or a maximum number of trades and get a warning as you approach it.

YOUR PLAYBOOK
Write down the setups you allow yourself to trade and the rules that make each one valid, then see how every setup actually performs.

TRADES, FILTERS AND REPORTS
• Search and filter by symbol, session, setup, leverage, date, direction and result
• Add the same details to many trades at once
• Merge partial exits back into one position, with the P&L exact to the cent
• Exclude a trade from the statistics without deleting it
• Reports month by month and by symbol, setup and weekday, ready to print

IMPORT FROM YOUR BROKER
Import a CSV export and preview exactly what was understood before anything is added. Common broker column names are recognised, and paired buy/sell exports such as Tradovate's are supported: the fill IDs are remembered, so importing your history again never adds the same fill twice. Export your trades to CSV at any time.

SEVERAL ACCOUNTS
Keep a live account, a prop firm challenge and a practice account apart, or view them all together.

MADE FOR THE KEYBOARD
Press N to log a trade, Ctrl+K to search everything, and Ctrl+Enter to save.

PRIVATE BY DESIGN
• No account and no sign-up
• No ads, no analytics, no tracking
• The app makes no internet connections and works with your internet switched off
• Your journal is one plain file in the Sniper Journal folder in your Documents, where you can see it, copy it and back it up like any other document
• Every day you make a change, the previous version is copied to a backups folder first, and the last 30 are kept
• Save a backup file whenever you like, and restore it on this PC or another one
• Uninstalling the app leaves your journal where it is, so reinstalling picks it up again

COMING FROM THE EARLIER VERSION?
If you used the Sniper Journal you installed with INSTALLER.bat, bring your journal and chart images over from Settings in one step. The old folder is left exactly as it was.

TRY IT FIRST
Not ready to enter your own trades? Load a set of test trades to explore every screen, then remove them with one click. Your own entries are never touched.

Dark and light themes are included.

Sniper Journal is a record-keeping and analysis tool. It does not place trades, connect to brokers, or give investment advice, and nothing in it is a recommendation to buy or sell anything.
```

### What's new in this version

Leave empty for the first submission (Microsoft's own advice). From the second
release on, describe the changes here (1,500 characters max).

### Product features (up to 20, 200 characters each; the Store adds the bullets)

```
Log trades with stop, target, fees, setup, tags, notes and a chart screenshot
Win rate, profit factor, expectancy, SQN and average reward-to-risk, worked out for you
Equity curve with maximum drawdown, and a daily P&L chart
Performance calendar with every day's net P&L
Insights found in your own trades, explained in plain language
A playbook of your setups, with how each one actually performs
Import broker CSV exports, with a preview before anything is added
Reports by month, symbol, setup and weekday, ready to print or export to CSV
Several accounts, kept apart or viewed together
Rate your discipline, execution and patience on every trade
Your journal is a plain file in your Documents folder, and nothing is uploaded
A daily backup, kept automatically for the last 30 days
No account, no ads, no tracking, and it works offline
Test trades to explore with, removed in one click
Dark and light themes
```

### Short description (1,000 max; the Store shows the first 270)

```
A private trading journal for your PC. Log every trade, then see your real win rate, profit factor, expectancy and equity curve. No account, no cloud, no ads: your journal is a file in your Documents folder and never leaves your computer.
```

### Screenshots (desktop: PNG, 1366 × 768 to 3840 × 2160, up to 10)

All seven are **2560 × 1440**, from `assets/microsoft-store/screenshots/`,
taken from the Windows app with its generated test trades (no real trades).
`npm run build:desktop && npm run screenshots:store` takes them again. Upload
them in this order, each with its caption (200 characters max):

| File                    | Caption                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `01-dashboard.png`      | Net profit, win rate, profit factor and your equity curve, worked out from the trades you log |
| `02-trades.png`         | Every trade with its setup, R multiple and tags. Filter by symbol, session, setup and result  |
| `03-trade.png`          | Log a trade with its stop, target, fees and chart, and rate your own discipline               |
| `04-insights.png`       | Patterns found in your own trades, each with the number behind it                             |
| `05-reports.png`        | Results, consistency and risk, month by month and by symbol. Print it or export to CSV        |
| `06-calendar-light.png` | Every day's net P&L at a glance, here in the light theme. Click a day for its trades          |
| `07-playbook.png`       | Write down the setups you allow yourself to trade, then see which ones pay                    |

### Store logos

- **1:1 App tile icon (300 × 300):** `assets/microsoft-store/app-tile-icon-300.png`.
  Microsoft strongly recommends it; without it the Store uses the package's
  logo.
- 2:3 poster art and 1:1 box art: leave empty. They are for games and Xbox.
- Trailers, 16:9 super hero art: optional, none for now.

---

## Properties

| Field                     | Answer                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Category                  | **Personal finance** → Banking + investments (secondary category: Productivity)                                               |
| Personal information      | **No**, it does not access, collect or transmit personal information. Give the privacy policy URL anyway (see below)          |
| Privacy policy URL        | the public address where `docs/privacy-policy.md` is hosted (the same one as for Google Play)                                 |
| Website                   | optional                                                                                                                      |
| Support contact info      | _your address_ (or a support web page); the Store shows it publicly                                                           |
| Product declarations      | Untick **Windows can include this product's data in automatic backups to OneDrive** (see below). Leave the others as they are |
| Accessibility declaration | **Don't tick.** It is only for apps tested with Narrator, high contrast and the other accessibility tools                     |
| Generative AI declaration | **Don't tick.** The insights are fixed rules worked out from your trades; no AI model is involved                             |
| System requirements       | leave empty: no special hardware                                                                                              |

The OneDrive box only covers the app's own hidden data (the WebView's cache);
the journal itself is in Documents. Unticking it keeps the promise that the app
copies nothing anywhere, as on Android, where cloud backup is switched off.

## Age ratings (the IARC questionnaire)

Choose the app type **"All other app types"** (not a game, not social), then
answer **No** to every question:

- violence, fear, sexual content, language, drugs or crude humour: No
- gambling, real or simulated: No (the app records trades; it doesn't let anyone bet or trade)
- users interacting or sharing content: No
- sharing the user's location: No
- digital purchases: No
- unrestricted internet access: No. Links open in the user's own browser; the app has no browser of its own

The result should be the lowest rating everywhere (IARC 3+, ESRB Everyone, PEGI 3).

## Pricing and availability

- Price: **Free**. No trial, no add-ons
- Markets: all
- Visibility: public
- Device families: **Windows 10/11 Desktop** only. Untick Xbox, Holographic and Team

## Submission options

### Restricted capabilities: why the app needs runFullTrust

```
Sniper Journal is a desktop (Win32) app built with Tauri: a native executable that shows its interface in Microsoft Edge WebView2. It is packaged as a full-trust desktop app, and runFullTrust is what every packaged desktop executable needs to run. The app declares no other capabilities.

What it does with it:
- It reads and writes the user's trading journal in Documents\Sniper Journal: journal.json, a backups folder with one copy per day, and a screenshots folder for chart images. The folder is in Documents rather than in the package's own app data so the user can see, copy and back up the file like any other document, and so the journal stays when the app is uninstalled.
- It shows Windows' Save As dialog when the user saves a backup of the journal, and the Open dialog when the user restores one or attaches a chart image.
- Only when the user asks: it reads the journal from the folder of the earlier, unpackaged version of the app, which the user picks in a folder dialog, and copies it into Documents\Sniper Journal. The old folder is not changed.
- It opens links the user clicks in the user's default browser.

The app itself checks every file path, so it can only open those few files inside its own folder. It makes no network connections, starts nothing at sign-in, runs no services or background tasks, installs no drivers, and changes nothing in Windows or in other apps.
```

### Notes for certification

```
No account or sign-in is needed, and the app works offline.

To see every screen, click "Explore with test data first" on the welcome screen. That loads a set of generated test trades; "Remove test data" in the banner at the top, or in Settings, deletes them again.

The journal is kept in Documents\Sniper Journal. By design, uninstalling the app leaves that folder in place, so a reinstall finds the journal again.

The app needs the Microsoft Edge WebView2 Runtime. It is part of Windows 11, and Windows Update installs it on Windows 10.
```

---

Wording rules followed above, as in the Play listing, so a reviewer has nothing
to object to: no claims of being "the best" or "#1", no promises of profit, no
features the app does not have, and "insights" rather than "AI", because the
analysis is rule-based calculation on your own trades. No links in the
description: Microsoft wants those in their own fields.
