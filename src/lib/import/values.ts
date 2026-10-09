import { pad2, parseDecimal } from '../utils';

/**
 * Reading single cells the way brokers write them: numbers with currency
 * signs and units, dates in a dozen layouts, and the many words for buy and
 * sell. No React and no I/O; tested in tests/csv.test.ts and
 * tests/import-formats.test.ts.
 */

// ---- numbers ---------------------------------------------------------------

/**
 * Tolerant number parsing: $1,234.50 / (120) / 1.234,50 / 1,08640 / -$80 /
 * @12.50 / 0.5BTC / 15000 USDT / 1.00 Lots / 120-. A trailing (or leading
 * three-letter) unit comes back separately, so a fee in BNB can be told from
 * one in USDT.
 */
export function parseNumber(raw: string): { value: number; unit?: string } | null {
  let s = raw.trim();
  if (!s || s.includes('%')) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  // accounting style with the sign at the end: 120-
  if (/^[^-]*\d-$/.test(s)) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  s = s.replace(/^[@~≈]\s*/, '').replace(/[$€£₪¥₹₩₿\s  ]/g, '');
  let unit: string | undefined;
  const trailing = s.match(/^([^a-z]*\d[^a-z]*?)([a-z]{1,12})$/i);
  if (trailing) {
    s = trailing[1];
    unit = trailing[2].toUpperCase();
  } else {
    const leading = s.match(/^([a-z]{3})([-+]?[\d.,]+)$/i);
    if (leading) {
      unit = leading[1].toUpperCase();
      s = leading[2];
    }
  }
  if (/^-/.test(s)) {
    negative = !negative;
    s = s.slice(1);
  }
  const n = parseDecimal(s);
  if (n == null) return null;
  return { value: negative ? -n : n, unit };
}

/** a number, or null for an empty cell or text that is not one */
export function parseMoney(raw: string): number | null {
  return parseNumber(raw)?.value ?? null;
}

// ---- dates and times ------------------------------------------------------

/** day-month or month-day, decided once for a whole file (see dateOrderOf) */
export type DateOrder = 'dmy' | 'mdy';

export interface Moment {
  /** minute precision, as the journal stores it: 2026-03-04T13:05 */
  value: string;
  /** second precision, which decides which of two fills came first */
  sortKey: string;
  /** the file said which time zone this was in, and it was converted to local time */
  zoned: boolean;
}

const TIME = String.raw`(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,]\d+)?\s*(AM|PM|am|pm)?`;
const ZONE = String.raw`\s*((?:UTC|GMT)?\s*[+-]\d{2}:?\d{2}|Z|UTC|GMT)?`;
const ISO_DATE = new RegExp(String.raw`^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T,]+${TIME})?${ZONE}`, 'i');
const NUMERIC_DATE = new RegExp(String.raw`^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?![\d])(?:[ T,]+${TIME})?${ZONE}`, 'i');
const COMPACT_DATE = /^(\d{4})(\d{2})(\d{2})(?:[;,\sT-]*(\d{2}):?(\d{2}):?(\d{2})?)?$/;
const DAY_MONTH_NAME = new RegExp(
  String.raw`^(?:[a-z]{3,9},?\s+)?(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+([a-z]{3,9})\.?[\s\-/.,]+(\d{4}|\d{2})(?![\d])(?:[ T,]+${TIME})?${ZONE}`,
  'i',
);
const MONTH_NAME_DAY = new RegExp(
  String.raw`^(?:[a-z]{3,9},?\s+)?([a-z]{3,9})\.?[\s\-/.]+(\d{1,2})(?:st|nd|rd|th)?,?[\s\-/.]+(\d{4})(?:[ T,]+${TIME})?${ZONE}`,
  'i',
);
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const monthOf = (name: string) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
const fullYear = (y: string) => (y.length === 2 ? (Number(y) < 70 ? 2000 : 1900) + Number(y) : Number(y));

