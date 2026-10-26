import { pad2 } from '../utils';
import { planColumns } from './columns';
import { tr } from '../i18n';
import { UNPACKED_LIMIT, workbookTooLarge } from './size';
import { findTable } from './table';

/**
 * Excel workbooks (.xlsx), read with no library. An .xlsx is a zip of XML
 * files: the zip is opened here and unpacked with the platform's own
 * DecompressionStream (every browser, WebView2 and Android's WebView have
 * it), and each sheet's cells become rows of text the way a CSV export would
 * have written them, for the rest of the import to read unchanged. Dates
 * and times, which Excel keeps as numbers with a date format, come out as
 * 2026-03-02 09:31:05. The old binary .xls format is not read.
 */

export interface WorkbookSheet {
  name: string;
  rows: string[][];
}

/** a file that starts like a zip, as every .xlsx does */
export const isZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4;
/** a file that starts like an old binary Office document (.xls) */
export const isOldExcel = (b: Uint8Array) =>
  b.length > 4 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;

/** what is wrong with a workbook, worded for the import window */
export class WorkbookError extends Error {}

// ---- the zip --------------------------------------------------------------

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/** a part unpacked, refused once it passes `limit` bytes, whatever size the zip claims for it */
async function inflate(data: Uint8Array, limit: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new WorkbookError(tr('imp.xlsx.noReader'));
  const reader = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new WorkbookError(workbookTooLarge());
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** the files in a zip, by name, each unpacked when it is asked for, up to `limit` bytes */
function zipFiles(b: Uint8Array, limit: number): Map<string, () => Promise<string>> {
  // the end of the central directory is in the last 22 bytes, or before a comment of up to 64 KB
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (u32(b, i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new WorkbookError(tr('imp.xlsx.damaged'));
  const decoder = new TextDecoder();
  const files = new Map<string, () => Promise<string>>();
  let at = u32(b, end + 16);
  for (let n = u16(b, end + 10); n > 0; n--) {
    if (u32(b, at) !== 0x02014b50) throw new WorkbookError(tr('imp.xlsx.damaged'));
    const method = u16(b, at + 10);
    const size = u32(b, at + 20);
    const unpacked = u32(b, at + 24);
    const nameLength = u16(b, at + 28);
    const local = u32(b, at + 42);
    const name = decoder.decode(b.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + u16(b, at + 30) + u16(b, at + 32);
    files.set(name, async () => {
      // what the zip says first, so an honest large part is refused before any of it is unpacked
      if (unpacked > limit) throw new WorkbookError(workbookTooLarge());
      const start = local + 30 + u16(b, local + 26) + u16(b, local + 28);
      const data = b.subarray(start, start + size);
      if (method === 0) return decoder.decode(data);
      if (method === 8) return decoder.decode(await inflate(data, limit));
      throw new WorkbookError(tr('imp.xlsx.packed'));
    });
  }
  return files;
}

// ---- the XML --------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
/** XML's escapes, then Office's own for characters XML cannot hold (_x000D_) */
const unescape = (s: string) =>
  s
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e: string) =>
      e[0] === '#'
        ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
        : (ENTITIES[e] ?? whole),
    )
    .replace(/_x([0-9a-f]{4})_/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
/** the text of a string item: one <t>, or several runs of rich text; phonetic guides left out */
const textOf = (xml: string) =>
  [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((m) => unescape(m[1]))
    .join('');

// ---- dates ----------------------------------------------------------------

/** Excel's built-in formats that are dates or times, with what they show */
const BUILT_IN: Record<number, string> = {
  14: 'm/d/yyyy',
  15: 'd-mmm-yy',
  16: 'd-mmm',
  17: 'mmm-yy',
  18: 'h:mm AM/PM',
  19: 'h:mm:ss AM/PM',
  20: 'h:mm',
  21: 'h:mm:ss',
  22: 'm/d/yyyy h:mm',
  45: 'mm:ss',
  46: '[h]:mm:ss',
  47: 'mm:ss.0',
};
// the East Asian built-in date formats
for (const id of [27, 28, 29, 30, 31, 34, 35, 36, 50, 51, 52, 53, 54, 57, 58]) BUILT_IN[id] = 'yyyy-mm-dd';
for (const id of [32, 33, 55, 56]) BUILT_IN[id] = 'h:mm:ss';

/** whether a number format shows a date, a time, both, or neither */
function dateKind(code: string | undefined): 'date' | 'time' | 'both' | null {
  if (!code) return null;
  const bare = code
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[(?![hms]+\])[^\]]*\]/gi, '');
  const date = /[dy]/i.test(bare) || /m{3,}/i.test(bare);
  const time = /[hs]/i.test(bare);
  return date && time ? 'both' : date ? 'date' : time ? 'time' : null;
}

/** an Excel date number as text the importer reads: 2026-03-02 09:31:05 */
function dateText(serial: number, kind: 'date' | 'time' | 'both', date1904: boolean): string {
  const seconds = Math.round((serial + (date1904 ? 1462 : 0)) * 86400);
  const d = new Date(Date.UTC(1899, 11, 30) + seconds * 1000);
  const day = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  const clock = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
  if (kind === 'time' && serial < 1) return clock;
  if (kind === 'date' && Number.isInteger(serial)) return day;
  return `${day} ${clock}`;
}

/** a number as a CSV would have it: 21010.75, not 21010.749999999996 */
const numberText = (raw: string) => {
  const n = Number(raw);
  return Number.isFinite(n) ? String(Number(n.toPrecision(15))) : raw;
};

// ---- the workbook ---------------------------------------------------------

/** "C" is column 2 (from 0), "AB" column 27 */
const columnOf = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64);
  return n - 1;
};

