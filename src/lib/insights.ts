import type { Settings, Setup, Trade } from './types';
import { formatMoney, WEEKDAYS } from './format';
import { aggregateDays, computeStats, groupTrades, type GroupStat, type Stats } from './stats';
import { holdMinutes, netPnl, sortChronological, statTrades, tradeDay } from './trade-math';
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
  category: 'Edge' | 'Timing' | 'Risk' | 'Behaviour' | 'Cost';
  title: string;
  body: string;
  metric?: string;
}

/** below this, patterns are noise rather than signal */
export const MIN_TRADES_FOR_INSIGHTS = 5;

const MIN_GROUP = 4;

function strongest(groups: GroupStat[], min = MIN_GROUP): { best?: GroupStat; worst?: GroupStat } {
  const eligible = groups.filter((g) => g.trades >= min);
  if (eligible.length < 2) return {};
  return { best: eligible[0], worst: eligible[eligible.length - 1] };
}

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
        title: 'Daily loss limit reached',
        body: `Today is down past the limit you set. Your own rule says stop here.`,
      });
    } else if (used >= 70) {
      signals.push({
        id: 'daily-loss-near',
        tone: 'warn',
        title: 'Close to your daily loss limit',
        body: `You have used ${used.toFixed(0)}% of the loss you allow yourself in a day.`,
      });
    }
  }

  const maxTrades = settings.maxTradesPerDay ?? null;
  if (maxTrades && maxTrades > 0 && todays.length >= maxTrades) {
    signals.push({
      id: 'trade-count',
      tone: todays.length > maxTrades ? 'bad' : 'warn',
      title: `${todays.length} trades today`,
      body: `Your limit is ${maxTrades} a day. Extra trades past the plan are usually the expensive ones.`,
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
      title: `${streak} losses in a row`,
      body: 'Size down or step away until you have a clean setup. Streaks are when discipline slips.',
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
      title: `${winStreak} wins in a row`,
      body: 'Running well. Keep the position size you had when the streak started.',
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
    const lastWeek = days.filter((d) => d.day > dateKey(twoWeeks) && d.day <= dateKey(weekAgo)).reduce((a, d) => a + d.net, 0);
    if (lastWeek !== 0 || thisWeek !== 0) {
      const better = thisWeek > lastWeek;
      signals.push({
        id: 'week-trend',
        tone: better ? 'good' : 'info',
        title: better ? 'Better than last week' : 'Behind last week',
        body: `The last 7 days are running ${better ? 'ahead of' : 'behind'} the 7 days before them.`,
      });
    }
  }

  return signals;
}

/**
 * Patterns found in the trades you logged. Nothing here is invented:
 * every line points at a count you can go and check in the table.
 */
export function buildInsights(trades: Trade[], setups: Setup[], settings: Settings): Insight[] {
  const closed = statTrades(trades);
  if (closed.length < MIN_TRADES_FOR_INSIGHTS) return [];

  const stats: Stats = computeStats(trades);
  const money = settings.currency;
  const out: Insight[] = [];
  const setupNames = new Map(setups.map((s) => [s.id, s.name]));

  // --- edge ------------------------------------------------------------
  out.push({
    id: 'expectancy',
    tone: stats.expectancy > 0 ? 'good' : 'bad',
    category: 'Edge',
    title: stats.expectancy > 0 ? 'Your system has a positive expectancy' : 'Your system is losing money per trade',
    body:
      stats.expectancy > 0
        ? `Across ${stats.total} closed trades you keep an average of this much per trade. More trades of the same quality should compound it.`
        : `Across ${stats.total} closed trades the average result is negative. Cutting the worst setup usually matters more than finding a new one.`,
    metric: `${formatMoney(stats.expectancy, money, { sign: true })} per trade`,
  });

  if (stats.avgWin > 0 && stats.avgLoss > 0) {
    const breakEvenWR = (stats.avgLoss / (stats.avgWin + stats.avgLoss)) * 100;
    const margin = stats.winRate - breakEvenWR;
    out.push({
      id: 'break-even-wr',
      tone: margin > 5 ? 'good' : margin > 0 ? 'warn' : 'bad',
      category: 'Edge',
      title: `You need to win ${breakEvenWR.toFixed(1)}% to break even`,
      body:
        margin > 0
          ? `You are winning ${stats.winRate.toFixed(1)}%, which leaves ${margin.toFixed(1)} points of cushion. Protect that gap before chasing a higher win rate.`
          : `You are winning ${stats.winRate.toFixed(1)}%, below the break-even line. Either win more often or make your winners bigger relative to your losers.`,
      metric: `${margin >= 0 ? '+' : ''}${margin.toFixed(1)} pts of margin`,
    });
  }

  // --- timing ----------------------------------------------------------
  const sessions = strongest(groupTrades(closed, (t) => t.session));
  if (sessions.best && sessions.worst && sessions.best.key !== sessions.worst.key) {
    out.push({
      id: 'session',
      tone: 'info',
      category: 'Timing',
      title: `${sessions.best.label} is your most profitable session`,
      body: `${sessions.best.label} has made ${formatMoney(sessions.best.net, money, { sign: true })} across ${sessions.best.trades} trades at a ${sessions.best.winRate.toFixed(0)}% win rate. ${sessions.worst.label} has made ${formatMoney(sessions.worst.net, money, { sign: true })} across ${sessions.worst.trades} at ${sessions.worst.winRate.toFixed(0)}%. If the gap holds for another month, the quiet session is the one to cut.`,
      metric: `${formatMoney(sessions.best.net, money, { sign: true, compact: true })} vs ${formatMoney(sessions.worst.net, money, { sign: true, compact: true })}`,
    });
  }

  const weekdays = strongest(groupTrades(closed, (t) => String(parseLocal(t.openedAt).getDay()), (k) => WEEKDAYS[(Number(k) + 6) % 7]));
  if (weekdays.best && weekdays.worst && weekdays.worst.net < 0 && weekdays.best.key !== weekdays.worst.key) {
    out.push({
      id: 'weekday',
      tone: 'warn',
      category: 'Timing',
      title: `${weekdays.worst.label} is costing you`,
      body: `${weekdays.worst.label} is down ${formatMoney(Math.abs(weekdays.worst.net), money)} across ${weekdays.worst.trades} trades, while ${weekdays.best.label} is your strongest day at ${formatMoney(weekdays.best.net, money, { sign: true })}. Worth asking what is different about that day.`,
      metric: `${weekdays.worst.label}: ${formatMoney(weekdays.worst.net, money, { sign: true, compact: true })}`,
    });
  }

  // --- edge by instrument and setup -----------------------------------
  const symbols = strongest(groupTrades(closed, (t) => t.symbol));
  if (symbols.best && symbols.worst && symbols.best.key !== symbols.worst.key && symbols.worst.net < 0) {
    out.push({
      id: 'symbol',
      tone: 'info',
      category: 'Edge',
      title: `${symbols.best.key} is carrying you, ${symbols.worst.key} is dragging`,
      body: `${symbols.best.key} has made ${formatMoney(symbols.best.net, money, { sign: true })} over ${symbols.best.trades} trades. ${symbols.worst.key} has lost ${formatMoney(Math.abs(symbols.worst.net), money)} over ${symbols.worst.trades}. Dropping your worst instrument is usually the cheapest improvement available.`,
      metric: `${symbols.worst.key}: ${formatMoney(symbols.worst.net, money, { sign: true, compact: true })}`,
    });
  }

  const setupGroups = strongest(groupTrades(closed, (t) => t.setupId, (k) => setupNames.get(k) ?? 'Unknown setup'));
  if (setupGroups.best && setupGroups.worst && setupGroups.best.key !== setupGroups.worst.key) {
    out.push({
      id: 'setup',
      tone: 'info',
      category: 'Edge',
      title: `"${setupGroups.best.label}" is your best playbook setup`,
      body: `It has produced ${formatMoney(setupGroups.best.net, money, { sign: true })} over ${setupGroups.best.trades} trades at a ${setupGroups.best.winRate.toFixed(0)}% win rate, against ${formatMoney(setupGroups.worst.net, money, { sign: true })} for "${setupGroups.worst.label}". Give the better one more of your size.`,
      metric: setupGroups.best.label,
    });
  }

  const tagGroups = groupTrades(closed, (t) => t.tags).filter((g) => g.trades >= MIN_GROUP);
  const worstTag = tagGroups[tagGroups.length - 1];
  if (worstTag && worstTag.net < 0) {
    out.push({
      id: 'tag',
      tone: 'bad',
      category: 'Behaviour',
      title: `Trades tagged "${worstTag.label}" lose money`,
      body: `${worstTag.trades} trades carry this tag and together they are down ${formatMoney(Math.abs(worstTag.net), money)} at a ${worstTag.winRate.toFixed(0)}% win rate. You already named the problem when you tagged them.`,
      metric: `${worstTag.trades} trades tagged`,
    });
  }

  // --- direction -------------------------------------------------------
  const sides = groupTrades(closed, (t) => t.side);
  if (sides.length === 2 && sides.every((s) => s.trades >= MIN_GROUP)) {
    const [strong, weak] = sides;
    if (strong.winRate - weak.winRate >= 15) {
      out.push({
        id: 'side',
        tone: 'info',
        category: 'Edge',
        title: `You read ${strong.key.toLowerCase()}s better than ${weak.key.toLowerCase()}s`,
        body: `${strong.key}: ${strong.winRate.toFixed(0)}% across ${strong.trades} trades. ${weak.key}: ${weak.winRate.toFixed(0)}% across ${weak.trades}. A one-directional edge is still an edge.`,
        metric: `${(strong.winRate - weak.winRate).toFixed(0)} point gap`,
      });
    }
  }

  // --- behaviour -------------------------------------------------------
  const days = aggregateDays(trades);
  const busy = days.filter((d) => d.trades >= 4);
  if (busy.length >= 3 && days.length >= 6) {
    const busyAvg = mean(busy.map((d) => d.net));
    const calmAvg = mean(days.filter((d) => d.trades < 4).map((d) => d.net));
    if (calmAvg > busyAvg) {
      out.push({
        id: 'overtrading',
        tone: 'warn',
        category: 'Behaviour',
        title: 'Your busy days are your worse days',
        body: `Days with 4 or more trades average less than your quieter days. Volume is not where your edge lives.`,
        metric: `${busy.length} busy days measured`,
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
        title: 'The trade right after a loss performs worse',
        body: `${after.length} trades were taken immediately after a same-day loss, and they average below your normal trade. A short cool-off after a red trade would have saved money.`,
        metric: `${formatMoney(avgAfter, money, { sign: true })} vs ${formatMoney(stats.expectancy, money, { sign: true })} normally`,
      });
    }
  }

  if (stats.avgWinHold != null && stats.avgLossHold != null && stats.avgLossHold > stats.avgWinHold * 1.3) {
    out.push({
      id: 'hold-asymmetry',
      tone: 'warn',
      category: 'Behaviour',
      title: 'You hold losers longer than winners',
      body: 'Losing trades stay open noticeably longer than winning ones. That is hope management, not risk management. A hard time stop fixes it.',
      metric: `${Math.round(stats.avgLossHold)}m vs ${Math.round(stats.avgWinHold)}m`,
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
      title: `Only ${stopPct.toFixed(0)}% of your trades record a stop`,
      body: 'Without a stop price the journal cannot measure your R multiples, and more importantly you cannot prove you ever defined the risk. Add one on every trade.',
      metric: `${withStop} of ${closed.length} trades`,
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
        title: 'One loss is far bigger than the rest',
        body: `Your largest loss is more than two and a half times your average one. A single trade like that undoes a week of good ones. Find out whether the stop was moved.`,
        metric: `${formatMoney(worst, money)} vs ${formatMoney(avgLoss, money)} average`,
      });
    }
  }

  // --- cost ------------------------------------------------------------
  if (stats.fees > 0) {
    const share = stats.grossProfit > 0 ? (stats.fees / stats.grossProfit) * 100 : 0;
    if (share > 15 || (stats.net < 0 && stats.net + stats.fees > 0)) {
      out.push({
        id: 'fees',
        tone: stats.net < 0 && stats.net + stats.fees > 0 ? 'bad' : 'warn',
        category: 'Cost',
        title:
          stats.net < 0 && stats.net + stats.fees > 0
            ? 'Commissions turned a winning system into a losing one'
            : 'Commissions are eating a large share of your profit',
        body:
          stats.net < 0 && stats.net + stats.fees > 0
            ? 'Before fees you are profitable; after fees you are not. Fewer, larger trades or a cheaper broker would flip this.'
            : `Fees account for roughly ${share.toFixed(0)}% of your gross profit.`,
        metric: `${formatMoney(stats.fees, money)} paid in fees`,
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
        title: 'Your own discipline ratings predict your results',
        body: `Trades you rated 4-5 for discipline average better than the ones you rated 1-2. You can tell a good trade from a bad one in the moment, which means the fix is following your own read.`,
        metric: `${high.length} disciplined vs ${low.length} rushed`,
      });
    }
  }

  const order: Record<Tone, number> = { bad: 0, warn: 1, good: 2, info: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
