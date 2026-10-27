import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Arabic reads right to left, and the whole page mirrors for it (dir="rtl"
 * on <html>, see store/language.ts). So the layout is written in start and
 * end, not left and right: ms-/me-, ps-/pe-, start-/end-, text-start/end,
 * border-s/e, rounded-s/e. Each reads the same as before in English, and
 * the other way round in Arabic. One written as left or right would stay put
 * in Arabic while the rest of the page turns.
 */

const SRC = join(__dirname, '..', 'src');
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [join(dir, e.name)] : [],
  );

/** a Tailwind class that names a side, with any variants before it (md:, hover:, -) */
const PHYSICAL =
  /(?<![\w/-])(?:[a-z0-9-]+:)*-?(?:(?:ml|mr|pl|pr|scroll-ml|scroll-mr|scroll-pl|scroll-pr)-(?:\d|px|auto|\[)|(?:left|right)-(?:\d|px|auto|full|\[)|text-(?:left|right)\b|border-[lr](?:-|\b)|rounded-(?:[lr]|tl|tr|bl|br)(?:-|\b))/g;

/** the same, written another way: an inline style's side, a float, a gradient's or a transform's side */
const PHYSICAL_OTHER =
  /\b(?:margin|padding|border)(?:Left|Right)\b|(?<![\w/-])(?:[a-z0-9-]+:)*(?:float-(?:left|right)|bg-gradient-to-[lr]|origin-(?:left|right))\b/g;

/** a box centred on the page or its anchor: centring reads the same both ways */
const CENTRED = /(?<![\w-])left-1\/2\b/g;

describe('the layout, in start and end', () => {
  it('names no side as left or right, so it mirrors for Arabic', () => {
    const found = files(SRC)
      .filter((f) => !f.includes(join('lib', 'i18n')))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .flatMap((line, i) =>
            [...(line.replace(CENTRED, '').match(PHYSICAL) ?? []), ...(line.match(PHYSICAL_OTHER) ?? [])].map(
              (c) => `${relative(SRC, f).replace(/\\/g, '/')}:${i + 1} ${c}`,
            ),
          ),
      );
    expect(found).toEqual([]);
  });
});
