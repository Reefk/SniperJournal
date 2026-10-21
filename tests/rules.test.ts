import { describe, expect, it } from 'vitest';
import type { RuleChecks, Setup, Trade } from '@/lib/types';
import {
  checksToSave,
  combineChecks,
  editedRules,
  MIN_BREAKS_TO_NAME,
  MIN_RULE_SIDE,
  playbookRuleReport,
  renameRuleChecks,
  rulesShown,
  ruleVerdict,
  setupRuleReport,
  tickOf,
} from '@/lib/rules';
import { buildInsights } from '@/lib/insights';
import { createDefaultData, normalize } from '@/lib/journal';
import { mergeTrades } from '@/lib/merge';
import { finishOpen, openRest } from '@/lib/import/finish';
import { generateSampleData } from '@/lib/sample';
import { netPnl } from '@/lib/trade-math';
import { cleanTrades } from '@/store/sanitize';
import { pnl, trade } from './helpers';

const orb: Setup = { id: 'orb', name: 'Opening Range Breakout', rules: ['Wait', 'Retest'] };
/** a closed trade of the ORB setup, `net` after fees, with these ticks */
const ticked = (net: number, ruleChecks?: RuleChecks, overrides: Partial<Trade> = {}) =>
  pnl(net, { setupId: orb.id, ruleChecks, ...overrides });

describe('a trade against the rules of its setup', () => {
  it('one broken rule decides it; every rule kept is kept; some unticked is partial', () => {
    expect(ruleVerdict({ Wait: true, Retest: false })).toBe('broken');
    expect(ruleVerdict({ Wait: null, Retest: false })).toBe('broken');
    expect(ruleVerdict({ Wait: true, Retest: true })).toBe('kept');
    expect(ruleVerdict({ Wait: true, Retest: null })).toBe('partial');
    expect(ruleVerdict({ Wait: null, Retest: null })).toBe('unchecked');
    expect(ruleVerdict({})).toBe('unchecked');
    expect(ruleVerdict(undefined)).toBe('unchecked');
  });

  it('reads a rule named like a property of every object as that rule, not the property', () => {
    expect(tickOf({}, 'constructor')).toBeNull();
    expect(tickOf({}, 'toString')).toBeNull();
    expect(tickOf({}, '__proto__')).toBeNull();
    // a journal file can hold one: JSON gives it as an ordinary key
    const fromFile = JSON.parse('{"__proto__": false, "constructor": true}') as RuleChecks;
    expect(tickOf(fromFile, '__proto__')).toBe(false);
    expect(tickOf(fromFile, 'constructor')).toBe(true);
    expect(ruleVerdict(fromFile)).toBe('broken');
  });
});

describe('the checklist in the trade form', () => {
  it("shows the setup's rules, then a removed rule only while the trade is ticked on it", () => {
    expect(rulesShown(['Wait', '', 'Retest'], undefined)).toEqual(['Wait', 'Retest']);
    expect(rulesShown(['Wait'], { Wait: true, Retest: false, Old: null })).toEqual(['Wait', 'Retest']);
  });

  it('shows a wording an older version saved twice as one rule', () => {
    expect(rulesShown(['Wait', 'Retest', 'Wait'], { Wait: true })).toEqual(['Wait', 'Retest']);
  });

  it('saves every rule of the setup, an unticked one as not checked', () => {
    expect(checksToSave(['Wait', 'Retest', 'Size'], { Retest: false })).toEqual({
      Wait: null,
      Retest: false,
      Size: null,
    });
  });

  it('keeps a removed rule while it is ticked, and drops it once cleared', () => {
    expect(checksToSave(['Wait'], { Wait: true, Retest: false })).toEqual({ Wait: true, Retest: false });
    expect(checksToSave(['Wait'], { Wait: true, Retest: null })).toEqual({ Wait: true });
  });

  it('saves nothing when nothing is ticked', () => {
    expect(checksToSave(['Wait', 'Retest'], undefined)).toBeUndefined();
    expect(checksToSave(['Wait', 'Retest'], { Wait: null })).toBeUndefined();
    expect(checksToSave([], { Gone: null })).toBeUndefined();
  });
});

