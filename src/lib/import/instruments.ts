/**
 * What one point of price is worth, for files that give prices but neither a
 * multiplier nor a P&L to work it out from. Futures are recognised only by a
 * full contract code (ESH6, MNQZ25, "ES 03-26", /ESH26:XCME), never by a bare
 * root: "ES" and "CL" are also stock tickers. Whatever is used is reported in
 * the import preview so it can be checked.
 */

/** dollars (or the contract's currency) per one point of price */
const POINT_VALUES: Record<string, number> = {
  // CME equity index
  ES: 50, MES: 5, NQ: 20, MNQ: 2, YM: 5, MYM: 0.5, RTY: 50, M2K: 5, EMD: 100, NKD: 5,
  // energy
  CL: 1000, MCL: 100, QM: 500, NG: 10000, QG: 2500, RB: 42000, HO: 42000,
  // metals
  GC: 100, MGC: 10, QO: 50, SI: 5000, SIL: 1000, QI: 2500, HG: 25000, MHG: 2500, PL: 50, PA: 100,
  // interest rates
  ZB: 1000, UB: 1000, ZN: 1000, TN: 1000, ZF: 1000, ZT: 2000,
  // agriculture (grains quoted in cents)
  ZC: 50, ZS: 50, ZW: 50, KE: 50, ZL: 600, ZM: 100, HE: 400, LE: 400, GF: 500,
  // currencies
  '6E': 125000, M6E: 12500, '6B': 62500, M6B: 6250, '6J': 12500000, '6A': 100000, M6A: 10000, '6C': 100000,
  '6S': 125000, '6N': 100000, '6M': 500000,
  // crypto and volatility
  BTC: 5, MBT: 0.1, ETH: 50, MET: 0.1, VX: 1000,
  // Eurex
  FDAX: 25, FDXM: 5, FDXS: 1, FESX: 10, FGBL: 1000,
};

const MONTH_CODE = '[FGHJKMNQUVXZ]';
const MONTH_NAMES = 'JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC';
const CONTRACT = [
  // ESH6, MNQZ25, 6EM6, /ESH26, /MESZ25:XCME
  new RegExp(`^/?([A-Z0-9]{1,4}?)${MONTH_CODE}(\\d{1,2})(?::[A-Z]+)?$`),
  // NinjaTrader: ES 03-26
  /^([A-Z0-9]{1,4})\s+\d{2}-\d{2}$/,
  // ES MAR26, ES Mar 26
  new RegExp(`^([A-Z0-9]{1,4})\\s+(?:${MONTH_NAMES})\\s*'?\\d{2}$`),
];

/** the futures root of a full contract code, or null when the symbol is not one */
export function futuresRoot(symbol: string): string | null {
  const s = symbol.trim().toUpperCase();
  for (const pattern of CONTRACT) {
    const m = s.match(pattern);
    if (m) return m[1];
  }
  return null;
}

/** point value of a futures contract, recognised from its full contract code */
export function futuresPointValue(symbol: string, assetClass = ''): { root: string; value: number } | null {
  const root = futuresRoot(symbol) ?? (/futur/i.test(assetClass) ? symbol.trim().toUpperCase() : null);
  if (!root || POINT_VALUES[root] == null) return null;
  return { root, value: POINT_VALUES[root] };
}

/** OCC (AAPL  260320C00180000) and Thinkorswim (.AAPL260320C180) option symbols */
const OCC = /^([A-Z][A-Z0-9.]{0,5})\s*(\d{6})([CP])(\d{8})$/;
const TOS_OPTION = /^\.([A-Z][A-Z0-9]{0,5})(\d{6})([CP])([\d.]+)$/;

/** whether a row is an option, from its symbol, an asset-class column or a call/put column */
export function isOption(symbol: string, assetClass = '', putCall = ''): boolean {
  const s = symbol.trim().toUpperCase();
  return OCC.test(s) || TOS_OPTION.test(s) || /option/i.test(assetClass) || /^(c|p|call|put)$/i.test(putCall.trim());
}

/** shares per equity option contract */
export const OPTION_MULTIPLIER = 100;

/** "AAPL 20 MAR 26 180 CALL" from separate underlying, expiry, strike and call/put columns */
export function optionSymbol(underlying: string, expiry: string, strike: string, putCall: string): string {
  return [underlying, expiry, strike, putCall]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
}
