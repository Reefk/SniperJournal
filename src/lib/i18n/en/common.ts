import type { Message } from '../types';

/** words and sentences more than one screen uses */
export const common = {
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.ok': 'OK',
  'common.close': 'Close',
  'common.save': 'Save',
  'common.add': 'Add',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.optional': 'optional',
  'common.trades': { one: '{count} trade', other: '{count} trades' },
  'common.keptHere': 'Your journal is kept here:',
  'common.downloadBackup': 'Download a backup',
  'common.backUpJournal': 'Back up your journal',
  'common.backupDownloaded': 'Backup downloaded',
  'common.yourName': 'Your name',
  'common.namePlaceholder': 'Shown in the header',
  'common.currency': 'Currency',
  'common.language': 'Language',
  'common.accountName': 'Account name',
  'common.startingBalance': 'Starting balance',
  'common.accountPlaceholder': 'e.g. Prop firm challenge',
  'common.accountCreated': 'Account "{name}" created',
  'common.removeTestData.title': 'Remove test data?',
  'common.removeTestData.message': {
    one: 'This deletes the {count} generated test trades, any chart images you attached to them, and the test playbook setups. Trades you entered yourself are kept.',
    other:
      'This deletes the {count} generated test trades, any chart images you attached to them, and the test playbook setups. Trades you entered yourself are kept.',
  },
  'common.removeTestData.confirm': 'Remove test data',
  'common.testDataRemoved': 'Test data removed',
} satisfies Record<string, Message>;
