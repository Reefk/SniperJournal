import type { RuleChecks, RuleTick, Setup, Trade } from './types';
import { netPnl, rMultiple, statTrades } from './trade-math';
import { mean } from './utils';

/**
 * Whether trades kept the rules of their setup. The trade form ticks each rule
 * Kept or Broken, and the ticks are stored on the trade under the rule's
 * wording as the setup had it then. A rule added to the setup later is not one
 * the trade could have kept, so it never turns a checked trade into a partly
 * checked one.
 */

/** below this many trades on either side, the cost of breaking rules is not worked out */
export const MIN_RULE_SIDE = 4;

/** a rule broken once is one trade, not a habit: it takes this many to be named the costliest */
export const MIN_BREAKS_TO_NAME = 2;

export type RuleVerdict = 'kept' | 'broken' | 'partial' | 'unchecked';

/** the tick for a rule, read safely whatever the rule is called ("constructor" is a rule too) */
export function tickOf(checks: RuleChecks | undefined, rule: string): RuleTick {
  return checks && Object.prototype.hasOwnProperty.call(checks, rule) ? checks[rule] : null;
}

/** one broken rule decides it; every rule kept is kept; some left unticked is partial */
export function ruleVerdict(checks: RuleChecks | undefined): RuleVerdict {
  const ticks = Object.values(checks ?? {});
  if (ticks.includes(false)) return 'broken';
  if (!ticks.includes(true)) return 'unchecked';
  return ticks.every((tick) => tick === true) ? 'kept' : 'partial';
}

/** the rules the form shows: the setup's, then any the trade is ticked on that the setup no longer has */
export function rulesShown(setupRules: string[], checks: RuleChecks | undefined): string[] {
  // a setup an older version saved can have one wording twice: it is one rule, with one tick
  const current = [...new Set(setupRules.filter(Boolean))];
  const removed = Object.keys(checks ?? {}).filter((rule) => !current.includes(rule) && tickOf(checks, rule) != null);
  return [...current, ...removed];
}

/**
 * What the trade form saves once its checklist was used: every rule of the
 * setup, an unticked one as null, so the trade is judged on the rules it had
 * at the time. A rule the setup no longer has stays only while it is ticked.
 * Nothing ticked saves nothing.
 */
export function checksToSave(setupRules: string[], checks: RuleChecks | undefined): RuleChecks | undefined {
  const current = setupRules.filter(Boolean);
  const ticks: Array<[string, RuleTick]> = [
    ...current.map((rule): [string, RuleTick] => [rule, tickOf(checks, rule)]),
    ...Object.entries(checks ?? {}).filter(([rule, tick]) => !current.includes(rule) && tick != null),
  ];
  return ticks.some(([, tick]) => tick != null) ? Object.fromEntries(ticks) : undefined;
}

/** broken wins over kept, and kept over unticked */
const stricter = (a: RuleTick | undefined, b: RuleTick): RuleTick =>
  a === false || b === false ? false : a === true || b === true ? true : null;

function fromTicks(ticks: Iterable<[string, RuleTick]>): RuleChecks | undefined {
  const out = new Map<string, RuleTick>();
  for (const [rule, tick] of ticks) out.set(rule, stricter(out.get(rule), tick));
  return out.size ? Object.fromEntries(out) : undefined;
}

/** the ticks of several partial fills merged into one trade: a rule broken in any part is broken */
export function combineChecks(parts: Array<RuleChecks | undefined>): RuleChecks | undefined {
  return fromTicks(parts.flatMap((checks) => Object.entries(checks ?? {})));
}

/**
 * The setup a trade's ticks were made against, saved beside them. A version
 * from before rule ticks keeps both when it moves the trade to another setup,
 * so a trade whose setup is not this one has ticks about another setup's rules,
 * and the journal drops them when it opens (cleanTrades). Every trade the app
 * saves with ticks has it.
 */
export function checksSetupId(setupId: string | undefined, checks: RuleChecks | undefined): string | undefined {
  return setupId && checks ? setupId : undefined;
}

/** a rule in the Playbook's editor, with the wording it had when the editor opened (null for a new one) */
export interface EditedRule {
  text: string;
  was: string | null;
}

/**
 * What the Playbook's editor saves: the rules trimmed, without blank or
 * repeated ones (a tick is kept under the wording, so two rules with one
 * wording would share it), and each reworded rule as old wording → new. A
 * wording another rule still has is not a rewording: its ticks stay with it.
 */
export function editedRules(rows: EditedRule[]): { rules: string[]; renamed: Map<string, string> } {
  const rules = [...new Set(rows.map((row) => row.text.trim()).filter(Boolean))];
  const renamed = new Map<string, string>();
  for (const { text, was } of rows) {
    const now = text.trim();
    if (was != null && now && now !== was && !rules.includes(was)) renamed.set(was, now);
  }
  return { rules, renamed };
}

/**
 * A setup's rules reworded in the Playbook: each trade's tick follows its rule
 * to the new wording. Two rules given the same wording keep the stricter tick.
 */
export function renameRuleChecks(trades: Trade[], setupId: string, renamed: ReadonlyMap<string, string>): Trade[] {
  if (!renamed.size) return trades;
  return trades.map((t) => {
    const checks = t.ruleChecks;
    if (t.setupId !== setupId || !checks || !Object.keys(checks).some((rule) => renamed.has(rule))) return t;
    return {
      ...t,
      ruleChecks: fromTicks(Object.entries(checks).map(([rule, tick]) => [renamed.get(rule) ?? rule, tick])),
    };
  });
}