/** minutes east of UTC for Z / UTC / GMT / +02:00 / -0500, or null when none is given */
export function zoneOffset(zone: string | undefined): number | null {
  if (!zone) return null;
  const rest = zone.trim().replace(/^(utc|gmt)/i, '').trim();
  if (!rest || /^z$/i.test(rest)) return 0;
  const m = rest.match(/^([+-])(\d{1,2}):?(\d{2})?$/);
  if (!m) return null;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

function local(d: Date, zoned: boolean): Moment {
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return { value: `${date}T${hm}`, sortKey: `${date}T${hm}:${pad2(d.getSeconds())}`, zoned };
}

/**
 * Builds the stored value from parts, or null when they do not make a real
 * moment: month 13, 30 February and 25:61 are refused rather than stored. A
 * known zone (in the value, or declared by the column) is converted to this
 * device's local time; otherwise the wall-clock time is kept as written.
 */
function fromParts(
  year: number,
  month: number,
  day: number,
  hourRaw: string | undefined,
  minuteRaw: string | undefined,
  secondRaw: string | undefined,
  meridiemRaw: string | undefined,
  offset: number | null,
): Moment | null {
  let hour = Number(hourRaw ?? 0);
  const minute = Number(minuteRaw ?? 0);
  const second = Number(secondRaw ?? 0);
  const meridiem = meridiemRaw?.toUpperCase();
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  if (offset != null) {
    return local(new Date(Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60_000), true);
  }
  const date = `${year}-${pad2(month)}-${pad2(day)}`;
  const hm = `${pad2(hour)}:${pad2(minute)}`;
  return { value: `${date}T${hm}`, sortKey: `${date}T${hm}:${pad2(second)}`, zoned: false };
}

/**
 * Accepts ISO, US and European dates (with 4- or 2-digit years), MetaTrader's
 * 2026.03.04, IBKR's 20260304;130512, month names (04-Mar-2026, Mar 4, 2026)
 * and Unix timestamps, each with or without a time, seconds, AM/PM and a zone.
 * `columnOffset` is a zone the column header declared, such as "Time (UTC)".
 */
export function parseMoment(raw: string, order?: DateOrder, columnOffset: number | null = null): Moment | null {
  const s = raw.trim();
  if (!s) return null;

  if (/^\d{10}(\.\d+)?$/.test(s)) return local(new Date(Number(s) * 1000), true);
  if (/^\d{13}$/.test(s)) return local(new Date(Number(s)), true);

  const compact = s.match(COMPACT_DATE);
  if (compact) {
    return fromParts(Number(compact[1]), Number(compact[2]), Number(compact[3]), compact[4], compact[5], compact[6], undefined, columnOffset);
  }

  const zoneIn = (z: string | undefined) => zoneOffset(z) ?? columnOffset;

  const iso = s.match(ISO_DATE);
  if (iso) return fromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]), iso[4], iso[5], iso[6], iso[7], zoneIn(iso[8]));

  const numeric = s.match(NUMERIC_DATE);
  if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    // the file's own order when it is known; otherwise a value above 12 in
    // the first slot can only be the day, and month-first is the default
    // most broker exports use
    const dayFirst = order ? order === 'dmy' : a > 12;
    const [day, month] = dayFirst ? [a, b] : [b, a];
    return fromParts(fullYear(numeric[3]), month, day, numeric[4], numeric[5], numeric[6], numeric[7], zoneIn(numeric[8]));
  }

  const dmy = s.match(DAY_MONTH_NAME);
  if (dmy && monthOf(dmy[2]) > 0) {
    return fromParts(fullYear(dmy[3]), monthOf(dmy[2]), Number(dmy[1]), dmy[4], dmy[5], dmy[6], dmy[7], zoneIn(dmy[8]));
  }
  const mdy = s.match(MONTH_NAME_DAY);
  if (mdy && monthOf(mdy[1]) > 0) {
    return fromParts(Number(mdy[3]), monthOf(mdy[1]), Number(mdy[2]), mdy[4], mdy[5], mdy[6], mdy[7], zoneIn(mdy[8]));
  }

  return null;
}

/** a cell that is only a time of day: 13:05, 1:05:12 PM, 130512 */
export function isTimeOfDay(raw: string): boolean {
  return /^\d{1,2}:\d{2}(:\d{2})?([.,]\d+)?\s*(am|pm)?$/i.test(raw.trim()) || /^\d{6}$/.test(raw.trim());
}

/** a time-of-day cell written so it can follow a date: 130512 becomes 13:05:12 */
export function asClock(raw: string): string {
  const s = raw.trim();
  return /^\d{6}$/.test(s) ? `${s.slice(0, 2)}:${s.slice(2, 4)}:${s.slice(4)}` : s;
}

/**
 * One file is read with one date order. 03/04 on its own could be either, so
 * if any date in the file has a day above 12 in the first slot, every date in
 * it is day-first; above 12 in the second slot, month-first. Mixed or no
 * evidence leaves each date to the per-date rule.
 */
export function dateOrderOf(values: string[]): { order?: DateOrder; ambiguous: boolean } {
  let dayFirst = false;
  let monthFirst = false;
  let numeric = false;
  for (const v of values) {
    const m = v.trim().match(NUMERIC_DATE);
    if (!m) continue;
    numeric = true;
    if (Number(m[1]) > 12) dayFirst = true;
    if (Number(m[2]) > 12) monthFirst = true;
  }
  if (dayFirst && !monthFirst) return { order: 'dmy', ambiguous: false };
  if (monthFirst && !dayFirst) return { order: 'mdy', ambiguous: false };
  return { ambiguous: numeric && !dayFirst && !monthFirst };
}

