import type { Message } from '../types';

/**
 * The Support page: the journal file's state, the shortcuts, and the common
 * questions as the browser version, the Windows app (.app) and the phone app
 * (.phone) each answer them. A command, an address or a broker's column name
 * goes in as a placeholder, as it is typed.
 */
export const support = {
  'sup.description': 'How Sniper Journal works, and where your data lives.',

  'sup.file.title': 'Your journal file',
  // what happened to the latest changes, by save state; .app in an app, .web in the browser
  'sup.file.errorLost.app':
    "The journal file could not be read when the app started, so it is being left exactly as it is rather than saved over. The app can't keep your changes either ({why}), so changes made now are not saved anywhere. Download a backup before you close the app, then close and reopen it to try again.",
  'sup.file.errorLost.web':
    "The journal file could not be read when the app started, so it is being left exactly as it is rather than saved over. This browser can't keep your changes either ({why}), so changes made now are not saved anywhere. Download a backup before you close the app, then close and reopen it to try again.",
  'sup.file.error.app':
    'The journal file could not be read when the app started, so it is being left exactly as it is rather than saved over. Your changes are kept temporarily for now. Close and reopen the app to try again. If this keeps happening, restore your latest backup in Settings.',
  'sup.file.error.web':
    'The journal file could not be read when the app started, so it is being left exactly as it is rather than saved over. Your changes are kept in this browser for now. Close and reopen the app to try again. If this keeps happening, restore your latest backup in Settings.',
  'sup.file.conflict':
    'Another tab, window or copy of the app saved the journal after this window opened it, so this window stopped saving rather than writing over that work. Its own version was kept as a copy in your backups. Reload to carry on.',
  'sup.file.browser.app':
    'The app cannot write its file right now, so changes are being kept temporarily. They will be written as soon as it can.',
  'sup.file.browser.web':
    'The app cannot reach its file right now, so changes are being kept in this browser only. They will be written to disk as soon as it is reachable again.',
  'sup.file.unsaved.app':
    "The app cannot write its file right now and can't keep a temporary copy either ({why}), so your latest changes are not saved anywhere yet. Keep the app open: they will be written as soon as it can. To be safe, save a backup.",
  'sup.file.unsaved.web':
    "The app cannot reach its file right now and this browser can't keep a copy either ({why}), so your latest changes are not saved anywhere yet. Keep the app open: they will be written to disk as soon as the file is reachable again. To be safe, download a backup.",
  'sup.file.saved': 'Saved automatically a moment after every change.',
  'sup.file.savedNoCopy':
    'Saved automatically a moment after every change. The spare copy in this browser is off: {why}.',

  'sup.private.pc': 'Nothing leaves this PC',
  'sup.private.phone': 'Nothing leaves this phone',
  'sup.privateText.pc':
    'There is no account, no server and no telemetry. The app only talks to its own folder on this machine, which is why it keeps working with the network off.',
  'sup.privateText.phone':
    'There is no account, no server and no telemetry. The app only talks to its own folder on this phone, which is why it keeps working with the network off.',

  'sup.shortcuts': 'Shortcuts',
  'sup.key.newTrade': 'Log a new trade',
  'sup.key.search': 'Jump to search',
  'sup.key.saveForm': 'Save the trade form',
  'sup.key.closeDialog': 'Close a dialog',
  // two keys that do the same, as they are written on the keyboard
  'sup.key.either': '{first}  or  {second}',

  'sup.faq': 'Common questions',
  'sup.q.where': 'Where exactly is my data kept?',
  'sup.a.where':
    'In a plain JSON file at data/journal.json inside the Sniper Journal folder on this PC. Nothing is uploaded anywhere, and the app works with your internet disconnected. A copy is also mirrored into this browser so your work survives if the app is closed mid-edit, as long as the journal fits in the browser (up to about {max} trades).',
  'sup.a.where.phone':
    'In the app’s own private storage on this phone. Nothing is uploaded anywhere, there is no account, and the app works with the network off. Other apps cannot read it, and uninstalling the app deletes it, so save a backup somewhere else now and then.',
  'sup.a.where.app':
    'In a plain JSON file, journal.json, in the Sniper Journal folder in your Documents. The app uploads nothing and works with your internet disconnected (if OneDrive backs up your Documents, it backs up the journal too). The folder stays when you uninstall the app, so reinstalling picks your journal up again.',
  'sup.q.broken': 'What happens if I break something?',
  'sup.a.broken':
    'Every day that you make a change, the previous version of the file is copied into data/backups before the new one is written. The last 30 daily copies are kept. You can also download a backup at any time from your profile menu, and restore it from Settings.',
  'sup.a.broken.phone':
    'Every day that you make a change, the previous version of your journal is copied aside inside the app before the new one is written, and the last 30 daily copies are kept. You can also save a backup at any time from More → Back up your journal, and restore it from Settings.',
  'sup.a.broken.app':
    'Every day that you make a change, the previous version of the file is copied into the backups folder next to it before the new one is written. The last 30 daily copies are kept. You can also save a backup at any time from your profile menu, and restore it from Settings.',
  'sup.q.missing': 'Why is a trade missing from my statistics?',
  'sup.a.missing':
    'Statistics only count closed trades, so anything without an exit price or a manual P&L is left out until you close it. Trades you marked with the eye icon are also deliberately excluded while staying in the journal.',
  'sup.q.futures': 'How do I log futures or forex properly?',
  'sup.a.futures':
    'Open the "Futures, forex and manual P&L" section in the trade form and set the contract multiplier: ES is 50, NQ is 20, MES is 5, and one standard forex lot is {lot} units. If it is easier, switch P&L to manual and paste the figure from your broker instead.',
  'sup.q.rMultiple': 'What counts as an R multiple?',
  'sup.a.rMultiple':
    'Your result divided by the money you had at risk between entry and stop loss. Trades logged without a stop cannot be measured in R, which is why the risk and R:R statistics ask you to record one.',
  'sup.q.window': 'Do I need to keep a window open for this to work?',
  'sup.a.window':
    'Yes, the one where you ran {start} (or {dev}): that is the server, and the page needs it. Nothing is lost by stopping it, because your journal is written to disk within a third of a second of every change.',
  'sup.a.window.app':
    'Only while you use it. Every change is written to disk within a third of a second, and closing the window waits for the last one, so nothing is lost when you close it.',
  'sup.q.ownWindow': 'Can I open it in its own window instead of a browser tab?',
  'sup.a.ownWindow':
    'Yes. In Chrome, click the three dots at the top right, choose Cast, save and share, then Install page as app. Sniper Journal gets its own window with no address bar, plus an icon in the Start menu and on the taskbar. It is the same app either way, using the same journal file.',
  'sup.q.computers': 'Can I run this on more than one computer?',
  'sup.q.computers.phone': 'Can I use it on more than one device?',
  'sup.a.computers':
    'Each installation keeps its own file. To move your journal, download a backup from one machine and restore it on the other from Settings.',
  'sup.a.computers.phone':
    'Each phone and each computer keeps its own journal. To move yours, save a backup on one device and restore it on the other from Settings.',
  'sup.a.computers.app':
    'Each computer keeps its own journal. To move yours, save a backup on one computer and restore it on the other from Settings, and copy the screenshots folder across for its chart images.',
  'sup.q.bringOver': 'I used the earlier version. How do I bring my journal over?',
  'sup.a.bringOver':
    'In Settings, under Backups, choose Bring over from the earlier version, then pick the folder you installed it in (the one with INSTALLER.bat). Your trades and chart images are copied over, and the old folder is left exactly as it was.',

  'sup.import.title': 'Importing from your broker',
  'sup.import.text':
    'Open Trades and choose Import. The exports of 30 platforms, CSV or Excel, import as they come, and the import window says which file to export from each. For anything else, download the template to see the column names: common broker headings such as {qty}, {ticker}, {commission} and {pnl} are recognised automatically, and any rows that cannot be read are listed before you commit the import.',
  'sup.open.title': 'Opening the app',
  'sup.open.text':
    'This is the version served from the project folder: run {start} there ({dev} while you edit the code), then open {url}. The Windows app from the Microsoft Store and the Android app open like any other app.',
} satisfies Record<string, Message>;
