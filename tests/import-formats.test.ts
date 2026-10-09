import { afterEach, describe, expect, it } from 'vitest';
import { importTradesFromCsv, type ImportOptions } from '@/lib/csv';
import { parseMoment } from '@/lib/import/values';
import { futuresPointValue } from '@/lib/import/instruments';
import { grossPnl, isClosed, netPnl } from '@/lib/trade-math';
import type { Account, Trade } from '@/lib/types';

/**
 * Broker exports, one per layout the importer is meant to understand. Every
 * file here is made up: the column layouts follow each platform's export, and
 * the numbers are synthetic but consistent (a P&L column agrees with the
 * prices), so each test can say exactly which trades must come out. A real
 * export can differ from these (platforms change their columns); the column
 * mapping in the import preview is the answer to that.
 */

const accounts: Account[] = [{ id: 'acc1', name: 'Main', startingBalance: 0, createdAt: '' }];
const read = (csv: string, extra: Partial<ImportOptions> = {}) =>
  importTradesFromCsv(csv, { accountId: 'acc1', accounts, setups: [], ...extra });
const lines = (...rows: string[]) => rows.join('\n');
const bySymbol = (trades: Trade[], symbol: string) => trades.find((t) => t.symbol === symbol) as Trade;
const money = (v: number) => Math.round(v * 100) / 100;

afterEach(() => {
  process.env.TZ = 'UTC';
});

