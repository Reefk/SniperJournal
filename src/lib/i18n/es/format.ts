import type { format as en } from '../en/format';
import type { Translation } from '../types';

export const format: Translation<typeof en> = {
  'format.percent': '{value} %',
  'format.comma': ', ',
  'format.underMinute': 'menos de un minuto',
  'format.minutes': '{m} min',
  'format.hours': '{h} h',
  'format.hoursMinutes': '{h} h {m} min',
  'format.daysHours': '{d} d {h} h',
  'format.bytes': { one: '{count} byte', many: '{count} bytes', other: '{count} bytes' },
  'format.kb': '{n} KB',
  'format.mb': '{n} MB',
  'format.gb': '{n} GB',
};
