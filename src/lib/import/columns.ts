import {
  isTimeOfDay,
  parseAction,
  parseEffect,
  parseMoment,
  parseMoney,
  parseNumber,
  parsePutCall,
  zoneOffset,
} from './values';
import { CURRENCIES, roleFromWords } from './words';

/**
 * What each column of a broker's file means. Headers are matched on a
 * normalised key: lower case, letters and digits only, with currency tags
 * ("Price USD", "Net P&L (USD)") and time-zone tags ("Time (UTC+2)") taken
 * off and remembered. Every name has a priority, so when a file has both
 * "Price" (the limit) and "Avg Fill Price", the fill price wins. A name not
 * listed here is read by its words (words.ts), as a guess its values must
 * bear out.
 */
export type Role =
  | 'symbol'
  | 'side'
  | 'effect'
  | 'status'
  | 'trade_no'
  | 'external_id'
  | 'opened_at'
  | 'opened_date'
  | 'closed_at'
  | 'closed_date'
  | 'time'
  | 'date'
  | 'bought_at'
  | 'sold_at'
  | 'buy_fill_id'
  | 'sell_fill_id'
  | 'buy_price'
  | 'sell_price'
  | 'entry_price'
  | 'exit_price'
  | 'price'
  | 'quantity'
  | 'notional'
  | 'stop_loss'
  | 'take_profit'
  | 'fees'
  | 'fee_rate'
  | 'multiplier'
  | 'leverage'
  | 'pnl'
  | 'net_pnl'
  | 'gross_pnl'
  | 'session'
  | 'setup'
  | 'tags'
  | 'notes'
  | 'account'
  | 'asset_class'
  | 'put_call'
  | 'strike'
  | 'expiry'
  | 'underlying'
  | 'tick_size'
  | 'duration';

/** what a role is called in the import preview, in the order it is offered */
export const ROLE_LABELS: Array<[Role, string]> = [
  ['symbol', 'Symbol'],
  ['side', 'Direction (buy / sell, long / short)'],
  ['quantity', 'Quantity'],
  ['price', 'Fill price'],
  ['entry_price', 'Entry price'],
  ['exit_price', 'Exit price'],
  ['time', 'Date and time'],
  ['date', 'Date'],
  ['opened_at', 'Opened: date and time'],
  ['opened_date', 'Opened: date'],
  ['closed_at', 'Closed: date and time'],
  ['closed_date', 'Closed: date'],
  ['fees', 'Fees or commission (several add up)'],
  ['fee_rate', 'Fee per contract, each side'],
  ['pnl', 'P&L before fees'],
  ['net_pnl', 'P&L after fees'],
  ['gross_pnl', 'Gross P&L'],
  ['multiplier', 'Multiplier / point value'],
  ['notional', 'Amount or proceeds (price × size)'],
  ['effect', 'Opens or closes a position'],
  ['status', 'Order status'],
  ['trade_no', 'Trade number (groups entry and exit rows)'],
  ['external_id', 'ID (to skip what was already imported)'],
  ['stop_loss', 'Stop loss'],
  ['take_profit', 'Take profit'],
  ['account', 'Account'],
  ['setup', 'Playbook setup / strategy'],
  ['tags', 'Tags'],
  ['notes', 'Notes'],
  ['session', 'Session'],
  ['leverage', 'Leverage'],
  ['asset_class', 'Asset class'],
  ['put_call', 'Call or put'],
  ['strike', 'Strike'],
  ['expiry', 'Expiry'],
  ['underlying', 'Underlying'],
  ['buy_price', 'Buy price (paired fills)'],
  ['sell_price', 'Sell price (paired fills)'],
  ['bought_at', 'Buy time (paired fills)'],
  ['sold_at', 'Sell time (paired fills)'],
  ['buy_fill_id', 'Buy fill ID (paired fills)'],
  ['sell_fill_id', 'Sell fill ID (paired fills)'],
];

