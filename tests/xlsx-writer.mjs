// A small .xlsx writer for the tests (tests/xlsx.test.ts) and the desktop
// journey: a real zip, deflated with CRCs, of the XML files Excel writes,
// enough to give the importer's reader numbers, shared and inline strings,
// booleans, dates and times in built-in and custom formats, gaps, and
// several sheets. Excel opens what it writes.
import { crc32, deflateRawSync } from 'node:zlib';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const columnName = (i) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

function zip(files, compress) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of files) {
    const data = Buffer.from(text, 'utf8');
    const body = compress ? deflateRawSync(data) : data;
    const fileName = Buffer.from(name, 'utf8');
    const method = compress ? 8 : 0;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(fileName.length, 28);
    entry.writeUInt32LE(offset, 42);
    parts.push(local, fileName, body);
    central.push(entry, fileName);
    offset += 30 + fileName.length + body.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}

/**
 * An .xlsx file as bytes. Each sheet is { name, rows }, and a cell is a
 * string (a shared string, or an inline one with `inlineStrings`), a number,
 * a boolean, null for none, or { serial, format } for a number shown with a
 * format: a built-in id (22 is m/d/yyyy h:mm) or a format code.
 *
 * @param {Array<{ name: string, rows: Array<Array<string | number | boolean | null | { serial: number, format: number | string }>> }>} sheets
 * @param {{ compress?: boolean, inlineStrings?: boolean, date1904?: boolean }} [options]
 * @returns {Uint8Array}
 */
export function makeXlsx(sheets, { compress = true, inlineStrings = false, date1904 = false } = {}) {
  const strings = [];
  const stringIndex = new Map();
  const customFormats = [];
  const styleOf = new Map(); // format -> index into cellXfs; 0 is General
  const style = (format) => {
    if (!styleOf.has(format)) {
      let id = format;
      if (typeof format === 'string') {
        id = 164 + customFormats.length;
        customFormats.push([id, format]);
      }
      styleOf.set(format, { index: styleOf.size + 1, id });
    }
    return styleOf.get(format).index;
  };

  const sheetXml = sheets.map(({ rows }) => {
    const body = rows
      .map((row, r) => {
        const cells = row
          .map((cell, c) => {
            const ref = `${columnName(c)}${r + 1}`;
            if (cell == null) return '';
            if (typeof cell === 'number') return `<c r="${ref}"><v>${cell}</v></c>`;
            if (typeof cell === 'boolean') return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`;
            if (typeof cell === 'object') return `<c r="${ref}" s="${style(cell.format)}"><v>${cell.serial}</v></c>`;
            if (inlineStrings)
              return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(cell)}</t></is></c>`;
            if (!stringIndex.has(cell)) {
              stringIndex.set(cell, strings.length);
              strings.push(cell);
            }
            return `<c r="${ref}" t="s"><v>${stringIndex.get(cell)}</v></c>`;
          })
          .join('');
        return `<row r="${r + 1}">${cells}</row>`;
      })
      .join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
  });

  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const xfs = [`<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>`]
    .concat(
      [...styleOf.values()].map(
        ({ id }) => `<xf numFmtId="${id}" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/>`,
      ),
    )
    .join('');
  const files = [
    [
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    ],
    [
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${ns} xmlns:r="${rel}"><workbookPr${date1904 ? ' date1904="1"' : ''}/><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${rel}/styles" Target="styles.xml"/><Relationship Id="rId${sheets.length + 2}" Type="${rel}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    ],
    [
      'xl/styles.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ${ns}><numFmts count="${customFormats.length}">${customFormats.map(([id, code]) => `<numFmt numFmtId="${id}" formatCode="${esc(code)}"/>`).join('')}</numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${styleOf.size + 1}">${xfs}</cellXfs></styleSheet>`,
    ],
    [
      'xl/sharedStrings.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst ${ns} count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`,
    ],
    ...sheetXml.map((xml, i) => [`xl/worksheets/sheet${i + 1}.xml`, xml]),
  ];
  return new Uint8Array(zip(files, compress));
}

/** the Excel date number of a moment given as numbers, in the 1900 date system */
export const excelSerial = (year, month, day, hour = 0, minute = 0, second = 0) =>
  (Date.UTC(year, month - 1, day, hour, minute, second) - Date.UTC(1899, 11, 30)) / 86_400_000;
