import type { Settings, Setup, Trade } from './types';
import { capital, formatMoney, formatPct, weekdayName } from './format';
import { decimalMark, tr } from './i18n';
import { aggregateDays, breakEvenWinRate, computeStats, groupTrades, type GroupStat, type Stats } from './stats';
import { MIN_RULE_SIDE, playbookRuleReport } from './rules';
import { mistakeList, mistakeName, mistakeReport } from './mistakes';
import { sessionName } from './sessions';
import { netPnl, sortChronological, statTrades, tradeDay } from './trade-math';
import { dateKey, mean, parseLocal } from './utils';

export type Tone = 'good' | 'bad' | 'warn' | 'info';

export interface Signal {
  id: string;
  tone: Tone;
  title: string;
  body: string;
}

export interface Insight {
  id: string;
  tone: Tone;
  /** named on screen in the current language (ins.cat.*) */
  category: 'Edge' | 'Timing' | 'Risk' | 'Behaviour' | 'Cost';
  title: string;
  body: string;
  metric?: string;
}

/** below this, patterns are noise rather than signal */
export const MIN_TRADES_FOR_INSIGHTS = 5;

const MIN_GROUP = 4;

/** a day with this many trades or more is a busy one */
const BUSY_DAY = 4;

function strongest(groups: GroupStat[], min = MIN_GROUP): { best?: GroupStat; worst?: GroupStat } {
  const eligible = groups.filter((g) => g.trades >= min);
  if (eligible.length < 2) return {};
  return { best: eligible[0], worst: eligible[eligible.length - 1] };
}

/** percentage points to one decimal, in the language's own decimal mark */
const points = (value: number) => decimalMark(value.toFixed(1));

/**
 * Live warnings about today and this week. These are about what is
 * happening right now, not long-run edge.
 */
export function buildSignals(trades: Trade[], settings: Settings, now = new Date()): Signal[] {
  const signals: Signal[] = [];
  const closed = sortChronological(statTrades(trades));
  if (!closed.length) return signals;

  const today = dateKey(now);
  const todays = closed.filter((t) => tradeDay(t) === today);
  const todayNet = todays.reduce((a, t) => a + netPnl(t), 0);

  const maxLoss = settings.maxDailyLoss ?? null;
  if (maxLoss && maxLoss > 0 && todayNet < 0) {
    const used = (Math.abs(todayNet) / maxLoss) * 100;
    if (used >= 100) {
      signals.push({
        id: 'daily-loss-breached',
        tone: 'bad',
        title: tr('sig.lossBreached.title'),
        body: tr('sig.lossBreached.text'),
      });
    } else if (used >= 70) {
      signals.push({
        id: 'daily-loss-near',
        tone: 'warn',
        title: tr('sig.lossNear.title'),
        body: tr('sig.lossNear.text', { pct: formatPct(used, 0) }),
      });
    }
  }

  const maxTrades = settings.maxTradesPerDay ?? null;
  if (maxTrades && maxTrades > 0 && todays.length >= maxTrades) {
    signals.push({
      id: 'trade-count',
      tone: todays.length > maxTrades ? 'bad' : 'warn',
      title: tr('sig.tradeCount.title', { count: todays.length }),
      body: tr('sig.tradeCount.text', { max: maxTrades }),
    });
  }

  // losing streak right now
  let streak = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    if (netPnl(closed[i]) < 0) streak++;
    else break;
  }
  if (streak >= 3) {
    signals.push({
      id: 'losing-streak',
      tone: 'warn',
      title: tr('sig.losing.title', { count: streak }),
      body: tr('sig.losing.text'),
    });
  }

  let winStreak = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    if (netPnl(closed[i]) > 0) winStreak++;
    else break;
  }
  if (winStreak >= 4) {
    signals.push({
      id: 'winning-streak',
      tone: 'good',
      title: tr('sig.winning.title', { count: winStreak }),
      body: tr('sig.winning.text'),
    });
  }

  // this week against last week
  const days = aggregateDays(trades);
  if (days.length >= 6) {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeks = new Date(now);
    twoWeeks.setDate(twoWeeks.getDate() - 14);
    const thisWeek = days.filter((d) => d.day > dateKey(weekAgo)).reduce((a, d) => a + d.net, 0);
    const lastWeek = days
      .filter((d) => d.day > dateKey(twoWeeks) && d.day <= dateKey(weekAgo))
      .reduce((a, d) => a + d.net, 0);
    if (lastWeek !== 0 || thisWeek !== 0) {
      const better = thisWeek > lastWeek;
      signals.push({
        id: 'week-trend',
        tone: better ? 'good' : 'info',
        title: tr(better ? 'sig.better.title' : 'sig.behind.title'),
        body: tr(better ? 'sig.better.text' : 'sig.behind.text'),
      });
    }
  }

  return signals;
}

