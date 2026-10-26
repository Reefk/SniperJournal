import { parseLocal } from './utils';
import { tr } from './i18n';

/** saved on a trade in English whatever the language; see sessionName */
export const SESSIONS = ['Asia', 'London', 'New York', 'After Hours'] as const;
export type SessionName = (typeof SESSIONS)[number];

/** a session as a screen names it: one of SESSIONS in the current language, any other (from a broker's file) as it is */
export function sessionName(session: string): string {
  return (SESSIONS as readonly string[]).includes(session) ? tr(`session.${session as SessionName}`) : session;
}

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
