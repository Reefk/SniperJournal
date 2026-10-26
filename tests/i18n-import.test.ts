import { afterEach, describe, expect, it } from 'vitest';
import { importTradesFromCsv, roleLabels } from '@/lib/csv';
import { setLanguage } from '@/lib/i18n';
import { rowsNote } from '@/lib/import/report';
import { fileTooLarge } from '@/lib/import/size';

/**
 * What reading a broker's file says, in the language on screen: the
 * things to check and how the file was read, the rows they are about, and
 * the names of the columns. The values from the file stay as they are.
 */
afterEach(() => setLanguage('en'));

const ctx = { accounts: [{ id: 'acc1', name: 'A', startingBalance: 0, createdAt: '' }], setups: [], accountId: 'acc1' };
// no direction column, no fees, a row without a symbol, and a total line
const FILE = ['symbol,qty,entry,exit', 'AAPL,1,100,101', ',1,100,101', 'TOTAL,,,'].join('\n');

describe('an import', () => {
  it('says what to check in Russian', () => {
    setLanguage('ru');
    const r = importTradesFromCsv(FILE, ctx);
    expect(r.errors).toContain('Строка 3: нет тикера, поэтому строка пропущена.');
    expect(r.errors).toContain('Нет столбца направления, поэтому все строки импортированы как ЛОНГ. Проверьте шорты.');
    expect(r.notices.some((n) => n.startsWith('В этом файле нет комиссий'))).toBe(true);
    expect(r.notices).toContain('Пропущена 1 строка итогов, сводки или повторного заголовка.');
  });

  it('says it in Spanish, and the same file in English as before', () => {
    expect(importTradesFromCsv(FILE, ctx).errors).toContain('Row 3: no symbol, so the row was skipped.');
    setLanguage('es');
    expect(importTradesFromCsv(FILE, ctx).errors).toContain('Fila 3: sin símbolo, así que la fila se omitió.');
  });

  it('names rows in Arabic with the plural Arabic needs', () => {
    setLanguage('ar');
    // "Row 3 and 2 more": two others is a form of its own in Arabic
    expect(rowsNote([3, 4, 5], 'one', 'many')).toBe('⁨الصف 3 وصفّان آخران⁩: ⁨many⁩');
    expect(rowsNote([3, 4, 5, 6], 'one', 'many')).toBe('⁨الصف 3 و3 صفوف أخرى⁩: ⁨many⁩');
  });

  it('names the columns, and says a file is too large, in Hindi', () => {
    setLanguage('hi');
    expect(new Map(roleLabels()).get('symbol')).toBe('सिंबल');
    expect(roleLabels()).toHaveLength(42);
    expect(fileTooLarge(11 * 1024 * 1024)).toBe(
      'यह फ़ाइल 11.0 MB की है, एक इम्पोर्ट की सीमा (10 MB) से ज़्यादा। अपने प्लेटफ़ॉर्म से छोटी अवधि एक्सपोर्ट करें, या फ़ाइल को बाँटकर हर हिस्सा इम्पोर्ट करें।',
    );
  });

  it('writes a size with the decimal mark of the language', () => {
    setLanguage('ru');
    expect(fileTooLarge(11 * 1024 * 1024)).toMatch(/^Этот файл занимает 11,0 MB/);
  });
});
