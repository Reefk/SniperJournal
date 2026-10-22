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

  it('keeps whole dollars where compact labels would all read the same, and decimals of K where they tell ticks apart', () => {
    // an equity curve from $10,000 to $10,143: compact, every tick read "$10K"
    expect([10_000, 10_050, 10_100, 10_150].map((v) => formatAxisMoney(v, 'USD', 143))).toEqual([
      '$10,000',
      '$10,050',
      '$10,100',
      '$10,150',
    ]);
    expect(formatAxisMoney(49_500, 'USD', 2_000)).toBe('$49.5K');
    expect(formatAxisMoney(10_250, 'USD', 1_000)).toBe('$10.25K');
    expect(formatAxisMoney(32_000, 'USD', 14_000)).toBe('$32K');
    expect(formatAxisMoney(10_000.5, 'USD', 2)).toBe('$10,000.50');
  });

  it('tells apart the ticks of any axis, however narrow and however big its numbers', () => {
    // the ticks recharts draws: five, a nice step apart (1, 2, 2.5 or 5 times a power of ten), at least a quarter of the span
    const ticks = (from: number, span: number) => {
      const rough = span / 4;
      const power = 10 ** Math.floor(Math.log10(rough));
      const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power;
      const first = Math.floor(from / step) * step;
      return [0, 1, 2, 3, 4].map((i) => first + i * step);
    };
    for (const from of [10_000, 43_856.12, 250_000, 1_234_567])
      for (const span of [3, 40, 143, 900, 2_000, 14_000, 400_000]) {
        const labels = ticks(from, span).map((v) => formatAxisMoney(v, 'USD', span));
        expect(new Set(labels).size, `from ${from} over ${span}: ${labels.join(' ')}`).toBe(5);
      }
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