describe('one row per trade', () => {
  it('NinjaTrader trade list: market position, "$" and "(…)" money, five fee columns added up', () => {
    const r = read(
      lines(
        'Trade number,Instrument,Account,Strategy,Market pos.,Qty,Entry price,Exit price,Entry time,Exit time,Entry name,Exit name,Profit,Cum. net profit,Commission,Clearing Fee,Exchange Fee,IP Fee,NFA Fee,MAE,MFE,ETD,Bars',
        '1,MNQ 03-26,Sim101,,Long,2,21000.25,21010.75,3/2/2026 9:31:05 AM,3/2/2026 9:45:10 AM,Entry,Exit,$42.00,$40.76,$0.62,$0.20,$0.32,$0.04,$0.06,$10.00,$50.00,$8.00,14',
        '2,MNQ 03-26,Sim101,,Short,1,21020.00,21025.50,3/2/2026 10:02:00 AM,3/2/2026 10:10:30 AM,Entry,Exit,($11.00),$29.14,$0.31,$0.10,$0.16,$0.02,$0.03,$12.00,$4.00,$15.00,8',
      ),
    );
    expect(r.layout?.rowKind).toBe('trades');
    expect(r.errors).toEqual([]);
    const [long, short] = r.trades;
    expect([long.symbol, long.side, long.quantity, long.multiplier]).toEqual(['MNQ 03-26', 'LONG', 2, 2]);
    expect([long.openedAt, long.closedAt]).toEqual(['2026-03-02T09:31', '2026-03-02T09:45']);
    expect(money(long.fees)).toBe(1.24);
    expect(money(netPnl(long))).toBe(40.76);
    expect([short.side, money(grossPnl(short)), money(netPnl(short))]).toEqual(['SHORT', -11, -11.62]);
  });

  it('MetaTrader positions: report title lines, Time and Price written twice, negative commission and swap', () => {
    const r = read(
      lines(
        'Trade History Report',
        'Name:,Demo User',
        'Account:,"12345678 (USD, Demo)"',
        'Positions',
        'Time,Position,Symbol,Type,Volume,Price,S / L,T / P,Time,Price,Commission,Swap,Profit',
        '2026.03.02 09:30:00,5001,EURUSD,buy,0.10,1.08500,1.08300,1.08900,2026.03.02 11:15:20,1.08750,-0.70,0.00,25.00',
        '2026.03.02 12:00:00,5002,XAUUSD,sell,0.05,2350.50,,,2026.03.02 13:20:00,2345.30,-0.35,-0.12,26.00',
        'Orders',
        'Open Time,Order,Symbol,Type,Volume,Price,S / L,T / P,Time,State,Comment',
        '2026.03.02 09:30:00,7001,EURUSD,buy,0.10,1.08500,,,2026.03.02 09:30:00,filled,',
      ),
    );
    expect(r.trades).toHaveLength(2);
    const eur = bySymbol(r.trades, 'EURUSD');
    expect([eur.side, eur.quantity, eur.entryPrice, eur.exitPrice, eur.multiplier]).toEqual(['LONG', 0.1, 1.085, 1.0875, 100000]);
    expect([eur.openedAt, eur.closedAt, eur.stopLoss, eur.takeProfit]).toEqual(['2026-03-02T09:30', '2026-03-02T11:15', 1.083, 1.089]);
    expect([money(eur.fees), money(netPnl(eur))]).toEqual([0.7, 24.3]);
    const gold = bySymbol(r.trades, 'XAUUSD');
    expect([gold.side, gold.multiplier, money(gold.fees), money(netPnl(gold))]).toEqual(['SHORT', 100, 0.47, 25.53]);
    expect(r.notices.join(' ')).toMatch(/column names are on line 5/);
  });

  it('cTrader history: a zone in the header (UTC+2), day-first dates, quantities in lots, net and gross columns', () => {
    const r = read(
      lines(
        'ID,Symbol,Opening Direction,Opening Time (UTC+2),Closing Time (UTC+2),Entry Price,Closing Price,Closing Quantity,Gross USD,Commission,Swap,Net USD',
        'PID1,EURUSD,Buy,02/03/2026 11:30:00.000,02/03/2026 13:15:20.000,1.08500,1.08750,0.10 Lots,25.00,-0.70,0.00,24.30',
        'PID2,EURUSD,Sell,15/03/2026 10:00:00.000,15/03/2026 10:30:00.000,1.09000,1.08900,0.20 Lots,20.00,-1.40,0.00,18.60',
      ),
    );
    const [first, second] = r.trades;
    expect([first.openedAt, first.closedAt]).toEqual(['2026-03-02T09:30', '2026-03-02T11:15']); // 11:30 at UTC+2 is 09:30 UTC
    expect([first.quantity, first.multiplier, money(netPnl(first))]).toEqual([0.1, 100000, 24.3]);
    expect([second.side, second.openedAt, money(netPnl(second))]).toEqual(['SHORT', '2026-03-15T08:00', 18.6]);
    expect(r.notices.join(' ')).toMatch(/time zone/);
  });

  it('TopstepX trades: ISO times with an offset, contract code, fees and commissions added up', () => {
    const r = read(
      lines(
        'Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions',
        '9001,MNQH6,2026-03-02T09:31:05.123-05:00,2026-03-02T09:45:10.456-05:00,21000.25,21010.75,0.74,42.00,2,Long,2026-03-02T00:00:00-05:00,00:14:05,0.50',
      ),
    );
    const t = r.trades[0];
    expect([t.symbol, t.side, t.quantity, t.multiplier]).toEqual(['MNQH6', 'LONG', 2, 2]);
    expect([t.openedAt, t.closedAt]).toEqual(['2026-03-02T14:31', '2026-03-02T14:45']);
    expect([money(t.fees), money(netPnl(t))]).toEqual([1.24, 40.76]);
    expect(t.externalId).toBe('9001');
  });

  it('separate date and time columns are joined (they used to lose the time)', () => {
    const t = read(
      lines('Entry Date,Entry Time,Exit Date,Exit Time,Symbol,Side,Qty,Entry Price,Exit Price', '03/02/2026,9:30 AM,03/02/2026,10:15 AM,AAPL,Long,10,100,110'),
    ).trades[0];
    expect([t.openedAt, t.closedAt]).toEqual(['2026-03-02T09:30', '2026-03-02T10:15']);
  });

  it('title lines above the header, a total line below it, and tab or pipe separated files', () => {
    const r = read(lines('My Broker - Closed Trades', 'Account: 12345', 'Symbol,Side,Qty,Entry,Exit', 'AAPL,Long,10,100,110', 'Total,,10,,'));
    expect(r.trades.map((t) => t.symbol)).toEqual(['AAPL']);
    expect(r.notices.join(' ')).toMatch(/line 3/);
    expect(r.notices.join(' ')).toMatch(/1 total/);
    for (const sep of ['\t', '|']) {
      const t = read(['symbol', 'side', 'qty', 'entry', 'exit'].join(sep) + '\n' + ['AAPL', 'Long', '10', '100', '110'].join(sep)).trades[0];
      expect(netPnl(t), JSON.stringify(sep)).toBe(100);
    }
  });

  it('a P&L that only fits the prices once the fees are added back was net, and the fees are not charged twice', () => {
    // 1 ES contract +2 points = $100; the file's P&L is after $4.50 commission
    const t = read('symbol,side,qty,entry,exit,commission,pnl\nES,Buy,1,5000,5002,4.5,95.5').trades[0];
    expect(t.multiplier).toBe(50);
    expect(money(netPnl(t))).toBe(95.5);
  });
});

