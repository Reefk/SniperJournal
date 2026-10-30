import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { messagesOf } from '@/lib/i18n';
import { ENGLISH_ONLY, looksEnglish, withoutKept } from './i18n-kept';

/**
 * English written straight into the app's code instead of through tr(): on a
 * screen in another language it would still show in English. The test reads
 * every file under src/ (the message files in src/lib/i18n aside) with
 * TypeScript's parser and lists each text a person could read there: JSX
 * text, the text of attributes such as title and aria-label, and strings that
 * look like words. What stays in English on purpose is in KEPT_IN_CODE below,
 * each with its reason.
 */

/** words a person reads: two of them, or one with a capital ("Saved") */
const wordy = (s: string) => /\p{L}{2,}[ ,.:;!?'"()&]+\p{L}{2,}/u.test(s) || /^\p{Lu}\p{Ll}{2,}/u.test(s.trim());
/** CSS classes: most of the parts have a - : [ ] or / in them, and none is a capitalised word ("Win/Loss") */
const classes = (s: string) => {
  const parts = s.trim().split(/\s+/);
  return (
    parts.filter((p) => /[-:[\]/]/.test(p)).length >= Math.max(1, parts.length / 2) &&
    !/(^|[^\p{L}])\p{Lu}\p{Ll}{2,}/u.test(s)
  );
};
/** a message key, or the start of one ("plat.group.") */
const key = (s: string) => /^[\w-]+(\.[\w-]+)+\.?$/.test(s);
/** a web address, the same in every language ("tradingview.com", an example link) */
const address = (s: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s.trim());
/** a CSS value: one with a variable in it, a colour, or the unit after a value in a template */
const css = (s: string) => /var\(--|^#[0-9a-f]{3,8}$|^(px|ms|rem|em|%)$/i.test(s);
/** a word beside a value in a template, as in `${n} pts`; not a path or a query */
const pieced = (node: ts.Node, s: string) =>
  (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) &&
  /(?<![\w$.-])\p{L}{2,}(?![\w-])/u.test(s) &&
  !/[/=?#]/.test(s);

/** attributes a person (or a screen reader) reads: any word in one is text */
const TEXT_ATTRIBUTES = new Set(['title', 'placeholder', 'alt', 'aria-label', 'aria-description', 'aria-valuetext']);
/** attributes that hold code: classes, ids, links, types, and SVG drawing */
const CODE_ATTRIBUTES = new Set([
  'className',
  'key',
  'id',
  'href',
  'src',
  'type',
  'variant',
  'size',
  'lang',
  'dir',
  'role',
  'name',
  'inputMode',
  'autoComplete',
  'htmlFor',
  'style',
  'rel',
  'target',
  'accept',
  'pattern',
  'enterKeyHint',
  'd',
  'viewBox',
  'fill',
  'stroke',
  'strokeLinecap',
  'strokeLinejoin',
  'transform',
  'textAnchor',
  'dominantBaseline',
  'fontFamily',
]);
/** calls whose strings are code: class names, imports, a language's code (tr()'s key is skipped, its values are not) */
const CODE_CALLS = new Set(['cn', 'clsx', 'require', 'messagesOf']);
/** methods whose strings are code: selectors, lookups, the console */
const CODE_METHODS = new Set([
  'console.log',
  'console.warn',
  'console.error',
  '.querySelector',
  '.querySelectorAll',
  '.closest',
  '.matches',
  '.indexOf',
  '.includes',
  '.has',
  '.get',
  '.startsWith',
  '.endsWith',
]);
const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

const callee = (call: ts.CallExpression) => {
  const name = call.expression.getText();
  if (CODE_CALLS.has(name) || CODE_METHODS.has(name)) return true;
  return ts.isPropertyAccessExpression(call.expression) && CODE_METHODS.has(`.${call.expression.name.text}`);
};

const attributeOf = (node: ts.Node) => {
  const parent = ts.isJsxExpression(node.parent) ? node.parent.parent : node.parent;
  return parent && ts.isJsxAttribute(parent) ? parent.name.getText() : undefined;
};

/** a string that is code, not text, by where it is */
function code(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateLiteralLikeNode): boolean {
  const parent = node.parent;
  // an object's property name; 'use client'; obj['name']; a type
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isExpressionStatement(parent) || ts.isElementAccessExpression(parent) || ts.isLiteralTypeNode(parent))
    return true;
  // a comparison or a case: a key name, an error's name, a value as it is saved
  if (ts.isBinaryExpression(parent) && COMPARISONS.has(parent.operatorToken.kind)) return true;
  return ts.isCaseClause(parent);
}

interface Hit {
  file: string;
  line: number;
  text: string;
}

/** every English-looking text in one file's code */
function scan(file: string, source: string): Hit[] {
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hits: Hit[] = [];
  const hit = (node: ts.Node, text: string) =>
    hits.push({
      file,
      line: tree.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      text: text.replace(/\s+/g, ' ').trim(),
    });

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return;
    if (ts.isCallExpression(node) && callee(node)) return;
    // tr('key', { values }): the key is code, the values may be text
    if (ts.isCallExpression(node) && node.expression.getText() === 'tr') {
      node.arguments.slice(1).forEach(visit);
      return;
    }
    if (ts.isJsxAttribute(node) && CODE_ATTRIBUTES.has(node.name.getText())) return;
    if (ts.isJsxText(node)) {
      // &nbsp; and &times; are not words
      if (/\p{L}/u.test(node.text.replace(/&\w+;|&#\w+;/g, ''))) hit(node, node.text);
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateLiteralToken(node)) {
      const text = node.text;
      const attribute = attributeOf(node);
      if (attribute && TEXT_ATTRIBUTES.has(attribute)) {
        if (/\p{L}{2,}/u.test(text) && !address(text)) hit(node, text);
        return;
      }
      if (code(node) || key(text) || classes(text) || css(text)) return;
      if (wordy(text) || pieced(node, text)) hit(node, text);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return hits;
}

/** a text that stays in English on purpose; with no texts, everything in the file (or folder, ending in /) */
interface Kept {
  file: string;
  texts?: (string | RegExp)[];
  why: string;
}

/** the app's name, the same in every language */
const NAME = 'Sniper Journal';

const KEPT_IN_CODE: Kept[] = [
  // ---- not shown in the app
  {
    file: 'src/app/api/',
    why: "the browser version's server: retired, kept for the e2e tests, and run in Node, where no language is chosen",
  },
  { file: 'src/lib/storage/web.ts', why: "the browser version's messages, the same as its server's" },
  {
    file: 'src/app/layout.tsx',
    texts: ['A trading journal and performance analytics desktop app that keeps your data on your own PC.'],
    why: "the page's description, written once when the app is built, before a language is chosen",
  },
  {
    file: 'src/app/manifest.ts',
    texts: ['Your trading journal and performance analytics, kept on this computer.'],
    why: "the app's description for the system, written once when the app is built",
  },
  {
    file: 'src/lib/storage/tauri.ts',
    texts: ['A newer version of Sniper Journal saved the journal.'],
    why: 'never shown: the app only checks that the error is a JournalConflict',
  },
  {
    file: 'src/store/JournalProvider.tsx',
    texts: [/must be used inside/],
    why: 'for developers: a hook used outside its provider',
  },
  { file: 'src/store/UIProvider.tsx', texts: [/must be used inside/], why: 'for developers' },

  // ---- saved under an English name, and shown through tr()
  {
    file: 'src/lib/starting-mistakes.ts',
    why: 'the starting mistakes are saved under their English names; mistakeName() shows them in the language on screen',
  },
  {
    file: 'src/lib/sample.ts',
    texts: [
      'Entered early (FOMO)',
      'Chased the entry',
      'Moved my stop',
      'Oversized',
      'Held a loser too long',
      'Exited too early',
    ],
    why: "the test journal's mistakes: starting mistakes, by their English names",
  },
  {
    file: 'src/lib/sessions.ts',
    texts: ['Asia', 'London', 'New York', 'After Hours'],
    why: 'sessions are saved under their English names, and shown through tr()',
  },
  {
    file: 'src/views/ResourcesView.tsx',
    texts: ['Charting', 'News & data', 'Education', 'Broker', 'Tools', 'Reading', 'Other'],
    why: "a resource's category is saved under its English name, and shown through categoryName()",
  },
  {
    file: 'src/lib/insights.ts',
    texts: ['Edge', 'Timing', 'Behaviour', 'Risk', 'Cost'],
    why: "an insight's category: a key, shown through tr()",
  },
  {
    file: 'src/lib/stats.ts',
    texts: ['Start'],
    why: "the equity curve's first point: a key the chart shows through tr()",
  },
  {
    file: 'src/lib/trade-math.ts',
    texts: ['entry time', 'entry price'],
    why: 'what missingDetails() names; the screens word it through tr()',
  },
  {
    file: 'src/lib/format.ts',
    texts: [
      /^(January|February|March|April|May|June|July|August|September|October|November|December)$/,
      /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/,
    ],
    why: 'the English names of months and days, used only when the language is English (the rest use Intl)',
  },

  // ---- journal data
  {
    file: 'src/lib/journal.ts',
    texts: ['Main Portfolio'],
    why: 'the account a new journal starts with; the Welcome window names it in the language chosen',
  },
  {
    file: 'src/store/sanitize.ts',
    texts: ['Account', 'Other'],
    why: "the names a damaged journal's nameless account and unknown resource category are given ('Other' is a category, above)",
  },
  {
    file: 'src/lib/csv.ts',
    texts: [/^(AAPL|EURUSD),(LONG|SHORT),$/, /,Main Portfolio$/],
    why: "the CSV template's example rows, in English as a broker's file would be (decided 2026-10-30)",
  },

  // ---- as brokers and platforms write them
  {
    file: 'src/lib/import/values.ts',
    why: 'words brokers write in their files (buy, sell, long); read, never shown',
  },
  { file: 'src/lib/import/words.ts', why: "words of brokers' column names; read, never shown" },
  {
    file: 'src/lib/import/platforms.ts',
    why: "platforms' names and their own names for menus and reports (texts are plat.* keys); the groups are keys too",
  },
  {
    file: 'src/lib/import/positions.ts',
    texts: ['no quantity', 'no symbol', 'no price'],
    why: 'why a row was skipped: a code, worded through tr() in the import window',
  },
  {
    file: 'src/lib/import/cash.ts',
    texts: ['Fees'],
    why: "a column the importer adds beside the broker's, named so its column matcher reads it",
  },
  {
    file: 'src/lib/import/table.ts',
    texts: ['Symbol'],
    why: "a column the importer adds beside the broker's, named so its column matcher reads it",
  },
  { file: 'src/lib/import/xlsx.ts', texts: ['Target'], why: "an attribute's name in a workbook's XML" },
  { file: 'src/lib/import/size.ts', texts: ['MB'], why: 'a unit, the same in every language (KEPT in i18n-kept.ts)' },
  {
    file: 'src/components/trades/ImportTradesModal.tsx',
    texts: ['Qty', 'Filled', 'Market pos.', 'Net P&L (USD)', 'Comm/Fee', 'Date/Time', 'Start Price', 'Lots Traded'],
    why: "brokers' column names, as brokers write them",
  },
  {
    file: 'src/lib/import/report.ts',
    texts: ['Cash Balance', 'Account Trade History', 'Trades'],
    why: "a statement's sections, named as the statement names them",
  },

  // ---- names and codes
  { file: 'src/views/ResourcesView.tsx', texts: ['TradingView'], why: "a product's name, in an example" },
  { file: 'src/components/trades/TradeFormModal.tsx', texts: ['NVDA, EURUSD, BTC'], why: 'symbols, in an example' },
  {
    file: 'src/components/layout/ClockDisplay.tsx',
    texts: ['America/New_York', 'Europe/London', 'Asia/Tokyo'],
    why: "time zones' ids; the clocks are named through tr()",
  },

  // ---- keys and commands, as they are typed
  {
    file: 'src/views/SupportView.tsx',
    texts: ['Ctrl K', 'Ctrl + Enter', 'Esc', 'npm start', 'npm run dev', 'realized pnl'],
    why: "the keys on the keyboard, and the commands and a broker's column heading as they are typed",
  },
  { file: 'src/components/layout/GlobalSearch.tsx', texts: ['Ctrl K'], why: 'the keys on the keyboard' },
  { file: 'src/components/layout/Header.tsx', texts: ['N'], why: 'the key on the keyboard (shortcutLetter())' },
  { file: 'src/hooks/useAndroidBack.ts', texts: ['Escape'], why: 'the key a key event names' },
];

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const FILES = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .map((path) => `src/${path.split(/[\\/]/).join('/')}`)
  .filter((path) => /\.[cm]?[jt]sx?$/.test(path) && !path.startsWith('src/lib/i18n/'));

const inFile = (kept: Kept, file: string) =>
  kept.file.endsWith('/') ? file.startsWith(kept.file) : file === kept.file;
const matches = (pattern: string | RegExp, text: string) =>
  typeof pattern === 'string' ? pattern === text : pattern.test(text);
/** the entry that keeps this text, and the pattern in it */
const keptBy = (hit: Hit) => {
  for (const kept of KEPT_IN_CODE.filter((k) => inFile(k, hit.file))) {
    if (!kept.texts) return { kept, pattern: undefined };
    const pattern = kept.texts.find((p) => matches(p, hit.text));
    if (pattern !== undefined) return { kept, pattern };
  }
  return undefined;
};

describe('English written into the code', () => {
  const hits = FILES.flatMap((file) => scan(file, readFileSync(join(ROOT, file), 'utf8')));

  it('is all kept on purpose: every other text goes through tr()', () => {
    const left = hits.filter((hit) => hit.text !== NAME && !keptBy(hit));
    expect(left.map((hit) => `${hit.file}:${hit.line}: ${hit.text}`)).toEqual([]);
  });

  it('is still there for each reason given, so none outlives its code', () => {
    // by entry: the same text kept in two files is two reasons
    const used = new Map<Kept, Set<string | RegExp | undefined>>();
    for (const found of hits.map(keptBy)) {
      if (found) used.set(found.kept, (used.get(found.kept) ?? new Set()).add(found.pattern));
    }
    const stale = KEPT_IN_CODE.flatMap((kept) =>
      kept.texts
        ? kept.texts.filter((p) => !used.get(kept)?.has(p)).map((p) => `${kept.file}: ${String(p)}`)
        : used.has(kept)
          ? []
          : [kept.file],
    );
    expect(stale).toEqual([]);
  });

  it('is kept in files that are there', () => {
    expect(KEPT_IN_CODE.filter((kept) => !existsSync(join(ROOT, kept.file))).map((kept) => kept.file)).toEqual([]);
  });
});

describe('the scanner', () => {
  it.each([
    ['text in JSX', 'src/views/A.tsx', 'export const A = () => <p>Hello there</p>;', 'Hello there'],
    ['one word in JSX', 'src/views/A.tsx', 'export const A = () => <span>trades</span>;', 'trades'],
    ['a title', 'src/views/A.tsx', 'export const A = () => <button title="delete">x</button>;', 'delete'],
    ['an aria-label in braces', 'src/views/A.tsx', "export const A = () => <i aria-label={'close'} />;", 'close'],
    ["a component's text prop", 'src/views/A.tsx', 'export const A = () => <Card subtitle="Best day" />;', 'Best day'],
    ['a toast', 'src/views/A.tsx', "toast('Saved the trade', 'success');", 'Saved the trade'],
    ['a template', 'src/lib/a.ts', 'export const f = (n: number) => `${n} trades closed`;', 'trades closed'],
    ['one word beside a value', 'src/lib/a.ts', 'export const f = (n: number) => `${n} pts`;', 'pts'],
    ['a constant', 'src/lib/a.ts', "export const LABEL = 'Win rate';", 'Win rate'],
    ['an error shown', 'src/lib/a.ts', "throw new Error('Could not read the file.');", 'Could not read the file.'],
    ['a property value', 'src/lib/a.ts', "export const o = { label: 'Profit factor' };", 'Profit factor'],
    ['a value named key', 'src/lib/a.ts', "export const c = { key: 'Win rate' };", 'Win rate'],
    ['a string in braces in JSX', 'src/views/A.tsx', "export const A = () => <p>{'Hello there'}</p>;", 'Hello there'],
    ['a branch', 'src/views/A.tsx', "toast(ok ? 'Saved' : 'Failed');", 'Failed'],
    ['a string in a list', 'src/lib/a.ts', "export const L = ['Best day', 'Worst day'];", 'Worst day'],
    ['a placeholder', 'src/views/A.tsx', 'export const A = () => <input placeholder="symbol" />;', 'symbol'],
    ['text between values', 'src/lib/a.ts', 'export const f = (a: number, b: number) => `${a} of ${b} done`;', 'of'],
    ['a value given to tr()', 'src/views/A.tsx', "tr('a.key', { side: 'Long position' });", 'Long position'],
    ['a percentage in text', 'src/lib/a.ts', "export const R = 'Risk over 2% per trade';", 'Risk over 2% per trade'],
    ['a word with a dash', 'src/lib/a.ts', "export const S = 'Stop-loss';", 'Stop-loss'],
    ['two words with a slash', 'src/lib/a.ts', "export const W = 'Win/Loss';", 'Win/Loss'],
    ['a label with a colon', 'src/lib/a.ts', "export const T = 'Total:';", 'Total:'],
  ])('finds %s', (_, file, source, text) => {
    expect(scan(file, source).map((hit) => hit.text)).toContain(text);
  });

  it.each([
    ['classes', 'export const A = () => <div className="flex items-center gap-2" />;'],
    ['classes in cn()', "cn('rounded-xl border', on && 'bg-accent text-white');"],
    ['a key', "tr('dash.title');"],
    ['a key with a value in it', 'tr(`plat.group.${group}`);'],
    ['a key name compared', "if (event.key === 'Enter') go();"],
    ['a case', "switch (kind) { case 'Long Side': break; }"],
    ['an import', "import x from 'some module';"],
    ['a type', "type Side = 'Long Side' | 'Short Side';"],
    ['the console', "console.warn('could not save it');"],
    ['a selector', "el.closest('header input');"],
    ['a CSS value', "const s = { width: 'calc(100% - 2rem)' };"],
    ['a CSS value in a template', 'el.style.paddingInlineEnd = `${width}px`;'],
    ['a path', 'const url = `/trades/${id}?view=list`;'],
    ["an object's property names", "const o = { 'New York': 1 };"],
    ['an inline style', "export const A = () => <div style={{ width: '50%', gridArea: 'main' }} />;"],
    ['a key attribute', "export const A = () => <li key={'row ' + id} />;"],
    ['a lookup', "if (names.includes('realized pnl')) go();"],
    ['a time format', "const f = 'h:mm AM/PM';"],
    ['a space in JSX', 'export const A = () => <p>{a}&nbsp;{b}</p>;'],
    // a lone lowercase word or capitals ('trades', 'OK') is too often code to count; JSX text and the text attributes still do
    ['one lowercase word in code', "const kind = 'trades';"],
  ])('passes %s', (_, source) => {
    expect(scan('src/views/A.tsx', source)).toEqual([]);
  });
});

describe('the Spanish screen check', () => {
  const texts = (code: 'en' | 'es') =>
    Object.values(messagesOf(code)).flatMap((m) => (typeof m === 'string' ? [m] : Object.values(m)));

  it('knows the words only the English texts have', () => {
    expect(ENGLISH_ONLY.size).toBeGreaterThan(500);
    expect(looksEnglish('Daily P&L')).toBe(true);
    expect(looksEnglish(`${messagesOf('es')['dash.daily']} · Daily P&L`)).toBe(true);
  });

  it('takes none of its words from a Spanish text, and passes the names kept in every language', () => {
    const words = (text: string) =>
      withoutKept(text)
        .toLowerCase()
        .match(/\p{L}{3,}/gu) ?? [];
    expect(texts('es').filter((text) => words(text).some((w) => ENGLISH_ONLY.has(w)))).toEqual([]);
    expect(looksEnglish('Sniper Journal · FOMO · VWAP')).toBe(false);
  });

  it('finds most English texts', () => {
    const english = texts('en').filter(Boolean);
    expect(english.filter((text) => looksEnglish(text)).length / english.length).toBeGreaterThan(0.9);
  });
});