export interface RuleSide {
  trades: number;
  net: number;
  /** net P&L per trade */
  avg: number;
  winRate: number;
  /** over the trades with a stop; null when none has one */
  avgR: number | null;
}

export interface RuleLine {
  rule: string;
  setupId: string;
  /** false for a rule the setup no longer has, still shown for the trades ticked on it */
  current: boolean;
  kept: number;
  broken: number;
  /** kept ÷ ticked, 0–100; null when never ticked */
  keptRate: number | null;
  /** net P&L of the trades that broke it */
  brokenNet: number;
}

export interface RuleReport {
  /** closed trades with the setup, as the statistics count them */
  trades: number;
  /** of them, ticked on at least one rule */
  checked: number;
  /** ticked, none broken, some left unticked: counted per rule, but on neither side */
  partial: number;
  /** the trades that kept every rule */
  kept: RuleSide | null;
  /** the trades that broke at least one */
  broken: RuleSide | null;
  /**
   * What the trades that broke a rule would have made, had they done as well
   * on average as the trades of the same setup that kept every rule, less what
   * they did make. Worked out setup by setup, so one setup doing better than
   * another never passes for the cost of breaking rules, and added up over the
   * setups with MIN_RULE_SIDE trades on each side. Null when none has; below
   * zero when breaking rules has paid so far.
   */
  cost: number | null;
  /** the trades that broke a rule in the setups the cost is worked out for */
  costed: number;
  rules: RuleLine[];
  /** of the rules broken MIN_BREAKS_TO_NAME times or more, the one whose broken trades lost the most; null when none lost money */
  costliest: RuleLine | null;
}

function side(trades: Trade[]): RuleSide | null {
  if (!trades.length) return null;
  const pnls = trades.map(netPnl);
  const net = pnls.reduce((a, b) => a + b, 0);
  const rs = trades.map(rMultiple).filter((r): r is number => r != null);
  return {
    trades: trades.length,
    net,
    avg: net / trades.length,
    winRate: (pnls.filter((p) => p > 0).length / trades.length) * 100,
    avgR: rs.length ? mean(rs) : null,
  };
}

function linesOf(setup: Setup, trades: Trade[]): RuleLine[] {
  const current = setup.rules.filter(Boolean);
  const tally = new Map<string, { kept: number; broken: number; brokenNet: number }>(
    current.map((rule) => [rule, { kept: 0, broken: 0, brokenNet: 0 }]),
  );
  for (const t of trades) {
    for (const [rule, tick] of Object.entries(t.ruleChecks ?? {})) {
      if (tick == null) continue;
      const line = tally.get(rule) ?? { kept: 0, broken: 0, brokenNet: 0 };
      if (tick) line.kept += 1;
      else {
        line.broken += 1;
        line.brokenNet += netPnl(t);
      }
      tally.set(rule, line);
    }
  }
  return [...tally.entries()].map(([rule, { kept, broken, brokenNet }]) => ({
    rule,
    setupId: setup.id,
    current: current.includes(rule),
    kept,
    broken,
    keptRate: kept + broken ? (kept / (kept + broken)) * 100 : null,
    brokenNet,
  }));
}

/** (kept average − broken average) × broken trades, given MIN_RULE_SIDE trades on each side */
function costOf(kept: RuleSide | null, broken: RuleSide | null): number | null {
  return kept && broken && kept.trades >= MIN_RULE_SIDE && broken.trades >= MIN_RULE_SIDE
    ? (kept.avg - broken.avg) * broken.trades
    : null;
}

function report(trades: Trade[], setups: Setup[]): RuleReport {
  const closed = statTrades(trades);
  const kept: Trade[] = [];
  const broken: Trade[] = [];
  const lines: RuleLine[] = [];
  let count = 0;
  let partial = 0;
  let cost: number | null = null;
  let costed = 0;
  for (const setup of setups) {
    const own = closed.filter((t) => t.setupId === setup.id);
    const ownKept: Trade[] = [];
    const ownBroken: Trade[] = [];
    count += own.length;
    for (const t of own) {
      const verdict = ruleVerdict(t.ruleChecks);
      if (verdict === 'kept') ownKept.push(t);
      else if (verdict === 'broken') ownBroken.push(t);
      else if (verdict === 'partial') partial += 1;
    }
    kept.push(...ownKept);
    broken.push(...ownBroken);
    lines.push(...linesOf(setup, own));
    const ownCost = costOf(side(ownKept), side(ownBroken));
    if (ownCost != null) {
      cost = (cost ?? 0) + ownCost;
      costed += ownBroken.length;
    }
  }

  const costliest = lines
    .filter((line) => line.broken >= MIN_BREAKS_TO_NAME && line.brokenNet < 0)
    .reduce<RuleLine | null>((worst, line) => (!worst || line.brokenNet < worst.brokenNet ? line : worst), null);

  return {
    trades: count,
    checked: kept.length + broken.length + partial,
    partial,
    kept: side(kept),
    broken: side(broken),
    cost,
    costed,
    rules: lines,
    costliest,
  };
}

/** How the trades of one setup did against its rules (the Playbook card) */
export function setupRuleReport(trades: Trade[], setup: Setup): RuleReport {
  return report(trades, [setup]);
}

/** The same across every setup in the playbook (Insights) */
export function playbookRuleReport(trades: Trade[], setups: Setup[]): RuleReport {
  return report(trades, setups);
}
