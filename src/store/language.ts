import { useLayoutEffect, useSyncExternalStore } from 'react';
import { currentLanguage, isLanguage, language, setLanguage, subscribeLanguage, type Language } from '@/lib/i18n';

/**
 * The language the journal was last shown in, kept in the browser for the
 * screens drawn before the journal is read (opening it) or without it (the
 * app crashed). Absent for English.
 */
export const LANGUAGE_KEY = 'sniper-journal-language';

export function rememberedLanguage(): Language {
  try {
    const code = localStorage.getItem(LANGUAGE_KEY);
    return isLanguage(code) ? code : 'en';
  } catch {
    return 'en';
  }
}

function remember(code: Language) {
  try {
    if (code === 'en') localStorage.removeItem(LANGUAGE_KEY);
    else localStorage.setItem(LANGUAGE_KEY, code);
  } catch {
    /* only the opening screen's language depends on it */
  }
}

/** the current language on <html>: its lang, and right to left for Arabic */
export function showLanguage(): void {
  const root = document.documentElement;
  root.lang = language().code;
  root.dir = language().dir;
}

const english = (): Language => 'en';

/**
 * Speaks the journal's language once it is read (`chosen`, English when it
 * has none), and until then the one it was last shown in. Returns the
 * language spoken now; it changes before the screen is painted.
 */
export function useJournalLanguage(ready: boolean, chosen: Language | undefined): Language {
  const code = useSyncExternalStore(subscribeLanguage, currentLanguage, english);
  useLayoutEffect(() => {
    const next = ready ? (chosen ?? 'en') : rememberedLanguage();
    setLanguage(next);
    showLanguage();
    if (ready) remember(next);
  }, [ready, chosen]);
  return code;
}
