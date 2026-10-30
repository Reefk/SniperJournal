import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { LANGUAGES, messagesOf, type MessageKey } from '@/lib/i18n';
import type { PluralForms } from '@/lib/i18n/types';

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

/** an icon that points along the line of text: it turns with the page in Arabic */
const ALONG_THE_LINE =
  /Left|Right|External|Input|Output|Undo|Redo|Reply|Forward|Send|LogIn|LogOut|Trending|Indent|Outdent|Import|Quote|Step|Skip|Rewind|Corner|Play/;
/** the class that turns one, in a right-to-left language only */
const FLIP = 'rtl:-scale-x-100';

/** icons that point along the line but stay as they are: why, and the files they stay in */
const STAYS: Record<string, { why: string; where: string[] }> = {
  ArrowUpRight: {
    why: "a trade's direction, up for long, as on a chart: charts read left to right in every language",
    where: ['components/trades/TradeFormModal.tsx', 'components/ui/StatusBadge.tsx'],
  },
  ArrowDownRight: {
    why: "a trade's direction, down for short, as on a chart",
    where: ['components/trades/TradeFormModal.tsx', 'components/ui/StatusBadge.tsx'],
  },
  TrendingUp: { why: 'a line going up on a chart', where: ['views/DashboardView.tsx'] },
  ArrowLeftRight: { why: 'points both ways', where: ['components/layout/Sidebar.tsx', 'views/TradesView.tsx'] },
  CornerDownLeft: {
    why: 'the Enter key, drawn as it is printed on the key',
    where: ['components/layout/GlobalSearch.tsx'],
  },
};

/** arrows written as characters: › ‹ « » turn by themselves in Arabic (Unicode mirrors them), → and ← don't */
const TYPED_ARROW = /[→←›‹«»]/g;
const NEVER_TURNS = /[→←]/;

/** a quarter turn, as an arrow turned to point down when its section opens */
const QUARTER = /^-?rotate-90$/;

/** what makes part of a className there only sometimes: a && b, a || b, a ?? b (and a ? b : c, cn({ class: on })) */
const CONDITIONS = [
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
];

/** each class an element's className can give it, and whether it always does, not only when something is true */
function classesOf(tag: ts.JsxOpeningLikeElement) {
  const found: { name: string; always: boolean }[] = [];
  const visit = (node: ts.Node, always: boolean): void => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))
      for (const name of node.text.split(/\s+/)) if (name) found.push({ name, always });
    const sometimes =
      ts.isConditionalExpression(node) ||
      ts.isObjectLiteralExpression(node) ||
      (ts.isBinaryExpression(node) && CONDITIONS.includes(node.operatorToken.kind));
    ts.forEachChild(node, (child) => visit(child, always && !sometimes));
  };
  for (const a of tag.attributes.properties)
    if (ts.isJsxAttribute(a) && a.name.getText() === 'className' && a.initializer) visit(a.initializer, true);
  return found;
}

/** each quarter turn among the classes, as its variants and the turn: ['rtl', 'group-open', '-rotate-90'] */
const quarterTurns = (classes: { name: string }[]) =>
  classes.map((c) => c.name.split(':')).filter((v) => QUARTER.test(v.at(-1)!));

/**
 * a quarter turn comes with an Arabic one the other way: there a sideways arrow
 * is mirrored, so the same turn would point it up instead of down
 */
function turnsBack(classes: { name: string }[]) {
  const turns = quarterTurns(classes);
  const back = (v: string[]) => v.at(-1)!.startsWith('-');
  const rtl = turns.filter((v) => v.includes('rtl'));
  return turns.filter((v) => !v.includes('rtl')).every((v) => rtl.some((r) => back(r) !== back(v)));
}

/** the element a text is shown in, through any {…} around it; none for an attribute's value */
function shownIn(node: ts.Node): ts.JsxOpeningLikeElement | undefined {
  for (let p = node.parent; p && !ts.isSourceFile(p); p = p.parent) {
    if (ts.isJsxAttribute(p)) return undefined;
    if (ts.isJsxElement(p)) return p.openingElement;
  }
  return undefined;
}

/** a name that is something else's: a property, an object key, an export, a declaration */
function aName(node: ts.Identifier) {
  const p = node.parent;
  return (
    ts.isExportSpecifier(p) ||
    ((ts.isPropertyAccessExpression(p) ||
      ts.isPropertyAssignment(p) ||
      ts.isVariableDeclaration(p) ||
      ts.isParameter(p) ||
      ts.isFunctionDeclaration(p)) &&
      p.name === node)
  );
}

