import { describe, expect, it } from 'vitest';
import { formatDuration, formatMoney, formatPct, formatPrice, formatRatio } from '@/lib/format';
import { buildInsights, buildSignals } from '@/lib/insights';
import { rangeStart, splitByRange } from '@/lib/ranges';
import { detectSession } from '@/lib/sessions';
import { dateKey, parseDateKey, parseLocal, toNumberOrNull } from '@/lib/utils';
import type { Settings } from '@/lib/types';
import { pnl, trade } from './helpers';

describe('toNumberOrNull: what the trade form accepts', () => {
  it.each([
    ['plain', '1234.5', 1234.5],
    ['spaces', ' 12 ', 12],
    ['US thousands', '1,234.50', 1234.5],
    ['thousands without decimals', '1,500', 1500],
    ['underscores', '1_000', 1000],
    ['negative', '-80.25', -80.25],
    ['decimal comma', '4,25', 4.25],
    ['decimal comma, forex', '1,08640', 1.0864],
  ])('%s: %s', (_, raw, expected) => {
    expect(toNumberOrNull(raw)).toBeCloseTo(expected, 10);
  });

  it.each(['', '   ', 'abc', 'NaN', 'Infinity', '1.2.3'])('rejects %j', (raw) => {
    expect(toNumberOrNull(raw)).toBeNull();
  });

  it('passes finite numbers through and rejects non-finite ones', () => {
    expect(toNumberOrNull(5)).toBe(5);
    expect(toNumberOrNull(Number.NaN)).toBeNull();
    expect(toNumberOrNull(Number.POSITIVE_INFINITY)).toBeNull();
    expect(toNumberOrNull(null)).toBeNull();
  });
});

describe('dates', () => {
  it('local day keys never shift through UTC', () => {
    expect(dateKey(new Date(2026, 0, 31, 23, 59))).toBe('2026-01-31');
    expect(parseDateKey('2026-02-03').getDate()).toBe(3);
    expect(parseLocal('2026-02-03T09:07').getHours()).toBe(9);
  });

  it('7D, 30D and YTD ranges include today and count back inclusively', () => {
    const now = new Date(2026, 2, 10, 15, 0);
    expect(rangeStart('7D', now)).toBe('2026-03-04');
    expect(rangeStart('30D', now)).toBe('2026-02-09');
    expect(rangeStart('YTD', now)).toBe('2026-01-01');
    expect(rangeStart('ALL', now)).toBeNull();
    const { inRange, before } = splitByRange(
      [pnl(1, { closedAt: '2026-03-03T10:00' }), pnl(2, { closedAt: '2026-03-04T10:00' })],
      '7D',
      now,
    );
    expect([inRange.length, before.length]).toEqual([1, 1]);
  });

  it('sessions come from the entry hour as written', () => {
    expect(detectSession('2026-03-02T03:00')).toBe('Asia');
    expect(detectSession('2026-03-02T09:00')).toBe('London');
    expect(detectSession('2026-03-02T14:00')).toBe('New York');
    expect(detectSession('2026-03-02T22:00')).toBe('After Hours');
    expect(detectSession('')).toBe('');
  });
});

describe('formatting', () => {
  it('money: sign, negatives, compact, and nothing misleading for non-finite values', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
    expect(formatMoney(-80)).toBe('-$80.00');
    expect(formatMoney(12, 'USD', { sign: true })).toBe('+$12.00');
    expect(formatMoney(0, 'USD', { sign: true })).toBe('$0.00');
    expect(formatMoney(1190, 'USD', { compact: true })).toBe('$1.19K');
    expect(formatMoney(Number.NaN)).toBe('—');
    expect(formatMoney(5, 'USDT')).toBe('$5.00');
  });

  it('ratios show infinity as ∞ and missing values as a dash', () => {
    expect(formatRatio(Number.POSITIVE_INFINITY)).toBe('∞');
    expect(formatRatio(null)).toBe('—');
    expect(formatRatio(2)).toBe('2.00');
    expect(formatPct(Number.NaN)).toBe('—');
  });

  it('prices keep the precision their market needs', () => {
    expect(formatPrice(1.08706)).toBe('1.0871');
    expect(formatPrice(187.4)).toBe('187.40');
    expect(formatPrice(0.000123)).toBe('0.000123');
    expect(formatPrice(null)).toBe('—');
  });

  it.each([
    [0.5, 'under a minute'],
    [45, '45m'],
    [59.6, '1h'],
    [90, '1h 30m'],
    [119.6, '2h'],
    [1500, '1d 1h'],
    [-1, '—'],
  ])('durations: %s minutes -> %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe('insights and signals', () => {
  const settings: Settings = { currency: 'USD', theme: 'dark', timezone: 'local', maxDailyLoss: 500, maxTradesPerDay: 3 };
  const now = new Date(2026, 2, 10, 16, 0);
  const today = (net: number, i: number) => pnl(net, { closedAt: `2026-03-10T1${i}:00`, openedAt: `2026-03-10T0${i}:00` });

  it('warns at 70% of the daily loss limit and stops at 100%', () => {
    expect(buildSignals([today(-350, 1)], settings, now).map((s) => s.id)).toContain('daily-loss-near');
    expect(buildSignals([today(-300, 1), today(-200, 2)], settings, now).map((s) => s.id)).toContain('daily-loss-breached');
    expect(buildSignals([today(-100, 1)], settings, now).map((s) => s.id)).not.toContain('daily-loss-near');
  });

  it('counts trades against the daily limit and spots losing streaks', () => {
    const ids = buildSignals([today(-1, 1), today(-2, 2), today(-3, 3)], settings, now).map((s) => s.id);
    expect(ids).toContain('trade-count');
    expect(ids).toContain('losing-streak');
  });

  it('says nothing below five closed trades', () => {
    expect(buildInsights([pnl(10), pnl(-5), trade()], [], settings)).toEqual([]);
  });

  it('flags commissions that turn a profitable record into a losing one', () => {
    const trades = [10, 12, -5, 8, -6].map((g, i) =>
      trade({ entryPrice: 100, exitPrice: 100 + g, fees: 6, closedAt: `2026-03-0${i + 2}T11:00` }),
    );
    expect(buildInsights(trades, [], settings).map((x) => x.id)).toContain('fees');
  });
});
