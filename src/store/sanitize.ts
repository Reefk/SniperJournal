import type { Account, Resource, Settings, Setup, Trade } from '@/lib/types';

/**
 * Type-checks everything that comes in from outside the app's own code: the
 * journal file at startup, and any backup being restored. A backup can be
 * hand-edited, truncated or from somewhere else entirely, and one wrong type
 * (a currency the browser cannot format, a tag list that is a string) would
 * otherwise crash a screen on every launch.
 *
 * The rule throughout: a value of the right type is kept exactly as it is, so
 * a well-formed journal comes out identical. Only a value of the wrong type is
 * replaced, with the same default a new journal would use.
 */

type Loose = Record<string, unknown>;

const isRecord = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** the objects in an array, skipping anything else */
export const records = (v: unknown): Loose[] => (Array.isArray(v) ? v.filter(isRecord) : []);

const text = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const optText = (v: unknown) => (typeof v === 'string' ? v : undefined);
const num = (v: unknown, fallback = 0) => (isNum(v) ? v : fallback);
const optNum = (v: unknown) => (isNum(v) ? v : undefined);
const optBool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
/** a number that may legitimately be null or absent */
const nullableNum = (v: unknown): number | null | undefined => (v == null || isNum(v) ? (v as number | null | undefined) : null);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

/**
 * A link that is safe to put in an href: http or https only. Anything else —
 * javascript:, data:, a file path — could run code inside the app when tapped.
 */
export function safeLink(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  try {
    const { protocol } = new URL(v);
    return protocol === 'https:' || protocol === 'http:' ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Intl throws on a malformed currency code, which would take every money figure down with it */
const CURRENCY = /^[A-Z]{3}$/;
/** setup colours go straight into a style; only a plain hex colour may */
const COLOR = /^#[0-9a-f]{3,8}$/i;

function validZone(zone: string): boolean {
  if (zone === 'local') return true;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function cleanSettings(v: unknown, base: Settings): Settings {
  const s = isRecord(v) ? v : {};
  const merged = { ...base, ...s } as Settings & Loose;
  return {
    ...merged,
    currency: typeof s.currency === 'string' && CURRENCY.test(s.currency) ? s.currency : base.currency,
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : base.theme,
    timezone: typeof s.timezone === 'string' && validZone(s.timezone) ? s.timezone : base.timezone,
    maxDailyLoss: 'maxDailyLoss' in s ? nullableNum(s.maxDailyLoss) : base.maxDailyLoss,
    maxTradesPerDay: 'maxTradesPerDay' in s ? nullableNum(s.maxTradesPerDay) : base.maxTradesPerDay,
  };
}

export function cleanAccounts(v: unknown): Account[] {
  return records(v)
    .filter((a) => typeof a.id === 'string')
    .map((a) => ({
      ...a,
      id: a.id as string,
      name: text(a.name, 'Account'),
      startingBalance: num(a.startingBalance),
      createdAt: text(a.createdAt),
    }));
}

export function cleanTrades(v: unknown): Trade[] {
  return records(v)
    .filter((t) => typeof t.id === 'string')
    .map((t) => ({
      ...(t as unknown as Trade),
      accountId: text(t.accountId),
      symbol: text(t.symbol),
      side: t.side === 'SHORT' ? 'SHORT' : 'LONG',
      openedAt: text(t.openedAt),
      closedAt: optText(t.closedAt),
      quantity: num(t.quantity),
      entryPrice: num(t.entryPrice),
      exitPrice: nullableNum(t.exitPrice),
      stopLoss: nullableNum(t.stopLoss),
      takeProfit: nullableNum(t.takeProfit),
      fees: num(t.fees),
      multiplier: optNum(t.multiplier),
      manualPnl: nullableNum(t.manualPnl),
      leverage: nullableNum(t.leverage),
      session: optText(t.session),
      setupId: optText(t.setupId),
      tags: strings(t.tags),
      notes: optText(t.notes),
      screenshotUrl: optText(t.screenshotUrl),
      screenshotFile: optText(t.screenshotFile),
      review: isRecord(t.review)
        ? { discipline: optNum(t.review.discipline), execution: optNum(t.review.execution), patience: optNum(t.review.patience) }
        : undefined,
      excluded: optBool(t.excluded),
      needsReview: optBool(t.needsReview),
      externalId: optText(t.externalId),
      fillCount: optNum(t.fillCount),
      isSample: optBool(t.isSample),
      createdAt: text(t.createdAt),
      updatedAt: text(t.updatedAt),
    }));
}

export function cleanSetups(v: unknown): Setup[] {
  return records(v)
    .filter((s) => typeof s.id === 'string')
    .map((s) => ({
      ...s,
      id: s.id as string,
      name: text(s.name),
      description: optText(s.description),
      rules: strings(s.rules),
      color: typeof s.color === 'string' && COLOR.test(s.color) ? s.color : undefined,
      isSample: optBool(s.isSample),
    }));
}

export function cleanResources(v: unknown): Resource[] {
  return records(v)
    .filter((r) => typeof r.id === 'string')
    .map((r) => ({
      ...r,
      id: r.id as string,
      title: text(r.title),
      url: safeLink(r.url),
      category: text(r.category, 'Other'),
      notes: optText(r.notes),
      createdAt: text(r.createdAt),
    }));
}
