import { describe, expect, it } from 'vitest';
import { splitLikelyDuplicates } from '@/lib/import/likely';
import { trade } from './helpers';

/** the stage on its own: trades that look like ones already in the journal */
describe('likely duplicates', () => {
  const inJournal = trade({ symbol: 'AAPL', side: 'LONG', openedAt: '2026-03-02T10:00', quantity: 10 });
  const symbols = (ts: { symbol: string }[]) => ts.map((t) => t.symbol);

  it('the same account, symbol, side, entry minute and size is a likely duplicate', () => {
    const split = splitLikelyDuplicates([trade({ ...inJournal, id: 'new', exitPrice: 105 })], [inJournal]);
    expect(split.likely).toHaveLength(1);
    expect(split.fresh).toHaveLength(0);
  });

  it('any one of them different makes a new trade', () => {
    const others = [
      trade({ ...inJournal, id: 'a', accountId: 'acc2' }),
      trade({ ...inJournal, id: 'b', symbol: 'MSFT' }),
      trade({ ...inJournal, id: 'c', side: 'SHORT' }),
      trade({ ...inJournal, id: 'd', openedAt: '2026-03-02T10:01' }),
      trade({ ...inJournal, id: 'e', openedAt: '2026-03-03T10:00' }),
      trade({ ...inJournal, id: 'f', quantity: 11 }),
    ];
    const split = splitLikelyDuplicates(others, [inJournal]);
    expect(split.fresh).toHaveLength(6);
    expect(split.likely).toHaveLength(0);
  });

  it('seconds, letter case and floating-point dust in the size do not matter', () => {
    const t = trade({ ...inJournal, id: 'x', symbol: 'aapl', openedAt: '2026-03-02T10:00:59', quantity: 0.1 + 0.2 });
    const split = splitLikelyDuplicates([t], [{ ...inJournal, quantity: 0.3 }]);
    expect(split.likely).toHaveLength(1);
  });

  it('each journal trade stands for one: two identical rows against one leave one in', () => {
    const rows = [trade({ ...inJournal, id: 'r1' }), trade({ ...inJournal, id: 'r2' })];
    const split = splitLikelyDuplicates(rows, [inJournal]);
    expect(split.likely.map((t) => t.id)).toEqual(['r1']);
    expect(split.fresh.map((t) => t.id)).toEqual(['r2']);
  });

  it('two trades with different broker ids are different trades, whatever their fields', () => {
    const split = splitLikelyDuplicates(
      [trade({ ...inJournal, id: 'n', externalId: 'B' })],
      [{ ...inJournal, externalId: 'A' }],
    );
    expect(split.fresh).toHaveLength(1);
  });

  it('an id on one side only still matches on the fields', () => {
    const fromFile = trade({ ...inJournal, id: 'n', externalId: 'B' });
    expect(splitLikelyDuplicates([fromFile], [inJournal]).likely).toHaveLength(1);
    expect(
      splitLikelyDuplicates([trade({ ...inJournal, id: 'm' })], [{ ...inJournal, externalId: 'A' }]).likely,
    ).toHaveLength(1);
  });

  it('test data, and trades missing their entry time or size, match nothing', () => {
    expect(
      splitLikelyDuplicates([trade({ ...inJournal, id: 'n' })], [{ ...inJournal, isSample: true }]).fresh,
    ).toHaveLength(1);
    const gaps = [trade({ ...inJournal, id: 'p', openedAt: '' }), trade({ ...inJournal, id: 'q', quantity: 0 })];
    const journal = [
      { ...inJournal, openedAt: '' },
      { ...inJournal, quantity: 0 },
    ];
    expect(splitLikelyDuplicates(gaps, journal).fresh).toHaveLength(2);
  });

  it('open in the journal and closed in the file: imported, and counted so the open copy can go', () => {
    const open = { ...inJournal, exitPrice: null, closedAt: undefined };
    const split = splitLikelyDuplicates([trade({ ...inJournal, id: 'n', exitPrice: 104 })], [open]);
    expect(symbols(split.fresh)).toEqual(['AAPL']);
    expect(split.closesOpen).toBe(1);
  });

  it('closed in the journal and open in the file, or open in both: a likely duplicate', () => {
    const openRow = trade({ ...inJournal, id: 'n', exitPrice: null, closedAt: undefined });
    expect(splitLikelyDuplicates([openRow], [inJournal]).likely).toHaveLength(1);
    expect(splitLikelyDuplicates([openRow], [{ ...inJournal, exitPrice: null }]).likely).toHaveLength(1);
  });

  it('with nothing in the journal, everything is new', () => {
    const split = splitLikelyDuplicates([trade(), trade()]);
    expect([split.fresh.length, split.likely.length, split.closesOpen]).toEqual([2, 0, 0]);
  });
});
