import type { Message } from '../types';

/** Settings: its sections, the mistake list and the tags */
export const settings = {
  'settings.title': 'Settings',
  'settings.description': 'Accounts, currency and your data.',

  'settings.profile': 'Profile and display',
  'settings.currencyHint': 'used for every figure',
  'settings.theme': 'Theme',
  'settings.theme.dark': 'Dark',
  'settings.theme.light': 'Light',
  'settings.placeholders': 'Example text in empty fields',
  'settings.placeholders.clear': 'Clear, easy to read',
  'settings.placeholders.faded': 'Faded, never looks filled in',

  'settings.limits': 'Limits and goals',
  'settings.limitsHint':
    'The daily limits drive the signals on the Insights page. A goal shows on the Dashboard once you give it a target. Leave a box blank to turn it off.',
  'settings.dailyLimits': 'Daily limits',
  'settings.maxLoss': 'Maximum loss in a day',
  'settings.maxTrades': 'Maximum trades in a day',

  'settings.mistakes': 'Mistakes',
  'settings.mistakesHint': 'The ones the trade form offers to tap. Reports work out what each one cost you.',
  'settings.yourMistakes': 'Your mistakes',
  'settings.mistakesEmpty': 'The list is empty, so the trade form offers none.',
  'settings.editList': 'Edit the list',
  'settings.mistakesSaved': 'Mistakes saved',
  'settings.mistakesRenamed': {
    one: 'Mistakes saved, and renamed on {count} trade',
    other: 'Mistakes saved, and renamed on {count} trades',
  },
  'settings.mistakesEditorHint':
    'Renaming one renames it on every trade that has it. Taking one off the list leaves those trades as they are, and Reports still count it.',
  'settings.mistakeN': 'Mistake {n}',
  'settings.mistakePlaceholder': 'e.g. Traded the first minute',
  'settings.removeMistakeN': 'Remove mistake {n}',
  'settings.addMistake': 'Add a mistake',
  'settings.saveMistakes': 'Save mistakes',

  'settings.tags': 'Tags',
  'settings.tagsHint':
    'Every tag on your trades, in every account. Renaming, merging or deleting one changes every trade that has it.',

  'settings.accounts': 'Accounts',
  'settings.accountsHint': 'Each account keeps its own trades, balance and statistics.',
  'settings.accountTrades': { one: '{count} trade', other: '{count} trades' },
  'settings.oneAccountNeeded': 'You need at least one account',
  'settings.deleteThisAccount': 'Delete this account',
  'settings.deleteNamed': 'Delete {name}',
  'settings.addAccount': 'Add an account',
  'settings.deleteAccount.title': 'Delete "{name}"?',
  'settings.deleteAccount.message': {
    one: 'This permanently deletes the account and its {count} trade.',
    other: 'This permanently deletes the account and its {count} trades.',
  },
  'settings.deleteAccount.empty': 'This account has no trades.',
  'settings.deleteAccount.confirm': 'Delete account',
  'settings.accountDeleted': 'Account deleted',
  'settings.countExcluded': 'Count excluded trades in the balance',
  'settings.countExcludedHint':
    "Off: a trade you exclude with the eye icon is left out of the balance as well as the statistics. On: the balance counts it, so it matches your broker's statement. Win rate, net profit, the equity curve and drawdown always leave excluded trades out.",

  'settings.backups': 'Backups',
  'settings.backupsHint':
    'Your journal already saves to disk automatically. These are for moving it, or keeping a copy elsewhere.',
  'settings.restore': 'Restore from a backup',
  'settings.bringOver': 'Bring over from the earlier version',
  'settings.backups.phone':
    'A dated copy is also kept inside the app automatically, once on each day you make changes, and the last 30 are kept. Those copies are deleted along with the app, though, so save a backup to Drive, email or your files now and then. Chart images are not included in the backup.',
  'settings.backups.app':
    'Your journal is in the Sniper Journal folder in your Documents, and stays there if you uninstall the app. A dated copy is also written into the backups folder next to it automatically, once on each day you make changes. The last 30 are kept. Chart images are saved as files in the screenshots folder rather than inside the backup, so copy that folder too if you are moving to another computer.',
  'settings.backups.server':
    'A dated copy is also written into the data/backups folder automatically, once on each day you make changes. The last 30 are kept. Chart images are saved as files in data/screenshots rather than inside the backup, so copy that folder too if you are moving to another computer.',
  'settings.unreadable': 'Could not read that file',
  'settings.restore.title': 'Restore this backup?',
  'settings.restore.message': {
    one: "The backup holds {count} trade. Restoring replaces everything currently in your journal, and deletes the chart images that the backup's trades don't use.",
    other:
      "The backup holds {count} trades. Restoring replaces everything currently in your journal, and deletes the chart images that the backup's trades don't use.",
  },
  'settings.restore.confirm': 'Replace my journal',
  'settings.restored': 'Journal restored. The one it replaced was kept in your backups, without its chart images.',
  'settings.noCopy': 'Could not keep a copy of your current journal first, so nothing was changed.',

  'settings.charts': 'Chart images',
  'settings.chartsHint': 'Images no trade uses any more, such as one pasted into a trade form that was never saved.',
  'settings.reclaim': 'Reclaim unused chart images',
  'settings.reclaimHint':
    'You see how many there are, and how much space they take, before anything is deleted. An image is kept while your journal or any copy in your backups still uses it, and for a day after it was added, in case a trade form open in another window is about to save it.',
  'settings.reclaim.none': 'Every chart image is still in use. There is nothing to reclaim.',
  'settings.reclaim.title': {
    one: 'Delete {count} unused chart image?',
    other: 'Delete {count} unused chart images?',
  },
  'settings.reclaim.message': {
    one: 'No trade in your journal and no copy in your backups uses it. Deleting it frees {size}.',
    other: 'No trade in your journal and no copy in your backups uses them. Deleting them frees {size}.',
  },
  'settings.reclaim.confirm': { one: 'Delete it', other: 'Delete them' },
  'settings.reclaim.done': {
    one: '{size} freed: {count} unused chart image deleted.',
    other: '{size} freed: {count} unused chart images deleted.',
  },
  'settings.reclaim.nothing': 'Nothing was deleted: the images are in use again, or could not be removed.',
  'settings.reclaim.unreachable': 'The app could not reach its data folder, so no chart image was deleted.',

  'settings.testData': 'Test data',
  'settings.testDataHint':
    'Generated trades for trying the app out. They are flagged separately and never mix into your own records.',
  'settings.testDataLoaded': 'Test data loaded',
  'settings.loadTestData': 'Load test data',
  'settings.regenerateTestData': 'Regenerate test data',
  'settings.testTradesLoaded': {
    one: '{count} test trades currently loaded',
    other: '{count} test trades currently loaded',
  },

  'settings.danger': 'Danger zone',
  'settings.dangerHint': 'There is no undo for this.',
  'settings.erase': 'Erase all data',
  'settings.erase.title': 'Erase everything?',
  'settings.erase.message': {
    one: "This permanently deletes your {count} trade and its chart image, your setups, resources and accounts. Download a backup first if you are not certain; backups don't include chart images.",
    other:
      "This permanently deletes all {count} trades and their chart images, your setups, resources and accounts. Download a backup first if you are not certain; backups don't include chart images.",
  },
  'settings.erase.empty':
    "This permanently deletes your setups, resources and accounts. Download a backup first if you are not certain; backups don't include chart images.",
  'settings.erase.confirm': 'Erase my journal',
  'settings.erased': 'Journal erased. A copy of it, without chart images, was kept in your backups.',

  // the tags (TagManager)
  'tags.none': "No tags yet. The ones you type in a trade's form show up here.",
  'tags.alike': 'These look like one tag',
  'tags.merge': 'Merge…',
  'tags.moveToMistakes': 'Move to mistakes…',
  'tags.keepApart': 'Keep apart',
  'tags.keptApart': 'Kept apart',
  'tags.find': 'Find a tag',
  'tags.yours': 'Your tags',
  'tags.noMatch': 'No tag has “{text}” in it.',
  'tags.showFewer': 'Show fewer',
  'tags.showAll': { one: 'Show all {count} tags', other: 'Show all {count} tags' },
  'tags.groups': 'Groups',
  'tags.newGroup': 'New group',
  'tags.groupsHint':
    'Put tags in groups of your own, such as Emotion or Source of the idea. Reports shows a table for each group.',
  'tags.groupEmpty': 'No tags in it yet',
  'tags.editGroup': 'Edit the group {name}',
  'tags.change': 'Change “{tag}”',
  'tags.rename': 'Rename…',
  'tags.mergeInto': 'Merge into…',
  'tags.delete': 'Delete…',

  'tags.delete.title': 'Delete “{tag}”?',
  'tags.delete.message': {
    one: 'It comes off {count} trade, in every account. The trades stay.',
    other: 'It comes off {count} trades, in every account. The trades stay.',
  },
  'tags.delete.confirm': 'Delete tag',
  'tags.deleted': { one: '“{tag}” deleted from {count} trade', other: '“{tag}” deleted from {count} trades' },

  'tags.rename.title': 'Rename “{tag}”',
  'tags.rename.newName': 'New name',
  'tags.rename.action': 'Rename',
  'tags.rename.done': {
    one: 'Renamed on {count} trade, in every account',
    other: 'Renamed on {count} trades, in every account',
  },
  'tags.rename.hint': {
    one: 'It changes on {count} trade, in every account.',
    other: 'It changes on {count} trades, in every account.',
  },
  'tags.rename.mergeHint': {
    one: '“{tag}” is a tag already: the two become one, on {count} trade, in every account. A trade with both keeps it once.',
    other:
      '“{tag}” is a tag already: the two become one, on {count} trades, in every account. A trade with both keeps it once.',
  },
  'tags.merge.action': 'Merge',
  'tags.merge.done': {
    one: 'Merged into “{tag}” on {count} trade, in every account',
    other: 'Merged into “{tag}” on {count} trades, in every account',
  },
  'tags.merge.titleMany': 'Merge these tags',
  'tags.merge.title': 'Merge “{tag}”',
  'tags.merge.keep': 'Keep which spelling',
  'tags.merge.become': {
    one: 'They become one tag on {count} trade, in every account.',
    other: 'They become one tag on {count} trades, in every account.',
  },
  'tags.merge.into': 'Into',
  'tags.merge.intoHint': {
    one: '“{tag}” comes off {count} trade and the tag you pick goes on in its place. A trade with both keeps it once.',
    other:
      '“{tag}” comes off {count} trades and the tag you pick goes on in its place. A trade with both keeps it once.',
  },
  'tags.merge.noOther': 'There is no other tag to merge it into.',
  'tags.move.title': 'Move to mistakes',
  'tags.move.done': {
    one: 'Moved to the mistakes as “{mistake}” on {count} trade, in every account',
    other: 'Moved to the mistakes as “{mistake}” on {count} trades, in every account',
  },
  'tags.move.bodyMany': {
    one: 'These tags come off {count} trade, in every account, and each of them gets the mistake instead. Reports then count those trades in what the mistake cost.',
    other:
      'These tags come off {count} trades, in every account, and each of them gets the mistake instead. Reports then count those trades in what the mistake cost.',
  },
  'tags.move.body': {
    one: '“{tag}” comes off {count} trade, in every account, and each of them gets the mistake instead. Reports then count those trades in what the mistake cost.',
    other:
      '“{tag}” comes off {count} trades, in every account, and each of them gets the mistake instead. Reports then count those trades in what the mistake cost.',
  },
  'tags.move.mistake': 'The mistake',
  'tags.move.newMistake': 'A new mistake…',
  'tags.move.name': 'Its name',
  'tags.move.nameHint': 'joins your list',

  'tags.group.nameIt': 'Name the group',
  'tags.group.taken': 'There is a group with that name',
  'tags.group.made': 'Group made',
  'tags.group.saved': 'Group saved',
  'tags.group.edit': 'Edit “{name}”',
  'tags.group.hint': 'A tag is in one group at most. Reports shows a table for each group.',
  'tags.group.delete': 'Delete group',
  'tags.group.save': 'Save group',
  'tags.group.name': 'Name',
  'tags.group.namePlaceholder': 'e.g. Emotion',
  'tags.group.tags': 'Its tags',
  'tags.group.inOther': 'in {name}',
  'tags.group.unused': 'no trades',
  'tags.group.noTags': 'No tags yet. Tag a trade first, then put its tags here.',
  'tags.group.delete.title': 'Delete the group “{name}”?',
  'tags.group.delete.message': 'Its tags stay on your trades; only the group goes, and its table in Reports.',
  'tags.group.deleted': 'Group deleted',
} satisfies Record<string, Message>;
