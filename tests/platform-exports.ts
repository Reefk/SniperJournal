/**
 * Made-up exports in the layouts of trading platforms and brokers, for
 * tests/import-platforms.test.ts. The columns follow each platform's export as
 * published by the platform, or as other journals that import it read it; the
 * numbers are synthetic and the same few trades throughout, so every file has
 * a known answer:
 *
 *   futures  MNQ long 2 at 21000.25, out at 21010.75 (+42.00 gross, 2 a point),
 *            09:31:05 to 09:45:10 on 2 March 2026; and MNQ short 1 at 21020.00,
 *            out at 21025.50 (-11.00), 10:02:00 to 10:10:30
 *   stocks   AAPL long 100 at 187.40, out at 189.10 (+170.00), 09:35:10 to 10:12:44
 *   options  SPY 580 call long 2 at 3.50, out at 4.25 (+150.00, 100 a point),
 *            10:00 to 11:30 on 3 March 2026
 *   forex    EURUSD long 0.10 lots at 1.08500, out at 1.08750 (+25.00), 09:30:00 to 11:15:20
 *   crypto   BTC long 0.5 at 60000, out at 61000 (+500.00), 14:00 to 16:30
 *
 * A real export can differ (platforms add and rename columns); the column
 * mapping in the import preview is the answer to that.
 */

/** symbol, side, quantity, entry, exit, opened, closed, multiplier, net P&L */
export type ExpectedTrade = [string, 'LONG' | 'SHORT', number, number, number, string, string, number, number];

export interface PlatformExport {
  platform: string;
  file: string;
  /** what the import must make of it, in order of opening */
  trades: ExpectedTrade[];
  /** the only things the import may report as needing a check */
  errors?: RegExp[];
  csv: string;
  /** typed in the preview for a file without a symbol column */
  defaultSymbol?: string;
}

const lines = (...rows: string[]) => rows.join('\n');

