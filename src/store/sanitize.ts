import type { Account, Resource, RuleChecks, Settings, Setup, TagGroup, Trade } from '@/lib/types';
import { distinctSets } from '@/lib/tags';

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
const nullableNum = (v: unknown): number | null | undefined =>
  v == null || isNum(v) ? (v as number | null | undefined) : null;
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
/** mistakes, on a trade or the list, and tags in groups: names that aren't blank, each once (twice would count it twice) */
const names = (v: unknown) => [...new Set(strings(v).filter((s) => s.trim()))];
const optNames = (v: unknown) => {
  const list = names(v);
  return list.length ? list : undefined;
};

/**
 * Tag groups: a group named like one before it (whatever its capitals) joins
 * that one, and a tag is in the first group that lists it only. A group with
 * no name is dropped. Absent, or not a list, is none.
 */
function tagGroups(v: unknown): TagGroup[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const taken = new Set<string>();
  const out: TagGroup[] = [];
  for (const g of records(v)) {
    const name = typeof g.name === 'string' ? g.name.trim() : '';
    if (!name) continue;
    const tags = names(g.tags).filter((tag) => !taken.has(tag));
    for (const tag of tags) taken.add(tag);
    const same = out.find((o) => o.name.toLowerCase() === name.toLowerCase());
    if (same) same.tags.push(...tags);
    else out.push({ name, tags });
  }
  return out;
}

/** sets of tags kept apart: two names or more each, no set twice; nothing usable is none */
function keptApart(v: unknown): string[][] | undefined {
  if (!Array.isArray(v)) return undefined;
  const sets = distinctSets(v.map(names));
  return sets.length ? sets : undefined;
}

/** rule ticks: true, false or null each, under a rule's wording; anything else is dropped, and with it an empty set */
function ruleChecks(v: unknown): RuleChecks | undefined {
  if (!isRecord(v)) return undefined;
  const ticks = Object.entries(v).filter(
    ([rule, tick]) => rule.trim() && (tick === true || tick === false || tick === null),
  );
  return ticks.length ? (Object.fromEntries(ticks) as RuleChecks) : undefined;
}

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

/**
 * Ids must be unique: an edit or delete finds its record by id, so two trades
 * sharing one would be edited and deleted together. A repeated id is either
 * given a fresh one, keeping the record, or (for accounts, which trades point
 * at) the repeat is dropped and its trades stay with the first.
 */
function uniqueIds<T extends { id: string }>(items: T[], repeats: 'rename' | 'drop'): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    } else if (repeats === 'rename') {
      let id = `${item.id}-${Math.random().toString(36).slice(2, 8)}`;
      while (seen.has(id)) id = `${item.id}-${Math.random().toString(36).slice(2, 8)}`;
      seen.add(id);
      out.push({ ...item, id });
    }
  }
  return out;
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
    // absent until it is first changed, which reads as off
    countExcludedInBalance: optBool(s.countExcludedInBalance),
    fadedPlaceholders: optBool(s.fadedPlaceholders),
    // absent reads as the starting list; an empty one is a list with every mistake taken off,
    // but one with nothing usable in it is damaged, and reads as absent
    mistakes:
      Array.isArray(s.mistakes) && (!s.mistakes.length || names(s.mistakes).length) ? names(s.mistakes) : undefined,
    tagGroups: tagGroups(s.tagGroups),
    tagsKeptApart: keptApart(s.tagsKeptApart),
  };
}

export function cleanAccounts(v: unknown): Account[] {
  const accounts = records(v)
    .filter((a) => typeof a.id === 'string')
    .map((a) => ({
      ...a,
      id: a.id as string,
      name: text(a.name, 'Account'),
      startingBalance: num(a.startingBalance),
      createdAt: text(a.createdAt),
    }));
  return uniqueIds(accounts, 'drop');
}

/**
 * Ticks are against the rules of the setup they were made for. Without a
 * setup (an older version deleting it cleared it) they would join the next one
 * the trade is given; with another setup (an older version moved the trade,
 * keeping the ticks and the id of their setup) they are about other rules.
 * Either way they are dropped. Ticks saved before their setup's id was saved
 * with them are taken as the trade's own setup's.
 */
function ownTicks(t: Loose): Pick<Trade, 'ruleChecks' | 'ruleChecksSetupId'> {
  const setupId = optText(t.setupId);
  const ticks = setupId && (optText(t.ruleChecksSetupId) ?? setupId) === setupId ? ruleChecks(t.ruleChecks) : undefined;
  return { ruleChecks: ticks, ruleChecksSetupId: ticks ? setupId : undefined };
}

export function cleanTrades(v: unknown): Trade[] {
  const trades: Trade[] = records(v)
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
      // zero or less is refused by the trade form; a negative one flips every result
      multiplier: isNum(t.multiplier) && t.multiplier > 0 ? t.multiplier : undefined,
      manualPnl: nullableNum(t.manualPnl),
      leverage: nullableNum(t.leverage),
      session: optText(t.session),
      setupId: optText(t.setupId),
      ...ownTicks(t),
      mistakes: optNames(t.mistakes),
      tags: strings(t.tags),
      notes: optText(t.notes),
      screenshotUrl: optText(t.screenshotUrl),
      screenshotFile: optText(t.screenshotFile),
      review: isRecord(t.review)
        ? {
            discipline: optNum(t.review.discipline),
            execution: optNum(t.review.execution),
            patience: optNum(t.review.patience),
          }
        : undefined,
      excluded: optBool(t.excluded),
      needsReview: optBool(t.needsReview),
      externalId: optText(t.externalId),
      fillCount: optNum(t.fillCount),
      isSample: optBool(t.isSample),
      createdAt: text(t.createdAt),
      updatedAt: text(t.updatedAt),
    }));
  return uniqueIds(trades, 'rename');
}

export function cleanSetups(v: unknown): Setup[] {
  const setups = records(v)
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
  return uniqueIds(setups, 'rename');
}

export function cleanResources(v: unknown): Resource[] {
  const resources = records(v)
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
  return uniqueIds(resources, 'rename');
}