/** roles where several columns add up instead of one being chosen */
export const ADDITIVE: ReadonlySet<Role> = new Set<Role>(['fees']);

const ALIASES: Record<string, [Role, number]> = {};
const alias = (role: Role, priority: number, keys: string[]) => keys.forEach((k) => (ALIASES[k] = [role, priority]));

alias('symbol', 3, [
  'symbol',
  'ticker',
  'tickersymbol',
  'pair',
  'symbolpair',
  'tradingpair',
  'contractsymbol',
  'contractname',
]);
alias('symbol', 2, ['instrument', 'instrumentname', 'contract', 'securitysymbol', 'marketname']);
alias('symbol', 1, ['market', 'asset', 'security', 'stock', 'product', 'item', 'coin']);
alias('underlying', 2, ['underlying', 'underlyingsymbol', 'rootsymbol', 'root']);

alias('side', 3, [
  'side',
  'buysell',
  'bs',
  'direction',
  'marketpos',
  'marketposition',
  'openingdirection',
  'tradeside',
  'orderside',
  // Rithmic's trade performance report, Bybit's closed P&L, NinjaTrader in French
  'entrybuysell',
  'closingdirection',
  'posmarche',
]);
alias('side', 2, ['action', 'transcode', 'transactioncode', 'buyorsell', 'dir']);
alias('side', 1, ['type', 'transactiontype', 'tradetype', 'position', 'positiontype', 'dealtype']);
alias('effect', 3, [
  'poseffect',
  'positioneffect',
  'openclose',
  'ex',
  'entryexit',
  'openorclose',
  'openingclosing',
  'opencloseindicator',
  'positiondisposition',
]);
alias('effect', 2, ['effect']);
alias('effect', 1, ['code', 'codes']);
alias('status', 3, ['status', 'orderstatus', 'fillstatus']);
alias('status', 1, ['state']);
alias('trade_no', 3, ['tradeno', 'tradenumber', 'tradenum', 'tradeidx']);

alias('external_id', 3, [
  'tradeid',
  'executionid',
  'execid',
  'fillid',
  'dealid',
  'ticket',
  'ticketno',
  'transactionid',
  'confirmationno',
  'tradeidentifier',
  'txid',
  'fillexecutionserviceid',
]);
alias('external_id', 2, [
  'id',
  'orderid',
  'orderno',
  'ordernumber',
  'positionid',
  'deal',
  'referenceno',
  'refno',
  'reference',
]);

alias('opened_at', 3, [
  'openedat',
  'opentime',
  'entrytime',
  'entrydatetime',
  'entrytimestamp',
  'opendatetime',
  'timeopened',
  'enteredat',
  'openingtime',
  'opentimestamp',
  'timeopen',
  'entryat',
  'starttime',
  'entrydt',
  'heuredentree',
  'opendateutc',
]);
// an "Open" or "Close" column of dates (FTMO); one of prices is left alone (see planColumns)
alias('opened_at', 1, ['open', 'opened']);
alias('opened_date', 3, ['entrydate', 'opendate', 'dateopened', 'openingdate', 'startdate']);
alias('closed_at', 3, [
  'closedat',
  'closetime',
  'exittime',
  'exitdatetime',
  'exittimestamp',
  'closedatetime',
  'timeclosed',
  'exitedat',
  'closingtime',
  'closetimestamp',
  'timeclose',
  'exitat',
  'endtime',
  'exitdt',
  'heuredesortie',
]);
alias('closed_at', 1, ['close', 'closed']);
alias('closed_date', 3, ['exitdate', 'closedate', 'dateclosed', 'closingdate', 'enddate']);
alias('time', 3, [
  'exectime',
  'executiontime',
  'filltime',
  'filledtime',
  'tradetime',
  'executedat',
  'filledat',
  'executiondatetime',
  'filldatetime',
]);
alias('time', 2, [
  'time',
  'datetime',
  'timestamp',
  'transactiontime',
  'tradedat',
  'transacttime',
  'datetimeutc',
  'dateandtime',
  'filledcanceled',
  // IG: when the deal closed, next to OpenDateUtc (see planColumns)
  'dateutc',
]);
alias('time', 1, ['updatetime', 'createdat', 'created', 'lastupdated', 'entered']);
alias('date', 3, ['activitydate', 'executiondate', 'filldate', 'tradedate']);
// TradeZero's T/D is the trade date; Fidelity's Run Date the day of the trade
alias('date', 2, ['date', 'transactiondate', 'td', 'rundate']);
alias('date', 1, ['tradeday', 'tradingday']);

