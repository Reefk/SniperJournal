import { describe, expect, it } from 'vitest';
import {
  formatAxisMoney,
  formatDate,
  formatMonthKey,
  formatNumber,
  formatPct,
  formatPrice,
  formatShortDate,
  formatTime,
} from '@/lib/format';

/** The formatters' edges: the switch to compact axis labels, and what each shows for nothing to show. */
describe('formatAxisMoney', () => {
  it('writes whole amounts in full below 10,000 and compact from 10,000, either sign', () => {
    expect(formatAxisMoney(9999)).toBe('$9,999');
    expect(formatAxisMoney(10000)).toBe('$10K');
    expect(formatAxisMoney(-10000)).toBe('-$10K');
  });
});

describe('formatNumber', () => {
  it('keeps up to the decimals asked for, and shows a dash for what is not a number', () => {
    expect(formatNumber(1234.5678)).toBe('1,234.57');
    expect(formatNumber(1.5, 0)).toBe('2');
    expect(formatNumber(Number.NaN)).toBe('—');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatPrice', () => {
  it('shows zero with two decimals, and up to six below 1, four below 20, two above', () => {
    expect(formatPrice(0)).toBe('0.00');
    expect(formatPrice(0.1234567)).toBe('0.123457');
    expect(formatPrice(1.23456)).toBe('1.2346');
    expect(formatPrice(20.123)).toBe('20.12');
  });
});

describe('formatPct', () => {
  it('shows a dash for what is not a number', () => {
    expect(formatPct(12.345)).toBe('12.3%');
    expect(formatPct(Number.NaN)).toBe('—');
  });
});

describe('formatDate and formatShortDate', () => {
  it('show a dash for no date, one too short, or a month that does not exist', () => {
    for (const bad of [null, undefined, '', '2026-03', '2026-13-01']) {
      expect(formatDate(bad)).toBe('—');
      expect(formatShortDate(bad)).toBe('—');
    }
  });

  it('read the date part of a time', () => {
    expect(formatDate('2026-03-05T14:30')).toBe('05 Mar 2026');
    expect(formatShortDate('2026-03-05T14:30')).toBe('05 Mar');
  });
});

describe('formatMonthKey and formatTime', () => {
  it('name a month in full, months counted from 0', () => {
    expect(formatMonthKey(2026, 0)).toBe('January 2026');
    expect(formatMonthKey(2026, 11)).toBe('December 2026');
  });

  it('show a time, or dashes when the value has none', () => {
    expect(formatTime('2026-03-05T14:30')).toBe('14:30');
    expect(formatTime('2026-03-05')).toBe('--:--');
  });
});
