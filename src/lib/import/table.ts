import { aliasOf } from './columns';

/**
 * Finding the table inside a broker's file: the delimiter, the header row
 * (which is not always the first line: many exports open with a title, an
 * account number or a date range), and where the trades stop.
 */

const DELIMITERS = [',', ';', '\t', '|'] as const;

/** how often `delimiter` appears outside quotes on one line */
function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0;
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === delimiter && !quoted) count++;
  }
  return count;
}

/**
 * The delimiter that splits the first lines most consistently: the one with
 * the highest median count. Ties go to the comma, then the semicolon.
 */
export function detectDelimiter(text: string): string {
  const lines = text
    .split('\n')
    .filter((l) => l.trim())
    .slice(0, 25);
  if (!lines.length) return ',';
  let best: string = ',';
  let bestScore = -1;
  for (const d of DELIMITERS) {
    const counts = lines.map((l) => countOutsideQuotes(l, d)).sort((a, b) => a - b);
    const median = counts[Math.floor(counts.length / 2)];
    const score = median + counts.filter((c) => c > 0).length / 1000;
    if (score > bestScore + 1e-9) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

/** RFC-ish CSV parser: quotes, embedded newlines, and the delimiter the file uses */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const sep = delimiter ?? detectDelimiter(clean);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    // a quote only opens a quoted field at its start; one in the middle of an
    // unquoted field (12" monitor) is just a character, and must not swallow
    // every delimiter and line after it
    if (ch === '"' && field.trim() === '') {
      quoted = true;
      field = '';
    } else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const TIME_ROLES = new Set(['time', 'date', 'opened_at', 'opened_date', 'bought_at', 'sold_at']);

/**
 * How strongly a row looks like a header: the distinct roles it names, plus
 * a symbol and a time each counting extra, and a P&L a little. A report with
 * several tables also lists its orders, filled or not; an order-status column
 * counts against a table, so the executed trades or positions win over it.
 */
function headerScore(row: string[]): number {
  // a data row can contain a word that is also a header name; headers do not contain numbers
  if (row.filter((c) => /^\s*[-+(]?[$€£]?\d[\d.,:/\s-]*\)?\s*$/.test(c)).length > 1) return 0;
  const roles = new Set(row.map((c) => aliasOf(c)?.role).filter((r): r is NonNullable<typeof r> => Boolean(r)));
  if (!roles.size) return 0;
  const has = (...names: string[]) => names.some((n) => roles.has(n as never));
  return (
    roles.size +
    (has('symbol') ? 2 : 0) +
    ([...roles].some((r) => TIME_ROLES.has(r)) ? 2 : 0) +
    (has('pnl', 'net_pnl', 'gross_pnl') ? 1 : 0) -
    (has('status') ? 3 : 0)
  );
}

const SECTION_KINDS = new Set(['header', 'data', 'subtotal', 'total', 'notes', 'summary']);

/**
 * Interactive Brokers activity statements put every table in one file, each
 * line starting with its section and its kind: "Trades,Header,...",
 * "Trades,Data,Order,...". Returns the trades section as an ordinary table,
 * or null when the file is not laid out that way.
 */
function statementSection(rows: string[][]): { header: string[]; data: string[][]; lines: number[]; skipped: number } | null {
  const kindOf = (r: string[]) => (r[1] ?? '').trim().toLowerCase();
  const tagged = rows.filter((r) => SECTION_KINDS.has(kindOf(r)));
  if (tagged.length < rows.length * 0.6 || tagged.length < 2) return null;

  const headers = rows.filter((r) => kindOf(r) === 'header');
  const named = headers.find((r) => /^trades?$/i.test(r[0].trim()));
  const best = named ?? [...headers].sort((a, b) => headerScore(b.slice(2)) - headerScore(a.slice(2)))[0];
  if (!best) return null;
  const section = best[0].trim();
  const header = best.slice(2);
  const names = header.map((h) => h.trim().toLowerCase());
  const discriminator = names.indexOf('datadiscriminator');

  // a statement repeats the section header per asset class, and the columns
  // can differ: each row is lined up with the first header by column name
  let current = names;
  let skipped = 0;
  const data: string[][] = [];
  const lines: number[] = [];
  rows.forEach((r, i) => {
    if (r[0].trim() !== section) return;
    if (kindOf(r) === 'header') {
      current = r.slice(2).map((h) => h.trim().toLowerCase());
      return;
    }
    if (kindOf(r) !== 'data') return;
    const cells = r.slice(2);
    const aligned = names.map((name) => {
      const at = current.indexOf(name);
      return at === -1 ? '' : (cells[at] ?? '');
    });
    // per-lot detail lines repeat an order that is already there
    const kind = discriminator === -1 ? '' : aligned[discriminator].trim().toLowerCase();
    if (kind && !['order', 'trade', 'trades', 'execution'].includes(kind)) {
      skipped++;
      return;
    }
    data.push(aligned);
    lines.push(i + 1);
  });
  return { header, data, lines, skipped };
}

export interface Table {
  header: string[];
  data: string[][];
  /** 1-based line of each data row in the file, for messages */
  lines: number[];
  /** lines before the header that were not part of the table */
  preamble: number;
  /** total and subtotal lines, section breaks and repeated headers left out */
  skipped: number;
  /** the file is an Interactive Brokers statement */
  statement: boolean;
}

const SUMMARY = /^(grand\s*)?(sub\s*)?totals?\b|^summary$|^net\s*total/i;

/**
 * The header is the row within the first 200 that names the most columns the
 * importer knows (see headerScore). Rows above it are a title or
 * account details; data stops at the next table in the file, and total rows
 * and repeated headers are left out along the way.
 */
export function findTable(rows: string[][]): Table {
  const statement = statementSection(rows);
  if (statement) {
    return {
      header: statement.header,
      data: statement.data,
      lines: statement.lines,
      preamble: 0,
      skipped: statement.skipped,
      statement: true,
    };
  }

  let headerAt = 0;
  let bestScore = 0;
  rows.slice(0, 200).forEach((row, i) => {
    const score = headerScore(row);
    if (score > bestScore) {
      bestScore = score;
      headerAt = i;
    }
  });

  const header = rows[headerAt] ?? [];
  const headerKey = header.map((h) => h.trim().toLowerCase()).join('|');
  const data: string[][] = [];
  const lines: number[] = [];
  let skipped = 0;

  for (let i = headerAt + 1; i < rows.length; i++) {
    const row = rows[i];
    const filled = row.filter((c) => c.trim());
    // the header again (a page break in the report): skip it
    if (row.map((h) => h.trim().toLowerCase()).join('|') === headerKey) {
      skipped++;
      continue;
    }
    // a lone title line, or another table's header, means this table has ended
    if ((filled.length === 1 && row.length < header.length / 2) || (i > headerAt + 1 && headerScore(row) >= Math.max(3, bestScore - 1))) {
      if (data.length) break;
      skipped++;
      continue;
    }
    if (SUMMARY.test(filled[0]?.trim() ?? '')) {
      skipped++;
      continue;
    }
    data.push(row);
    lines.push(i + 1);
  }
  return { header, data, lines, preamble: headerAt, skipped, statement: false };
}