describe('one row per fill', () => {
  it('Interactive Brokers statement: Trades section, signed quantities, Comm/Fee, options from proceeds', () => {
    const r = read(
      lines(
        'Statement,Header,Field Name,Field Value',
        'Statement,Data,BrokerName,Interactive Brokers LLC',
        'Account Information,Header,Field Name,Field Value',
        'Account Information,Data,Name,Test User',
        'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code',
        'Trades,Data,Order,Stocks,USD,AAPL,"2026-03-02, 09:35:10",100,187.40,187.55,-18740,-1,18741,0,15,O',
        'Trades,Data,Order,Stocks,USD,AAPL,"2026-03-02, 10:12:44",-100,189.10,189.00,18910,-1.02,-18741,167.98,-10,C',
        'Trades,Data,ClosedLot,Stocks,USD,AAPL,2026-03-02,100,187.41,,,,18741,167.98,,',
        'Trades,SubTotal,,Stocks,USD,AAPL,,0,,,170,-2.02,0,167.98,5,',
        'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code',
        'Trades,Data,Order,Equity and Index Options,USD,SPY 20MAR26 580 C,"2026-03-03, 10:00:00",2,3.50,3.60,-700,-1.30,701.3,0,20,O',
        'Trades,Data,Order,Equity and Index Options,USD,SPY 20MAR26 580 C,"2026-03-03, 11:30:00",-2,4.25,4.20,850,-1.32,-701.3,147.38,-10,C',
        'Trades,Total,,,,,,,,,,,,,,',
      ),
    );
    expect(r.layout?.rowKind).toBe('fills');
    expect(r.trades).toHaveLength(2);
    const aapl = bySymbol(r.trades, 'AAPL');
    expect([aapl.side, aapl.quantity, aapl.entryPrice, aapl.exitPrice, aapl.multiplier]).toEqual(['LONG', 100, 187.4, 189.1, 1]);
    expect([aapl.openedAt, aapl.closedAt]).toEqual(['2026-03-02T09:35', '2026-03-02T10:12']);
    expect(money(netPnl(aapl))).toBe(167.98); // IBKR's own realised P/L, after commissions
    const spy = bySymbol(r.trades, 'SPY 20MAR26 580 C');
    expect([spy.multiplier, money(grossPnl(spy)), money(netPnl(spy))]).toEqual([100, 150, 147.38]);
    expect(r.notices.join(' ')).toMatch(/Interactive Brokers/);
  });

  it('Thinkorswim statement: finds Account Trade History among other tables; option from CALL, expiry and strike', () => {
    const r = read(
      lines(
        'This document was exported from the paperMoney platform.',
        'Account Statement for D-12345678 since 3/1/26 through 3/4/26',
        'Cash Balance',
        'DATE,TIME,TYPE,REF #,DESCRIPTION,Misc Fees,Commissions & Fees,AMOUNT,BALANCE',
        '3/2/26,09:31:12,TRD,="1001",BOT +100 AAPL @187.40,,,"-18,740.00","81,260.00"',
        '3/2/26,10:12:40,TRD,="1002",SOLD -100 AAPL @189.10,-0.02,,"18,909.98","100,169.98"',
        'Account Order History',
        'Notes,,Time Placed,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,PRICE,,TIF,Status',
        ',,3/2/26 09:31:10,STOCK,BUY,+100,TO OPEN,AAPL,,,STOCK,187.40,LMT,DAY,FILLED',
        ',,3/2/26 10:00:00,STOCK,SELL,-100,TO CLOSE,AAPL,,,STOCK,190.00,LMT,DAY,CANCELED',
        'Account Trade History',
        ',Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type',
        ',3/2/26 09:31:12,STOCK,BUY,+100,TO OPEN,AAPL,,,STOCK,187.40,187.40,LMT',
        ',3/2/26 10:12:40,STOCK,SELL,-100,TO CLOSE,AAPL,,,STOCK,189.10,189.10,LMT',
        ',3/3/26 10:00:00,SINGLE,BUY,+2,TO OPEN,SPY,20 MAR 26,580,CALL,3.50,3.50,LMT',
        ',3/3/26 11:30:00,SINGLE,SELL,-2,TO CLOSE,SPY,20 MAR 26,580,CALL,4.25,4.25,LMT',
        'Equities',
        'Symbol,Description,Qty,Trade Price,Mark,Mark Value',
        'AAPL,APPLE INC,0,.00,189.00,$0.00',
      ),
    );
    expect(r.layout?.rowKind).toBe('fills');
    expect(r.trades).toHaveLength(2);
    const aapl = bySymbol(r.trades, 'AAPL');
    expect([aapl.openedAt, money(grossPnl(aapl))]).toEqual(['2026-03-02T09:31', 170]);
    const call = bySymbol(r.trades, 'SPY 20 MAR 26 580 CALL');
    expect([call.quantity, call.multiplier, money(grossPnl(call))]).toEqual([2, 100, 150]);
    expect(r.notices.join(' ')).toMatch(/SPY 20 MAR 26 580 CALL: one point taken as worth 100 \(an option contract\)/);
  });

  it('Webull orders: cancelled orders left out, filled quantity and average price used, not the limit', () => {
    const r = read(
      lines(
        'Name,Symbol,Side,Status,Filled,Total Qty,Price,Avg Price,Time-in-Force,Placed Time,Filled Time',
        'Apple Inc,AAPL,Buy,Filled,100,100,@187.50,187.40,DAY,03/02/2026 09:31:00 EST,03/02/2026 09:31:05 EST',
        'Apple Inc,AAPL,Sell,Cancelled,0,100,@195.00,,GTC,03/02/2026 09:40:00 EST,',
        'Apple Inc,AAPL,Sell,Filled,100,100,@189.00,189.10,DAY,03/02/2026 10:12:00 EST,03/02/2026 10:12:40 EST',
      ),
    );
    expect(r.trades).toHaveLength(1);
    const t = r.trades[0];
    expect([t.entryPrice, t.exitPrice, t.quantity, t.openedAt, t.closedAt]).toEqual([187.4, 189.1, 100, '2026-03-02T09:31', '2026-03-02T10:12']);
    expect(r.notices.join(' ')).toMatch(/1 order that was cancelled or never filled was left out/);
  });

  it('Robinhood activity: newest first, dates only, money in brackets, deposits and dividends left out', () => {
    const r = read(
      lines(
        '"Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"',
        '"3/3/2026","3/3/2026","3/5/2026","SPY","SPY 3/20/2026 Call $580.00","STC","2","$4.25","$850.00"',
        '"3/3/2026","3/3/2026","3/5/2026","SPY","SPY 3/20/2026 Call $580.00","BTO","2","$3.50","($700.00)"',
        '"3/2/2026","3/2/2026","3/4/2026","AAPL","Apple\nCUSIP: 037833100","Sell","100","$189.10","$18,910.00"',
        '"3/2/2026","3/2/2026","3/4/2026","AAPL","Apple\nCUSIP: 037833100","Buy","100","$187.40","($18,740.00)"',
        '"3/2/2026","3/2/2026","3/2/2026","MSFT","Cash Div: R/D 2026-02-15","CDIV","","","$7.50"',
        '"3/1/2026","3/1/2026","3/1/2026","","ACH Deposit","ACH","","","$5,000.00"',
      ),
    );
    expect(r.trades).toHaveLength(2);
    const aapl = bySymbol(r.trades, 'AAPL');
    expect([aapl.side, money(grossPnl(aapl)), aapl.notes]).toEqual(['LONG', 170, undefined]);
    const spy = bySymbol(r.trades, 'SPY');
    expect([spy.multiplier, money(grossPnl(spy))]).toEqual([100, 150]);
    expect(r.notices.join(' ')).toMatch(/2 rows are not a buy or a sell/);
  });

  it('Binance spot history: UTC times, quantities and amounts with units, a fee paid in BNB left out', () => {
    process.env.TZ = 'Asia/Jerusalem'; // UTC+2 in early March
    const r = read(
      lines(
        'Date(UTC),Pair,Side,Price,Executed,Amount,Fee',
        '2026-03-02 14:00:00,BTCUSDT,BUY,60000,0.5BTC,30000USDT,0.0003BNB',
        '2026-03-02 16:30:00,BTCUSDT,SELL,61000,0.5BTC,30500USDT,30.5USDT',
      ),
    );
    const t = r.trades[0];
    expect([t.symbol, t.quantity, t.multiplier, t.openedAt, t.closedAt]).toEqual(['BTCUSDT', 0.5, 1, '2026-03-02T16:00', '2026-03-02T18:30']);
    expect([t.fees, money(netPnl(t))]).toEqual([30.5, 469.5]);
    expect(r.errors.join(' ')).toMatch(/Fees paid in BNB were left out/);
  });

  it('Tradovate orders: cancelled order left out, futures point value from the contract code, re-import skipped', () => {
    const csv = lines(
      'orderId,Account,Order ID,B/S,Contract,Product,Product Description,avgPrice,filledQty,Fill Time,lastCommandId,Status,_priceFormat,_priceFormatType,_tickSize,spreadDefinitionId,Version ID,Timestamp,Date,Quantity,Text,Type,Limit Price,Stop Price,decimalLimit,decimalStop,Filled Qty,Avg Fill Price,decimalFillAvg',
      '1001,DEMO123,1001, Buy,MNQH6,MNQ,Micro E-mini Nasdaq-100,21000.25,2,03/02/2026 09:31:05,1001,Filled,-2,0,0.25,,1001,03/02/2026 09:31:05,3/2/26,2,,Market,,,,,2,21000.25,21000.25',
      '1002,DEMO123,1002, Sell,MNQH6,MNQ,Micro E-mini Nasdaq-100,21010.75,2,03/02/2026 09:45:10,1002,Filled,-2,0,0.25,,1002,03/02/2026 09:45:10,3/2/26,2,,Limit,21010.75,,21010.75,,2,21010.75,21010.75',
      '1003,DEMO123,1003, Sell,MNQH6,MNQ,Micro E-mini Nasdaq-100,,0,,1003,Canceled,-2,0,0.25,,1003,03/02/2026 09:50:00,3/2/26,1,,Stop,,20990.00,,20990.00,0,,',
    );
    const r = read(csv);
    expect(r.trades).toHaveLength(1);
    const t = r.trades[0];
    expect([t.symbol, t.side, t.quantity, t.multiplier, money(grossPnl(t)), t.externalId]).toEqual(['MNQH6', 'LONG', 2, 2, 42, '1001|1002']);
    expect(r.notices.join(' ')).toMatch(/MNQH6: one point taken as worth 2 a point \(MNQ futures\)/);
    const again = read(csv, { existing: r.trades });
    expect([again.trades.length, again.duplicates]).toEqual([0, 1]);
  });

  it('MetaTrader deals: in/out direction, a balance line left out, the P&L on the closing deal', () => {
    const r = read(
      lines(
        'Time,Deal,Symbol,Type,Direction,Volume,Price,Order,Commission,Fee,Swap,Profit,Balance,Comment',
        '2026.03.01 08:00:00,1,,balance,,,,,0.00,0.00,0.00,10000.00,10000.00,Deposit',
        '2026.03.02 09:30:00,2,EURUSD,buy,in,0.10,1.08500,11,-0.35,0.00,0.00,0.00,9999.65,',
        '2026.03.02 11:15:20,3,EURUSD,sell,out,0.10,1.08750,12,-0.35,0.00,0.00,25.00,10024.30,',
      ),
    );
    expect(r.trades).toHaveLength(1);
    const t = r.trades[0];
    expect([t.side, t.quantity, t.multiplier, money(t.fees), money(netPnl(t)), t.externalId]).toEqual(['LONG', 0.1, 100000, 0.7, 24.3, '2|3']);
  });

  it('TradingView list of trades: no symbol column, entry and exit rows paired by trade number, newest first', () => {
    const csv = lines(
      'Trade #,Type,Signal,Date/Time,Price USD,Contracts,Profit USD,Profit %,Cumulative profit USD,Cumulative profit %,Run-up USD,Run-up %,Drawdown USD,Drawdown %',
      '2,Exit Short,Close,2026-03-03 15:30,4985.25,1,737.50,0.29,987.50,0.39,800.00,0.32,-100.00,-0.04',
      '2,Entry Short,Short,2026-03-03 14:00,5000.00,1,737.50,0.29,987.50,0.39,800.00,0.32,-100.00,-0.04',
      '1,Exit Long,Close,2026-03-02 11:00,5005.00,1,250.00,0.10,250.00,0.10,300.00,0.12,-50.00,-0.02',
      '1,Entry Long,Long,2026-03-02 10:00,5000.00,1,250.00,0.10,250.00,0.10,300.00,0.12,-50.00,-0.02',
    );
    expect(read(csv).errors[0]).toMatch(/No symbol column found/);
    const r = read(csv, { defaultSymbol: 'es' });
    expect(r.trades.map((t) => [t.symbol, t.side, t.openedAt, t.multiplier, money(grossPnl(t))])).toEqual([
      ['ES', 'LONG', '2026-03-02T10:00', 50, 250],
      ['ES', 'SHORT', '2026-03-03T14:00', 50, 737.5],
    ]);
  });

  it('scaling in, a fill that goes through zero, and a position still open at the end', () => {
    const r = read(
      lines(
        'time,symbol,side,qty,price,commission',
        '2026-03-02 09:30,AAPL,Buy,2,100,0',
        '2026-03-02 09:40,AAPL,Sell,5,110,1.00', // closes the long 2, opens a short 3
        '2026-03-02 09:50,AAPL,Buy,3,105,0', // closes the short
        '2026-03-02 10:00,AAPL,Buy,4,100,0',
        '2026-03-02 10:10,AAPL,Sell,1,102,0', // sells 1 of 4: 3 still open at the end
      ),
    );
    expect(r.trades.map((t) => [t.side, t.quantity, isClosed(t), isClosed(t) ? money(grossPnl(t)) : null, money(t.fees)])).toEqual([
      ['LONG', 2, true, 20, 0.4],
      ['SHORT', 3, true, 15, 0.6],
      ['LONG', 1, true, 2, 0],
      ['LONG', 3, false, null, 0],
    ]);
    expect(r.notices.join(' ')).toMatch(/1 position was still open/);
  });

  it('scaling in at two prices: one trade at the size-weighted entry, separate date and time columns', () => {
    const r = read(
      lines(
        'Date,Time,Symbol,Side,Quantity,Price,Commission',
        '2026-03-02,09:30:00,MSFT,Buy,50,400.00,0.50',
        '2026-03-02,09:45:00,MSFT,Buy,50,401.00,0.50',
        '2026-03-02,10:30:00,MSFT,Sell,100,405.00,1.00',
      ),
    );
    expect(r.trades).toHaveLength(1);
    const t = r.trades[0];
    expect([t.quantity, t.entryPrice, t.exitPrice, t.openedAt, t.closedAt, t.fillCount]).toEqual([100, 400.5, 405, '2026-03-02T09:30', '2026-03-02T10:30', 3]);
    expect([money(grossPnl(t)), money(netPnl(t))]).toEqual([450, 448]);
  });

  it('a fill that says it closes, with nothing open, is kept as a trade missing its entry, never as a new short', () => {
    const r = read(lines('time,symbol,side,qty,price,pos effect', '2026-03-02 09:30,AAPL,Sell,100,110,To Close'));
    const t = r.trades[0];
    expect([t.side, t.exitPrice, t.needsReview]).toEqual(['LONG', 110, true]);
    expect(r.errors.join(' ')).toMatch(/opened before this file starts/);
  });
});