describe('ticks when trades are merged, imported and rules reworded', () => {
  it('combines the parts: broken anywhere is broken, kept beats unticked', () => {
    expect(combineChecks([{ Wait: true, Retest: null }, { Wait: true, Retest: false }, undefined])).toEqual({
      Wait: true,
      Retest: false,
    });
    expect(combineChecks([{ Wait: null }, { Wait: true }])).toEqual({ Wait: true });
    expect(combineChecks([undefined, {}])).toBeUndefined();
  });

  it('a merged trade keeps the ticks of the parts with its setup, not of a part with another', () => {
    const merged = mergeTrades([
      trade({ openedAt: '2026-03-02T09:30', setupId: orb.id, ruleChecks: { Wait: true, Retest: null } }),
      trade({ openedAt: '2026-03-02T09:45', setupId: orb.id, ruleChecks: { Wait: true, Retest: false } }),
      trade({ openedAt: '2026-03-02T10:00', setupId: 'vwap', ruleChecks: { Volume: false } }),
    ]);
    expect(merged.setupId).toBe(orb.id);
    expect(merged.ruleChecks).toEqual({ Wait: true, Retest: false });
    expect(merged.ruleChecksSetupId).toBe(orb.id);
    const unticked = mergeTrades([trade({ ruleChecksSetupId: 'vwap' }), trade()]);
    expect(unticked.ruleChecks).toBeUndefined();
    expect(unticked.ruleChecksSetupId).toBeUndefined();
  });

  it('the open rest of a partly closed trade keeps its ticks, as it keeps its setup', () => {
    const open = trade({ exitPrice: null, closedAt: undefined, setupId: orb.id, ruleChecks: { Wait: true } });
    const rest = openRest(open, trade({ exitPrice: null, closedAt: undefined, quantity: 2 }));
    expect(rest.setupId).toBe(orb.id);
    expect(rest.ruleChecks).toEqual({ Wait: true });
    expect(rest.ruleChecksSetupId).toBe(orb.id);
  });

  it('a trade an import finishes keeps its ticks and their setup', () => {
    const open = trade({ exitPrice: null, closedAt: undefined, setupId: orb.id, ruleChecks: { Wait: false } });
    const done = finishOpen(open, trade({ setupId: 'vwap' }), undefined);
    expect(done.setupId).toBe(orb.id);
    expect(done.ruleChecks).toEqual({ Wait: false });
    expect(done.ruleChecksSetupId).toBe(orb.id);
  });

  it('a reworded rule takes its ticks with it, on the trades of that setup only', () => {
    const mine = ticked(10, { Wait: true, Retest: false });
    const other = pnl(10, { setupId: 'vwap', ruleChecks: { Wait: false } });
    const unticked = ticked(10);
    const [a, b, c] = renameRuleChecks([mine, other, unticked], orb.id, new Map([['Wait', 'Wait 15 minutes']]));
    expect(a.ruleChecks).toEqual({ 'Wait 15 minutes': true, Retest: false });
    expect(Object.keys(a.ruleChecks!)).toEqual(['Wait 15 minutes', 'Retest']);
    expect(b).toBe(other);
    expect(c).toBe(unticked);
  });

  it('two rules given one wording keep the stricter tick', () => {
    const [t] = renameRuleChecks([ticked(10, { Wait: true, Retest: false })], orb.id, new Map([['Wait', 'Retest']]));
    expect(t.ruleChecks).toEqual({ Retest: false });
  });

  it('two rules swapping their wording swap their ticks', () => {
    const swap = new Map([
      ['Wait', 'Retest'],
      ['Retest', 'Wait'],
    ]);
    const [t] = renameRuleChecks([ticked(10, { Wait: true, Retest: false })], orb.id, swap);
    expect(t.ruleChecks).toEqual({ Retest: true, Wait: false });
  });
});

describe("the Playbook's setup editor", () => {
  const was = (text: string) => ({ text, was: text });

  it('saves the rules trimmed, without blank or repeated ones', () => {
    const { rules } = editedRules([
      was('Wait'),
      { text: '  Retest ', was: null },
      { text: ' ', was: null },
      was('Wait'),
    ]);
    expect(rules).toEqual(['Wait', 'Retest']);
  });

  it('reports a reworded rule, old wording → new; a new or unchanged one is no rewording', () => {
    const { renamed } = editedRules([
      { text: 'Wait 15 minutes ', was: 'Wait' },
      was('Retest'),
      { text: 'Size', was: null },
      { text: '', was: 'Gone' },
    ]);
    expect([...renamed]).toEqual([['Wait', 'Wait 15 minutes']]);
  });

  it('leaves the ticks of a wording another rule still has where they are', () => {
    // one of two rules with the same wording reworded: the other is still "Wait"
    expect(editedRules([{ text: 'Retest', was: 'Wait' }, was('Wait')]).renamed.size).toBe(0);
    // a rule reworded while a new one is given its old wording
    expect(
      editedRules([
        { text: 'Retest', was: 'Wait' },
        { text: 'Wait', was: null },
      ]).renamed.size,
    ).toBe(0);
  });
});