// ---- direction, open/close and order status --------------------------------

export interface Action {
  side: 'BUY' | 'SELL';
  /** the file says whether this fill opened or closed a position */
  effect?: 'open' | 'close';
}

const ACTIONS: Record<string, Action> = {};
const define = (action: Action, words: string[]) => words.forEach((w) => (ACTIONS[w] = action));
define({ side: 'BUY' }, ['buy', 'b', 'bot', 'bought', 'long', 'l', '1', 'purchase', 'buy long', 'long buy', 'market buy', 'limit buy', 'buy market', 'buy limit', 'buy stop']);
define({ side: 'SELL' }, ['sell', 's', 'sld', 'sold', 'short', 'sht', '-1', 'sale', 'market sell', 'limit sell', 'sell market', 'sell limit', 'sell stop']);
define({ side: 'BUY', effect: 'open' }, ['buy to open', 'bto', 'entry long', 'long entry', 'open long', 'buy open', 'buy to open long']);
define({ side: 'SELL', effect: 'close' }, ['sell to close', 'stc', 'exit long', 'long exit', 'close long', 'sell close']);
define({ side: 'SELL', effect: 'open' }, ['sell to open', 'sto', 'sell short', 'short sell', 'sellshort', 'ss', 'entry short', 'short entry', 'open short', 'sell open']);
define({ side: 'BUY', effect: 'close' }, ['buy to close', 'btc', 'buy to cover', 'cover', 'buy cover', 'exit short', 'short exit', 'close short', 'buy close']);

const normalWords = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.]+/g, ' ')
    .trim();

/** Buy / SLD / Sell to Close / Exit Long / BTO ... or null when it is not a direction */
export function parseAction(raw: string): Action | null {
  // exact first: '-1' must stay a sell, not become '1' once dashes are spaces
  const exact = raw.trim().toLowerCase();
  if (ACTIONS[exact]) return ACTIONS[exact];
  const s = normalWords(raw);
  if (!s) return null;
  if (ACTIONS[s]) return ACTIONS[s];
  // "Buy Limit GTC", "SELL (stop)"
  const first = s.split(' ')[0];
  if (first === 'buy' || first === 'bought') return { side: 'BUY' };
  if (first === 'sell' || first === 'sold') return { side: 'SELL' };
  return null;
}

/** The direction of a whole trade: what its opening fill did */
export function parseSide(raw: string): 'LONG' | 'SHORT' | null {
  const action = parseAction(raw);
  if (!action) return null;
  const openedWithBuy = action.effect === 'close' ? action.side === 'SELL' : action.side === 'BUY';
  return openedWithBuy ? 'LONG' : 'SHORT';
}

/** TO OPEN / Close / in / out / E / X / IBKR's "O;P" ... */
export function parseEffect(raw: string): 'open' | 'close' | null {
  const s = normalWords(raw);
  if (!s) return null;
  if (['open', 'to open', 'opening', 'o', 'in', 'entry', 'e', 'opened', 'new'].includes(s)) return 'open';
  if (['close', 'to close', 'closing', 'c', 'out', 'exit', 'x', 'closed'].includes(s)) return 'close';
  const codes = raw.toUpperCase().split(/[;,\s]+/);
  if (codes.includes('O') && !codes.includes('C')) return 'open';
  if (codes.includes('C') && !codes.includes('O')) return 'close';
  return null;
}

/** whether an order-status cell means the order was (at least partly) filled */
export function parseStatus(raw: string): 'filled' | 'unfilled' | null {
  const s = normalWords(raw);
  if (!s) return null;
  if (/^(partially )?(filled|executed|complete|completed|done|traded|fill|partial fill|partially executed|part filled)( partially)?$/.test(s))
    return 'filled';
  if (/^(cancel+ed|cancel+ed by user|rejected|expired|working|pending|new|submitted|inactive|accepted|queued|suspended|received|replaced|open|cancel+ation requested|pending cancel|triggered|not filled|unfilled|failed)$/.test(s))
    return 'unfilled';
  return null;
}

/** CALL / PUT / C / P */
export function parsePutCall(raw: string): 'C' | 'P' | null {
  const s = normalWords(raw);
  if (s === 'call' || s === 'c') return 'C';
  if (s === 'put' || s === 'p') return 'P';
  return null;
}
