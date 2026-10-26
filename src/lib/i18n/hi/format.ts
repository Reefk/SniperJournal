import type { format as en } from '../en/format';
import type { Translation } from '../types';

export const format: Translation<typeof en> = {
  'format.percent': '{value}%',
  'format.comma': ', ',
  'format.underMinute': 'एक मिनट से कम',
  'format.minutes': '{m} मि',
  'format.hours': '{h} घं',
  'format.hoursMinutes': '{h} घं {m} मि',
  'format.daysHours': '{d} दि {h} घं',
  'format.bytes': { one: '{count} बाइट', other: '{count} बाइट' },
  'format.kb': '{n} KB',
  'format.mb': '{n} MB',
  'format.gb': '{n} GB',
};
