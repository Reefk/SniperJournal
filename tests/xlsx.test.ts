import { describe, expect, it } from 'vitest';
import { importTradesFromCsv } from '@/lib/csv';
import { isOldExcel, isZip, likeliestSheet, readWorkbook, sheetToCsv } from '@/lib/import/xlsx';
import { netPnl } from '@/lib/trade-math';
import { excelSerial, makeXlsx } from './xlsx-writer.mjs';

/**
 * Excel workbooks (lib/import/xlsx.ts), made by tests/xlsx-writer.mjs: the
 * reader is checked cell by cell, then a workbook goes through the whole
 * import the way a file chosen in the import window does.
 */

const accounts = [{ id: 'acc1', name: 'Main', startingBalance: 0, createdAt: '' }];
const importSheet = async (bytes: Uint8Array) => {
  const sheets = await readWorkbook(bytes);
  return importTradesFromCsv(sheetToCsv(sheets[likeliestSheet(sheets)]), { accountId: 'acc1', accounts, setups: [] });
};

describe('reading a workbook', () => {
  it('cells as text: shared and inline strings, numbers, booleans, escaped characters and gaps', async () => {
    for (const options of [{}, { inlineStrings: true }, { compress: false }]) {
      const bytes = makeXlsx(
        [
          {
            name: 'Trades & more',
            rows: [
              ['Symbol', 'Qty', 'Price', 'Flag', null, 'Note'],
              ['AAPL', 100, 187.4, true, null, 'a & <b> "c"'],
            ],
          },
        ],
        options,
      );
      expect(await readWorkbook(bytes), JSON.stringify(options)).toEqual([
        {
          name: 'Trades & more',
          rows: [
            ['Symbol', 'Qty', 'Price', 'Flag', '', 'Note'],
            ['AAPL', '100', '187.4', 'TRUE', '', 'a & <b> "c"'],
          ],
        },
      ]);
    }
  });

  it('dates and times kept as Excel date numbers come out as text the importer reads', async () => {
    const at = excelSerial(2026, 3, 2, 9, 31, 5);
    const bytes = makeXlsx([
      {
        name: 'Sheet1',
        rows: [
          [
            { serial: at, format: 22 },
            { serial: at, format: 'dd/mm/yyyy hh:mm:ss' },
            { serial: excelSerial(2026, 3, 2), format: 14 },
            { serial: (9 * 3600 + 35 * 60 + 10) / 86400, format: 21 },
            { serial: 0.5, format: '0.00' },
            { serial: 1234.5, format: '[$€-407] #,##0.00' },
            0.1 + 0.2,
          ],
        ],
      },
    ]);
    const [sheet] = await readWorkbook(bytes);
    expect(sheet.rows[0]).toEqual([
      '2026-03-02 09:31:05',
      '2026-03-02 09:31:05',
      '2026-03-02',
      '09:35:10',
      '0.5',
      '1234.5',
      '0.3',
    ]);
  });

  it('a workbook counting its dates from 1904', async () => {
    const serial = excelSerial(2026, 3, 2, 9, 31, 5) - 1462;
    const [sheet] = await readWorkbook(makeXlsx([{ name: 'S', rows: [[{ serial, format: 22 }]] }], { date1904: true }));
    expect(sheet.rows[0][0]).toBe('2026-03-02 09:31:05');
  });

  it('of several sheets, the one that looks most like a list of trades is chosen', async () => {
    const sheets = await readWorkbook(
      makeXlsx([
        {
          name: 'Summary',
          rows: [
            ['Account', 'Balance'],
            ['Main', 10000],
          ],
        },
        {
          name: 'Closed Positions',
          rows: [
            ['Symbol', 'Side', 'Qty', 'Entry Price', 'Exit Price', 'Open Time', 'Close Time'],
            ['AAPL', 'Long', 100, 187.4, 189.1, '2026-03-02 09:35', '2026-03-02 10:12'],
          ],
        },
        { name: 'Notes', rows: [['Exported by a test']] },
      ]),
    );
    expect(sheets.map((s) => s.name)).toEqual(['Summary', 'Closed Positions', 'Notes']);
    expect(likeliestSheet(sheets)).toBe(1);
  });

  it('an old .xls, and a file that is not a workbook, are refused with what to do', async () => {
    const xls = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect([isOldExcel(xls), isZip(xls)]).toEqual([true, false]);
    await expect(readWorkbook(xls)).rejects.toThrow(
      /old Excel file \(\.xls\)\. Open it in Excel and save it as \.xlsx or CSV/,
    );
    await expect(readWorkbook(new TextEncoder().encode('symbol,qty\nAAPL,1'))).rejects.toThrow(/not an Excel workbook/);
    await expect(readWorkbook(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0, 0]))).rejects.toThrow(/damaged/);
  });
});

describe('importing from a workbook', () => {
  it('NinjaTrader executions saved for Excel: real date cells, the same 2 trades as the CSV', async () => {
    const time = (h: number, m: number, s: number) => ({ serial: excelSerial(2026, 3, 2, h, m, s), format: 22 });
    const r = await importSheet(
      makeXlsx([
        {
          name: 'Executions',
          rows: [
            ['Instrument', 'Action', 'Quantity', 'Price', 'Time', 'ID', 'E/X', 'Commission', 'Account'],
            ['MNQ 03-26', 'Buy', 2, 21000.25, time(9, 31, 5), 'e1', 'Entry', 0.62, 'Sim101'],
            ['MNQ 03-26', 'Sell', 2, 21010.75, time(9, 45, 10), 'e2', 'Exit', 0.62, 'Sim101'],
            ['MNQ 03-26', 'Sell', 1, 21020, time(10, 2, 0), 'e3', 'Entry', 0.31, 'Sim101'],
            ['MNQ 03-26', 'Buy', 1, 21025.5, time(10, 10, 30), 'e4', 'Exit', 0.31, 'Sim101'],
          ],
        },
      ]),
    );
    expect(r.platform?.name).toBe('NinjaTrader 8');
    expect(
      r.trades.map((t) => [t.side, t.openedAt, t.closedAt, t.multiplier, Math.round(netPnl(t) * 100) / 100]),
    ).toEqual([
      ['LONG', '2026-03-02T09:31', '2026-03-02T09:45', 2, 40.76],
      ['SHORT', '2026-03-02T10:02', '2026-03-02T10:10', 2, -11.62],
    ]);
  });

  it('an ATAS journal as it comes, with a title above the table', async () => {
    const at = (h: number, m: number) => ({ serial: excelSerial(2026, 3, 2, h, m), format: 'dd.mm.yyyy hh:mm:ss' });
    const r = await importSheet(
      makeXlsx([
        {
          name: 'Journal',
          rows: [
            ['Journal'],
            [],
            [
              'Account',
              'Instrument',
              'Open time',
              'Open price',
              'Open volume',
              'Close time',
              'Close price',
              'Close volume',
              'PnL',
            ],
            ['Sim', 'MNQH6', at(9, 31), 21000.25, 2, at(9, 45), 21010.75, -2, 42],
            ['Sim', 'MNQH6', at(10, 2), 21020, -1, at(10, 10), 21025.5, 1, -11],
          ],
        },
      ]),
    );
    expect(r.platform?.name).toBe('ATAS');
    expect(r.trades.map((t) => [t.side, t.quantity, t.openedAt, Math.round(netPnl(t) * 100) / 100])).toEqual([
      ['LONG', 2, '2026-03-02T09:31', 42],
      ['SHORT', 1, '2026-03-02T10:02', -11],
    ]);
  });
});
