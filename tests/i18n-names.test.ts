import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '@/lib/i18n';
import { editedMistakes, matchMistake, mistakeName, STARTING_MISTAKES } from '@/lib/mistakes';
import { SESSIONS, sessionName } from '@/lib/sessions';
import { matchesSearch, needsText } from '@/lib/trade-math';
import { mergeIssue } from '@/lib/merge';
import { trade } from './helpers';

/**
 * What the app saves in English whatever the language (the starting mistakes,
 * the four sessions) is named on screen in the language, and typing or
 * searching that name finds what is saved.
 */
afterEach(() => setLanguage('en'));

describe('the starting mistakes', () => {
  it('are named in the language on screen, and saved in English', () => {
    expect(STARTING_MISTAKES.map(mistakeName)).toEqual(STARTING_MISTAKES);
    setLanguage('ru');
    expect(mistakeName('No stop')).toBe('Без стопа');
    expect(mistakeName('Entered early (FOMO)')).toBe('Ранний вход (FOMO)');
    // one of the person's own stays as they wrote it
    expect(mistakeName('Traded tired')).toBe('Traded tired');
  });

  it('typed by the name a screen gives them, are the one saved', () => {
    setLanguage('es');
    expect(matchMistake('  sin STOP ', STARTING_MISTAKES)).toBe('No stop');
    // the English name still finds it too
    expect(matchMistake('no stop', STARTING_MISTAKES)).toBe('No stop');
    expect(matchMistake('Operé cansado', STARTING_MISTAKES)).toBe('Operé cansado');
  });

  it('edited under the name a screen gives them, and left so, keep the name they are saved under', () => {
    setLanguage('ar');
    const rows = STARTING_MISTAKES.map((was) => ({ text: mistakeName(was), was }));
    expect(editedMistakes(rows)).toEqual({ list: [...STARTING_MISTAKES], renamed: new Map() });
    // one renamed is renamed, in the words typed
    rows[3] = { text: 'بلا وقف', was: 'No stop' };
    const { list, renamed } = editedMistakes(rows);
    expect(list[3]).toBe('بلا وقف');
    expect(renamed).toEqual(new Map([['No stop', 'بلا وقف']]));
  });

  it('a row given the name another one has in the language is that one, as a row given its English name is', () => {
    const rows = () => STARTING_MISTAKES.map((was) => ({ text: mistakeName(was), was }));
    const merged = {
      list: STARTING_MISTAKES.filter((m) => m !== 'No stop'),
      renamed: new Map([['No stop', 'Oversized']]),
    };
    const english = rows();
    english[3] = { text: 'oversized', was: 'No stop' };
    expect(editedMistakes(english)).toEqual(merged);
    setLanguage('es');
    const spanish = rows();
    spanish[3] = { text: ` ${mistakeName('Oversized').toLowerCase()} `, was: 'No stop' };
    expect(editedMistakes(spanish)).toEqual(merged);
  });

  it("of the person's own and a starting one the language names the same, theirs is the one typed", () => {
    setLanguage('es');
    const same = mistakeName('No stop');
    expect(matchMistake(same.toLowerCase(), ['No stop', same])).toBe(same);
    expect(matchMistake(same.toLowerCase(), ['No stop'])).toBe('No stop');
    // in the list editor, a row renamed to that name goes to theirs too, left as it was
    const { list, renamed } = editedMistakes([
      { text: same, was: 'No stop' },
      { text: same, was: same },
      { text: same.toLowerCase(), was: 'Revenge trade' },
    ]);
    expect(list).toEqual(['No stop', same]);
    expect(renamed).toEqual(new Map([['Revenge trade', same]]));
  });
});

describe('the sessions', () => {
  it('are named in the language, and one from a broker file is shown as it is', () => {
    expect(SESSIONS.map(sessionName)).toEqual([...SESSIONS]);
    setLanguage('hi');
    expect(SESSIONS.map(sessionName)).toEqual(['एशिया', 'लंदन', 'न्यूयॉर्क', 'आफ़्टर आवर्स']);
    expect(sessionName('Pre-market')).toBe('Pre-market');
  });
});

describe('searching the trades', () => {
  const t = trade({ side: 'SHORT', session: 'London', mistakes: ['No stop'] });

  it('finds a trade by what the screen calls its side, session and mistakes', () => {
    setLanguage('ru');
    expect(matchesSearch(t, 'шорт')).toBe(true);
    expect(matchesSearch(t, 'лондон')).toBe(true);
    expect(matchesSearch(t, 'без стопа')).toBe(true);
    expect(matchesSearch(t, 'азия')).toBe(false);
  });

  it('still finds it by what is saved', () => {
    setLanguage('ru');
    expect(matchesSearch(t, 'london')).toBe(true);
    expect(matchesSearch(t, 'no stop')).toBe(true);
  });
});

describe('what a trade still needs', () => {
  const t = trade({ symbol: '', quantity: 0 });

  it('is listed in the language, in the order English lists it', () => {
    expect(needsText(t)).toBe('needs symbol, quantity');
    setLanguage('ru');
    expect(needsText(t)).toBe('не хватает: тикер, количество');
    setLanguage('ar');
    // the list is held together inside the Arabic sentence, and joined by an Arabic comma
    expect(needsText(t)).toBe('ينقصها: ⁨الرمز، الكمية⁩');
  });

  it('is nothing for a trade with all it needs', () => {
    setLanguage('hi');
    expect(needsText(trade())).toBe('');
  });
});

describe('why trades cannot be merged', () => {
  it('is said in the language', () => {
    setLanguage('es');
    expect(mergeIssue([trade()])).toBe('Selecciona al menos dos operaciones para unirlas.');
    expect(mergeIssue([trade({ symbol: 'A' }), trade({ symbol: 'B' })])).toBe('Tienen que ser del mismo símbolo.');
    expect(mergeIssue([trade(), trade()])).toBeNull();
  });
});
