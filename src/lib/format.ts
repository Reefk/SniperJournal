import { decimalMark, isolate, language, tr } from './i18n';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'ILS', 'JPY', 'CAD', 'AUD', 'CHF', 'INR', 'USDT'];

const SYMBOL_FOR: Record<string, string> = { USDT: 'USD' };
const cache = new Map<string, Intl.NumberFormat>();

function nf(currency: string, decimals: number, compact: boolean): Intl.NumberFormat {
  const locale = language().numbers;
  const key = `${locale}|${currency}|${decimals}|${compact}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: SYMBOL_FOR[currency] ?? currency,
      minimumFractionDigits: compact ? 0 : decimals,
      maximumFractionDigits: decimals,
      ...(compact ? { notation: 'compact' as const } : {}),
    });
    cache.set(key, f);
  }
  return f;
}

export function formatMoney(
  value: number,
  currency = 'USD',
  opts: { sign?: boolean; compact?: boolean; decimals?: number } = {},
): string {
  if (!Number.isFinite(value)) return '—';
  const decimals = opts.decimals ?? 2;
  // compact shortens thousands and up; below that it would only drop a cent's zero ($103.8)
  const compact = Boolean(opts.compact) && Math.abs(value) >= 1000;
  const text = nf(currency, decimals, compact).format(Math.abs(value));
  const prefix = value < 0 ? '-' : opts.sign && value > 0 ? '+' : '';
  return isolate(prefix + text);
}

/**
 * A short amount, split for a box too narrow for it on one line: the number,
 * then what the language writes after it ("тыс. $", "US$", "हज़ार"). Null when
 * nothing is written after the number, as in English ("+$1.36K").
 */
export function numberAndUnit(text: string): [string, string] | null {
  // \s takes in the no-break spaces Intl puts there
  const match = /^(.*\d)\s+(\D.*)$/s.exec(text);
  return match ? [match[1], match[2]] : null;
}

/**
 * Axis labels: plain thousands until the numbers get big, then compact. `span`
 * is how much the axis covers (its highest value less its lowest): an axis
 * spanning little of a big number keeps whole dollars, where compact labels
 * would all read the same ($10K at every tick).
 */
export function formatAxisMoney(value: number, currency = 'USD', span = Number.POSITIVE_INFINITY): string {
  // recharts' five ticks are at least a quarter of the span apart
  const step = span > 0 ? span / 4 : Number.POSITIVE_INFINITY;
  const abs = Math.abs(value);
  if (abs >= 10000) {
    // K, M, B…: two decimals of it tell apart ticks a tenth of it apart, or more
    const unit = 1000 ** Math.floor(Math.log10(abs) / 3);
    if (step >= unit / 10) return formatMoney(value, currency, { compact: true });
  }
  return formatMoney(value, currency, { decimals: step >= 1 ? 0 : 2 });
}

export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return isolate(new Intl.NumberFormat(language().numbers, { maximumFractionDigits: decimals }).format(value));
}

/** price precision that adapts: 4 decimals for FX, 2 for equities */
export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const decimals = abs === 0 ? 2 : abs < 1 ? 6 : abs < 20 ? 4 : 2;
  return isolate(
    new Intl.NumberFormat(language().numbers, { minimumFractionDigits: 2, maximumFractionDigits: decimals }).format(
      value,
    ),
  );
}

export function formatPct(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '—';
  return isolate(tr('format.percent', { value: decimalMark(value.toFixed(decimals)) }));
}

/** a percentage already rounded as it is to be read: 90, 89.5 */
export function pctText(value: number): string {
  return isolate(tr('format.percent', { value: decimalMark(String(value)) }));
}

/**
 * A percentage as a whole number that reads true: 99.6 is 99, not 100, and
 * 0.4 is 1, not 0. Only all of it is 100, and none of it 0.
 */
export function wholePct(pct: number): number {
  if (pct <= 0) return 0;
  if (pct >= 100) return 100;
  return Math.min(99, Math.max(1, Math.round(pct)));
}

export function formatRatio(value: number | null | undefined, decimals = 2): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return '∞';
  const text = value.toFixed(decimals);
  // a loss too small to show is nothing, not -0.00
  return isolate(decimalMark(Number(text) === 0 ? text.replace('-', '') : text));
}

/** an R multiple with its sign: +1.50R, -0.75R */
export function formatR(value: number): string {
  return isolate(`${value >= 0 ? '+' : ''}${decimalMark(value.toFixed(2))}R`);
}

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3));
/** Monday-first, as the calendar grid is laid out */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** dates in the current language, read in UTC so that a calendar date never moves a day */
function dates(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = language().dates;
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = dateFormats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
    dateFormats.set(key, f);
  }
  return f;
}

/** "Октябрь 2026": a month heading starts with a capital, as it does in English */
const capital = (text: string) => text.charAt(0).toLocaleUpperCase(language().dates) + text.slice(1);

/** a month's name, 0 for January */
export function monthName(month: number, form: 'long' | 'short'): string {
  if (language().code === 'en') return (form === 'long' ? MONTHS_LONG : MONTHS_SHORT)[month] ?? '';
  return capital(dates({ month: form }).format(Date.UTC(2024, month, 1)));
}

/** a weekday's short name, Monday-first (0 is Monday), as the calendar grid is laid out */
export function weekdayName(index: number): string {
  if (language().code === 'en') return WEEKDAYS[index] ?? '';
  // 1 January 2024 was a Monday
  return dates({ weekday: 'short' }).format(Date.UTC(2024, 0, 1 + index));
}

/** year, month (0 for January) and day of an ISO date, or null when it isn't one */
function ymd(value: string): [number, number, number] | null {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return y && m >= 1 && m <= 12 && d ? [y, m - 1, d] : null;
}

export function formatDate(value: string | undefined | null): string {
  if (!value || value.length < 10) return '—';
  if (language().code !== 'en') {
    const parts = ymd(value);
    return parts ? dates({ day: 'numeric', month: 'short', year: 'numeric' }).format(Date.UTC(...parts)) : '—';
  }
  const [y, m, d] = value.slice(0, 10).split('-');
  const month = MONTHS_SHORT[Number(m) - 1];
  if (!month || !d || !y) return '—';
  return `${d} ${month} ${y}`;
}

export function formatShortDate(value: string | undefined | null): string {
  if (!value || value.length < 10) return '—';
  if (language().code !== 'en') {
    const parts = ymd(value);
    return parts ? dates({ day: 'numeric', month: 'short' }).format(Date.UTC(...parts)) : '—';
  }
  const [, m, d] = value.slice(0, 10).split('-');
  const month = MONTHS_SHORT[Number(m) - 1];
  if (!month || !d) return '—';
  return `${d} ${month}`;
}

export function formatMonthKey(year: number, month: number): string {
  if (language().code !== 'en') {
    return capital(dates({ month: 'long', year: 'numeric' }).format(Date.UTC(year, month, 1)));
  }
  return `${MONTHS_LONG[month]} ${year}`;
}

export function formatTime(value: string): string {
  const time = value.slice(11, 16);
  return time || '--:--';
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return '—';
  if (minutes < 1) return tr('format.underMinute');
  // round once, up front, so 119.6 minutes is "2h" and never "1h 60m"
  const total = Math.round(minutes);
  if (total < 60) return tr('format.minutes', { m: total });
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h < 24) return m ? tr('format.hoursMinutes', { h, m }) : tr('format.hours', { h });
  const d = Math.floor(h / 24);
  return tr('format.daysHours', { d, h: h % 24 });
}

/** a file size the way a person reads it: 70 bytes, 512 KB, 3.4 MB, 1.25 GB */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const n = Math.round(bytes);
  if (n < 1024) return tr('format.bytes', { count: n });
  // each unit gives way to the next once it would read 1024 ("1.0 MB", never "1024 KB")
  const kb = Math.round(n / 1024);
  if (kb < 1024) return tr('format.kb', { n: kb });
  const mb = (n / 1024 ** 2).toFixed(1);
  if (Number(mb) < 1024) return tr('format.mb', { n: decimalMark(mb) });
  return tr('format.gb', { n: decimalMark((n / 1024 ** 3).toFixed(2)) });
}
