import { parseLocal } from './utils';

export const SESSIONS = ['Asia', 'London', 'New York', 'After Hours'] as const;
export type SessionName = (typeof SESSIONS)[number];

/**
 * Best-effort session from the entry time. Uses the hour as entered,
 * which is what a trader sees on their own clock.
 */
export function detectSession(openedAt: string): string {
  if (!openedAt) return '';
  const h = parseLocal(openedAt).getHours();
  if (h >= 2 && h < 9) return 'Asia';
  if (h >= 9 && h < 14) return 'London';
  if (h >= 14 && h < 21) return 'New York';
  return 'After Hours';
}
