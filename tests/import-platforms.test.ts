import { describe, expect, it } from 'vitest';
import { PLATFORMS, importTradesFromCsv } from '@/lib/csv';
import { recognisePlatform } from '@/lib/import/platforms';
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
    expect(r.platform?.name).toBe(p.platform);
    expect(r.trades.filter((t) => t.needsReview).map((t) => t.symbol)).toEqual([]);
    expect(r.errors).toHaveLength(p.errors?.length ?? 0);
    p.errors?.forEach((pattern, i) => expect(r.errors[i]).toMatch(pattern));
  });

  it('what each file leaves out is said', () => {
    const notices = (platform: string, file: string) => {
      const p = PLATFORM_EXPORTS.find((x) => x.platform === platform && x.file === file);
      return importTradesFromCsv(p?.csv ?? '', { accountId: 'acc1', accounts, setups: [] }).notices.join(' ');
    };
    expect(notices('MetaTrader 4 and 5', 'MetaTrader 4 account history')).toMatch(
      /1 row has no price and no size \("balance"\)/,
    );
    expect(notices('IG', 'Transaction history')).toMatch(/\("BANK DEPOSIT"\)/);
    expect(notices('TopstepX', 'Orders')).toMatch(/1 order that was cancelled or never filled was left out/);
    expect(notices('Trading 212', 'History')).toMatch(/1 row is not a buy or a sell \("Deposit"\)/);
    expect(notices('tastytrade', 'Transactions history')).toMatch(/1 row is not a buy or a sell/);
  });
});

describe('which platform a file came from', () => {
  const header = (line: string) => line.split(',');

  it('the layouts tested elsewhere are named too', () => {
    const named = (line: string) => recognisePlatform(header(line))?.name;
    expect(
      named(
        'Trade number,Instrument,Account,Strategy,Market pos.,Qty,Entry price,Exit price,Entry time,Exit time,Entry name,Exit name,Profit',
      ),
    ).toBe('NinjaTrader 8');
    expect(named('Time,Position,Symbol,Type,Volume,Price,S / L,T / P,Time,Price,Commission,Swap,Profit')).toBe(
      'MetaTrader 4 and 5',
    );
    expect(named('Time,Deal,Symbol,Type,Direction,Volume,Price,Order,Commission,Fee,Swap,Profit')).toBe(
      'MetaTrader 4 and 5',
    );
    expect(
      named(
        'ID,Symbol,Opening Direction,Opening Time (UTC+2),Closing Time (UTC+2),Entry Price,Closing Price,Closing Quantity,Net USD',
      ),
    ).toBe('cTrader');
    expect(named('Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type')).toBe('TopstepX');
    expect(named(',Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type')).toBe(
      'Thinkorswim',
    );
    expect(
      named('Name,Symbol,Side,Status,Filled,Total Qty,Price,Avg Price,Time-in-Force,Placed Time,Filled Time'),
    ).toBe('Webull');
    expect(
      named('Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount'),
    ).toBe('Robinhood');
    expect(named('Date(UTC),Pair,Side,Price,Executed,Amount,Fee')).toBe('Binance');
    expect(named('orderId,Account,Order ID,B/S,Contract,Product,avgPrice,filledQty,Fill Time,Status')).toBe(
      'Tradovate',
    );
    expect(named('Trade #,Type,Signal,Date/Time,Price USD,Contracts,Profit USD')).toBe('TradingView');
    expect(recognisePlatform(['Trades', 'Header'], true)?.name).toBe('Interactive Brokers');
  });

  it('a file of no known platform is read by its column names, and named nothing', () => {
    expect(recognisePlatform(header('symbol,side,opened_at,closed_at,quantity,entry_price,exit_price'))).toBeNull();
    expect(recognisePlatform(header('Ticker Name,Lots Traded,Buy Or Sell Flag,Fill,When'))).toBeNull();
  });

  it('every platform in the list says which export to choose', () => {
    for (const p of PLATFORMS) {
      expect(p.how.length, p.name).toBeGreaterThan(10);
      expect(p.exports.length, p.name).toBeGreaterThan(0);
    }
    const names = PLATFORMS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