// paired buy/sell fill exports (Tradovate's performance report and similar)
alias('buy_price', 3, ['buyprice', 'avgbuyprice', 'averagebuyprice']);
alias('sell_price', 3, ['sellprice', 'avgsellprice', 'averagesellprice']);
alias('bought_at', 3, ['boughttimestamp', 'buytimestamp', 'buytime', 'boughttime', 'buydate']);
alias('sold_at', 3, ['soldtimestamp', 'selltimestamp', 'selltime', 'soldtime', 'selldate']);
alias('buy_fill_id', 3, ['buyfillid']);
alias('sell_fill_id', 3, ['sellfillid']);
alias('tick_size', 3, ['ticksize']);

alias('entry_price', 3, [
  'entryprice',
  'openprice',
  'priceopen',
  'avgentryprice',
  'averageentryprice',
  'openingprice',
  'entryavgprice',
  'openlevel',
  'prixdentree',
]);
alias('entry_price', 2, ['entry']);
alias('exit_price', 3, [
  'exitprice',
  'closeprice',
  'priceclose',
  'avgexitprice',
  'averageexitprice',
  'closingprice',
  'exitavgprice',
  'closelevel',
  'prixdesortie',
]);
alias('exit_price', 2, ['exit']);
alias('price', 3, [
  'fillprice',
  'filledprice',
  'avgfillprice',
  'averagefillprice',
  'executionprice',
  'execprice',
  'tradeprice',
  'tprice',
  'dealprice',
  'executedprice',
  'avgexecutionprice',
  'executeprice',
  'priceattransaction',
  'spotpriceattransaction',
]);
alias('price', 2, ['avgprice', 'averageprice', 'pricepershare', 'priceshare', 'px']);
alias('price', 1, ['price', 'netprice']);

alias('quantity', 3, [
  'filledqty',
  'filledquantity',
  'filled',
  'executedqty',
  'executedquantity',
  'executed',
  'qtyfilled',
  'quantityfilled',
  'fillqty',
  'fillquantity',
  'fillsize',
  'closingquantity',
  'positionsizeqty',
  'tradesize',
  'quantitytransacted',
  'openvolume',
]);
alias('quantity', 2, [
  'quantity',
  'qty',
  'size',
  'volume',
  'shares',
  'contracts',
  'lots',
  'units',
  'amountshares',
  'lotsize',
  'noofshares',
  'vol',
  'sz',
  'qte',
]);
alias('quantity', 1, ['totalqty', 'orderqty', 'orderquantity', 'quantityordered']);
alias('notional', 3, [
  'proceeds',
  'notional',
  'tradevalue',
  'grossamount',
  'positionsizevalue',
  'principal',
  'grossproceeds',
]);
alias('notional', 2, ['amount', 'total', 'value', 'tradeamount', 'subtotal', 'cost', 'ntl']);
alias('notional', 1, ['netamount', 'netproceeds']);

alias('stop_loss', 3, ['stoploss', 'stoplossprice', 'initialstop', 'stoplevel']);
alias('stop_loss', 2, ['stop', 'sl']);
alias('take_profit', 3, ['takeprofit', 'profittarget', 'targetprice', 'takeprofitprice']);
alias('take_profit', 2, ['target', 'tp']);