describe('rule ticks in a journal file', () => {
  const withSetup = () => trade({ setupId: orb.id });

  it('keeps well-formed ticks exactly, in their order', () => {
    const [t] = cleanTrades([{ ...withSetup(), ruleChecks: { Wait: true, Retest: false, Size: null } }]);
    expect(t.ruleChecks).toEqual({ Wait: true, Retest: false, Size: null });
    expect(Object.keys(t.ruleChecks!)).toEqual(['Wait', 'Retest', 'Size']);
  });

  it('drops a tick of the wrong type, and ticks that are not a set of ticks', () => {
    const [a, b, c, d] = cleanTrades([
      { ...withSetup(), ruleChecks: { Wait: true, Retest: 'yes', Size: 1, Stop: {} } },
      { ...withSetup(), ruleChecks: 'kept' },
      { ...withSetup(), ruleChecks: [true, false] },
      { ...withSetup(), ruleChecks: { Wait: 'no' } },
    ]);
    expect(a.ruleChecks).toEqual({ Wait: true });
    expect(b.ruleChecks).toBeUndefined();
    expect(c.ruleChecks).toBeUndefined();
    expect(d.ruleChecks).toBeUndefined();
  });

  it('drops a tick under a blank wording, which no rule can have', () => {
    const [t] = cleanTrades([{ ...withSetup(), ruleChecks: { '': false, '  ': true, Wait: true } }]);
    expect(t.ruleChecks).toEqual({ Wait: true });
  });

  it('drops the ticks of a trade without a setup, so they never join the next setup it is given', () => {
    // an older version deleting the setup clears setupId but not the ticks it doesn't know
    const [a, b, c] = cleanTrades([
      { ...trade(), ruleChecks: { Wait: false } },
      { ...trade({ setupId: '' }), ruleChecks: { Wait: false } },
      { ...trade(), ruleChecks: { Wait: false }, ruleChecksSetupId: orb.id },
    ]);
    for (const t of [a, b, c]) {
      expect(t.ruleChecks).toBeUndefined();
      expect(t.ruleChecksSetupId).toBeUndefined();
    }
  });

  it('survive a save and a reopen', () => {
    const data = { ...createDefaultData(), trades: [ticked(10, { Wait: true, Retest: false })], setups: [orb] };
    const reopened = normalize(JSON.parse(JSON.stringify(data)));
    expect(reopened.trades[0].ruleChecks).toEqual({ Wait: true, Retest: false });
    expect(reopened.trades[0].ruleChecksSetupId).toBe(orb.id);
  });

  it("keeps ticks saved with their setup; ticks saved without one are taken as the trade's own setup's", () => {
    const [saved, before, odd] = cleanTrades([
      { ...withSetup(), ruleChecks: { Wait: true }, ruleChecksSetupId: orb.id },
      { ...withSetup(), ruleChecks: { Wait: true } },
      { ...withSetup(), ruleChecks: { Wait: true }, ruleChecksSetupId: 42 },
    ]);
    for (const t of [saved, before, odd]) {
      expect(t.ruleChecks).toEqual({ Wait: true });
      expect(t.ruleChecksSetupId).toBe(orb.id);
    }
  });

  it('drops ticks made against another setup, as an older version moving the trade leaves them', () => {
    const vwap: Setup = { id: 'vwap', name: 'VWAP', rules: ['Wait', 'Volume'] };
    const data = { ...createDefaultData(), trades: [ticked(-50, { Wait: false, Retest: true })], setups: [orb, vwap] };
    const saved = normalize(JSON.parse(JSON.stringify(data)));
    // an older version knows nothing of ticks: it moves the trade and keeps every field it doesn't know
    const moved = { ...saved, trades: saved.trades.map((t) => ({ ...t, setupId: vwap.id })) };
    const reopened = normalize(JSON.parse(JSON.stringify(moved)));
    expect(reopened.trades[0].setupId).toBe(vwap.id);
    expect(reopened.trades[0].ruleChecks).toBeUndefined();
    expect(reopened.trades[0].ruleChecksSetupId).toBeUndefined();
    // so they count against neither setup's rules
    expect(setupRuleReport(reopened.trades, vwap).checked).toBe(0);
    expect(setupRuleReport(reopened.trades, orb).checked).toBe(0);

    // moved back to the setup they were made against, they are about its rules again
    const back = { ...moved, trades: moved.trades.map((t) => ({ ...t, setupId: orb.id })) };
    expect(normalize(JSON.parse(JSON.stringify(back))).trades[0].ruleChecks).toEqual({ Wait: false, Retest: true });
  });

  it('a rule named __proto__ in a file stays a rule, and the ticks stay plain data', () => {
    const [t] = cleanTrades([{ ...withSetup(), ruleChecks: JSON.parse('{"__proto__": false, "Wait": true}') }]);
    expect(tickOf(t.ruleChecks, '__proto__')).toBe(false);
    expect(Object.getPrototypeOf(t.ruleChecks)).toBe(Object.prototype);
    expect(JSON.parse(JSON.stringify(t.ruleChecks))).toEqual(JSON.parse('{"__proto__": false, "Wait": true}'));
  });
});

