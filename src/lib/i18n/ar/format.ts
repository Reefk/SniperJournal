import type { format as en } from '../en/format';
import type { Translation } from '../types';

export const format: Translation<typeof en> = {
  'format.percent': '{value}%',
  'format.comma': '، ',
  'format.underMinute': 'أقل من دقيقة',
  'format.minutes': '{m} د',
  'format.hours': '{h} س',
  'format.hoursMinutes': '{h} س {m} د',
  'format.daysHours': '{d} ي {h} س',
  'format.bytes': {
    zero: '{count} بايت',
    one: '{count} بايت',
    two: '{count} بايت',
    few: '{count} بايتات',
    many: '{count} بايت',
    other: '{count} بايت',
  },
  'format.kb': '{n} كيلوبايت',
  'format.mb': '{n} ميغابايت',
  'format.gb': '{n} غيغابايت',
};