alias('fees', 3, [
  'fees',
  'fee',
  'commission',
  'commissions',
  'comm',
  'commfee',
  'commfees',
  'commissionfee',
  'commissionfees',
  'commissionandfees',
  'commissionsfees',
  'commissionsandfees',
  'feesandcommissions',
  'totalfees',
  'totalcommission',
  'totalcommissions',
  'clearingfee',
  'clearingfees',
  'exchangefee',
  'exchangefees',
  'ipfee',
  'nfafee',
  'nfafees',
  'regfee',
  'regfees',
  'regulatoryfee',
  'regulatoryfees',
  'secfee',
  'sec',
  'taffee',
  'taf',
  'nscc',
  'ecnremove',
  'ecnadd',
  'feescomm',
  'feesandorspread',
  'transactionandorthirdpartyfees',
  'brokerfee',
  'brokerage',
  'brokeragefee',
  'ibcommission',
  'swap',
  'swaps',
  'rollover',
  'financing',
  'taxes',
  'tax',
  'transactionfee',
  'transactionfees',
  'tradingfee',
  'tradingfees',
  'transactioncost',
  'tradingcost',
  'charges',
  'otherfees',
  'miscfees',
]);
// a rate for each contract, not an amount (Rithmic's Completed Orders): the fee is the rate times the size
alias('fee_rate', 3, [
  'commissionfillrate',
  'commissionpercontract',
  'commissionperunit',
  'feepercontract',
  'feeperunit',
  'commpercontract',
]);
alias('multiplier', 3, ['multiplier', 'mult', 'pointvalue', 'bigpointvalue', 'contractmultiplier', 'valueperpoint']);
alias('multiplier', 2, ['contractsize']);
alias('leverage', 3, ['leverage', 'lev']);

// a P&L column that does not say is taken as gross, before commissions; one
// that says "net" already has them taken off
alias('pnl', 2, [
  'pnl',
  'profit',
  'pl',
  'profitloss',
  'realizedpnl',
  'realizedpl',
  'realizedprofit',
  'closedpnl',
  'tradepnl',
  'tradepl',
  'gainloss',
  'result',
  'gain',
  'realizedprofitloss',
  'closedpl',
  'fifopnlrealized',
  'plamount',
]);
alias('pnl', 1, ['realized', 'profitandloss']);
alias('net_pnl', 3, [
  'netpnl',
  'netprofit',
  'netpl',
  'netprofitloss',
  'netrealizedpnl',
  'netresult',
  'net',
  'netgainloss',
]);
alias('gross_pnl', 3, ['grosspnl', 'grossprofit', 'grosspl', 'gross', 'grossprofitloss']);

alias('session', 3, ['session', 'marketsession', 'tradingsession']);
alias('setup', 3, ['setup', 'strategy', 'playbook', 'system', 'strategyname', 'strategie']);
alias('tags', 3, ['tags', 'tag', 'labels', 'label']);
alias('notes', 3, ['notes', 'note', 'comment', 'comments', 'memo', 'journal']);
alias('notes', 1, ['description']);
alias('account', 3, [
  'account',
  'accountname',
  'portfolio',
  'accountnumber',
  'accountid',
  'clientaccountid',
  'tradeaccount',
  'compte',
]);
alias('asset_class', 3, [
  'assetcategory',
  'assetclass',
  'instrumenttype',
  'sectype',
  'securitytype',
  'assettype',
  'producttype',
  'symboltype',
]);
alias('put_call', 3, ['putcall', 'callput', 'callorput', 'optiontype', 'right']);
alias('strike', 3, ['strike', 'strikeprice']);
alias('expiry', 3, ['exp', 'expiry', 'expiration', 'expirationdate', 'expdate', 'maturity']);
alias('duration', 2, ['duration', 'tradeduration', 'holdtime']);