describe("a setup's record against its rules", () => {
  // kept every rule: +100 +50 −20 +70 → 4 trades, +200, +50 a trade, 75% won
  // broke one: −60 −40 +30 −30 → 4 trades, −100, −25 a trade, 25% won
  const book = () => [
    ticked(100, { Wait: true, Retest: true }),
    ticked(50, { Wait: true, Retest: true }),
    ticked(-20, { Wait: true, Retest: true }),
    ticked(70, { Wait: true, Retest: true }),
    ticked(-60, { Wait: true, Retest: false }),
    ticked(-40, { Wait: false, Retest: true }),
    ticked(30, { Wait: true, Retest: false }),
    ticked(-30, { Wait: true, Retest: false }),
    ticked(10, { Wait: true, Retest: null }),
    ticked(5),
  ];
  // none of these count: an open trade, a trade left out of the statistics, another setup's trade
  const ignored = () => [
    trade({ exitPrice: null, closedAt: undefined, setupId: orb.id, ruleChecks: { Wait: false } }),
    ticked(-500, { Wait: false }, { excluded: true }),
    pnl(-999, { setupId: 'vwap', ruleChecks: { Wait: false } }),
  ];

  it('counts the checked trades and splits them into kept and broken', () => {
    const r = setupRuleReport([...book(), ...ignored()], orb);
    expect(r.trades).toBe(10);
    expect(r.checked).toBe(9);
    expect(r.partial).toBe(1);
    expect(r.kept).toEqual({ trades: 4, net: 200, avg: 50, winRate: 75, avgR: null });
    expect(r.broken).toEqual({ trades: 4, net: -100, avg: -25, winRate: 25, avgR: null });
  });

  it('works out what breaking a rule cost: (kept average − broken average) × broken trades', () => {
    expect(setupRuleReport(book(), orb).cost).toBe((50 - -25) * 4);
  });

  it(`leaves the cost out with fewer than ${MIN_RULE_SIDE} trades on a side`, () => {
    const three = book().filter((t) => netPnl(t) !== 100);
    const r = setupRuleReport(three, orb);
    expect(r.kept?.trades).toBe(3);
    expect(r.cost).toBeNull();
  });

  it('gives a negative cost when breaking rules has paid', () => {
    const kept = { Wait: true, Retest: true };
    const broke = { Wait: true, Retest: false };
    // the same results the other way round: kept −25 a trade, broke one +50
    const r = setupRuleReport(
      [...[-60, -40, 30, -30].map((net) => ticked(net, kept)), ...[100, 50, -20, 70].map((net) => ticked(net, broke))],
      orb,
    );
    expect(r.cost).toBe((-25 - 50) * 4);
  });

  it('tallies each rule, and names the one whose broken trades lost the most', () => {
    const r = setupRuleReport(book(), orb);
    const [wait, retest] = r.rules;
    // Wait: kept by the 4 kept, the partial one and 3 of the broken; broken once (−40)
    expect(wait).toMatchObject({ rule: 'Wait', current: true, kept: 8, broken: 1, brokenNet: -40 });
    expect(wait.keptRate).toBeCloseTo((8 / 9) * 100, 10);
    // Retest: kept by the 4 kept and 1 broken; broken 3 times (−60 +30 −30)
    expect(retest).toMatchObject({ rule: 'Retest', current: true, kept: 5, broken: 3, brokenNet: -60, keptRate: 62.5 });
    expect(r.costliest).toBe(retest);
  });

  it(`names a rule only once it was broken ${MIN_BREAKS_TO_NAME} times: once is one trade, not a habit`, () => {
    // Wait broken once for −900, Retest once for −10: neither is named
    const once = setupRuleReport([ticked(-900, { Wait: false }), ticked(-10, { Retest: false })], orb);
    expect(once.costliest).toBeNull();
    // Retest broken twice for −10 in all is named over Wait's single −900
    const twice = setupRuleReport(
      [ticked(-900, { Wait: false }), ticked(-5, { Retest: false }), ticked(-5, { Retest: false })],
      orb,
    );
    expect(twice.costliest).toMatchObject({ rule: 'Retest', broken: 2, brokenNet: -10 });
  });

  it('names no costliest rule when breaking rules never lost money', () => {
    const r = setupRuleReport([ticked(10, { Wait: false, Retest: true }), ticked(20, { Wait: true })], orb);
    expect(r.costliest).toBeNull();
  });

  it('shows a rule no longer in the setup for the trades ticked on it, and a new rule unticked', () => {
    const reworked: Setup = { ...orb, rules: ['Wait', 'Size'] };
    const r = setupRuleReport(book(), reworked);
    expect(r.rules.map((l) => [l.rule, l.current, l.kept + l.broken])).toEqual([
      ['Wait', true, 9],
      ['Size', true, 0],
      ['Retest', false, 8],
    ]);
    expect(r.rules[1].keptRate).toBeNull();
    // the trades checked before Size existed are still judged on the rules they had
    expect(r.kept?.trades).toBe(4);
  });

  it('averages R over the trades with a stop', () => {
    const withStop = { setupId: orb.id, ruleChecks: { Wait: true, Retest: true }, stopLoss: 95 };
    const r = setupRuleReport(
      [
        trade({ ...withStop, entryPrice: 100, exitPrice: 110 }), // +10 on 5 risked: +2R
        trade({ ...withStop, entryPrice: 100, exitPrice: 95 }), // −1R
        ticked(40, { Wait: true, Retest: true }), // no stop: not in the average
      ],
      orb,
    );
    expect(r.kept?.avgR).toBeCloseTo(0.5, 10);
  });

  it('adds every setup up for the whole playbook', () => {
    const vwap: Setup = { id: 'vwap', name: 'VWAP Reclaim', rules: ['Volume'] };
    const r = playbookRuleReport(
      [
        ...book(),
        pnl(-80, { setupId: 'vwap', ruleChecks: { Volume: false } }),
        pnl(-20, { setupId: 'vwap', ruleChecks: { Volume: false } }),
        pnl(15, { setupId: 'nowhere' }),
      ],
      [orb, vwap],
    );
    expect(r.trades).toBe(12);
    expect(r.broken?.trades).toBe(6);
    // Volume (−100 over 2) against ORB's Retest (−60 over 3)
    expect(r.costliest).toMatchObject({ rule: 'Volume', setupId: 'vwap', brokenNet: -100 });
  });
});