export const PLATFORM_EXPORTS: PlatformExport[] = [
  // ---- futures platforms ----------------------------------------------------
  {
    platform: 'NinjaTrader 8',
    file: 'Executions (Trade Performance, display Executions)',
    trades: [
      ['MNQ 03-26', 'LONG', 2, 21000.25, 21010.75, '2026-03-02T09:31', '2026-03-02T09:45', 2, 40.76],
      ['MNQ 03-26', 'SHORT', 1, 21020, 21025.5, '2026-03-02T10:02', '2026-03-02T10:10', 2, -11.62],
    ],
    csv: lines(
      'Instrument,Action,Quantity,Price,Time,ID,E/X,Position,Order ID,Name,Commission,Rate,Account,Connection',
      'MNQ 03-26,Buy,2,21000.25,3/2/2026 9:31:05 AM,e1f0a1,Entry,2 L,o2001,Entry,$0.62,1,Sim101,Playback Connection',
      'MNQ 03-26,Sell,2,21010.75,3/2/2026 9:45:10 AM,e1f0a2,Exit,-,o2002,Exit,$0.62,1,Sim101,Playback Connection',
      'MNQ 03-26,Sell,1,21020.00,3/2/2026 10:02:00 AM,e1f0a3,Entry,1 S,o2003,Entry,$0.31,1,Sim101,Playback Connection',
      'MNQ 03-26,Buy,1,21025.50,3/2/2026 10:10:30 AM,e1f0a4,Exit,-,o2004,Exit,$0.31,1,Sim101,Playback Connection',
    ),
  },
  {
    platform: 'NinjaTrader 8',
    file: 'Executions, European settings (semicolons, decimal commas, day.month.year)',
    trades: [
      ['MNQ 03-26', 'LONG', 2, 21000.25, 21010.75, '2026-03-02T09:31', '2026-03-02T09:45', 2, 40.76],
      ['MNQ 03-26', 'SHORT', 1, 21020, 21025.5, '2026-03-02T10:02', '2026-03-02T10:10', 2, -11.62],
    ],
    csv: lines(
      'Instrument;Action;Quantity;Price;Time;ID;E/X;Position;Order ID;Name;Commission;Rate;Account;Connection;',
      'MNQ 03-26;Buy;2;21000,25;02.03.2026 09:31:05;e1f0a1;Entry;2 L;o2001;Entry;0,62 $;1;Sim101;Playback Connection;',
      'MNQ 03-26;Sell;2;21010,75;02.03.2026 09:45:10;e1f0a2;Exit;-;o2002;Exit;0,62 $;1;Sim101;Playback Connection;',
      'MNQ 03-26;Sell;1;21020,00;02.03.2026 10:02:00;e1f0a3;Entry;1 S;o2003;Entry;0,31 $;1;Sim101;Playback Connection;',
      'MNQ 03-26;Buy;1;21025,50;02.03.2026 10:10:30;e1f0a4;Exit;-;o2004;Exit;0,31 $;1;Sim101;Playback Connection;',
    ),
  },
  {
    platform: 'NinjaTrader 8',
    file: 'Trades, in French',
    trades: [
      ['MNQ 03-26', 'LONG', 2, 21000.25, 21010.75, '2026-03-02T09:31', '2026-03-02T09:45', 2, 40.76],
      ['MNQ 03-26', 'SHORT', 1, 21020, 21025.5, '2026-03-02T10:02', '2026-03-02T10:10', 2, -11.62],
    ],
    csv: lines(
      "Numéro d'ordre;Instrument;Compte;Stratégie;Pos. marché.;Qté;Prix d'entrée;Prix de sortie;Heure d'entrée;Heure de sortie;Nom d'entrée;Nom de la sortie;Profit;Profit net cum.;Commission;MAE;MFE;ETD;Barres;",
      '1;MNQ 03-26;Sim101;;Long;2;21000,25;21010,75;02/03/2026 09:31:05;02/03/2026 09:45:10;Entry;Exit;42,00 $;40,76 $;1,24 $;10,00 $;50,00 $;8,00 $;14;',
      '2;MNQ 03-26;Sim101;;Short;1;21020,00;21025,50;02/03/2026 10:02:00;02/03/2026 10:10:30;Entry;Exit;-11,00 $;29,14 $;0,62 $;12,00 $;4,00 $;15,00 $;8;',
    ),
  },
  {
    platform: 'Tradovate',
    file: 'Performance (paired buy and sell fills)',
    trades: [
      ['MNQH6', 'LONG', 2, 21000.25, 21010.75, '2026-03-02T09:31', '2026-03-02T09:45', 2, 42],
      ['MNQH6', 'SHORT', 1, 21020, 21025.5, '2026-03-02T10:02', '2026-03-02T10:10', 2, -11],
    ],
    csv: lines(
      'symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration',
      'MNQH6,-2,0,0.25,301,302,2,21000.25,21010.75,$42.00,03/02/2026 09:31:05,03/02/2026 09:45:10,14min 5sec',
      'MNQH6,-2,0,0.25,304,303,1,21025.50,21020.00,$(11.00),03/02/2026 10:10:30,03/02/2026 10:02:00,8min 30sec',
    ),
  },
  {
    platform: 'TopstepX',
    file: 'Orders',
    trades: [['MNQH6', 'LONG', 2, 21000.25, 21010.75, '2026-03-02T14:31', '2026-03-02T14:45', 2, 42]],
    csv: lines(
      'Id,AccountName,ContractName,Status,Type,Size,Side,CreatedAt,TradeDay,FilledAt,CancelledAt,StopPrice,LimitPrice,ExecutePrice,PositionDisposition,CreationDisposition,RejectionReason,ExchangeOrderId,PlatformOrderId',
      '5001,50KTC-V2-1234,MNQH6,Filled,Market,2,Bid,2026-03-02T09:31:05.000-05:00,2026-03-02T00:00:00-05:00,2026-03-02T09:31:05.120-05:00,,,,21000.25,Opening,Trader,,X1,P1',
      '5002,50KTC-V2-1234,MNQH6,Cancelled,Limit,2,Ask,2026-03-02T09:31:10.000-05:00,2026-03-02T00:00:00-05:00,,2026-03-02T09:45:09.000-05:00,,21050.00,,,Trader,,X2,P2',
      '5003,50KTC-V2-1234,MNQH6,Filled,Market,2,Ask,2026-03-02T09:45:10.000-05:00,2026-03-02T00:00:00-05:00,2026-03-02T09:45:10.090-05:00,,,,21010.75,Closing,Trader,,X3,P3',
    ),
  },
  {
    platform: 'Rithmic R | Trader Pro',
    file: 'Orders History, Completed Orders',
    trades: [['MNQH6', 'LONG', 2, 21000.25, 21010.75, '2026-03-02T09:31', '2026-03-02T09:45', 2, 42]],
    csv: lines(
      'Completed Orders',
      'Account,Status,Remarks,Buy/Sell,Qty To Fill,Symbol,Exchange,Qty Filled,Avg Fill Price,Limit Price,Stop Price,Order Type,Order Number,Create Time,Update Time',
      'APEX-1234-01,Filled,,B,2,MNQH6,CME,2,21000.25,,,Market,9001,2026-03-02 09:31:05,2026-03-02 09:31:05',
      'APEX-1234-01,Cancelled,,S,2,MNQH6,CME,0,,21050.00,,Limit,9002,2026-03-02 09:31:10,2026-03-02 09:45:09',
      'APEX-1234-01,Filled,,S,2,MNQH6,CME,2,21010.75,,,Market,9003,2026-03-02 09:45:10,2026-03-02 09:45:10',
    ),
  },
  {
    platform: 'Rithmic R | Trader Pro',
    file: 'Trade performance report',
    trades: [
      ['MNQH6', 'LONG', 2, 21000.25, 21010.75, '2026-03-02T09:31', '2026-03-02T09:45', 2, 40.76],
      ['MNQH6', 'SHORT', 1, 21020, 21025.5, '2026-03-02T10:02', '2026-03-02T10:10', 2, -11.62],
    ],
    csv: lines(
      'AccountNumber,Instrument,Entry Order Number,Exit Order Number,Entry Buy/Sell,Fill Size,Entry Price,Exit Price,Entry Time,Exit Time,Trade P&L,Commission & Fees,Trade Life Span',
      'APEX-1234-01,MNQH6,9001,9003,B,2,21000.25,21010.75,2026-03-02 09:31:05,2026-03-02 09:45:10,42.00,1.24,00:14:05',
      'APEX-1234-01,MNQH6,9004,9005,S,1,21020.00,21025.50,2026-03-02 10:02:00,2026-03-02 10:10:30,-11.00,0.62,00:08:30',
    ),
  },
  {
    platform: 'Quantower',
    file: 'Trades history',
    trades: [['MNQH6', 'LONG', 2, 21000.25, 21010.75, '2026-03-02T14:31', '2026-03-02T14:45', 2, 40.76]],
    csv: lines(
      'Account,Date/Time,Symbol,Description,Symbol type,Expiration date,Strike price,Side,Order type,Quantity,Price,Gross P/L,Fee,Net P/L,Trade value,Trade ID,Order ID,Position ID',
      'Sim-1,2026-03-02 9:31:05 AM -05:00,MNQH6,Micro E-mini Nasdaq-100,Futures,2026-03-20,,Buy,Market,2,21000.25,0,-0.62,-0.62,84001,T1,O1,P1',
      'Sim-1,2026-03-02 9:45:10 AM -05:00,MNQH6,Micro E-mini Nasdaq-100,Futures,2026-03-20,,Sell,Market,-2,21010.75,42,-0.62,41.38,84043,T2,O2,P1',
    ),
  },
  {
    platform: 'ATAS',
    file: 'Statistics journal, saved as CSV',
    trades: [
      ['MNQH6', 'LONG', 2, 21000.25, 21010.75, '2026-03-02T09:31', '2026-03-02T09:45', 2, 42],
      ['MNQH6', 'SHORT', 1, 21020, 21025.5, '2026-03-02T10:02', '2026-03-02T10:10', 2, -11],
    ],
    csv: lines(
      'Account,Instrument,Open time,Open price,Open volume,Close time,Close price,Close volume,Ticks,PnL,Comment',
      'Sim,MNQH6,02.03.2026 09:31:05,21000.25,2,02.03.2026 09:45:10,21010.75,-2,42,42.00,',
      'Sim,MNQH6,02.03.2026 10:02:00,21020.00,-1,02.03.2026 10:10:30,21025.50,1,-22,-11.00,',
    ),
  },
  {
    platform: 'Sierra Chart',
    file: 'Trade Activity Log, fills (tab separated)',
    trades: [['MNQH26-CME', 'LONG', 2, 21000.25, 21010.75, '2026-03-02T09:31', '2026-03-02T09:45', 2, 42]],
    csv: lines(
      [
        'ActivityType',
        'DateTime',
        'TransDateTime',
        'Symbol',
        'OrderActionSource',
        'InternalOrderID',
        'ServiceOrderID',
        'OrderType',
        'Quantity',
        'BuySell',
        'Price',
        'Price2',
        'OrderStatus',
        'FillPrice',
        'FilledQuantity',
        'TradeAccount',
        'OpenClose',
        'ParentInternalOrderID',
        'PositionQuantity',
        'FillExecutionServiceID',
        'Note',
      ].join('\t'),
      [
        'Fills',
        '2026-03-02 09:31:05.120',
        '2026-03-02 09:31:05.118',
        'MNQH26-CME',
        'Chart DOM',
        '101',
        'S101',
        'Market',
        '2',
        'Buy',
        '0',
        '0',
        'Filled',
        '21000.25',
        '2',
        'Sim1',
        'Open',
        '0',
        '2',
        'F101',
        '',
      ].join('\t'),
      [
        'Fills',
        '2026-03-02 09:45:10.090',
        '2026-03-02 09:45:10.088',
        'MNQH26-CME',
        'Chart DOM',
        '102',
        'S102',
        'Market',
        '2',
        'Sell',
        '0',
        '0',
        'Filled',
        '21010.75',
        '2',
        'Sim1',
        'Close',
        '0',
        '0',
        'F102',
        '',
      ].join('\t'),
    ),
  },
  {
    platform: 'TradeStation',
    file: 'Orders report',
    trades: [['MNQH26', 'LONG', 2, 21000.25, 21010.75, '2026-03-02T09:31', '2026-03-02T09:45', 2, 40.76]],
    csv: lines(
      'TradeStation Orders',
      'Order #,Symbol,Type,Qty,Qty Filled,Order Type,Limit Price,Stop Price,Filled Price,Order Status,Entered,Filled/Canceled,Commission,Routing,Duration,Account,Contract Exp Date',
      '7001,MNQH26,Buy,2,2,Market,,,21000.25,Filled,3/2/2026 9:31:05 AM,3/2/2026 9:31:05 AM,$0.62,Intelligent,Day,SIM12345F,3/20/2026',
      '7002,MNQH26,Sell,2,0,Limit,21050.00,,,Canceled,3/2/2026 9:31:10 AM,3/2/2026 9:45:09 AM,$0.00,Intelligent,Day,SIM12345F,3/20/2026',
      '7003,MNQH26,Sell,2,2,Market,,,21010.75,Filled,3/2/2026 9:45:10 AM,3/2/2026 9:45:10 AM,$0.62,Intelligent,Day,SIM12345F,3/20/2026',
    ),
  },
  {
    platform: 'Deepcharts',
    file: 'Trade list',
    trades: [
      ['MNQH6', 'LONG', 2, 21000.25, 21010.75, '2026-03-02T09:31', '2026-03-02T09:45', 2, 42],
      ['MNQH6', 'SHORT', 1, 21020, 21025.5, '2026-03-02T10:02', '2026-03-02T10:10', 2, -11],
    ],
    csv: lines(
      'Symbol,Quantity,Entry DT,Entry Price,Exit DT,Exit Price,ProfitLoss',
      'MNQH6,2,2026-03-02 09:31:05.120,21000.25,2026-03-02 09:45:10.090,21010.75,42.00',
      'MNQH6,-1,2026-03-02 10:02:00.000,21020.00,2026-03-02 10:10:30.000,21025.50,-11.00',
    ),
  },

  // ---- TradingView ----------------------------------------------------------
  {
    platform: 'TradingView',
    file: 'Paper Trading, Order History',
    trades: [['MNQ1!', 'LONG', 2, 21000.25, 21010.75, '2026-03-02T09:31', '2026-03-02T09:45', 2, 42]],
    csv: lines(
      'Symbol,Side,Type,Quantity,Limit price,Stop price,Fill price,Status,Commission,Leverage,Margin,Placing time,Closing time,Order ID,Level ID',
      'CME_MINI:MNQ1!,Sell,Market,2,,,21010.75,Filled,,,,2026-03-02 09:45:10,2026-03-02 09:45:10,1003,',
      'CME_MINI:MNQ1!,Sell,Limit,2,21050.00,,,Cancelled,,,,2026-03-02 09:31:10,2026-03-02 09:45:09,1002,',
      'CME_MINI:MNQ1!,Buy,Market,2,,,21000.25,Filled,,,,2026-03-02 09:31:05,2026-03-02 09:31:05,1001,',
    ),
  },
  {
    platform: 'TradingView',
    file: 'Strategy Tester, List of trades (2025 columns)',
    trades: [
      ['MNQ1!', 'LONG', 2, 21000.25, 21010.75, '2026-03-02T09:31', '2026-03-02T09:45', 2, 42],
      ['MNQ1!', 'SHORT', 1, 21020, 21025.5, '2026-03-02T10:02', '2026-03-02T10:10', 2, -11],
    ],
    defaultSymbol: 'MNQ1!',
    csv: lines(
      'Trade #,Type,Date and time,Signal,Price USD,Position size (qty),Position size (value),Net P&L USD,Net P&L %,Favorable excursion USD,Favorable excursion %,Adverse excursion USD,Adverse excursion %,Cumulative P&L USD,Cumulative P&L %',
      '2,Exit short,2026-03-02 10:10,Close,21025.50,1,21025.5,-11.00,-0.03,4.00,0.01,-12.00,-0.03,31.00,0.03',
      '2,Entry short,2026-03-02 10:02,Short,21020.00,1,21020,-11.00,-0.03,4.00,0.01,-12.00,-0.03,31.00,0.03',
      '1,Exit long,2026-03-02 09:45,Close,21010.75,2,42021.5,42.00,0.05,50.00,0.06,-10.00,-0.01,42.00,0.04',
      '1,Entry long,2026-03-02 09:31,Long,21000.25,2,42000.5,42.00,0.05,50.00,0.06,-10.00,-0.01,42.00,0.04',
    ),
  },

  // ---- forex and CFDs -------------------------------------------------------
  {
    platform: 'MetaTrader 4 and 5',
    file: 'MetaTrader 4 account history',
    trades: [['EURUSD', 'LONG', 0.1, 1.085, 1.0875, '2026-03-02T09:30', '2026-03-02T11:15', 100000, 24.3]],
    csv: lines(
      'Ticket,Open Time,Type,Size,Item,Price,S / L,T / P,Close Time,Price,Commission,Taxes,Swap,Profit',
      '50001,2026.03.01 08:00:00,balance,,,,,,,,,,,10000.00',
      '50002,2026.03.02 09:30:00,buy,0.10,eurusd,1.08500,1.08300,1.08900,2026.03.02 11:15:20,1.08750,-0.70,0.00,0.00,25.00',
    ),
  },
  {
    platform: 'FTMO',
    file: 'Trading journal export (MetaTrader account)',
    trades: [['EURUSD', 'LONG', 0.1, 1.085, 1.0875, '2026-03-02T09:30', '2026-03-02T11:15', 100000, 24.3]],
    csv: lines(
      'Ticket;Open;Type;Volume;Symbol;Price;SL;TP;Close;Price;Swap;Commissions;Profit;Pips;Trade duration in seconds',
      '50002;2026-03-02 09:30:00;buy;0,1;EURUSD;1,085;1,083;1,089;2026-03-02 11:15:20;1,0875;0;-0,7;25;25;6320',
    ),
  },
  {
    platform: 'IG',
    file: 'Transaction history',
    trades: [['EUR/USD MINI', 'LONG', 1, 1.085, 1.0875, '2026-03-02T09:30', '2026-03-02T11:15', 10000, 25]],
    errors: [/no direction column/],
    csv: lines(
      'Date,Sumary,MarketName,Period,ProfitAndLoss,Transaction type,Reference,Open level,Close level,Size,Currency,PL Amount,Cash transaction,DateUtc,OpenDateUtc,CurrencyIsoCode',
      '02/03/2026,Deposit,Bank Deposit,-,E5000.00,DEPO,DP01,-,-,-,E,5000.00,true,2026-03-02T08:00:00,,EUR',
      '02/03/2026,CFD,EUR/USD Mini,-,E25.00,DEAL,RF01,1.08500,1.08750,+1,E,25.00,false,2026-03-02T11:15:20,2026-03-02T09:30:00,EUR',
    ),
  },

  // ---- stocks and options ---------------------------------------------------
  {
    platform: 'Interactive Brokers',
    file: 'Flex Query, trades',
    trades: [
      ['AAPL', 'LONG', 100, 187.4, 189.1, '2026-03-02T09:35', '2026-03-02T10:12', 1, 167.98],
      ['SPY   260320C00580000', 'LONG', 2, 3.5, 4.25, '2026-03-03T10:00', '2026-03-03T11:30', 100, 147.38],
    ],
    csv: lines(
      '"ClientAccountID","CurrencyPrimary","AssetClass","Symbol","Description","Multiplier","Strike","Expiry","Put/Call","TradeID","DateTime","TradeDate","Buy/Sell","Quantity","TradePrice","Proceeds","IBCommission","NetCash","Open/CloseIndicator","FifoPnlRealized","LevelOfDetail"',
      '"U1234567","USD","STK","AAPL","APPLE INC","1","","","","111","20260302;093510","20260302","BUY","100","187.40","-18740","-1","-18741","O","0","EXECUTION"',
      '"U1234567","USD","STK","AAPL","APPLE INC","1","","","","112","20260302;101244","20260302","SELL","-100","189.10","18910","-1.02","18908.98","C","167.98","EXECUTION"',
      '"U1234567","USD","OPT","SPY   260320C00580000","SPY 20MAR26 580 C","100","580","20260320","C","113","20260303;100000","20260303","BUY","2","3.50","-700","-1.30","-701.3","O","0","EXECUTION"',
      '"U1234567","USD","OPT","SPY   260320C00580000","SPY 20MAR26 580 C","100","580","20260320","C","114","20260303;113000","20260303","SELL","-2","4.25","850","-1.32","848.68","C","147.38","EXECUTION"',
    ),
  },
  {
    platform: 'tastytrade',
    file: 'Transactions history',
    trades: [
      ['AAPL', 'LONG', 100, 187.4, 189.1, '2026-03-02T14:35', '2026-03-02T15:12', 1, 169.98],
      ['SPY   260320C00580000', 'LONG', 2, 3.5, 4.25, '2026-03-03T15:00', '2026-03-03T16:30', 100, 147.38],
    ],
    csv: lines(
      'Date,Type,Sub Type,Action,Symbol,Instrument Type,Description,Value,Quantity,Average Price,Commissions,Fees,Multiplier,Root Symbol,Underlying Symbol,Expiration Date,Strike Price,Call or Put,Order #,Total,Currency',
      '2026-03-03T11:30:00-0500,Trade,Sell to Close,SELL_TO_CLOSE,SPY   260320C00580000,Equity Option,Sold 2 SPY 03/20/26 Call 580.00 @ 4.25,850.00,2,425.00,-1.00,-0.32,100,SPY,SPY,3/20/26,580,CALL,2002,848.68,USD',
      '2026-03-03T10:00:00-0500,Trade,Buy to Open,BUY_TO_OPEN,SPY   260320C00580000,Equity Option,Bought 2 SPY 03/20/26 Call 580.00 @ 3.50,-700.00,2,-350.00,-1.00,-0.30,100,SPY,SPY,3/20/26,580,CALL,2001,-701.30,USD',
      '2026-03-02T10:12:44-0500,Trade,Sell to Close,SELL_TO_CLOSE,AAPL,Equity,Sold 100 AAPL @ 189.10,"18,910.00",100,189.10,0.00,-0.02,1,,AAPL,,,,1004,"18,909.98",USD',
      '2026-03-02T09:35:10-0500,Trade,Buy to Open,BUY_TO_OPEN,AAPL,Equity,Bought 100 AAPL @ 187.40,"-18,740.00",100,-187.40,0.00,0.00,1,,AAPL,,,,1003,"-18,740.00",USD',
      '2026-03-01T08:00:00-0500,Money Movement,Deposit,,,,ACH DEPOSIT,"5,000.00",0,,0.00,0.00,,,,,,,,"5,000.00",USD',
    ),
  },
  {
    platform: 'Charles Schwab',
    file: 'Transactions history',
    trades: [['AAPL', 'LONG', 100, 187.4, 189.1, '2026-03-02T00:00', '2026-03-02T00:00', 1, 169.98]],
    csv: lines(
      '"Date","Action","Symbol","Description","Quantity","Price","Fees & Comm","Amount"',
      '"03/02/2026","Sell","AAPL","APPLE INC","100","$189.10","$0.02","$18,909.98"',
      '"03/02/2026","Buy","AAPL","APPLE INC","100","$187.40","","-$18,740.00"',
      '"02/27/2026","MoneyLink Transfer","","Tfr BANK OF EXAMPLE","","","","$5,000.00"',
    ),
  },
  {
    platform: 'Fidelity',
    file: 'Account history',
    trades: [['AAPL', 'LONG', 100, 187.4, 189.1, '2026-03-02T00:00', '2026-03-02T00:00', 1, 169.98]],
    csv: lines(
      '',
      'Run Date,Account,Action,Symbol,Description,Type,Quantity,Price ($),Commission ($),Fees ($),Accrued Interest ($),Amount ($),Cash Balance ($),Settlement Date',
      '03/02/2026,Individual X12345678,"YOU SOLD APPLE INC (AAPL) (Cash)",AAPL,"APPLE INC",Cash,-100,189.10,,0.02,,18909.98,23909.98,03/03/2026',
      '03/02/2026,Individual X12345678,"YOU BOUGHT APPLE INC (AAPL) (Cash)",AAPL,"APPLE INC",Cash,100,187.40,,,,-18740.00,5000.00,03/03/2026',
      '02/27/2026,Individual X12345678,"ELECTRONIC FUNDS TRANSFER RECEIVED (Cash)",,"No Description",Cash,0.000,,,,,5000.00,23740.00,',
      '',
      '"The data and information in this spreadsheet is provided to you solely for your use and is not for distribution."',
      '"Date downloaded 03/05/2026 10:00 am"',
    ),
  },
  {
    platform: 'E*TRADE',
    file: 'Transactions',
    trades: [['AAPL', 'LONG', 100, 187.4, 189.1, '2026-03-02T00:00', '2026-03-02T00:00', 1, 170]],
    csv: lines(
      'For Account:,####1234',
      '',
      'TransactionDate,TransactionType,SecurityType,Symbol,Quantity,Amount,Price,Commission,Description',
      '03/02/26,Sold,EQ,AAPL,-100,18909.98,189.10,0.00,APPLE INC',
      '03/02/26,Bought,EQ,AAPL,100,-18740.00,187.40,0.00,APPLE INC',
      '02/27/26,Transfer,,,0,5000.00,0,0.00,TRANSFER FROM BANK',
    ),
  },
  {
    platform: 'TradeZero',
    file: 'Trades',
    trades: [['AAPL', 'LONG', 100, 187.4, 189.1, '2026-03-02T09:35', '2026-03-02T10:12', 1, 169.4]],
    csv: lines(
      'Account,T/D,S/D,Currency,Type,Side,Symbol,Qty,Price,Exec Time,Comm,SEC,TAF,NSCC,Nasdaq,ECN Remove,ECN Add,Gross Proceeds,Net Proceeds,Clr Broker,Liq,Note',
      'TZ12345,03/02/2026,03/03/2026,USD,2,B,AAPL,100,187.40,09:35:10,0.00,0.00,0.00,0.02,0.00,0.30,0.00,-18740.00,-18740.32,VELO,R,',
      'TZ12345,03/02/2026,03/03/2026,USD,2,S,AAPL,100,189.10,10:12:44,0.00,0.04,0.02,0.02,0.00,0.00,-0.20,18910.00,18910.12,VELO,A,',
    ),
  },
  {
    platform: 'Trading 212',
    file: 'History',
    trades: [['AAPL', 'LONG', 100, 187.4, 189.1, '2026-03-02T09:35', '2026-03-02T10:12', 1, 170]],
    csv: lines(
      'Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Currency (Result),Total,Currency (Total),Withholding tax,Currency (Withholding tax),Notes,ID,Currency conversion fee,Currency (Currency conversion fee)',
      'Deposit,2026-03-01 08:00:00,,,,,,,,,,5000.00,USD,,,,D001,,',
      'Market buy,2026-03-02 09:35:10,US0378331005,AAPL,Apple,100,187.40,USD,1.00,,,18740.00,USD,,,,EOF001,,',
      'Market sell,2026-03-02 10:12:44,US0378331005,AAPL,Apple,100,189.10,USD,1.00,170.00,USD,18910.00,USD,,,,EOF002,,',
    ),
  },
  {
    platform: 'DEGIRO',
    file: 'Transactions',
    trades: [['APPLE INC - COMMON ST', 'LONG', 100, 187.4, 189.1, '2026-03-16T09:35', '2026-03-16T10:12', 1, 168]],
    csv: lines(
      'Date,Time,Product,ISIN,Reference exchange,Venue,Quantity,Price,,Local value,,Value,,Exchange rate,Transaction and/or third party fees,,Total,,Order ID',
      '16-03-2026,10:12,APPLE INC - COMMON ST,US0378331005,NDQ,XNAS,-100,189.10,USD,18910.00,USD,18910.00,USD,1.0000,-1.00,USD,18909.00,USD,b2c3',
      '16-03-2026,09:35,APPLE INC - COMMON ST,US0378331005,NDQ,XNAS,100,187.40,USD,-18740.00,USD,-18740.00,USD,1.0000,-1.00,USD,-18741.00,USD,a1b2',
    ),
  },

  // ---- crypto ---------------------------------------------------------------
  {
    platform: 'Binance',
    file: 'Futures trade history',
    trades: [['BTCUSDT', 'LONG', 0.5, 60000, 61000, '2026-03-02T14:00', '2026-03-02T16:30', 1, 475.8]],
    csv: lines(
      'Date(UTC),Symbol,Side,Price,Quantity,Amount,Fee,Realized Profit',
      '2026-03-02 14:00:00,BTCUSDT,BUY,60000,0.5,30000,12.00,0',
      '2026-03-02 16:30:00,BTCUSDT,SELL,61000,0.5,30500,12.20,500',
    ),
  },
  {
    platform: 'Coinbase',
    file: 'Transaction history',
    trades: [['BTC', 'LONG', 0.5, 60000, 61000, '2026-03-02T14:00', '2026-03-02T16:30', 1, 258]],
    csv: lines(
      'Transactions',
      'User,user@example.com,0000-0000',
      '',
      'ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes',
      'c001,2026-03-01 08:00:00 UTC,Deposit,USD,5000,USD,$1.00,"$5,000.00","$5,000.00",$0.00,Deposit from bank',
      'c002,2026-03-02 14:00:00 UTC,Buy,BTC,0.5,USD,"$60,000.00","$30,000.00","$30,120.00",$120.00,Bought 0.5 BTC',
      'c003,2026-03-02 16:30:00 UTC,Sell,BTC,0.5,USD,"$61,000.00","$30,500.00","$30,378.00",$122.00,Sold 0.5 BTC',
    ),
  },
  {
    platform: 'Coinbase',
    file: 'Advanced, fills',
    trades: [['BTC-USD', 'LONG', 0.5, 60000, 61000, '2026-03-02T14:00', '2026-03-02T16:30', 1, 403.2]],
    csv: lines(
      'portfolio,trade id,product,side,created at,size,size unit,price,fee,total,price/fee/total unit',
      'Default,T001,BTC-USD,BUY,2026-03-02T14:00:00.123Z,0.5,BTC,60000,48,-30048,USD',
      'Default,T002,BTC-USD,SELL,2026-03-02T16:30:00.456Z,0.5,BTC,61000,48.8,30451.2,USD',
    ),
  },
  {
    platform: 'Kraken',
    file: 'Trades',
    trades: [['XXBTZUSD', 'LONG', 0.5, 60000, 61000, '2026-03-02T14:00', '2026-03-02T16:30', 1, 372.7]],
    csv: lines(
      '"txid","ordertxid","pair","time","type","ordertype","price","cost","fee","vol","margin","misc","ledgers"',
      '"TX001","OR001","XXBTZUSD","2026-03-02 14:00:00.1234","buy","limit","60000.0","30000.0","48.0","0.5","0.0","","LG001,LG002"',
      '"TX002","OR002","XXBTZUSD","2026-03-02 16:30:00.5678","sell","market","61000.0","30500.0","79.3","0.5","0.0","","LG003,LG004"',
    ),
  },
  {
    platform: 'Hyperliquid',
    file: 'Trade history',
    trades: [['BTC', 'LONG', 0.5, 60000, 61000, '2026-03-02T14:00', '2026-03-02T16:30', 1, 478.83]],
    csv: lines(
      'time,coin,dir,px,sz,ntl,fee,closedPnl',
      '3/2/2026 - 16:30:00,BTC,Close Long,61000.0,0.5,30500.0,10.675,500.0',
      '3/2/2026 - 14:00:00,BTC,Open Long,60000.0,0.5,30000.0,10.5,0.0',
    ),
  },

  // ---- other journals -------------------------------------------------------
  {
    platform: 'TradeZella',
    file: 'Trades export',
    trades: [['AAPL', 'LONG', 100, 187.4, 189.1, '2026-03-02T09:35', '2026-03-02T10:12', 1, 168.98]],
    csv: lines(
      'Account Name,Open Date,Open Time,Close Date,Close Time,Symbol,Instrument,Side,Quantity,Entry Price,Exit Price,Gross P&L,Commission,Fee,Adjusted Cost,Adjusted Proceeds,Duration',
      'Main,03/02/2026,09:35:10,03/02/2026,10:12:44,AAPL,Stock,Long,100,187.40,189.10,170.00,1.00,0.02,18740.00,18910.00,2254',
    ),
  },
];
