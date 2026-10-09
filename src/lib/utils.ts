import { storage } from './storage';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' in local time (never UTC-shifted like toISOString) */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** value for <input type="datetime-local"> */
export function toLocalInput(d: Date): string {
  return `${dateKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** parse 'YYYY-MM-DD' as local midnight */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** parse 'YYYY-MM-DDTHH:mm' as local time */
export function parseLocal(value: string): Date {
  const [day, time = '00:00'] = value.split('T');
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const round2 = (v: number) => Math.round(v * 100) / 100;
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * A number typed or exported in either convention: 1,234.50 and 1.234,50 are
 * both 1234.5. A separator only counts as a thousands separator when it forms
 * proper groups of three, so "4,25" is four and a quarter, never 425, and
 * "1,08640" is a forex price, not 108640. "1,500" stays fifteen hundred.
 * Anything that is not clearly one number gives null.
 */
export function parseDecimal(raw: string): number | null {
  let s = raw.trim().replace(/[\s_  ']/g, '');
  if (!s) return null;
  let sign = '';
  if (/^[+-]/.test(s)) {
    sign = s[0] === '-' ? '-' : '';
    s = s.slice(1);
  }
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // both present: whichever comes last is the decimal point, and the other
    // must be grouping the whole part in threes
    const point = Math.max(lastComma, lastDot);
    const thousands = point === lastComma ? '.' : ',';
    const whole = s.slice(0, point);
    if (!new RegExp(`^\\d{1,3}(\\${thousands}\\d{3})*$`).test(whole)) return null;
    s = `${whole.split(thousands).join('')}.${s.slice(point + 1)}`;
  } else if (lastComma !== -1) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.split(',').length === 2 ? s.replace(',', '.') : '';
  } else if (lastDot !== -1 && s.indexOf('.') !== lastDot) {
    // several dots can only be thousands separators: 1.234.567
    s = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : '';
  }
  if (!/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
  const n = Number(sign + s);
  return Number.isFinite(n) ? n : null;
}

export function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  return parseDecimal(String(value));
}

export function downloadFile(filename: string, content: string, mime = 'application/json') {
  // Delegates to the platform: a download on a PC, the share sheet on a phone.
  // Deliberately fire-and-forget so the many call sites stay synchronous.
  void storage.exportFile(filename, content, mime);
}