describe('the rules insight', () => {
  const settings = createDefaultData().settings;
  const book = (keptNet: number, brokenNet: number) => [
    ...[1, 2, 3, 4].map(() => ticked(keptNet, { Wait: true, Retest: true })),
    ...[1, 2, 3, 4].map(() => ticked(brokenNet, { Wait: true, Retest: false })),
  ];

  it('says what breaking the rules cost, and which rule cost the most', () => {
    const insight = buildInsights(book(50, -25), [orb], settings).find((i) => i.id === 'rules');
    expect(insight?.tone).toBe('bad');
    expect(insight?.title).toBe('Breaking your rules cost you about $300.00');
    expect(insight?.body).toContain('"Retest"');
    expect(insight?.metric).toBe('4 of 8 checked trades broke a rule');
  });

  it('says so when breaking them has not cost anything', () => {
    const insight = buildInsights(book(-25, 50), [orb], settings).find((i) => i.id === 'rules');
    expect(insight?.tone).toBe('info');
    expect(insight?.title).toBe('Breaking your rules has not cost you so far');
  });

  it(`stays quiet with fewer than ${MIN_RULE_SIDE} trades on a side`, () => {
    const trades = book(50, -25).slice(1);
    expect(buildInsights(trades, [orb], settings).some((i) => i.id === 'rules')).toBe(false);
  });
});

describe('the test trades', () => {
  it('are ticked on the rules of their own setup, and some are left unchecked', () => {
    const { trades, setups } = generateSampleData('acc1');
    const rulesOf = new Map(setups.map((s) => [s.id, s.rules]));
    const ticks = trades.filter((t) => t.ruleChecks);
    for (const t of ticks) {
      expect(Object.keys(t.ruleChecks!)).toEqual(rulesOf.get(t.setupId!));
      expect(t.ruleChecksSetupId).toBe(t.setupId);
    }
    expect(trades.filter((t) => !t.ruleChecks).every((t) => t.ruleChecksSetupId === undefined)).toBe(true);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.length).toBeLessThan(trades.length);
    expect(ticks.some((t) => ruleVerdict(t.ruleChecks) === 'broken')).toBe(true);
    expect(ticks.some((t) => ruleVerdict(t.ruleChecks) === 'kept')).toBe(true);
  });
});
