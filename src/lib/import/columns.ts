import { parseAction, parseEffect, parsePutCall, zoneOffset } from './values';

/**
 * What each column of a broker's file means. Headers are matched on a
 * normalised key: lower case, letters and digits only, with currency tags
 * ("Price USD", "Net P&L (USD)") and time-zone tags ("Time (UTC+2)") taken
 * off and remembered. Every name has a priority, so when a file has both
 * "Price" (the limit) and "Avg Fill Price", the fill price wins.
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

alias('symbol', 3, ['symbol', 'ticker', 'tickersymbol', 'pair', 'symbolpair', 'tradingpair', 'contractsymbol', 'contractname']);
alias('symbol', 2, ['instrument', 'instrumentname', 'contract', 'securitysymbol']);
alias('symbol', 1, ['market', 'asset', 'security', 'stock', 'product', 'item', 'coin']);
alias('underlying', 2, ['underlying', 'underlyingsymbol', 'rootsymbol', 'root']);

alias('side', 3, ['side', 'buysell', 'bs', 'direction', 'marketpos', 'marketposition', 'openingdirection', 'tradeside', 'orderside']);
alias('side', 2, ['action', 'transcode', 'transactioncode', 'buyorsell']);
alias('side', 1, ['type', 'transactiontype', 'tradetype', 'position', 'positiontype', 'dealtype']);
alias('effect', 3, ['poseffect', 'positioneffect', 'openclose', 'ex', 'entryexit', 'openorclose', 'openingclosing']);
alias('effect', 2, ['effect']);
alias('effect', 1, ['code', 'codes']);
alias('status', 3, ['status', 'orderstatus', 'fillstatus']);
alias('status', 1, ['state']);
alias('trade_no', 3, ['tradeno', 'tradenumber', 'tradenum', 'tradeidx']);

alias('external_id', 3, ['tradeid', 'executionid', 'execid', 'fillid', 'dealid', 'ticket', 'ticketno', 'transactionid', 'confirmationno', 'tradeidentifier']);
alias('external_id', 2, ['id', 'orderid', 'orderno', 'ordernumber', 'positionid', 'deal', 'referenceno', 'refno', 'reference']);

alias('opened_at', 3, ['openedat', 'opentime', 'entrytime', 'entrydatetime', 'entrytimestamp', 'opendatetime', 'timeopened', 'enteredat', 'openingtime', 'opentimestamp', 'timeopen', 'entryat', 'starttime']);
alias('opened_date', 3, ['entrydate', 'opendate', 'dateopened', 'openingdate', 'startdate']);
alias('closed_at', 3, ['closedat', 'closetime', 'exittime', 'exitdatetime', 'exittimestamp', 'closedatetime', 'timeclosed', 'exitedat', 'closingtime', 'closetimestamp', 'timeclose', 'exitat', 'endtime']);
alias('closed_date', 3, ['exitdate', 'closedate', 'dateclosed', 'closingdate', 'enddate']);
alias('time', 3, ['exectime', 'executiontime', 'filltime', 'filledtime', 'tradetime', 'executedat', 'filledat', 'executiondatetime', 'filldatetime']);
alias('time', 2, ['time', 'datetime', 'timestamp', 'transactiontime', 'tradedat', 'transacttime', 'datetimeutc']);
alias('time', 1, ['updatetime', 'createdat', 'created', 'lastupdated']);
alias('date', 3, ['activitydate', 'executiondate', 'filldate', 'tradedate']);
alias('date', 2, ['date', 'transactiondate']);
alias('date', 1, ['tradeday', 'tradingday']);

// paired buy/sell fill exports (Tradovate's performance report and similar)
alias('buy_price', 3, ['buyprice', 'avgbuyprice', 'averagebuyprice']);
alias('sell_price', 3, ['sellprice', 'avgsellprice', 'averagesellprice']);
alias('bought_at', 3, ['boughttimestamp', 'buytimestamp', 'buytime', 'boughttime', 'buydate']);
alias('sold_at', 3, ['soldtimestamp', 'selltimestamp', 'selltime', 'soldtime', 'selldate']);
alias('buy_fill_id', 3, ['buyfillid']);
alias('sell_fill_id', 3, ['sellfillid']);
alias('tick_size', 3, ['ticksize']);

alias('entry_price', 3, ['entryprice', 'openprice', 'priceopen', 'avgentryprice', 'averageentryprice', 'openingprice', 'entryavgprice']);
alias('entry_price', 2, ['entry']);
alias('exit_price', 3, ['exitprice', 'closeprice', 'priceclose', 'avgexitprice', 'averageexitprice', 'closingprice', 'exitavgprice']);
alias('exit_price', 2, ['exit']);
alias('price', 3, ['fillprice', 'filledprice', 'avgfillprice', 'averagefillprice', 'executionprice', 'execprice', 'tradeprice', 'tprice', 'dealprice', 'executedprice', 'avgexecutionprice']);
alias('price', 2, ['avgprice', 'averageprice', 'pricepershare']);
alias('price', 1, ['price', 'netprice']);

alias('quantity', 3, ['filledqty', 'filledquantity', 'filled', 'executedqty', 'executedquantity', 'executed', 'qtyfilled', 'quantityfilled', 'fillqty', 'fillquantity', 'fillsize', 'closingquantity', 'positionsizeqty', 'tradesize']);
alias('quantity', 2, ['quantity', 'qty', 'size', 'volume', 'shares', 'contracts', 'lots', 'units', 'amountshares', 'lotsize']);
alias('quantity', 1, ['totalqty', 'orderqty', 'orderquantity', 'quantityordered']);
alias('notional', 3, ['proceeds', 'notional', 'tradevalue', 'grossamount', 'positionsizevalue', 'principal']);
alias('notional', 2, ['amount', 'total', 'value', 'tradeamount']);
alias('notional', 1, ['netamount', 'netproceeds']);

alias('stop_loss', 3, ['stoploss', 'stoplossprice', 'initialstop', 'stoplevel']);
alias('stop_loss', 2, ['stop', 'sl']);
alias('take_profit', 3, ['takeprofit', 'profittarget', 'targetprice', 'takeprofitprice']);
alias('take_profit', 2, ['target', 'tp']);

alias('fees', 3, [
  'fees', 'fee', 'commission', 'commissions', 'comm', 'commfee', 'commfees', 'commissionfee', 'commissionfees',
  'commissionandfees', 'commissionsfees', 'commissionsandfees', 'feesandcommissions', 'totalfees', 'totalcommission', 'totalcommissions', 'clearingfee',
  'clearingfees', 'exchangefee', 'exchangefees', 'ipfee', 'nfafee', 'nfafees', 'regfee', 'regfees', 'regulatoryfee',
  'regulatoryfees', 'secfee', 'taffee', 'brokerfee', 'brokerage', 'brokeragefee', 'ibcommission', 'swap', 'swaps',
  'rollover', 'financing', 'taxes', 'tax', 'transactionfee', 'transactionfees', 'tradingfee', 'tradingfees',
  'transactioncost', 'tradingcost', 'charges', 'otherfees', 'miscfees',
]);
alias('multiplier', 3, ['multiplier', 'mult', 'pointvalue', 'bigpointvalue', 'contractmultiplier', 'valueperpoint']);
alias('multiplier', 2, ['contractsize']);
alias('leverage', 3, ['leverage', 'lev']);

// a P&L column that does not say is taken as gross, before commissions; one
// that says "net" already has them taken off
alias('pnl', 2, ['pnl', 'profit', 'pl', 'profitloss', 'realizedpnl', 'realizedpl', 'realizedprofit', 'closedpnl', 'tradepnl', 'tradepl', 'gainloss', 'result', 'gain', 'realizedprofitloss']);
alias('pnl', 1, ['realized']);
alias('net_pnl', 3, ['netpnl', 'netprofit', 'netpl', 'netprofitloss', 'netrealizedpnl', 'netresult', 'net', 'netgainloss']);
alias('gross_pnl', 3, ['grosspnl', 'grossprofit', 'grosspl', 'gross', 'grossprofitloss']);

alias('session', 3, ['session', 'marketsession', 'tradingsession']);
alias('setup', 3, ['setup', 'strategy', 'playbook', 'system', 'strategyname']);
alias('tags', 3, ['tags', 'tag', 'labels', 'label']);
alias('notes', 3, ['notes', 'note', 'comment', 'comments', 'memo', 'journal']);
alias('notes', 1, ['description']);
alias('account', 3, ['account', 'accountname', 'portfolio', 'accountnumber', 'accountid']);
alias('asset_class', 3, ['assetcategory', 'assetclass', 'instrumenttype', 'sectype', 'securitytype', 'assettype', 'producttype']);
alias('put_call', 3, ['putcall', 'callput', 'callorput', 'optiontype', 'right']);
alias('strike', 3, ['strike', 'strikeprice']);
alias('expiry', 3, ['exp', 'expiry', 'expiration', 'expirationdate', 'expdate', 'maturity']);
alias('duration', 2, ['duration', 'tradeduration', 'holdtime']);

const CURRENCIES = new Set(
  'usd eur gbp jpy chf aud cad nzd ils nis hkd sgd cnh cny inr krw sek nok dkk pln zar mxn brl try usdt usdc busd'.split(' '),
);

/** the lookup key of a header, and the time zone it declares (minutes east of UTC), if any */
export function headerInfo(raw: string): { key: string; offset: number | null } {
  let s = raw.trim().toLowerCase();
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
  return { key: words.join(''), offset };
}

