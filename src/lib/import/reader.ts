import type { Account, Setup, Trade } from '../types';
import { uid } from '../utils';
import type { Role } from './columns';
import type { Unsaid } from './finish';
import { OPTION_MULTIPLIER, futuresPointValue, isOption, optionSymbol } from './instruments';
import type { Sheet } from './layout';
import {
  asClock,
  isTimeOfDay,
  parseMoment,
  parseMoney,
  parseNumber,
  parsePutCall,
  unescapeFormula,
  type Moment,
} from './values';

/**
 * Reading the values of one row the same way, whichever kind of row it is
 * (see rows.ts and positions.ts), and keeping track of what turned up along
 * the way: rows skipped, values that could not be read, values worked out.
 * That is said once, at the end (report.ts).
 */

/** where the trades go, and what the journal already has */
export interface ImportTarget {
  accountId: string;
  accounts: Account[];
  setups: Setup[];
  existing?: Trade[];
}

/** what turned up while the rows were read */
export interface Findings {
  /** file lines with no symbol, which were skipped */
  noSymbol: number[];
  /** direction values that meant nothing: value -> lines */
  unknownSides: Map<string, number[]>;
  /** multipliers of zero or less, which the trade form refuses: lines and the first value */
  badMultipliers: { rows: number[]; value: string };
  /** point values worked out rather than read: symbol -> how */
  inferred: Map<string, string>;
  /** units of fees that could not be added to the prices */
  foreignFees: Set<string>;
  /** times read with a time zone, and converted to this device's */
  zoned: number;
  /** times of day read with no time zone, and kept as written */
  unzoned: number;
  /** rows already in the journal, or in the file twice */
  duplicates: number;
}

/** what reading the rows gave */
export interface RowsRead {
  trades: Trade[];
  /** things to check that only this kind of row turns up */
  errors: string[];
  notices: string[];
  /** trade id -> the broker's id of the fill that opened it, where a row names it */
  openingFill?: Map<string, string>;
  /** trades the journal has open that the file closes, finished (same ids as in the journal) */
  finished?: Trade[];
  /** trade id -> what its row or fills left unsaid, should the trade finish one the journal has open */
  unsaid?: Map<string, Unsaid>;
}

export interface Reader {
  sheet: Sheet;
  findings: Findings;
  /** when this import happened: every trade's createdAt */
  now: string;
  /** the broker's ids of the fills and trades already in the journal */
  existingIds: Set<string>;
  /** the setups the file names that the journal does not have, made as they are met */
  newSetups: Setup[];
  /** free text: a value tradesToCsv escaped against spreadsheet formulas comes back as typed */
  textCell(row: string[], role: Role): string;
  /** a moment from a date-and-time column, or a date column plus a time-of-day column */
  moment(row: string[], atRole: Role, dateRole: Role): Moment | null;
  /**
   * every fee column added up, and a fee per contract times the size, once
   * for each of `sides` (a fill is one, a closed trade two); null when none
   * has a value
   */
  feeOf(row: string[], sides?: number): number | null;
  /** the symbol, with an option's expiry, strike and call/put when they come in their own columns */
  symbolOf(row: string[]): string;
  setupIdFor(name: string): string | undefined;
  accountIdFor(name: string): string;
  tagsOf(row: string[]): string[];
  /** the row's multiplier; one of zero or less is left out, and noted */
  multiplierCell(row: string[], line: number): number | null;
  /** what one point of the instrument should be worth, from what the symbol is; nothing is noted */
  expectedMultiplier(symbol: string, row: string[]): number | null;
  /** a point value from what the symbol is, when nothing in the row gives one; noted for the preview */
  knownMultiplier(symbol: string, row: string[]): number | null;
}

/** TradingView names the exchange first: CME_MINI:MNQ1! is MNQ1!, NASDAQ:AAPL is AAPL */
export const withoutExchange = (symbol: string) => symbol.replace(/^[A-Z][A-Z0-9_]*:(?=\S)/, '');