describe('when the importer cannot tell', () => {
  it('column names it does not know are mapped by hand in the preview', () => {
    const csv = lines('Ticker Name,Lots Traded,Buy Or Sell Flag,Fill,When', 'AAPL,100,B,187.40,2026-03-02 09:31', 'AAPL,100,S,189.10,2026-03-02 10:12');
    expect(read(csv).trades).toHaveLength(0);
    const r = read(csv, { mapping: { 0: 'symbol', 1: 'quantity', 2: 'side', 3: 'price', 4: 'time' } });
    expect(r.layout?.rowKind).toBe('fills');
    expect(money(grossPnl(r.trades[0]))).toBe(170);
    expect(r.layout?.columns.map((c) => c.role)).toEqual(['symbol', 'quantity', 'side', 'price', 'time']);
  });

  it('each row can be read as a whole trade instead of a fill, and a column can be switched off', () => {
    const csv = lines('time,symbol,side,qty,price', '2026-03-02 09:30,AAPL,Buy,2,100', '2026-03-02 09:40,AAPL,Sell,2,110');
    expect(read(csv).trades).toHaveLength(1);
    expect(read(csv, { rowKind: 'trades' }).trades).toHaveLength(2);
    expect(read(csv, { mapping: { 1: '' } }).trades).toHaveLength(0);
  });

  it('the date order can be set when the file cannot show it', () => {
    const csv = 'symbol,opened_at\nAAPL,03/04/2026 10:00';
    expect(read(csv).layout?.ambiguousDates).toBe(true);
    expect(read(csv).trades[0].openedAt).toBe('2026-03-04T10:00');
    expect(read(csv, { dateOrder: 'dmy' }).trades[0].openedAt).toBe('2026-04-03T10:00');
  });
});

