import type { Message } from '../types';

/**
 * Around every page: the sidebar and the phone's tab bar, the header, the
 * search, the account and clock menus, the first-run dialog, the notices
 * about saving, and the screens shown when something breaks.
 */
export const shell = {
  'nav.main': 'Main',
  'nav.dashboard': 'Dashboard',
  'nav.calendar': 'Calendar',
  'nav.playbook': 'The Playbook',
  'nav.trades': 'Trades',
  'nav.insights': 'Insights & Signals',
  'nav.insightsTab': 'Insights',
  'nav.resources': 'Resources',
  'nav.support': 'Support',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',
  'nav.more': 'More',

  'save.saving': 'Saving…',
  'save.unsaved': 'Not saved',
  'save.error': 'Journal file unreadable',
  'save.conflict': 'Changed elsewhere',
  'save.savedDevice': 'Saved on this device',
  'save.savedTemporarily': 'Saved temporarily',
  'save.savedDisk': 'Saved to disk',
  'save.savedBrowser': 'Saved in browser',

  'shell.opening': 'Opening your journal',
  'shell.allAccounts': 'All accounts',
  'shell.portfolio': 'Portfolio',
  'shell.theme': 'Colour theme',
  'shell.theme.dark': 'dark',
  'shell.theme.light': 'light',
  'shell.online': 'Online',
  'shell.offline': 'Offline',
  'shell.storedWhere': 'Where your journal is stored',
  'shell.testBanner': {
    one: 'Test data is loaded ({count} generated trades).',
    other: 'Test data is loaded ({count} generated trades).',
  },
  'shell.testBannerHint': ' Remove it before you start logging real trades.',
  'shell.remove': 'Remove',
  'shell.removeTail': ' test data',
  'shell.newer.title': 'This journal needs a newer Sniper Journal',
  'shell.newer.body':
    "It was last saved by a newer version of the app, which keeps things this one doesn't know about. Opening it here could lose them, so it was left as it is: nothing in it has been changed.",
  'shell.newer.update': 'Update Sniper Journal, then open it again.',

  'header.logTradeTitle': 'Log a trade (N)',
  'header.logTradeLabel': 'Log a trade',
  'header.logTrade': 'Log trade',

  'search.open': 'Open search',
  'search.placeholder': 'Search symbols, tags, notes, setups',
  'search.label': 'Search all trades',
  'search.none': 'No trades match that search.',
  'search.showAll': 'Show all matches in Trades',

  'accounts.heading': 'Accounts',
  'accounts.new': 'New account',
  'accounts.manage': 'Manage accounts',
  'accounts.nameRequired': 'Give the account a name',
  'accounts.create': 'Create account',

  'profile.menu': 'Profile menu',
  'profile.trader': 'Trader',
  'profile.storedPhone': 'Journal stored on this device',
  'profile.storedPc': 'Journal stored on this PC',
  'profile.downloadBackup': 'Download backup',
  'profile.help': 'Help & shortcuts',

  'clock.heading': 'Clock timezone',
  'clock.local': 'Local time',
  'clock.localShort': 'Local',
  'clock.newYork': 'New York',
  'clock.london': 'London',
  'clock.tokyo': 'Tokyo',

  'welcome.title': 'Set up your journal',
  'welcome.savedPhone': 'Everything you enter is saved on this phone.',
  'welcome.savedPc': 'Everything you enter is saved on this computer.',
  'welcome.phoneWarning':
    'Your journal lives only inside this app. Uninstalling it deletes your trades, so back it up now and then from <b>More → Back up your journal</b>.',
  'welcome.bringOver':
    'Used Sniper Journal before, from its own folder with INSTALLER.bat? <link>Bring your journal over</link> and carry on where you left off.',
  'welcome.defaultAccount': 'Main Portfolio',
  'welcome.balanceHint': 'used for the equity curve and drawdown',
  'welcome.explore': 'Explore with test data first',
  'welcome.start': 'Start journalling',
  'welcome.sampleLoaded': 'Test data loaded. Remove it any time from the banner at the top.',

  'conflict.title': 'This journal was changed in another window',
  'conflict.download': "Download this window's version",
  'conflict.reload': 'Reload',
  'conflict.body':
    "Another tab, window or copy of Sniper Journal saved the journal after this window opened it. So that its work isn't written over, this window has stopped saving.",
  'conflict.keeping': "Keeping a copy of this window's version…",
  'conflict.kept': "This window's version, with the changes made here, was kept as a copy:",
  'conflict.keptOpen': 'If it is the one you want, open it with <b>Settings → Restore from a backup</b>.',
  'conflict.notKept':
    "This window's version could not be kept as a copy. Download it before you reload, or the changes made in this window are lost.",
  'conflict.reloadHint': 'Reload to carry on with the journal as it is saved now.',

  'copy.why.tooBig': 'the journal is too large for it',
  'copy.why.refused': 'its storage is full or turned off',
  'copy.offTooBig':
    'Your journal is now too large for this browser to keep its spare copy. Nothing else changes: it is still saved to the journal file a moment after every change.',
  'copy.off':
    "This browser won't keep a spare copy of your journal ({why}). Nothing else changes: it is still saved to the journal file a moment after every change.",
  'copy.lostErrorNative':
    "The journal file couldn't be read when the app started, and the app can't keep your changes either ({why}), so changes made now aren't saved anywhere. Download a backup before you close the app.",
  'copy.lostErrorWeb':
    "The journal file couldn't be read when the app started, and this browser can't keep your changes either ({why}), so changes made now aren't saved anywhere. Download a backup before you close the app.",
  'copy.lostNative':
    "Your latest changes aren't saved anywhere yet: the app can't write its file right now and can't keep a temporary copy ({why}). They are written as soon as the file can be. To be safe, download a backup before you close the app.",
  'copy.lostWeb':
    "Your latest changes aren't saved anywhere yet: the journal file can't be reached and this browser can't keep a copy ({why}). They are written as soon as the file can be. To be safe, download a backup before you close the app.",
  'recovered.body':
    'Changes from another window that never reached the journal file were made on top of an older version, so they were kept as a copy instead of being opened: <path>{path}</path>',

  'error.title': "This page couldn't be shown",
  'error.body':
    'Something went wrong while drawing it. Nothing was lost: your journal is saved on its own, and only this page failed. Try it again, or carry on elsewhere in the app.',
  'error.retry': 'Try again',
  'error.dashboard': 'Go to the dashboard',
  'error.details': 'Details for a bug report',
  'error.noMessage': 'No message',
  'error.app.title': 'Sniper Journal ran into a problem',
  'error.app.body':
    "Something went wrong and the app couldn't carry on. Your journal is still saved where it was: nothing on this screen changes it. Try again, or download a backup first to be safe.",
  'error.app.reload': 'Reload the app',
  'error.app.reading': 'Reading your journal…',
  'error.app.holds': { one: 'The backup holds {count} trade.', other: 'The backup holds {count} trades.' },
  'error.app.nothing': 'No journal could be read, so there is nothing to download from here.',
} satisfies Record<string, Message>;
