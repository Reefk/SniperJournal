import type { format as en } from '../en/format';
import type { Translation } from '../types';

export const format: Translation<typeof en> = {
  'format.percent': '{value} %',
  'format.comma': ', ',
  'format.underMinute': 'меньше минуты',
  'format.minutes': '{m} мин',
  'format.hours': '{h} ч',
  'format.hoursMinutes': '{h} ч {m} мин',
  'format.daysHours': '{d} д {h} ч',
  'format.bytes': { one: '{count} байт', few: '{count} байта', many: '{count} байт', other: '{count} байта' },
  'format.kb': '{n} КБ',
  'format.mb': '{n} МБ',
  'format.gb': '{n} ГБ',
};