describe('reading single values', () => {
  it.each([
    ['MetaTrader dots', '2026.03.02 10:15:00', '2026-03-02T10:15'],
    ['IBKR compact', '20260302;101500', '2026-03-02T10:15'],
    ['IBKR date, comma, time', '2026-03-02, 10:15:00', '2026-03-02T10:15'],
    ['two-digit year', '03/02/26 09:31:12', '2026-03-02T09:31'],
    ['day, month name', '02-Mar-2026 10:15', '2026-03-02T10:15'],
    ['month name first', 'Mar 2, 2026 1:05 PM', '2026-03-02T13:05'],
    ['weekday and GMT', 'Mon, 02 Mar 2026 13:05:12 GMT', '2026-03-02T13:05'],
    ['offset', '2026-03-02T15:05:12+02:00', '2026-03-02T13:05'],
    ['Unix seconds', '1772456700', '2026-03-02T13:05'],
    ['Unix milliseconds', '1772456700000', '2026-03-02T13:05'],
  ])('%s: %s', (_, raw, expected) => {
    expect(parseMoment(raw)?.value).toBe(expected);
  });

  it('a zone is converted to local time; without one the time is kept as written', () => {
    process.env.TZ = 'America/New_York'; // UTC-5 in early March
    expect(parseMoment('2026-03-02T14:30:00Z')?.value).toBe('2026-03-02T09:30');
    expect(parseMoment('2026-03-02 14:30:00')?.value).toBe('2026-03-02T14:30');
  });

  it('a futures point value comes only from a full contract code, never from a bare stock ticker', () => {
    expect(futuresPointValue('ESH6')?.value).toBe(50);
    expect(futuresPointValue('/MESZ25:XCME')?.value).toBe(5);
    expect(futuresPointValue('NQ 06-26')?.value).toBe(20);
    expect(futuresPointValue('6EM6')?.value).toBe(125000);
    expect(futuresPointValue('ES')).toBeNull(); // Eversource Energy
    expect(futuresPointValue('CL')).toBeNull(); // Colgate-Palmolive
    expect(futuresPointValue('AAPL')).toBeNull();
    expect(futuresPointValue('ES', 'Futures')?.value).toBe(50);
  });
});