/** the role a header suggests on its own, before its values are looked at */
export function aliasOf(raw: string): { role: Role; priority: number } | null {
  const hit = ALIASES[headerInfo(raw).key];
  return hit ? { role: hit[0], priority: hit[1] } : null;
}

export interface ColumnPlan {
  /** role -> the column used for it (several for additive roles) */
  roles: Map<Role, number[]>;
  columns: Array<{ index: number; header: string; role: Role | ''; suggested: Role | '' }>;
  /** per column: the zone its header declares */
  offsets: Array<number | null>;
}

const share = (values: string[], test: (v: string) => boolean) => {
  const filled = values.filter((v) => v.trim());
  return filled.length ? filled.filter(test).length / filled.length : 0;
};

/**
 * Decides what each column is. Ambiguous names are checked against what the
 * column holds: a "Type" column of Market/Limit is not a direction, MetaTrader's
 * "Direction" of in/out says open or close, and Thinkorswim's "Type" of
 * CALL/PUT says which option. `overrides` (column index -> role) are the
 * choices made in the import preview, and always win.
 */
export function planColumns(headers: string[], sample: string[][], overrides: Record<number, Role | ''> = {}): ColumnPlan {
  const values = (i: number) => sample.map((row) => row[i] ?? '');
  const infos = headers.map(headerInfo);
  const candidates: Array<{ role: Role | ''; priority: number }> = infos.map((info, i) => {
    const hit = ALIASES[info.key];
    if (!hit) return { role: '', priority: 0 };
    let role: Role | '' = hit[0];
    const priority = hit[1];
    if (role === 'side' || role === 'effect' || role === 'put_call') {
      const v = values(i);
      const sides = share(v, (x) => parseAction(x) != null);
      const effects = share(v, (x) => parseEffect(x) != null);
      const options = share(v, (x) => parsePutCall(x) != null);
      if (role === 'side' && sides < 0.5) {
        // a column plainly named Side or Direction stays the direction, so an
        // odd value in it is reported; a vaguer "Type" or "Action" is dropped
        if (effects >= 0.5) role = 'effect';
        else if (options > 0) role = 'put_call';
        else if (priority < 3) role = '';
      } else if (role === 'effect' && effects < 0.5 && priority < 3) role = '';
      else if (role === 'put_call' && options === 0) role = '';
    }
    return { role, priority };
  });

  // the same header twice: MetaTrader writes Time and Price once for the
  // opening and once for the closing
  const seen = new Map<string, number>();
  infos.forEach((info, i) => {
    const first = seen.get(info.key);
    if (first == null) {
      seen.set(info.key, i);
      return;
    }
    const role = candidates[first].role;
    if (role === 'price' || role === 'entry_price') {
      candidates[first] = { role: 'entry_price', priority: 3 };
      candidates[i] = { role: 'exit_price', priority: 3 };
    } else if (role === 'time' || role === 'opened_at') {
      candidates[first] = { role: 'opened_at', priority: 3 };
      candidates[i] = { role: 'closed_at', priority: 3 };
    }
  });

  for (const [index, role] of Object.entries(overrides)) {
    const i = Number(index);
    if (i >= 0 && i < headers.length) candidates[i] = { role, priority: 10 };
  }

  const roles = new Map<Role, number[]>();
  candidates.forEach(({ role, priority }, i) => {
    if (!role) return;
    const taken = roles.get(role);
    if (ADDITIVE.has(role)) roles.set(role, [...(taken ?? []), i]);
    else if (!taken || priority > candidates[taken[0]].priority) roles.set(role, [i]);
  });

  return {
    roles,
    columns: headers.map((header, index) => {
      const role = candidates[index].role;
      const used = role && roles.get(role)?.includes(index) ? role : '';
      return { index, header: header.trim(), role: used, suggested: role };
    }),
    offsets: infos.map((info) => info.offset),
  };
}