export function createReader(sheet: Sheet, target: ImportTarget): Reader {
  const { table, plan, order, at, cell, fallbackSymbol } = sheet;
  const findings: Findings = {
    noSymbol: [],
    unknownSides: new Map(),
    badMultipliers: { rows: [], value: '' },
    inferred: new Map(),
    foreignFees: new Set(),
    zoned: 0,
    unzoned: 0,
    duplicates: 0,
  };

  const textCell = (row: string[], role: Role) => unescapeFormula(cell(row, role));

  const offsetOf = (role: Role) => {
    const i = at(role);
    return i == null ? null : plan.offsets[i];
  };
  const moment = (row: string[], atRole: Role, dateRole: Role): Moment | null => {
    const when = cell(row, atRole);
    const day = cell(row, dateRole);
    const offset = offsetOf(atRole) ?? offsetOf(dateRole);
    const m =
      when && day && isTimeOfDay(when)
        ? parseMoment(`${day} ${asClock(when)}`, order, offset)
        : ((when ? parseMoment(when, order, offset) : null) ?? (day ? parseMoment(day, order, offset) : null));
    if (m?.zoned) findings.zoned++;
    else if (m?.timed) findings.unzoned++;
    return m;
  };

  // fees: every fee column adds up. Some brokers write costs as negatives
  // (IBKR, MetaTrader), others as positives; each column is read its own way.
  const feeColumns = plan.roles.get('fees') ?? [];
  const feeSign = new Map(
    feeColumns.map((c) => {
      let negative = 0;
      let positive = 0;
      for (const row of table.data) {
        const v = parseMoney(row[c] ?? '');
        if (!v) continue;
        if (v < 0) negative++;
        else positive++;
      }
      return [c, negative > positive ? -1 : 1] as const;
    }),
  );
  // a fee in another currency than the prices (Binance charges BNB) cannot be added to them
  const valueUnits = new Set<string>();
  for (const row of table.data.slice(0, 200)) {
    for (const role of ['price', 'entry_price', 'exit_price', 'notional', 'pnl', 'net_pnl', 'gross_pnl'] as Role[]) {
      const unit = parseNumber(cell(row, role))?.unit;
      if (unit) valueUnits.add(unit);
    }
  }
  const feeOf = (row: string[], sides = 1): number | null => {
    let total: number | null = null;
    for (const c of feeColumns) {
      const n = parseNumber(row[c] ?? '');
      if (!n) continue;
      if (n.unit && valueUnits.size && !valueUnits.has(n.unit)) {
        findings.foreignFees.add(n.unit);
        continue;
      }
      total = (total ?? 0) + n.value * (feeSign.get(c) ?? 1);
    }
    // a rate for each contract (Rithmic's Commission Fill Rate)
    const rate = parseMoney(cell(row, 'fee_rate'));
    const size = Math.abs(parseMoney(cell(row, 'quantity')) ?? 0);
    if (rate && size) total = (total ?? 0) + Math.round(Math.abs(rate) * size * sides * 1e8) / 1e8;
    return total;
  };

  const symbolOf = (row: string[]) => {
    const base = withoutExchange(
      (textCell(row, 'symbol') || textCell(row, 'underlying')).toUpperCase() || fallbackSymbol,
    );
    const putCall = parsePutCall(cell(row, 'put_call'));
    // an OCC symbol (IBKR's Flex queries, tastytrade) already names the expiry, strike and call or put
    if (!putCall || !base || isOption(base)) return base;
    return optionSymbol(base, cell(row, 'expiry'), cell(row, 'strike'), putCall === 'C' ? 'CALL' : 'PUT');
  };

  const now = new Date().toISOString();
  const setupsByName = new Map(target.setups.map((s) => [s.name.toLowerCase(), s]));
  const accountsByName = new Map(target.accounts.map((a) => [a.name.toLowerCase(), a]));
  const existingIds = new Set((target.existing ?? []).flatMap((t) => (t.externalId ? t.externalId.split('|') : [])));
  const newSetups: Setup[] = [];
  const setupIdFor = (name: string): string | undefined => {
    if (!name) return undefined;
    const key = name.toLowerCase();
    let setup = setupsByName.get(key);
    if (!setup) {
      setup = { id: uid(), name, rules: [], description: 'Created during a CSV import.' };
      setupsByName.set(key, setup);
      newSetups.push(setup);
    }
    return setup.id;
  };
  const accountIdFor = (name: string) => (name && accountsByName.get(name.toLowerCase())?.id) || target.accountId;
  const tagsOf = (row: string[]) =>
    textCell(row, 'tags')
      .split(/[|;]/)
      .map((t) => t.trim())
      .filter(Boolean);

  const multiplierCell = (row: string[], line: number): number | null => {
    const m = parseMoney(cell(row, 'multiplier'));
    if (m != null && m <= 0) {
      // a negative one would turn every win into a loss; leave it out and say so
      const bad = findings.badMultipliers;
      if (!bad.rows.length) bad.value = cell(row, 'multiplier');
      bad.rows.push(line);
      return null;
    }
    return m;
  };

  const instrumentWorth = (symbol: string, row: string[]): { value: number; how: string } | null => {
    const assetClass = cell(row, 'asset_class');
    const future = futuresPointValue(symbol, assetClass);
    if (future) return { value: future.value, how: `${future.value} a point (${future.root} futures)` };
    if (isOption(symbol, assetClass, cell(row, 'put_call')))
      return { value: OPTION_MULTIPLIER, how: `${OPTION_MULTIPLIER} (an option contract)` };
    return null;
  };
  const expectedMultiplier = (symbol: string, row: string[]) => instrumentWorth(symbol, row)?.value ?? null;
  const knownMultiplier = (symbol: string, row: string[]): number | null => {
    const worth = instrumentWorth(symbol, row);
    if (worth) findings.inferred.set(symbol, worth.how);
    return worth?.value ?? null;
  };

  return {
    sheet,
    findings,
    now,
    existingIds,
    newSetups,
    textCell,
    moment,
    feeOf,
    symbolOf,
    setupIdFor,
    accountIdFor,
    tagsOf,
    multiplierCell,
    expectedMultiplier,
    knownMultiplier,
  };
}

