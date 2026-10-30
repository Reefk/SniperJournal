import type { Settings, TagGroup, Trade } from './types';
import { matchMistake, mistakeList, mistakeName } from './mistakes';
import { netPnl, rMultiple, statTrades } from './trade-math';

/**
 * The tag manager (Settings → Tags) and tag groups (Reports → one table per
 * group). Tags stay plain strings on each trade: renaming, merging, deleting
 * and moving one into the mistakes change them in place on every trade that
 * has it, in every account, and keep the groups and the "kept apart" sets in
 * step. Nothing here merges anything on its own: look-alikes are only listed.
 */

/** the tags the journal has, with how many trades have each */
export interface TagLine {
  tag: string;
  /** every trade with it: open, excluded and test trades too, since a rename changes them all */
  trades: number;
  /** the ones the statistics count (closed, complete, not excluded) */
  counted: number;
  /** their net P&L */
  net: number;
  /** the group it is in, if any */
  group: string | null;
}

/** every tag on any trade, the most used first */
export function tagLines(trades: Trade[], groups: TagGroup[] = []): TagLine[] {
  const lines = new Map<string, TagLine>();
  const counted = new Set(statTrades(trades));
  for (const t of trades) {
    for (const tag of new Set(t.tags)) {
      const line = lines.get(tag) ?? { tag, trades: 0, counted: 0, net: 0, group: groupOf(groups, tag) };
      line.trades += 1;
      if (counted.has(t)) {
        line.counted += 1;
        line.net += netPnl(t);
      }
      lines.set(tag, line);
    }
  }
  return [...lines.values()].sort((a, b) => b.trades - a.trades || a.tag.localeCompare(b.tag));
}

/** the trades that have any of `tags` */
export function tradesWith(trades: Trade[], tags: Iterable<string>): number {
  const set = new Set(tags);
  return trades.filter((t) => t.tags.some((tag) => set.has(tag))).length;
}

/** a tag as it would be typed again: trimmed, single spaces */
export const spacedTag = (tag: string) => tag.trim().replace(/\s+/g, ' ');

/** what look-alikes are told apart by: capitals, spaces, '-' and '_' are not */
const spelled = (tag: string) => tag.toLowerCase().replace(/[-_]+/g, ' ').trim().replace(/\s+/g, ' ');

/**
 * Tags that are probably one tag typed differently: the same but for
 * capitals, spaces, '-' or '_' ("fomo", "FOMO", "moved-stop", "moved stop"),
 * or for a trailing "s" when both are there ("breakout", "breakouts"). Each set
 * in the order `tags` has them (the most used first), and the sets by their
 * first. A set kept apart (all of it within one of `keptApart`) is left out.
 */
export function lookAlikes(tags: string[], keptApart: string[][] = []): string[][] {
  const byKey = new Map<string, string[]>();
  for (const tag of tags) {
    const key = spelled(tag);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), tag]);
  }
  // a plural joins its singular when both are there
  const root = (key: string) =>
    key.length > 2 && key.endsWith('s') && byKey.has(key.slice(0, -1)) ? key.slice(0, -1) : key;
  const sets = new Map<string, string[]>();
  for (const [key, own] of byKey) sets.set(root(key), [...(sets.get(root(key)) ?? []), ...own]);
  const order = new Map(tags.map((t, i) => [t, i]));
  return [...sets.values()]
    .filter((set) => set.length > 1)
    .map((set) => set.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)))
    .filter((set) => !keptApart.some((apart) => set.every((t) => apart.includes(t))))
    .sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0));
}

/** what Settings → Tags does to the journal */
export interface TagChange {
  /** the tags that go */
  from: string[];
  /** what they become: a tag (renamed, or merged into it if it is one already), or null to take them off */
  into: string | null;
  /** Move to mistakes: every trade that had one of them gets this mistake, which joins the list */
  mistake?: string;
}

const once = <T>(items: T[]) => [...new Set(items)];