/** the words of a header, and the time zone it declares (minutes east of UTC), if any */
export function headerParts(raw: string): { words: string[]; offset: number | null } {
  // accents off, so NinjaTrader's French "Prix d'entrée" reads as "prix d'entree"
  let s = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  let offset: number | null = null;
  const zone = s.match(/\b(utc|gmt)\s*([+-]\s*\d{1,2}(?::?\d{2})?)?/);
  if (zone) {
    offset = zoneOffset(zone[0].replace(/\s+/g, ''));
    s = s.replace(zone[0], ' ');
  }
  // a currency or an empty note in brackets says nothing about the meaning;
  // anything else ("Profit (ticks)") does, so it stays part of the key
  s = s.replace(/[([]([^)\]]*)[)\]]/g, (_, inner: string) => {
    const t = inner.trim();
    return !t || CURRENCIES.has(t) || /^[$€£₪¥]$/.test(t) ? ' ' : ` ${t} `;
  });
  s = s.replace(/%/g, ' pct ').replace(/#/g, ' no ');
  const words = s.split(/[^a-z0-9]+/).filter(Boolean);
  while (words.length > 1 && CURRENCIES.has(words[words.length - 1])) words.pop();
  return { words, offset };
}

/** the lookup key of a header, and the time zone it declares (minutes east of UTC), if any */
export function headerInfo(raw: string): { key: string; offset: number | null } {
  const { words, offset } = headerParts(raw);
  const key = words.join('');
  // a zone run into the name: IG's "DateUtc", "DateTimeUTC"
  return { key, offset: offset == null && /.(utc|gmt)$/.test(key) ? 0 : offset };
}

/** the role a header suggests on its own, before its values are looked at */
export function aliasOf(raw: string): { role: Role; priority: number } | null {
  const hit = ALIASES[headerInfo(raw).key];
  return hit ? { role: hit[0], priority: hit[1] } : null;
}

export interface ColumnPlan {
  /** role -> the column used for it (several for additive roles) */
  roles: Map<Role, number[]>;
  /** `guessed`: the role was read from the words of a name not listed (words.ts), to be checked */
  columns: Array<{ index: number; header: string; role: Role | ''; suggested: Role | ''; guessed: boolean }>;
  /** per column: the zone its header declares */
  offsets: Array<number | null>;
}

/** text that can be a ticker or a contract: BTCUSDT, MNQH6, ES 03-26 */
const TICKER = /^[a-z][a-z0-9.\-_/:! ]{0,24}$/i;

const share = (values: string[], test: (v: string) => boolean) => {
  const filled = values.filter((v) => v.trim());
  return filled.length ? filled.filter(test).length / filled.length : 0;
};

const isNumber = (v: string) => parseMoney(v) != null;
// money in a currency if in anything: "1.5R" and "12 pips" are not money
const isMoney = (v: string) => {
  const n = parseNumber(v);
  return n != null && (!n.unit || CURRENCIES.has(n.unit.toLowerCase()));
};
const isMoment = (v: string) => parseMoment(v) != null;
/** capitals with a letter, and after a space only a date: ES 03-26, 6EM6 or /MESZ25:XCME, never "Apple Inc" */
const GUESSED_TICKER = /^(?=[^ ]*[A-Z])\/?[A-Z0-9][A-Z0-9.\-_/:!]{0,24}( \d[\d\-/]*)?$/;
/**
 * What the values of a column guessed from its name must be, nearly all of
 * them (GUESS_HOLDS): a "Start Price" of text is not a price. Notes, setups,
 * tags and accounts can hold anything.
 */
const HOLDS: Partial<Record<Role, (v: string) => boolean>> = {
  symbol: (v) => GUESSED_TICKER.test(v.trim()),
  side: (v) => parseAction(v) != null,
  quantity: isNumber,
  price: isMoney,
  entry_price: isMoney,
  exit_price: isMoney,
  stop_loss: isMoney,
  take_profit: isMoney,
  fees: isMoney,
  pnl: isMoney,
  net_pnl: isMoney,
  gross_pnl: isMoney,
  // a time of day alone joins a Date column only as the fill's time (rows.ts)
  time: (v) => isMoment(v) || isTimeOfDay(v),
  opened_at: isMoment,
  closed_at: isMoment,
  date: isMoment,
  opened_date: isMoment,
  closed_date: isMoment,
};
const GUESS_HOLDS = 0.8;

