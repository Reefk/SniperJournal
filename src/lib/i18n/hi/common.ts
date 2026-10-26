import type { common as en } from '../en/common';
import type { Translation } from '../types';

export const common: Translation<typeof en> = {
  'common.cancel': 'रद्द करें',
  'common.confirm': 'पुष्टि करें',
  'common.ok': 'ठीक है',
  'common.close': 'बंद करें',
  'common.save': 'सहेजें',
  'common.add': 'जोड़ें',
  'common.edit': 'बदलें',
  'common.delete': 'हटाएँ',
  'common.optional': 'वैकल्पिक',
  'common.trades': { one: '{count} ट्रेड', other: '{count} ट्रेड' },
  'common.keptHere': 'आपका जर्नल यहाँ रखा है:',
  'common.downloadBackup': 'बैकअप डाउनलोड करें',
  'common.backUpJournal': 'अपने जर्नल का बैकअप लें',
  'common.backupDownloaded': 'बैकअप डाउनलोड हो गया',
  'common.yourName': 'आपका नाम',
  'common.namePlaceholder': 'हेडर में दिखता है',
  'common.currency': 'मुद्रा',
  'common.language': 'भाषा',
  'common.accountName': 'खाते का नाम',
  'common.startingBalance': 'शुरुआती बैलेंस',
  'common.accountPlaceholder': 'जैसे प्रॉप फ़र्म चैलेंज',
  'common.accountCreated': 'खाता "{name}" बन गया',
  'common.removeTestData.title': 'टेस्ट डेटा हटाएँ?',
  'common.removeTestData.message': {
    other:
      'इससे बनाए गए {count} टेस्ट ट्रेड, उनसे जोड़ी गई चार्ट इमेज और प्लेबुक के टेस्ट सेटअप हट जाएँगे। आपके खुद दर्ज किए ट्रेड बने रहेंगे।',
  },
  'common.removeTestData.confirm': 'टेस्ट डेटा हटाएँ',
  'common.testDataRemoved': 'टेस्ट डेटा हटा दिया गया',
};
