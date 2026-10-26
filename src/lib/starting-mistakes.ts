import { tr, type MessageKey } from './i18n';

/**
 * The mistakes a journal starts with, and how a screen names them. They are
 * saved in English whatever the language, so a journal reads the same in
 * every one and Reports count a mistake as one however it was shown; each is
 * named on screen in the current language. Kept apart from lib/mistakes.ts
 * so that lib/trade-math.ts, which it imports, can name them too.
 */
const NAMES = [
  ['Entered early (FOMO)', 'mistake.fomo'],
  ['Chased the entry', 'mistake.chased'],
  ['Moved my stop', 'mistake.movedStop'],
  ['No stop', 'mistake.noStop'],
  ['Oversized', 'mistake.oversized'],
  ['Revenge trade', 'mistake.revenge'],
  ['Exited too early', 'mistake.exitedEarly'],
  ['Held a loser too long', 'mistake.heldLoser'],
  ['Outside my plan', 'mistake.outsidePlan'],
] as const satisfies ReadonlyArray<readonly [string, MessageKey]>;

/** the list a journal starts with, until it is changed in Settings */
export const STARTING_MISTAKES: readonly string[] = NAMES.map(([name]) => name);

const KEYS = new Map<string, MessageKey>(NAMES);

/** a mistake as a screen names it: a starting one in the current language, any other as the person wrote it */
export function mistakeName(mistake: string): string {
  const key = KEYS.get(mistake);
  return key ? tr(key) : mistake;
}
