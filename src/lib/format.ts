import { pad2, parseLocal } from './utils';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'ILS', 'JPY', 'CAD', 'AUD', 'CHF', 'INR', 'USDT'];

const SYMBOL_FOR: Record<string, string> = { USDT: 'USD' };
const cache = new Map<string, Intl.NumberFormat>();

function nf(currency: string, decimals: number, compact: boolean): Intl.NumberFormat {
  const key = `${currency}|${decimals}|${compact}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
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
  const text = nf(currency, decimals, Boolean(opts.compact)).format(Math.abs(value));
  const prefix = value < 0 ? '-' : opts.sign && value > 0 ? '+' : '';
  return prefix + text;
}

/** Axis labels: plain thousands until the numbers get big, then compact */
export function formatAxisMoney(value: number, currency = 'USD'): string {
  return formatMoney(value, currency, { compact: Math.abs(value) >= 10000, decimals: 0 });
}

export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(value);
}

/** price precision that adapts: 4 decimals for FX, 2 for equities */
export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const decimals = abs === 0 ? 2 : abs < 1 ? 6 : abs < 20 ? 4 : 2;
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: decimals }).format(value);
}

export function formatPct(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

export function formatRatio(value: number | null | undefined, decimals = 2): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return '∞';
  return value.toFixed(decimals);
}

export const MONTHS_LONG = [
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
export const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3));
/** Monday-first, as the calendar grid is laid out */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function formatDate(value: string | undefined | null): string {
  if (!value || value.length < 10) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  const month = MONTHS_SHORT[Number(m) - 1];
  if (!month || !d || !y) return '—';
  return `${d} ${month} ${y}`;
}

export function formatShortDate(value: string | undefined | null): string {
  if (!value || value.length < 10) return '—';
  const [, m, d] = value.slice(0, 10).split('-');
  const month = MONTHS_SHORT[Number(m) - 1];
  if (!month || !d) return '—';
  return `${d} ${month}`;
}

export function formatMonthKey(year: number, month: number): string {
  return `${MONTHS_LONG[month]} ${year}`;
}

export function formatTime(value: string): string {
  const time = value.slice(11, 16);
  return time || '--:--';
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return '—';
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function formatClock(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function weekdayOf(value: string): number {
  return parseLocal(value).getDay();
}