/**
 * Listed roles that keep a guess out of a role of its own: a guessed P&L next
 * to a listed one changes which is before fees, and a guessed entry price is
 * read before a listed price (rows.ts).
 */
const SHADOWED_BY: Partial<Record<Role, Role[]>> = {
  pnl: ['net_pnl', 'gross_pnl'],
  net_pnl: ['pnl', 'gross_pnl'],
  gross_pnl: ['pnl', 'net_pnl'],
  entry_price: ['price'],
};

interface Candidate {
  role: Role | '';
  priority: number;
  /** read from the words of the name, not a name listed */
  guessed?: boolean;
}

/** a column whose name is not listed: what its words say, if its values bear that out */
function guess(header: string, values: string[]): Candidate {
  const role = roleFromWords(headerParts(header).words);
  const holds = role ? HOLDS[role] : undefined;
  // an empty column is not worth a guess, nor a notice
  const empty = values.every((v) => !v.trim());
  if (!role || empty || (holds && share(values, holds) < GUESS_HOLDS)) return { role: '', priority: 0 };
  return { role, priority: 0, guessed: true };
}

/**
 * Decides what each column is. Ambiguous names are checked against what the
 * column holds: a "Type" column of Market/Limit is not a direction, MetaTrader's
 * "Direction" of in/out says open or close, and Thinkorswim's "Type" of
 * CALL/PUT says which option. `overrides` (column index -> role) are the
 * choices made in the import preview, and always win.
 */
