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
  // compact shortens thousands and up; below that it would only drop a cent's zero ($103.8)
  const compact = Boolean(opts.compact) && Math.abs(value) >= 1000;
  const text = nf(currency, decimals, compact).format(Math.abs(value));
  const prefix = value < 0 ? '-' : opts.sign && value > 0 ? '+' : '';
  return prefix + text;
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
  // round once, up front, so 119.6 minutes is "2h" and never "1h 60m"
  const total = Math.round(minutes);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/** a file size the way a person reads it: 70 bytes, 512 KB, 3.4 MB, 1.25 GB */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const n = Math.round(bytes);
  if (n < 1024) return `${n} ${n === 1 ? 'byte' : 'bytes'}`;
  // each unit gives way to the next once it would read 1024 ("1.0 MB", never "1024 KB")
  const kb = Math.round(n / 1024);
  if (kb < 1024) return `${kb} KB`;
  const mb = (n / 1024 ** 2).toFixed(1);
  if (Number(mb) < 1024) return `${mb} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