/**
 * Patterns found in the trades you logged. Nothing here is invented:
 * every line points at a count you can go and check in the table.
 *
 * `stats` must be `computeStats(trades)`; pass it when you already have it
 * (the Insights page does), so it isn't worked out twice.
 */
export function buildInsights(trades: Trade[], setups: Setup[], settings: Settings, stats?: Stats): Insight[] {
  const closed = statTrades(trades);
  if (closed.length < MIN_TRADES_FOR_INSIGHTS) return [];

  stats ??= computeStats(trades);
  const money = settings.currency;
  const out: Insight[] = [];
  const setupNames = new Map(setups.map((s) => [s.id, s.name]));

  // --- edge ------------------------------------------------------------
  out.push({
    id: 'expectancy',
    tone: stats.expectancy > 0 ? 'good' : 'bad',
    category: 'Edge',
    title: tr(stats.expectancy > 0 ? 'ins.expectancy.goodTitle' : 'ins.expectancy.badTitle'),
    body: tr(stats.expectancy > 0 ? 'ins.expectancy.goodText' : 'ins.expectancy.badText', { count: stats.total }),
    metric: tr('ins.expectancy.metric', { money: formatMoney(stats.expectancy, money, { sign: true }) }),
  });

  const breakEvenWR = breakEvenWinRate(stats);
  if (breakEvenWR != null) {
    const margin = stats.winRate - breakEvenWR;
    const winning = formatPct(stats.winRate, 1);
    out.push({
      id: 'break-even-wr',
      tone: margin > 5 ? 'good' : margin > 0 ? 'warn' : 'bad',
      category: 'Edge',
      title: tr('ins.breakEven.title', { pct: formatPct(breakEvenWR, 1) }),
      body:
        margin > 0
          ? tr('ins.breakEven.above', { pct: winning, points: points(margin) })
          : tr('ins.breakEven.below', { pct: winning }),
      metric: tr('ins.breakEven.metric', { points: `${margin >= 0 ? '+' : ''}${points(margin)}` }),
    });
  }

  // --- timing ----------------------------------------------------------
  const sessions = strongest(groupTrades(closed, (t) => t.session, sessionName));
  if (sessions.best && sessions.worst && sessions.best.key !== sessions.worst.key) {
    const { best, worst } = sessions;
    out.push({
      id: 'session',
      tone: 'info',
      category: 'Timing',
      title: tr('ins.session.title', { session: best.label }),
      body: tr('ins.session.text', {
        best: best.label,
        bestNet: formatMoney(best.net, money, { sign: true }),
        bestTrades: best.trades,
        bestRate: formatPct(best.winRate, 0),
        worst: worst.label,
        worstNet: formatMoney(worst.net, money, { sign: true }),
        worstTrades: worst.trades,
        worstRate: formatPct(worst.winRate, 0),
      }),
      metric: tr('ins.vs', {
        a: formatMoney(best.net, money, { sign: true, compact: true }),
        b: formatMoney(worst.net, money, { sign: true, compact: true }),
      }),
    });
  }

  const weekdays = strongest(
    groupTrades(
      closed,
      (t) => String(parseLocal(t.openedAt).getDay()),
      (k) => weekdayName((Number(k) + 6) % 7, 'long'),
    ),
  );
  if (weekdays.best && weekdays.worst && weekdays.worst.net < 0 && weekdays.best.key !== weekdays.worst.key) {
    const { best, worst } = weekdays;
    out.push({
      id: 'weekday',
      tone: 'warn',
      category: 'Timing',
      title: tr('ins.weekday.title', { day: worst.label }),
      body: tr('ins.weekday.text', {
        worst: worst.label,
        loss: formatMoney(Math.abs(worst.net), money),
        count: worst.trades,
        best: best.label,
        bestNet: formatMoney(best.net, money, { sign: true }),
      }),
      metric: tr('ins.labelNet', {
        // "Martes: −$120", though the sentence says "el martes"
        label: capital(worst.label),
        net: formatMoney(worst.net, money, { sign: true, compact: true }),
      }),
    });
  }

  // --- edge by instrument and setup -----------------------------------
  const symbols = strongest(groupTrades(closed, (t) => t.symbol));
  if (symbols.best && symbols.worst && symbols.best.key !== symbols.worst.key && symbols.worst.net < 0) {
    const { best, worst } = symbols;
    out.push({
      id: 'symbol',
      tone: 'info',
      category: 'Edge',
      title: tr('ins.symbol.title', { best: best.key, worst: worst.key }),
      body: tr('ins.symbol.text', {
        best: best.key,
        bestNet: formatMoney(best.net, money, { sign: true }),
        bestTrades: best.trades,
        worst: worst.key,
        worstLoss: formatMoney(Math.abs(worst.net), money),
        worstTrades: worst.trades,
      }),
      metric: tr('ins.labelNet', {
        label: worst.key,
        net: formatMoney(worst.net, money, { sign: true, compact: true }),
      }),
    });
  }

  const setupGroups = strongest(
    groupTrades(
      closed,
      (t) => t.setupId,
      (k) => setupNames.get(k) ?? tr('ins.setup.unknown'),
    ),
  );
  if (setupGroups.best && setupGroups.worst && setupGroups.best.key !== setupGroups.worst.key) {
    const { best, worst } = setupGroups;
    out.push({
      id: 'setup',
      tone: 'info',
      category: 'Edge',
      title: tr('ins.setup.title', { name: best.label }),
      body: tr('ins.setup.text', {
        bestNet: formatMoney(best.net, money, { sign: true }),
        count: best.trades,
        rate: formatPct(best.winRate, 0),
        worstNet: formatMoney(worst.net, money, { sign: true }),
        worst: worst.label,
      }),
      metric: best.label,
    });
  }

  const tagGroups = groupTrades(closed, (t) => t.tags).filter((g) => g.trades >= MIN_GROUP);
  const worstTag = tagGroups[tagGroups.length - 1];
  if (worstTag && worstTag.net < 0) {
    out.push({
      id: 'tag',
      tone: 'bad',
      category: 'Behaviour',
      title: tr('ins.tag.title', { tag: worstTag.label }),
      body: tr('ins.tag.text', {
        count: worstTag.trades,
        loss: formatMoney(Math.abs(worstTag.net), money),
        rate: formatPct(worstTag.winRate, 0),
      }),
      metric: tr('ins.tag.metric', { count: worstTag.trades }),
    });
  }

  // the playbook's rules: what the trades that broke one gave up against the trades of the same setup that kept them all
  const rules = playbookRuleReport(closed, setups);
  if (rules.cost != null && rules.broken) {
    const { broken, costed, costliest } = rules;
    // to the cent, so what is left over from adding up never reads as "cost you about $0.00"
    const cost = Math.round(rules.cost * 100) / 100;
    const gap = cost / costed;
    const rest = broken.trades - costed;
    const others = rest ? ` ${tr('ins.rules.others', { count: rest, min: MIN_RULE_SIDE })}` : '';
    let worst = '';
    if (costliest) {
      const said = {
        rule: costliest.rule,
        net: formatMoney(costliest.brokenNet, money, { sign: true }),
        count: costliest.broken,
      };
      worst = ` ${
        setups.length > 1
          ? tr('ins.rules.worstIn', { ...said, setup: setupNames.get(costliest.setupId) ?? tr('ins.setup.unknown') })
          : tr('ins.rules.worst', said)
      }`;
    }
    const metric = tr('ins.rules.metric', { broken: broken.trades, count: rules.checked });
    out.push(
      cost > 0
        ? {
            id: 'rules',
            tone: 'bad',
            category: 'Behaviour',
            title: tr('ins.rules.costTitle', { money: formatMoney(cost, money) }),
            body: `${tr('ins.rules.costText', { count: costed, gap: formatMoney(gap, money) })}${others}${worst}`,
            metric,
          }
        : {
            id: 'rules',
            tone: 'info',
            category: 'Behaviour',
            title: tr('ins.rules.noCostTitle'),
            body: `${
              gap <= -0.005
                ? tr('ins.rules.noCostMore', { count: costed, gap: formatMoney(-gap, money) })
                : tr('ins.rules.noCostSame', { count: costed })
            }${others}`,
            metric,
          },
    );
  }

  // mistakes: what the trades with the costliest one made less than the clean trades, with none
  const { costliest, clean } = mistakeReport(closed, mistakeList(settings));
  if (costliest?.cost != null && clean) {
    const cost = Math.round(costliest.cost * 100) / 100;
    out.push({
      id: 'mistake',
      tone: 'bad',
      category: 'Behaviour',
      title: tr('ins.mistake.title', { mistake: mistakeName(costliest.mistake) }),
      body: tr('ins.mistake.text', {
        count: costliest.trades,
        avg: formatMoney(costliest.avg, money, { sign: true }),
        cleanAvg: formatMoney(clean.avg, money, { sign: true }),
        clean: clean.trades,
        cost: formatMoney(cost, money),
      }),
      metric: tr('ins.mistake.metric', { cost: formatMoney(cost, money), count: costliest.trades }),
    });
  }

  // --- direction -------------------------------------------------------
  const sides = groupTrades(closed, (t) => t.side);
  if (sides.length === 2 && sides.every((s) => s.trades >= MIN_GROUP)) {
    const [strong, weak] = sides;
    if (strong.winRate - weak.winRate >= 15) {
      const longs = strong.key === 'LONG';
      out.push({
        id: 'side',
        tone: 'info',
        category: 'Edge',
        title: tr(longs ? 'ins.side.longsTitle' : 'ins.side.shortsTitle'),
        body: tr(longs ? 'ins.side.longsText' : 'ins.side.shortsText', {
          strongRate: formatPct(strong.winRate, 0),
          strongTrades: strong.trades,
          weakRate: formatPct(weak.winRate, 0),
          weakTrades: weak.trades,
        }),
        metric: tr('ins.side.metric', { points: (strong.winRate - weak.winRate).toFixed(0) }),
      });
    }
  }

  // --- behaviour -------------------------------------------------------
  const days = aggregateDays(trades);
  const busy = days.filter((d) => d.trades >= BUSY_DAY);
  if (busy.length >= 3 && days.length >= 6) {
    const busyAvg = mean(busy.map((d) => d.net));
    const calmAvg = mean(days.filter((d) => d.trades < BUSY_DAY).map((d) => d.net));
    if (calmAvg > busyAvg) {
      out.push({
        id: 'overtrading',
        tone: 'warn',
        category: 'Behaviour',
        title: tr('ins.busy.title'),
        body: tr('ins.busy.text', { min: BUSY_DAY }),
        metric: tr('ins.busy.metric', { count: busy.length }),
      });
    }
  }

  // revenge trading: the trade taken right after a loss on the same day
  const chrono = sortChronological(closed);
  const after: number[] = [];
  for (let i = 1; i < chrono.length; i++) {
    if (netPnl(chrono[i - 1]) < 0 && tradeDay(chrono[i]) === tradeDay(chrono[i - 1])) after.push(netPnl(chrono[i]));
  }
  if (after.length >= MIN_GROUP) {
    const avgAfter = mean(after);
    if (avgAfter < stats.expectancy) {
      out.push({
        id: 'revenge',
        tone: avgAfter < 0 ? 'bad' : 'warn',
        category: 'Behaviour',
        title: tr('ins.revenge.title'),
        body: tr('ins.revenge.text', { count: after.length }),
        metric: tr('ins.revenge.metric', {
          after: formatMoney(avgAfter, money, { sign: true }),
          normal: formatMoney(stats.expectancy, money, { sign: true }),
        }),
      });
    }
  }

  if (stats.avgWinHold != null && stats.avgLossHold != null && stats.avgLossHold > stats.avgWinHold * 1.3) {
    out.push({
      id: 'hold-asymmetry',
      tone: 'warn',
      category: 'Behaviour',
      title: tr('ins.hold.title'),
      body: tr('ins.hold.text'),
      metric: tr('ins.vs', {
        a: tr('format.minutes', { m: Math.round(stats.avgLossHold) }),
        b: tr('format.minutes', { m: Math.round(stats.avgWinHold) }),
      }),
    });
  }

  // --- risk ------------------------------------------------------------
  const withStop = closed.filter((t) => t.stopLoss != null).length;
  const stopPct = (withStop / closed.length) * 100;
  if (stopPct < 70) {
    out.push({
      id: 'stops',
      tone: 'warn',
      category: 'Risk',
      title: tr('ins.stops.title', { pct: formatPct(stopPct, 0) }),
      body: tr('ins.stops.text'),
      metric: tr('ins.stops.metric', { n: withStop, count: closed.length }),
    });
  }

  const losses = closed.map(netPnl).filter((p) => p < 0);
  if (losses.length >= MIN_GROUP) {
    const avgLoss = Math.abs(mean(losses));
    const worst = Math.abs(Math.min(...losses));
    if (worst > avgLoss * 2.5) {
      out.push({
        id: 'outlier-loss',
        tone: 'bad',
        category: 'Risk',
        title: tr('ins.outlier.title'),
        body: tr('ins.outlier.text'),
        metric: tr('ins.outlier.metric', { worst: formatMoney(worst, money), avg: formatMoney(avgLoss, money) }),
      });
    }
  }

  // --- cost ------------------------------------------------------------
  if (stats.fees > 0) {
    const share = stats.grossProfit > 0 ? (stats.fees / stats.grossProfit) * 100 : 0;
    const flipped = stats.net < 0 && stats.net + stats.fees > 0;
    if (share > 15 || flipped) {
      out.push({
        id: 'fees',
        tone: flipped ? 'bad' : 'warn',
        category: 'Cost',
        title: tr(flipped ? 'ins.fees.flipTitle' : 'ins.fees.shareTitle'),
        body: flipped ? tr('ins.fees.flipText') : tr('ins.fees.shareText', { pct: formatPct(share, 0) }),
        metric: tr('ins.fees.metric', { money: formatMoney(stats.fees, money) }),
      });
    }
  }

  // --- discipline correlation -----------------------------------------
  const rated = closed.filter((t) => typeof t.review?.discipline === 'number');
  if (rated.length >= 8) {
    const high = rated.filter((t) => (t.review?.discipline ?? 0) >= 4).map(netPnl);
    const low = rated.filter((t) => (t.review?.discipline ?? 0) <= 2).map(netPnl);
    if (high.length >= 3 && low.length >= 3 && mean(high) > mean(low)) {
      out.push({
        id: 'discipline',
        tone: 'good',
        category: 'Behaviour',
        title: tr('ins.discipline.title'),
        body: tr('ins.discipline.text'),
        metric: tr('ins.discipline.metric', { high: high.length, low: low.length }),
      });
    }
  }

  const order: Record<Tone, number> = { bad: 0, warn: 1, good: 2, info: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
