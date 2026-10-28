import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANGUAGES, messagesOf } from '@/lib/i18n';

/**
 * The font of a figure (the `num` utility) is JetBrains Mono, which has Latin,
 * Cyrillic and Greek. A language whose words it hasn't got takes the digits and
 * signs from it and the rest, spaces included, from the normal font
 * (globals.css), or its words are drawn in the system's monospace font.
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../src/app/globals.css');
const mono = read('../node_modules/@fontsource-variable/jetbrains-mono/index.css');

type Range = [number, number];
/** "U+0021-007E, U+20AC" -> [[0x21, 0x7e], [0x20ac, 0x20ac]] */
const ranges = (list: string): Range[] =>
  list.split(',').map((part) => {
    const [from, to = from] = part.trim().replace(/^U\+/i, '').split('-');
    return [parseInt(from, 16), parseInt(to, 16)];
  });
const covers = (rs: Range[], code: number) => rs.some(([from, to]) => code >= from && code <= to);
/** every character the @font-face rules of a family cover */
const family = (text: string, name: string): Range[] =>
  [...text.matchAll(/@font-face\s*\{([^}]*)\}/g)]
    .map((m) => m[1])
    .filter((body) => body.includes(`font-family: '${name}'`))
    .flatMap((body) => ranges(/unicode-range:\s*([^;]+);/.exec(body)?.[1] ?? ''));

const FIGURES = family(css, 'Figures');
const MONO = family(mono, 'JetBrains Mono Variable');
const rule = /:root:is\(([^)]*)\) \.num \{\s*font-family: ([^;]+);/.exec(css);
const swapped = [...(rule?.[1] ?? '').matchAll(/\[lang='(\w+)'\]/g)].map((m) => m[1]);

describe('the font of a figure', () => {
  it('leaves spaces and the letters JetBrains Mono has not got to the normal font', () => {
    expect(FIGURES.length).toBeGreaterThan(0);
    expect(rule?.[2]).toBe("'Figures', var(--font-sans)");
    // a space, a no-break space, a narrow one, an Arabic alif, a Devanagari ka
    for (const code of [0x20, 0xa0, 0x202f, 0x627, 0x915]) expect(covers(FIGURES, code)).toBe(false);
  });

  it('takes from JetBrains Mono only what it has, so digits and signs look as they do in English', () => {
    for (const [from, to] of FIGURES) for (let code = from; code <= to; code++) expect(covers(MONO, code)).toBe(true);
    // the digits, the signs around them, and the currency signs
    for (const ch of '0123456789+-−.,%$€£¥₪₹') expect(covers(FIGURES, ch.codePointAt(0)!)).toBe(true);
  });

  it.each(LANGUAGES)('$name: swapped exactly when JetBrains Mono lacks some of its letters', ({ code }) => {
    const words = Object.values(messagesOf(code))
      .flatMap((message) => (typeof message === 'string' ? [message] : Object.values(message)))
      .join('');
    const lacking = [...words].filter((ch) => /\p{L}/u.test(ch) && !covers(MONO, ch.codePointAt(0)!));
    expect(swapped.includes(code)).toBe(lacking.length > 0);
  });
});
