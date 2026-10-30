import { afterEach, describe, expect, it } from 'vitest';
import { decimalMark, isolate, LANGUAGES, messagesOf, setLanguage, tr, type Language } from '@/lib/i18n';
import { en } from '@/lib/i18n/en';
import type { Message, PluralForms } from '@/lib/i18n/types';
import {
  breakableAmount,
  formatMoney,
  formatNumber,
  formatPct,
  formatPrice,
  formatR,
  formatRatio,
  numberAndUnit,
  weekdayName,
} from '@/lib/format';
import { withoutKept } from './i18n-kept';

/**
 * Every language has every text, and each translation keeps what the app
 * fills in or draws: the same {placeholders}, the same <tags>, the plural
 * forms its language needs, and no English left in it.
 */

const OTHERS = LANGUAGES.filter((l) => l.code !== 'en');

const forms = (m: Message): string[] => (typeof m === 'string' ? [m] : Object.values(m));
const placeholders = (text: string) => new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
const tagsOf = (text: string) => [...text.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();
const union = (sets: Set<string>[]) => new Set(sets.flatMap((s) => [...s]));
const sorted = (s: Set<string>) => [...s].sort();

/** Spanish keys whose English text is also good Spanish */
const SAME_IN_SPANISH = new Set<string>([
  'clock.localShort',
  'profile.trader',
  'format.bytes',
  'session.Asia',
  'form.stopLoss',
  'form.takeProfit',
  'form.setup',
  'form.manual',
  'list.manual',
  'role.stop_loss',
  'role.take_profit',
  'role.strike',
]);

afterEach(() => setLanguage('en'));

describe.each(OTHERS)('$name ($code)', ({ code }) => {
  const messages = messagesOf(code) as Record<string, Message>;
  const english = en as Record<string, Message>;
  const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories as Array<keyof PluralForms>;

  it('has every English key and no other', () => {
    expect(Object.keys(messages).sort()).toEqual(Object.keys(english).sort());
  });

  it.each(Object.keys(en))('%s keeps the placeholders, tags and form of the English', (key) => {
    const ours = messages[key];
    const theirs = english[key];
    expect(typeof ours).toBe(typeof theirs);
    for (const text of forms(ours)) expect(text.trim(), 'empty').not.toBe('');

    const wanted = union(forms(theirs).map(placeholders));
    const wantedTags = tagsOf(forms(theirs)[0]);
    if (typeof ours === 'string') {
      expect(sorted(placeholders(ours))).toEqual(sorted(wanted));
    } else {
      // one text for every count, or every form the language has, and no form it hasn't
      const have = Object.keys(ours).sort();
      if (have.join() !== 'other') expect(have).toEqual([...categories].sort());
      // a form may leave the count out ("one trade"), never put in something English doesn't have
      for (const text of forms(ours)) for (const name of placeholders(text)) expect(wanted).toContain(name);
      expect(sorted(placeholders(ours.other))).toEqual(sorted(wanted));
    }
    for (const text of forms(ours)) expect(tagsOf(text)).toEqual(wantedTags);

    // a text that continues another (" test data") keeps its leading space
    const lead = forms(theirs)[0].startsWith(' ');
    for (const text of forms(ours)) expect(text.startsWith(' ')).toBe(lead);
  });

  it('has no English left in it', () => {
    const left = Object.entries(messages).filter(([key, m]) =>
      forms(m).some((text) =>
        code === 'es'
          ? !SAME_IN_SPANISH.has(key) && forms(english[key]).includes(text) && /[A-Za-z]{2}/.test(withoutKept(text))
          : /[A-Za-z]{2}/.test(withoutKept(text)),
      ),
    );
    expect(left.map(([key]) => key)).toEqual([]);
  });
});

describe('tr', () => {
  it('fills in the placeholders, and leaves one it has no value for as it is', () => {
    expect(tr('common.accountCreated', { name: 'Prop' })).toBe('Account "Prop" created');
    expect(tr('common.accountCreated')).toBe('Account "{name}" created');
  });

  it('picks the plural form by the count, in each language', () => {
    expect([1, 2, 0].map((count) => tr('common.trades', { count }))).toEqual(['1 trade', '2 trades', '0 trades']);
    setLanguage('ru');
    expect([1, 3, 5, 21].map((count) => tr('common.trades', { count }))).toEqual([
      '1 сделка',
      '3 сделки',
      '5 сделок',
      '21 сделка',
    ]);
    setLanguage('ar');
    expect([1, 2, 3, 11, 100].map((count) => tr('common.trades', { count }))).toEqual([
      'صفقة واحدة',
      'صفقتان',
      '3 صفقات',
      '11 صفقة',
      '100 صفقة',
    ]);
  });

  // texts that said "1 trades" or the like, once
  it.each([
    ['settings.accountTrades', '1 trade'],
    ['impw.newSetups', '1 new playbook setup will be created'],
    ['impw.incomplete', '<num>1</num> needs details before it counts'],
    // the number of trades imported is filled in where {done} is
    ['impw.done.needDetails', '{done} — 1 needs details'],
    ['impw.moreRows', '…and 1 more row.'],
    ['shell.testBanner', 'Test data is loaded (1 generated trade).'],
    ['settings.testTradesLoaded', '1 test trade currently loaded'],
  ] as const)('says one in English, not "1 …s": %s', (key, text) => {
    expect(tr(key, { count: 1 })).toBe(text);
  });

  it('speaks English for anything that is not one of its languages', () => {
    setLanguage('ru');
    setLanguage('xx');
    expect(tr('common.cancel')).toBe('Cancel');
  });
});

describe('numbers inside the text', () => {
  it('take the decimal mark of the language', () => {
    const marks = Object.fromEntries(
      LANGUAGES.map(({ code }) => {
        setLanguage(code);
        return [code, decimalMark('-12.5')];
      }),
    ) as Record<Language, string>;
    expect(marks).toEqual({ en: '-12.5', es: '-12,5', ru: '-12,5', ar: '-12.5', hi: '-12.5' });
  });

  it('read left to right inside Arabic, and are left alone elsewhere', () => {
    expect(isolate('-$120')).toBe('-$120');
    setLanguage('ar');
    expect(isolate('-$120')).toBe('⁦-$120⁩');
  });

  it('carry no direction marks, as shown by the app, but in Arabic', () => {
    const shown = () => [
      formatMoney(-1234.5, 'USD'),
      formatMoney(80, 'EUR', { sign: true }),
      formatNumber(1234.5),
      formatPrice(5012.25),
      formatPct(-12.34),
      formatRatio(1.5),
      formatR(-0.5),
      tr('common.trades', { count: 3 }),
    ];
    const marked = (texts: string[]) => texts.filter((t) => /[‎‏⁦-⁩]/.test(t));
    for (const { code } of LANGUAGES) {
      setLanguage(code);
      expect(marked(shown()), code).toEqual(code === 'ar' ? shown().slice(0, 7) : []);
    }
  });
});

describe('a short amount on two lines', () => {
  it('puts what is written after the number on a line of its own', () => {
    expect(numberAndUnit('+1,36 тыс. $')).toEqual(['+1,36', 'тыс. $']);
    // Intl's no-break spaces, between the parts and inside one
    expect(numberAndUnit('-740,31 US$')).toEqual(['-740,31', 'US$']);
    expect(numberAndUnit('+1,36 mil US$')).toEqual(['+1,36', 'mil US$']);
    expect(numberAndUnit('+$1.36 हज़ार')).toEqual(['+$1.36', 'हज़ार']);
    // a thousands separator that is a space stays inside the number
    expect(numberAndUnit('+1 234,56 $')).toEqual(['+1 234,56', '$']);
  });

  it('leaves whole an amount with nothing after the number, or with its currency before it', () => {
    expect(numberAndUnit('+$1.36K')).toBeNull();
    expect(numberAndUnit('-$740.31')).toBeNull();
    expect(numberAndUnit('+CHF 1.36K')).toBeNull();
    expect(numberAndUnit('')).toBeNull();
  });

  it("splits the languages' own short amounts where the phone calendar needs it", () => {
    // Spanish, Russian and Hindi write "thousand" or the currency after the number; English and Arabic don't
    const splits: Record<Language, boolean> = { en: false, es: true, ru: true, ar: false, hi: true };
    for (const { code } of LANGUAGES) {
      setLanguage(code);
      const short = formatMoney(1360, 'USD', { sign: true, compact: true });
      expect(numberAndUnit(short) !== null, `${code}: ${short}`).toBe(splits[code]);
    }
  });

  it('may break before what follows the number, and nowhere else, when its box is too narrow', () => {
    // the Playbook card's net figure, a quarter of a phone's card; Intl joins the parts with no-break spaces
    const nb = String.fromCharCode(0xa0);
    expect(breakableAmount(`+9,04${nb}mil${nb}US$`)).toBe(`+9,04 mil${nb}US$`);
    expect(breakableAmount(`+9,04${nb}тыс.${nb}$`)).toBe(`+9,04 тыс.${nb}$`);
    expect(breakableAmount(`+1${nb}234,56${nb}$`)).toBe(`+1${nb}234,56 $`);
    expect(breakableAmount('+$9.04K')).toBe('+$9.04K');
    // nothing that isn't an amount is touched
    expect(breakableAmount('')).toBe('');
    expect(breakableAmount(`n/a${nb}US$`)).toBe(`n/a${nb}US$`);
    for (const { code } of LANGUAGES) {
      setLanguage(code);
      const short = formatMoney(9040, 'USD', { sign: true, compact: true });
      const parts = numberAndUnit(short);
      // English and Arabic, with nothing after the number, come back exactly as they were
      expect(breakableAmount(short), code).toBe(parts ? `${parts[0]} ${parts[1]}` : short);
    }
  });
});

describe('a weekday', () => {
  it('is named in full for a sentence, and short for a table; English says "Fri" in both, as it did', () => {
    // Monday is 0, Friday 4
    const names = Object.fromEntries(
      LANGUAGES.map(({ code }) => {
        setLanguage(code);
        return [code, [weekdayName(4), weekdayName(4, 'long'), weekdayName(0, 'long')]];
      }),
    );
    expect(names).toEqual({
      en: ['Fri', 'Fri', 'Mon'],
      es: ['vie', 'viernes', 'lunes'],
      ru: ['пт', 'пятница', 'понедельник'],
      // Arabic's short name is its full one
      ar: ['الجمعة', 'الجمعة', 'الاثنين'],
      hi: ['शुक्र', 'शुक्रवार', 'सोमवार'],
    });
  });

  it('has seven different names in every language, both short and long, the last one Sunday', () => {
    for (const { code } of LANGUAGES) {
      setLanguage(code);
      for (const form of ['short', 'long'] as const) {
        const week = [0, 1, 2, 3, 4, 5, 6].map((i) => weekdayName(i, form));
        expect(new Set(week).size, `${code} ${form}`).toBe(7);
        expect(week.every(Boolean), `${code} ${form}`).toBe(true);
      }
    }
    setLanguage('es');
    expect(weekdayName(6, 'long')).toBe('domingo');
  });
});
