import { describe, expect, it } from 'vitest';
import { importTradesFromCsv } from '@/lib/csv';
import { netPnl } from '@/lib/trade-math';
import type { Account } from '@/lib/types';
import { PLATFORM_EXPORTS } from './platform-exports';

/**
 * Every platform layout in tests/platform-exports.ts must import as it comes:
 * no column mapped by hand, no date order chosen, nothing left to fill in. The
 * stages these files go through are tested on their own in csv-stages.test.ts,
 * and the harder single files in import-formats.test.ts.
 */

const accounts: Account[] = [{ id: 'acc1', name: 'Main', startingBalance: 0, createdAt: '' }];
const cases = PLATFORM_EXPORTS.map((p) => [`${p.platform}: ${p.file}`, p] as const);

describe('platform exports import with no help', () => {
  it.each(cases)('%s', (_, p) => {
    const r = importTradesFromCsv(p.csv, { accountId: 'acc1', accounts, setups: [], defaultSymbol: p.defaultSymbol });
    const got = r.trades.map((t) => [
      t.symbol,
      t.side,
      t.quantity,
      t.entryPrice,
      t.exitPrice,
      t.openedAt,
      t.closedAt,
      t.multiplier,
      Math.round(netPnl(t) * 100) / 100,
    ]);
    expect(got).toEqual(p.trades);
    expect(r.trades.filter((t) => t.needsReview).map((t) => t.symbol)).toEqual([]);
    expect(r.errors).toHaveLength(p.errors?.length ?? 0);
    p.errors?.forEach((pattern, i) => expect(r.errors[i]).toMatch(pattern));
  });

  it('what each file leaves out is said', () => {
    const notices = (platform: string, file: string) => {
      const p = PLATFORM_EXPORTS.find((x) => x.platform === platform && x.file === file);
      return importTradesFromCsv(p?.csv ?? '', { accountId: 'acc1', accounts, setups: [] }).notices.join(' ');
    };
    expect(notices('MetaTrader 4', 'Account history')).toMatch(/1 row has no price and no size \("balance"\)/);
    expect(notices('IG', 'Transaction history')).toMatch(/\("BANK DEPOSIT"\)/);
    expect(notices('TopstepX', 'Orders')).toMatch(/1 order that was cancelled or never filled was left out/);
    expect(notices('Trading 212', 'History')).toMatch(/1 row is not a buy or a sell \("Deposit"\)/);
    expect(notices('tastytrade', 'Transactions history')).toMatch(/1 row is not a buy or a sell/);
  });
});