describe('arrows along the line', () => {
  // one pass over the code: each use of a lucide icon whose name points left or right (an element, or the
  // icon given to another component), each arrow written as a character, and icons brought in another way
  const uses: { at: string; file: string; icon: string; flipped: boolean; turnsBack: boolean }[] = [];
  const typed: { at: string; turns: boolean; turned: boolean; turnsBack: boolean }[] = [];
  const otherImports: string[] = [];
  for (const f of files(SRC).filter((f) => !f.includes(join('lib', 'i18n')))) {
    const file = relative(SRC, f).replace(/\\/g, '/');
    // a .ts file read as TSX would take a cast like <string>x for an element
    const kind = f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const tree = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, kind);
    const at = (node: ts.Node) => `${file}:${tree.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
    const icons = new Map<string, string>();
    for (const statement of tree.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const from = statement.moduleSpecifier;
      if (!from || !ts.isStringLiteral(from) || !from.text.startsWith('lucide-react')) continue;
      const clause = ts.isImportDeclaration(statement) ? statement.importClause : undefined;
      const named = clause?.namedBindings;
      if (from.text !== 'lucide-react' || !clause || clause.name || !named || !ts.isNamedImports(named)) {
        otherImports.push(at(statement));
        continue;
      }
      for (const el of named.elements) {
        const icon = (el.propertyName ?? el.name).text;
        if (ALONG_THE_LINE.test(icon)) icons.set(el.name.text, icon);
      }
    }
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) || ts.isJsxClosingElement(node)) return;
      const icon = ts.isIdentifier(node) && !aName(node) ? icons.get(node.text) : undefined;
      if (icon) {
        const tag = node.parent;
        const classes =
          (ts.isJsxSelfClosingElement(tag) || ts.isJsxOpeningElement(tag)) && tag.tagName === node
            ? classesOf(tag)
            : [];
        uses.push({
          at: at(node),
          file,
          icon,
          flipped: classes.some((c) => c.name === FLIP && c.always),
          turnsBack: turnsBack(classes),
        });
      }
      // any text in the code, shown on a screen or not: a → kept in a constant still shows somewhere
      const text =
        ts.isJsxText(node) ||
        ts.isStringLiteralLike(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node);
      const arrows = text && node.text.match(TYPED_ARROW);
      if (arrows) {
        const element = shownIn(node);
        const classes = element ? classesOf(element) : [];
        typed.push({
          at: `${at(node)} ${arrows.join('')}`,
          turns: !NEVER_TURNS.test(arrows.join('')),
          turned: quarterTurns(classes).length > 0,
          turnsBack: turnsBack(classes),
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }

  it('come in by name from lucide-react, so each one is seen here', () => {
    expect(otherImports).toEqual([]);
  });

  it('turn with the page in Arabic, or stay where they are for a reason', () => {
    expect(
      uses.filter((u) => !u.flipped && !STAYS[u.icon]?.where.includes(u.file)).map((u) => `${u.at} ${u.icon}`),
    ).toEqual([]);
  });

  it('that stay are each still where they stay', () => {
    expect(
      Object.entries(STAYS).flatMap(([icon, { where }]) =>
        where.filter((file) => !uses.some((u) => u.icon === icon && u.file === file)).map((f) => `${f} ${icon}`),
      ),
    ).toEqual([]);
  });

  it('written as characters are ones that turn by themselves: › ‹ « », never → or ←', () => {
    expect(typed.filter((t) => !t.turns).map((t) => t.at)).toEqual([]);
  });

  it('turned a quarter, to point down when open, turn the other way in Arabic', () => {
    expect([...uses, ...typed].filter((u) => !u.turnsBack).map((u) => u.at)).toEqual([]);
  });

  it('are found: the month and page arrows, the links out, Bring over, the questions in Support', () => {
    expect(
      ['ChevronLeft', 'ChevronRight', 'ExternalLink', 'FolderInput'].filter(
        (icon) => !uses.some((u) => u.icon === icon && u.flipped),
      ),
    ).toEqual([]);
    // the question's arrow: turned when open, and the other way in Arabic
    expect(typed.filter((t) => t.at.startsWith('views/SupportView.tsx')).map((t) => [t.turned, t.turnsBack])).toEqual([
      [true, true],
    ]);
  });
});

describe('a path through the menus ("Settings → Restore")', () => {
  const forms = (m: string | PluralForms) => (typeof m === 'string' ? [m] : Object.values(m).filter(Boolean));
  const english = messagesOf('en');
  const paths = Object.keys(english).filter((key) => forms(english[key as MessageKey]).some((t) => t.includes('→')));

  it('has its arrows', () => {
    expect(paths.length).toBeGreaterThanOrEqual(3);
  });

  it.each(LANGUAGES.filter((l) => l.code !== 'en'))('points the way $name reads', ({ code, dir }) => {
    const theirs = messagesOf(code);
    const [along, against] = dir === 'rtl' ? ['←', '→'] : ['→', '←'];
    const wrong = Object.keys(theirs).filter((key) => {
      const texts = forms(theirs[key as MessageKey]);
      return texts.some((t) => t.includes(against)) || (paths.includes(key) && !texts.every((t) => t.includes(along)));
    });
    expect(wrong).toEqual([]);
  });
});

describe('a name in its own direction (dir="auto")', () => {
  it('lines up with the page in Chromium, which knows match-parent only as -webkit-match-parent', () => {
    const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8');
    const rule = css.match(/\[dir='auto'\]\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/text-align:\s*-webkit-match-parent;/);
  });
});
