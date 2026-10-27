import type { calendar as en } from '../en/calendar';
import type { Translation } from '../types';

export const calendar: Translation<typeof en> = {
  'cal.title': 'प्रदर्शन कैलेंडर',
  'cal.hint': 'किसी भी दिन पर <phone>टैप</phone><pc>क्लिक</pc> करें और उस संख्या के पीछे के ट्रेड देखें',
  'cal.previous': 'पिछला महीना',
  'cal.next': 'अगला महीना',
  'cal.today': 'आज',
  'cal.empty.title': 'आपका ट्रेडिंग कैलेंडर खाली है',
  'cal.empty.text':
    'ट्रेड दर्ज करते ही हर दिन में उसका शुद्ध मुनाफ़ा या नुकसान और उस दिन लिए गए ट्रेड की संख्या भर जाएगी, ताकि सिलसिले और मुश्किल दिन एक नज़र में दिख जाएँ।',
  'cal.net': 'महीने का शुद्ध P&L',
  'cal.stillOpen': { one: '{count} अभी खुला है', other: '{count} अभी खुले हैं' },
  'cal.activeDays': 'ट्रेडिंग वाले दिन',
  'cal.greenRed': { one: '{count} हरा, {red} लाल', other: '{count} हरे, {red} लाल' },
  'cal.winRate': 'इस महीने की जीत दर',
  'cal.noneClosed': 'अभी कोई बंद ट्रेड नहीं',
  'cal.noneIn': '{month} में कोई ट्रेड नहीं।',
  'cal.dayNet': { other: '{count} ट्रेड · शुद्ध {net}' },
};
