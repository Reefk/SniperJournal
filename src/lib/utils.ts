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

export function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const cleaned = String(value)
    .trim()
    .replace(/[\s,_]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function downloadFile(filename: string, content: string, mime = 'application/json') {
  // Delegates to the platform: a download on a PC, the share sheet on a phone.
  // Deliberately fire-and-forget so the many call sites stay synchronous.
  void storage.exportFile(filename, content, mime);
}