/** a multiplier worked out from data, if it is a believable one: a whole number, or 0.1, 0.25 or 0.5 */
export function believable(m: number): number | null {
  if (!Number.isFinite(m) || m <= 0) return null;
  if (m >= 0.95) {
    const r = Math.round(m);
    return Math.abs(m - r) / r < 0.01 ? r : null;
  }
  return [0.1, 0.25, 0.5].find((c) => Math.abs(m - c) / c < 0.01) ?? null;
}

/**
 * Whether a reported P&L fits the prices, and so what one point is worth.
 * An unlabelled P&L is read as gross; if it only fits once the fees are
 * added back, it was net after all.
 *
 * A believable point value that fits is taken. One that is not believable is
 * taken only when it is far from what the instrument should be worth
 * (`expected`: a future's point value, or 1), as a forex cross's can be.
 * Close to it (0.95 against 1, 1.94 against MNQ's 2), the P&L holds
 * something the prices don't, such as fees already taken off with no fee
 * column, or another currency: then no point value is worked out, and the
 * P&L is kept as written.
 */
export function fitReported(
  reported: number,
  move: number | null,
  fees: number,
  net: boolean,
  expected = 1,
): { multiplier: number | null; manualPnl: number | null } {
  const gross = net ? reported + fees : reported;
  if (move == null) return { multiplier: null, manualPnl: gross };
  if (Math.abs(move) <= 1e-9) return { multiplier: null, manualPnl: gross };
  const fits = (total: number) => {
    const m = believable(total / move);
    return m != null && Math.abs(move * m - total) < 0.01 ? m : null;
  };
  const round = fits(gross) ?? (!net && fees ? fits(reported + fees) : null);
  if (round != null) return { multiplier: round, manualPnl: null };
  const ratio = Number((gross / move).toFixed(4));
  const far = ratio < expected / 2 || ratio > expected * 2;
  if (ratio > 0 && far && Math.abs(move * ratio - gross) < 0.01) return { multiplier: ratio, manualPnl: null };
  return { multiplier: null, manualPnl: gross };
}
