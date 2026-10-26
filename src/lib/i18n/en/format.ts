import type { Message } from '../types';

/** the units of numbers, durations and file sizes (lib/format.ts) */
export const format = {
  'format.percent': '{value}%',
  // between the items of a list: "Discipline, Patience"
  'format.comma': ', ',
  'format.underMinute': 'under a minute',
  'format.minutes': '{m}m',
  'format.hours': '{h}h',
  'format.hoursMinutes': '{h}h {m}m',
  'format.daysHours': '{d}d {h}h',
  'format.bytes': { one: '{count} byte', other: '{count} bytes' },
  'format.kb': '{n} KB',
  'format.mb': '{n} MB',
  'format.gb': '{n} GB',
} satisfies Record<string, Message>;