/** kept-apart sets of two names or more, none of them twice */
export function distinctSets(sets: string[][]): string[][] {
  const seen = new Set<string>();
  return sets.map(once).filter((set) => {
    const key = JSON.stringify([...set].sort());
    if (set.length < 2 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * `from` becomes `into` on every trade, in every account; a trade that had
 * both keeps it once. The groups follow: `into` stays in its own group, or
 * else goes where the first of `from` was. The kept-apart sets follow too.
 * `into` is tidied as typed (spacedTag) and `mistake` is the listed one with
 * its capitals (matchMistake); a blank one changes nothing.
 */
export function changeTags(
  trades: Trade[],
  settings: Settings,
  change: TagChange,
): { trades: Trade[]; settings: Settings } {
  const { from } = change;
  const into = change.into == null ? null : spacedTag(change.into);
  const mistake = change.mistake == null ? undefined : matchMistake(change.mistake, mistakeList(settings));
  if (into === '' || mistake === null) return { trades, settings };
  const going = new Set(from.filter((tag) => tag !== into));
  if (!going.size) return { trades, settings };
  const swap = (tag: string) => (going.has(tag) ? into : tag);
  const named = (tags: string[]) => once(tags.map(swap).filter((tag): tag is string => tag != null));

  const nextTrades = trades.map((t) => {
    if (!t.tags.some((tag) => going.has(tag))) return t;
    const next: Trade = { ...t, tags: named(t.tags) };
    if (mistake) next.mistakes = once([...(t.mistakes ?? []), mistake]);
    return next;
  });

  const next: Settings = { ...settings };
  if (settings.tagGroups) {
    const groups = settings.tagGroups;
    const home =
      into == null
        ? undefined
        : (groups.find((g) => g.tags.includes(into)) ??
          from.map((tag) => groups.find((g) => g.tags.includes(tag))).find(Boolean));
    next.tagGroups = groups.map((g) => ({
      ...g,
      tags: g === home ? named(g.tags) : g.tags.filter((tag) => !going.has(tag)),
    }));
  }
  if (settings.tagsKeptApart) {
    next.tagsKeptApart = distinctSets(settings.tagsKeptApart.map(named));
  }
  if (mistake) {
    const list = mistakeList(settings);
    if (!list.includes(mistake)) next.mistakes = [...list, mistake];
  }
  return { trades: nextTrades, settings: next };
}

/** the tags of a look-alike set, remembered as not the same */
export function keepApart(settings: Settings, tags: string[]): string[][] {
  return distinctSets([...(settings.tagsKeptApart ?? []), tags]);
}

/**
 * The mistake a tag most likely is, for Move to mistakes to offer first: one
 * whose words include all of the tag's ("fomo" is "Entered early (FOMO)",
 * "moved stop" is "Moved my stop"), the one with the fewest other words. Its
 * name as shown counts as well as the one it is saved under, so a tag typed in
 * the language on screen finds a starting mistake ("перенос стопа" is
 * "Перенос стопа", saved as "Moved my stop"). A plural "s" doesn't count. Null
 * when none is.
 */
export function likelyMistake(tags: string[], list: string[]): string | null {
  // what is often left out when typing doesn't count: accents ("movi" is
  // "moví", "объем" is "объём"), Arabic's vowel marks and Hindi's nukta dot.
  // Hindi's vowel signs are letters of the word, and a joiner doesn't split one.
  const words = (s: string) =>
    spelled(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640\u093c\u200c\u200d]/g, '')
      .replace(/[^\p{L}\p{M}\p{N} ]+/gu, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
  let best: { mistake: string; extra: number } | null = null;
  for (const tag of tags) {
    const own = words(tag);
    if (!own.length) continue;
    for (const mistake of list) {
      for (const name of new Set([mistake, mistakeName(mistake)])) {
        const theirs = words(name);
        if (!own.every((w) => theirs.includes(w))) continue;
        const extra = theirs.length - own.length;
        if (!best || extra < best.extra) best = { mistake, extra };
      }
    }
  }
  return best?.mistake ?? null;
}

/** the group a tag is in, if any */
export function groupOf(groups: TagGroup[], tag: string): string | null {
  return groups.find((g) => g.tags.includes(tag))?.name ?? null;
}

/**
 * A group as the editor saves it: `was` is its name before (null for a new
 * one). Its tags leave any other group, since a tag is in one at most.
 */
export function saveGroup(groups: TagGroup[], was: string | null, group: TagGroup): TagGroup[] {
  const tags = once(group.tags);
  const saved: TagGroup = { name: group.name.trim(), tags };
  const others = groups
    .filter((g) => g.name !== was)
    .map((g) => ({ ...g, tags: g.tags.filter((tag) => !tags.includes(tag)) }));
  const at = was == null ? -1 : groups.findIndex((g) => g.name === was);
  if (at < 0) return [...others, saved];
  return [...others.slice(0, at), saved, ...others.slice(at)];
}

/** suggestions for the trade form, kept in the order given except that a group's tags sit together, in the groups' order */
export function arrangeByGroup(tags: string[], groups: TagGroup[]): string[] {
  const rank = (tag: string) => {
    const i = groups.findIndex((g) => g.tags.includes(tag));
    return i < 0 ? groups.length : i;
  };
  return tags
    .map((tag, i) => ({ tag, i, rank: rank(tag) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.tag);
}

export interface GroupRow {
  tag: string;
  trades: number;
  winRate: number;
  net: number;
  /** over the trades with a stop, the only ones with an R */
  avgR: number | null;
}

export interface GroupTable {
  name: string;
  /** each of the group's tags some counted trade has, the best net first */
  rows: GroupRow[];
  /** trades with two or more of its tags, which count in each of their rows */
  shared: number;
}

/** Reports → one table per tag group, over `trades` (the range and account shown) */
export function groupTables(trades: Trade[], groups: TagGroup[]): GroupTable[] {
  const counted = statTrades(trades);
  return groups.map((g) => {
    const own = new Set(g.tags);
    const rows = g.tags
      .map((tag): GroupRow | null => {
        const list = counted.filter((t) => t.tags.includes(tag));
        if (!list.length) return null;
        const pnls = list.map(netPnl);
        const rs = list.map(rMultiple).filter((r): r is number => r != null);
        const net = pnls.reduce((a, b) => a + b, 0);
        return {
          tag,
          trades: list.length,
          winRate: (pnls.filter((p) => p > 0).length / list.length) * 100,
          net,
          avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
        };
      })
      .filter((row): row is GroupRow => row != null)
      .sort((a, b) => b.net - a.net || b.trades - a.trades);
    const shared = counted.filter((t) => new Set(t.tags.filter((tag) => own.has(tag))).size > 1).length;
    return { name: g.name, rows, shared };
  });
}
