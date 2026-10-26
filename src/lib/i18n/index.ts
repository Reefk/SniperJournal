import { en, type MessageKey, type Messages } from './en';
import { es } from './es';
import { ru } from './ru';
import { ar } from './ar';
import { hi } from './hi';
import type { PluralForms, Translation } from './types';

export type { MessageKey } from './en';

/**
 * The languages the app speaks, and the one it speaks now.
 *
 * Every text a person reads is in the message files beside this: `en/` is
 * the source, and each other language has a folder with the same files and
 * every key in them (the types check it, tests/i18n.test.ts checks the
 * rest). `tr()` looks a text up in the current language. A journal with no
 * language set is in English.
 */
export type Language = 'en' | 'es' | 'ru' | 'ar' | 'hi';

export interface LanguageInfo {
  code: Language;
  /** in its own language, as the language menus show it */
  name: string;
  dir: 'ltr' | 'rtl';
  /** how its numbers are written (Intl); Arabic keeps the digits and separators of English */
  numbers: string;
  /** how its dates are written (Intl): month and weekday names */
  dates: string;
}

export const LANGUAGES: readonly LanguageInfo[] = [
  { code: 'en', name: 'English', dir: 'ltr', numbers: 'en-US', dates: 'en-GB' },
  { code: 'es', name: 'Español', dir: 'ltr', numbers: 'es-ES', dates: 'es-ES' },
  { code: 'ru', name: 'Русский', dir: 'ltr', numbers: 'ru-RU', dates: 'ru-RU' },
  { code: 'ar', name: 'العربية', dir: 'rtl', numbers: 'en-US', dates: 'ar-u-nu-latn' },
  { code: 'hi', name: 'हिन्दी', dir: 'ltr', numbers: 'hi-IN', dates: 'hi-IN' },
];

const MESSAGES: Record<Language, Translation<Messages>> = { en, es, ru, ar, hi };

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && LANGUAGES.some((l) => l.code === value);
}

let current: LanguageInfo = LANGUAGES[0];
const listeners = new Set<() => void>();

/** the language the app speaks now */
export function language(): LanguageInfo {
  return current;
}

/** for useSyncExternalStore */
export const currentLanguage = (): Language => current.code;

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** switches every later tr() and format call; anything not a language is English */
export function setLanguage(code: unknown): void {
  const next = LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
  if (next === current) return;
  current = next;
  for (const listener of [...listeners]) listener();
}

const pluralRules = new Map<Language, Intl.PluralRules>();

function pluralOf(forms: PluralForms, count: number | undefined): string {
  if (count === undefined) return forms.other;
  let rules = pluralRules.get(current.code);
  if (!rules) {
    rules = new Intl.PluralRules(current.code);
    pluralRules.set(current.code, rules);
  }
  return forms[rules.select(count)] ?? forms.other;
}

export type Params = Record<string, string | number>;

/**
 * A text in the current language, with each `{name}` in it replaced by
 * `params.name`. A plural text picks its form by `params.count`. Numbers go
 * in as written (String), so format them first where the screen did. In a
 * right-to-left language each text put in keeps its own direction, so an
 * English tag or account name ("Prop (FTMO)") reads as typed.
 */
export function tr(key: MessageKey, params?: Params): string {
  const message = MESSAGES[current.code][key] ?? en[key];
  const text = typeof message === 'string' ? message : pluralOf(message, numeric(params?.count));
  if (!params) return text;
  return fill(text, current.dir === 'rtl' ? isolatedTexts(params) : params);
}

function isolatedTexts(params: Params): Params {
  const out: Params = {};
  for (const [name, value] of Object.entries(params)) out[name] = typeof value === 'string' ? `⁨${value}⁩` : value;
  return out;
}

function numeric(value: string | number | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export function fill(text: string, params: Params): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** the same text in every language, for tests and the language menus */
export function messagesOf(code: Language): Translation<Messages> {
  return MESSAGES[code];
}

const decimals = new Map<string, string>();

/**
 * A number already written the English way ("12.5", "-0.75") with the
 * current language's decimal mark. Only for text that has no thousands
 * separator, such as toFixed's.
 */
export function decimalMark(text: string): string {
  const locale = current.numbers;
  let mark = decimals.get(locale);
  if (mark === undefined) {
    mark = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
    decimals.set(locale, mark);
  }
  return mark === '.' ? text : text.replace('.', mark);
}

/**
 * Keeps a number, an amount or a price reading left to right inside
 * right-to-left text, so "-$120" never shows as "$120-". Unchanged in a
 * left-to-right language.
 */
export function isolate(text: string): string {
  return current.dir === 'rtl' ? `⁦${text}⁩` : text;
}