/**
 * Every sheet of an .xlsx workbook, in order, as rows of text. A part of it
 * that unpacks to more than `limit` bytes is refused (see size.ts).
 */
export async function readWorkbook(bytes: Uint8Array, limit = UNPACKED_LIMIT): Promise<WorkbookSheet[]> {
  if (isOldExcel(bytes)) throw new WorkbookError(tr('imp.xlsx.old'));
  if (!isZip(bytes)) throw new WorkbookError(tr('imp.xlsx.notWorkbook'));
  const files = zipFiles(bytes, limit);
  const read = (name: string) => files.get(name)?.() ?? Promise.resolve('');
  const workbook = await read('xl/workbook.xml');
  if (!workbook) throw new WorkbookError(tr('imp.xlsx.zipNotWorkbook'));
  const [rels, shared, styles] = await Promise.all([
    read('xl/_rels/workbook.xml.rels'),
    read('xl/sharedStrings.xml'),
    read('xl/styles.xml'),
  ]);

  const date1904 = /<workbookPr\b[^>]*\sdate1904="(1|true)"/.test(workbook);
  const strings = [...shared.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si\s*\/>/g)].map((m) => textOf(m[1] ?? ''));
  const formats = new Map<number, string>(Object.entries(BUILT_IN).map(([id, code]) => [Number(id), code]));
  for (const m of styles.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = Number(attr(m[0], 'numFmtId'));
    const code = attr(m[0], 'formatCode');
    if (code != null) formats.set(id, unescape(code));
  }
  const cellFormats = styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '';
  const kinds = [...cellFormats.matchAll(/<xf\b[^>]*>/g)].map((m) =>
    dateKind(formats.get(Number(attr(m[0], 'numFmtId')))),
  );

  const targets = new Map(
    [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], 'Id'), attr(m[0], 'Target') ?? ''] as const),
  );
  const sheets: WorkbookSheet[] = [];
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const target = targets.get(attr(m[0], 'r:id')) ?? '';
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    const xml = await read(path);
    const rows: string[][] = [];
    for (const row of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const index = Number(attr(row[1], 'r') ?? rows.length + 1) - 1;
      const cells: string[] = [];
      for (const c of (row[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(c[1], 'r');
        const column = ref ? columnOf(ref) : cells.length;
        const type = attr(c[1], 't');
        const body = c[2] ?? '';
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let text = '';
        if (type === 's') text = v == null ? '' : (strings[Number(v)] ?? '');
        else if (type === 'inlineStr') text = textOf(body.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? '');
        else if (type === 'b') text = v === '1' ? 'TRUE' : v === '0' ? 'FALSE' : '';
        else if (type === 'str' || type === 'e' || type === 'd') text = v == null ? '' : unescape(v);
        else if (v != null) {
          const kind = kinds[Number(attr(c[1], 's') ?? 0)];
          text = kind && Number.isFinite(Number(v)) ? dateText(Number(v), kind, date1904) : numberText(v);
        }
        cells[column] = text;
      }
      rows[index] = Array.from(cells, (cell) => cell ?? '');
    }
    sheets.push({
      name: unescape(attr(m[0], 'name') ?? tr('imp.xlsx.sheet', { n: sheets.length + 1 })),
      rows: Array.from(rows, (r) => r ?? []),
    });
  }
  if (!sheets.length) throw new WorkbookError(tr('imp.xlsx.noSheets'));
  return sheets;
}

/** a sheet written out as CSV, every cell quoted, for the CSV import to read */
export const sheetToCsv = (sheet: WorkbookSheet) =>
  sheet.rows.map((row) => row.map((cell) => (cell ? `"${cell.replace(/"/g, '""')}"` : '')).join(',')).join('\n');

/**
 * Which sheet looks most like a list of trades: the most columns the importer
 * knows by name (a column guessed from its words counts for nothing, so a
 * summary sheet of "Realised P&L" and "Broker Charges" does not win), then
 * the most rows.
 */
export function likeliestSheet(sheets: WorkbookSheet[]): number {
  let best = 0;
  let bestScore = -1;
  sheets.forEach((sheet, i) => {
    const rows = sheet.rows.filter((r) => r.some((c) => c.trim()));
    if (rows.length < 2) return;
    const table = findTable(rows);
    const { columns } = planColumns(table.header, table.data.slice(0, 50));
    const known = new Set(columns.filter((c) => c.role && !c.guessed).map((c) => c.role));
    const score = known.size * 1e6 + table.data.length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}