export function planColumns(
  headers: string[],
  sample: string[][],
  overrides: Record<number, Role | ''> = {},
): ColumnPlan {
  const values = (i: number) => sample.map((row) => row[i] ?? '');
  const infos = headers.map(headerInfo);
  /** column -> the share of its values that are a buy or a sell, for each column still the direction */
  const sideShares = new Map<number, number>();
  const candidates: Candidate[] = infos.map((info, i) => {
    const hit = ALIASES[info.key];
    if (!hit) return guess(headers[i], values(i));
    let role: Role | '' = hit[0];
    const priority = hit[1];
    if (role === 'side' || role === 'effect' || role === 'put_call') {
      const v = values(i);
      const sides = share(v, (x) => parseAction(x) != null);
      const effects = share(v, (x) => parseEffect(x) != null);
      const options = share(v, (x) => parsePutCall(x) != null);
      if (role === 'side' && sides < 0.5) {
        // a column plainly named Side or Direction stays the direction, so an
        // odd value in it is reported. So does an "Action" with a buy or a sell
        // in it: a broker's activity lists transfers and splits beside the
        // trades (Schwab), and those rows are said not to be trades. A vaguer
        // "Type" (Market, Limit) is dropped, and so is an "Action" with no buy
        // or sell in it
        if (effects >= 0.5) role = 'effect';
        else if (options > 0) role = 'put_call';
        else if (priority < 2 || (priority === 2 && sides === 0)) role = '';
      } else if (role === 'effect' && effects < 0.5 && priority < 3) role = '';
      else if (role === 'put_call' && options === 0) role = '';
      if (role === 'side') sideShares.set(i, sides);
    } else if (role === 'quantity' && share(values(i), (x) => parseMoney(x) != null) < 0.5) {
      // Bybit's "Contracts" names the contract; a symbol column of its own wins
      return share(values(i), (x) => TICKER.test(x.trim())) >= 0.5
        ? { role: 'symbol' as const, priority: 0 }
        : { role: '' as const, priority: 0 };
    } else if ((role === 'opened_at' || role === 'closed_at') && priority < 2) {
      // FTMO's "Open" and "Close" are times; elsewhere they can be prices
      if (share(values(i), (x) => parseMoment(x) != null) < 0.5) role = '';
    }
    return { role, priority };
  });
  // an Action kept for a few buys and sells gives way to a column that says
  // the direction on most rows: a Type of Buy and Sell beside an Action of Filled
  if ([...sideShares.values()].some((s) => s >= 0.5)) {
    for (const [i, s] of sideShares)
      if (s < 0.5 && candidates[i].priority < 3) candidates[i] = { role: '', priority: 0 };
  }

  // the same header twice: MetaTrader writes Time and Price once for the
  // opening and once for the closing
  const seen = new Map<string, number>();
  infos.forEach((info, i) => {
    const first = seen.get(info.key);
    if (first == null) {
      seen.set(info.key, i);
      return;
    }
    // a guess is paired only with a guess: one whose values did not fit stays unread
    if (Boolean(candidates[first].guessed) !== Boolean(candidates[i].guessed)) return;
    const role = candidates[first].role;
    if (role === 'price' || role === 'entry_price') {
      candidates[first] = { ...candidates[first], role: 'entry_price', priority: 3 };
      candidates[i] = { ...candidates[i], role: 'exit_price', priority: 3 };
    } else if (role === 'time' || role === 'opened_at') {
      // guessed times of day stay fill times: nothing joins an opening or closing time to a Date column
      if (candidates[first].guessed && [first, i].some((c) => share(values(c), isMoment) < GUESS_HOLDS)) return;
      candidates[first] = { ...candidates[first], role: 'opened_at', priority: 3 };
      candidates[i] = { ...candidates[i], role: 'closed_at', priority: 3 };
    }
  });

  // a listed column switched off or to another role in the preview hands its
  // role to no guess
  const cleared = new Set<Role>();
  for (const [index, role] of Object.entries(overrides)) {
    const i = Number(index);
    if (i < 0 || i >= headers.length) continue;
    const before = candidates[i];
    if (before.role && !before.guessed && role !== before.role) cleared.add(before.role);
    candidates[i] = { role, priority: 10 };
  }

  // listed names take their roles first; a column guessed from its words only
  // takes a role none of them took, so it never adds to a listed fee column
  const roles = new Map<Role, number[]>();
  for (const guesses of [false, true]) {
    const listed = new Set(roles.keys());
    const kept = (role: Role) =>
      listed.has(role) || cleared.has(role) || Boolean(SHADOWED_BY[role]?.some((r) => listed.has(r)));
    candidates.forEach(({ role, priority, guessed = false }, i) => {
      if (!role || guessed !== guesses || (guesses && kept(role))) return;
      const taken = roles.get(role);
      if (ADDITIVE.has(role)) roles.set(role, [...(taken ?? []), i]);
      else if (!taken || priority > candidates[taken[0]].priority) roles.set(role, [i]);
    });
  }

  // what a time means can depend on the columns around it; a choice made in
  // the preview is never moved
  const has = (role: Role) => roles.has(role);
  const move = (from: Role, to: Role) => {
    const columns = roles.get(from) as number[];
    if (columns.some((c) => candidates[c].priority >= 10)) return;
    roles.delete(from);
    roles.set(to, columns);
    for (const c of columns) candidates[c] = { ...candidates[c], role: to };
  };
  // a list of orders (TradingView): the "Closing time" is when the order was filled
  if (has('closed_at') && !has('time') && has('status') && has('price') && !has('entry_price') && !has('exit_price'))
    move('closed_at', 'time');
  // IG: next to OpenDateUtc, DateUtc is when the deal closed
  else if (
    (has('opened_at') || has('opened_date')) &&
    has('exit_price') &&
    !has('closed_at') &&
    !has('closed_date') &&
    has('time')
  )
    move('time', 'closed_at');

  return {
    roles,
    columns: headers.map((header, index) => {
      const role = candidates[index].role;
      const used = role && roles.get(role)?.includes(index) ? role : '';
      return {
        index,
        header: header.trim(),
        role: used,
        suggested: role,
        guessed: Boolean(used && candidates[index].guessed),
      };
    }),
    offsets: infos.map((info) => info.offset),
  };
}
