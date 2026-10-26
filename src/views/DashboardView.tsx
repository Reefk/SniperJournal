'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  CalendarRange,
  Flame,
  FlaskConical,
  Gauge,
  Plus,
  Receipt,
  Scale,
  Sigma,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  Wallet,
} from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { computeStats, sniperScore, sqnLabel } from '@/lib/stats';
import { dailySummary, equitySummary, scoreSummary } from '@/lib/chart-summary';
import { rangeOptions, splitByRange, type RangeKey } from '@/lib/ranges';
import { goalReport } from '@/lib/goals';
import {
  formatDate,
  formatDuration,
  formatMoney,
  formatPct,
  formatR,
  formatRatio,
  pctText,
  wholePct,
} from '@/lib/format';
import { decimalMark, isolate, tr } from '@/lib/i18n';
import { isClosed, tradeTimestamp } from '@/lib/trade-math';
import { excludedRealised, openingBalance } from '@/store/selectors';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { MetricCard, MetricCell, MetricStrip, toneFor } from '@/components/ui/MetricCard';
import { RingProgress } from '@/components/ui/RingProgress';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EquityCurveChart } from '@/components/dashboard/EquityCurveChart';
import { DailyPnlChart } from '@/components/dashboard/DailyPnlChart';
import { SniperScoreChart } from '@/components/dashboard/SniperScoreChart';
import { RecentTrades } from '@/components/dashboard/RecentTrades';
import { GoalsCard } from '@/components/dashboard/GoalsCard';
import { ImportTradesModal } from '@/components/trades/ImportTradesModal';
import { rich } from '@/components/ui/Rich';

/** the period the goals' arrows compare with: as long as the range, just before it */
const beforeWords = (range: RangeKey): string | null => (range === 'ALL' ? null : tr(`range.before.${range}`));

const wins = (n: number) => tr('stat.wins', { n });
const losses = (n: number) => tr('stat.losses', { n });

export function DashboardView() {
  const { accountTrades, data, startingBalance, activeLabel, actions } = useJournal();
  const { openTradeForm } = useUI();
  const [range, setRange] = useState<RangeKey>('30D');
  const [importing, setImporting] = useState(false);
  const currency = data.settings.currency;

  const { inRange, before, start } = useMemo(() => splitByRange(accountTrades, range), [accountTrades, range]);
  // the curve starts from whatever the balance already was when the range began
  const opening = useMemo(() => openingBalance(startingBalance, before), [startingBalance, before]);
  // the balance may also count trades left out of the statistics (Settings);
  // the equity curve, being a statistic, never does
  const countExcluded = data.settings.countExcludedInBalance === true;
  const excludedNet = useMemo(
    () => (countExcluded ? excludedRealised(before) + excludedRealised(inRange) : 0),
    [countExcluded, before, inRange],
  );
  const stats = useMemo(() => computeStats(inRange, opening), [inRange, opening]);
  const score = useMemo(() => sniperScore(inRange, stats), [inRange, stats]);
  const goals = useMemo(
    () => goalReport({ trades: accountTrades, setups: data.setups, settings: data.settings, from: start }),
    [accountTrades, data.setups, data.settings, start],
  );
  const recent = useMemo(
    () => [...accountTrades].sort((a, b) => tradeTimestamp(b).localeCompare(tradeTimestamp(a))).slice(0, 5),
    [accountTrades],
  );

  // ---------- nothing logged yet ----------
  if (accountTrades.length === 0) {
    return (
      <>
        <PageHeader title={tr('nav.dashboard')} description={activeLabel} />
        <EmptyState
          icon={Target}
          title={tr('dash.empty.title')}
          description={tr('dash.empty.body')}
          actions={
            <>
              <Button variant="primary" onClick={() => openTradeForm()}>
                <Plus className="size-4" /> {tr('dash.empty.first')}
              </Button>
              <Button onClick={() => setImporting(true)}>
                <Upload className="size-4" /> {tr('dash.empty.import')}
              </Button>
              <Button variant="ghost" onClick={() => actions.loadSampleData()}>
                <FlaskConical className="size-4" /> {tr('dash.empty.sample')}
              </Button>
            </>
          }
        />
        <ImportTradesModal open={importing} onClose={() => setImporting(false)} />
      </>
    );
  }

  const closedInRange = stats.total;
  const noClosedTrades = closedInRange === 0;
  const pf = stats.profitFactor;
  const pfRing = pf == null ? 0 : Number.isFinite(pf) ? Math.min(pf / 4, 1) : 1;
  const rrRing = stats.payoff == null ? 0 : Math.min(Number.isFinite(stats.payoff) ? stats.payoff / 3 : 1, 1);
  const balanceNow = opening + stats.net + excludedNet;
  const { greenDays } = stats;
  const openCount = accountTrades.filter((t) => !isClosed(t)).length;

  return (
    <>
      <PageHeader
        title={tr('nav.dashboard')}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {activeLabel}
            <span className="text-faint">·</span>
            {rich(tr('dash.closedInRange', { count: closedInRange }), {
              num: (text) => <span className="num">{text}</span>,
            })}
            {stats.open > 0 && <StatusBadge tone="accent">{tr('dash.open', { count: stats.open })}</StatusBadge>}
          </span>
        }
        actions={
          <>
            <SegmentedControl value={range} onChange={setRange} options={rangeOptions()} />
            {/* a phone already has Log trade in the header */}
            <Button variant="primary" className="max-md:hidden" onClick={() => openTradeForm()}>
              <Plus className="size-4" /> {tr('header.logTrade')}
            </Button>
          </>
        }
      />

      {noClosedTrades ? (
        <EmptyState
          icon={CalendarRange}
          title={tr(`range.none.${range}`)}
          description={tr('dash.noClosedHint')}
          actions={<Button onClick={() => setRange('ALL')}>{tr('dash.showAllTime')}</Button>}
        />
      ) : (
        <>
          {/* ---------- headline metrics ---------- */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
            <MetricCard
              label={tr('stat.netProfit')}
              value={formatMoney(stats.net, currency, { sign: true })}
              tone={toneFor(stats.net)}
              icon={TrendingUp}
              sub={tr('dash.balance', { money: formatMoney(balanceNow, currency) })}
              info={tr('dash.netInfo')}
            />
            <MetricCard
              label={tr('goal.winRate.label')}
              value={formatPct(stats.winRate)}
              icon={Target}
              sub={[
                wins(stats.wins),
                losses(stats.losses),
                stats.breakeven ? tr('stat.breakeven', { n: stats.breakeven }) : '',
              ]
                .filter(Boolean)
                .join(' · ')}
              info={tr('dash.winRateInfo')}
              aside={
                <RingProgress
                  value={stats.winRate / 100}
                  color="var(--profit)"
                  track="color-mix(in srgb, var(--loss) 35%, transparent)"
                >
                  <span className="num text-[11px] font-semibold text-fg">{pctText(Math.round(stats.winRate))}</span>
                </RingProgress>
              }
            />
            <MetricCard
              label={tr('stat.profitFactor')}
              value={formatRatio(pf)}
              tone={pf != null && pf >= 1 ? 'profit' : pf != null ? 'loss' : 'neutral'}
              icon={Scale}
              sub={tr('dash.wonLost', {
                won: formatMoney(stats.grossProfit, currency, { compact: true }),
                lost: formatMoney(stats.grossLoss, currency, { compact: true }),
              })}
              info={tr('dash.pfInfo')}
              aside={
                <RingProgress value={pfRing} color={pf != null && pf >= 1 ? 'var(--profit)' : 'var(--loss)'}>
                  <Scale className="size-4 text-muted" />
                </RingProgress>
              }
            />
            <MetricCard
              label={tr('stat.avgRR')}
              value={stats.payoff == null ? '—' : isolate(`1:${formatRatio(stats.payoff)}`)}
              tone={stats.payoff != null && stats.payoff >= 1 ? 'profit' : stats.payoff != null ? 'loss' : 'neutral'}
              icon={Activity}
              sub={stats.avgR == null ? tr('dash.rrSub') : tr('dash.avgResult', { r: formatR(stats.avgR) })}
              info={tr('dash.rrInfo')}
              aside={
                <RingProgress value={rrRing} color="var(--accent)">
                  <Activity className="size-4 text-muted" />
                </RingProgress>
              }
            />
          </div>

          {/* ---------- secondary metrics ---------- */}
          <MetricStrip className="mt-4">
            <MetricCell
              label={tr('stat.expectancy')}
              value={formatMoney(stats.expectancy, currency, { sign: true })}
              tone={toneFor(stats.expectancy)}
              sub={tr('dash.perTrade')}
              info={tr('dash.expectancyInfo')}
            />
            <MetricCell
              label={tr('stat.sqn')}
              value={stats.sqn == null ? '—' : isolate(decimalMark(stats.sqn.toFixed(2)))}
              sub={sqnLabel(stats.sqn)}
              info={tr('dash.sqnInfo')}
            />
            <MetricCell
              label={tr('stat.commissions')}
              value={formatMoney(stats.fees, currency)}
              tone={stats.fees > 0 ? 'loss' : 'neutral'}
              sub={
                stats.grossProfit > 0
                  ? tr('dash.feesShare', { pct: formatPct((stats.fees / stats.grossProfit) * 100, 0) })
                  : tr('dash.paidInFees')
              }
              info={tr('dash.feesInfo')}
            />
            <MetricCell
              label={tr('stat.totalTrades')}
              value={stats.total}
              sub={tr('stat.tradingDays', { count: stats.activeDays })}
            />
            <MetricCell
              label={tr('stat.maxStreak')}
              value={`${wins(stats.maxWinStreak)} / ${losses(stats.maxLossStreak)}`}
              sub={
                stats.currentStreak === 0
                  ? tr('dash.noStreak')
                  : tr('dash.currently', {
                      streak:
                        stats.currentStreak > 0 ? wins(stats.currentStreak) : losses(Math.abs(stats.currentStreak)),
                    })
              }
              info={tr('dash.streakInfo')}
            />
            <MetricCell
              label={tr('stat.bestDay')}
              value={stats.bestDay ? formatMoney(stats.bestDay.net, currency, { sign: true, compact: true }) : '—'}
              tone={toneFor(stats.bestDay?.net ?? 0)}
              sub={stats.bestDay ? formatDate(stats.bestDay.day) : undefined}
            />
            <MetricCell
              label={tr('stat.worstDay')}
              value={stats.worstDay ? formatMoney(stats.worstDay.net, currency, { sign: true, compact: true }) : '—'}
              tone={toneFor(stats.worstDay?.net ?? 0)}
              sub={stats.worstDay ? formatDate(stats.worstDay.day) : undefined}
            />
            <MetricCell
              label={tr('stat.avgWinLoss')}
              value={`${formatMoney(stats.avgWin, currency, { compact: true, decimals: 0 })} / ${formatMoney(-stats.avgLoss, currency, { compact: true, decimals: 0 })}`}
              sub={
                stats.avgHoldMinutes != null
                  ? tr('dash.held', { duration: formatDuration(stats.avgHoldMinutes) })
                  : undefined
              }
              info={tr('dash.avgWinLossInfo')}
            />
          </MetricStrip>

          {/* ---------- charts ---------- */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <ChartContainer
              className="h-[280px] md:col-span-2 md:h-[340px]"
              title={tr('dash.equity')}
              summary={equitySummary(stats.equity, currency)}
              subtitle={
                stats.maxDrawdown > 0
                  ? stats.maxDrawdownPct != null
                    ? tr('dash.drawdownPct', {
                        money: formatMoney(stats.maxDrawdown, currency),
                        pct: formatPct(stats.maxDrawdownPct),
                      })
                    : tr('dash.drawdown', { money: formatMoney(stats.maxDrawdown, currency) })
                  : tr('dash.equityHint')
              }
              actions={
                <div className="text-right">
                  <div
                    className={`num text-lg font-semibold ${stats.net > 0 ? 'text-profit' : stats.net < 0 ? 'text-loss' : 'text-fg'}`}
                  >
                    {formatMoney(balanceNow, currency)}
                  </div>
                  <div className="text-[11px] text-faint">
                    {excludedNet !== 0 ? tr('dash.currentBalanceExcluded') : tr('dash.currentBalance')}
                  </div>
                </div>
              }
            >
              <EquityCurveChart points={stats.equity} currency={currency} startingBalance={opening} />
            </ChartContainer>

            <ChartContainer
              className="h-[320px] md:h-[340px]"
              title={tr('dash.score')}
              summary={scoreSummary(score)}
              subtitle={
                score.overall == null ? tr('dash.scoreHint') : tr('dash.scoreOverall', { score: score.overall })
              }
              actions={
                score.overall != null && <div className="num text-lg font-semibold text-accent">{score.overall}</div>
              }
            >
              {/* the note takes the room it needs and the chart the rest, so it stays inside the card */}
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1">
                  <SniperScoreChart score={score} />
                </div>
                {score.unrated.length > 0 && (
                  <p className="shrink-0 px-3 text-center text-[11px] leading-relaxed text-faint">
                    {tr('dash.notRated', { axes: score.unrated.join(tr('format.comma')) })}
                  </p>
                )}
              </div>
            </ChartContainer>
          </div>

          <ChartContainer
            className="mt-4 h-[240px] md:h-[300px]"
            title={tr('dash.daily')}
            summary={dailySummary(stats.days, currency)}
            subtitle={tr('dash.dailyHint', {
              count: greenDays,
              red: stats.days.filter((d) => d.net < 0).length,
              pct: pctText(wholePct(stats.greenDayRate)),
            })}
            empty={stats.days.length === 0}
            emptyText={tr('dash.dailyEmpty')}
          >
            <DailyPnlChart days={stats.days} currency={currency} />
          </ChartContainer>

          {/* ---------- the extremes and the average day, under the days they come from ---------- */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <MetricCard
              label={tr('stat.largestWin')}
              value={formatMoney(stats.largestWin, currency, { sign: true })}
              tone="profit"
              icon={Trophy}
              sub={tr('dash.avgWinner', { money: formatMoney(stats.avgWin, currency) })}
            />
            <MetricCard
              label={tr('stat.largestLoss')}
              value={formatMoney(stats.largestLoss, currency, { sign: true })}
              tone="loss"
              icon={Flame}
              sub={tr('dash.avgLoser', { money: formatMoney(-stats.avgLoss, currency) })}
            />
            <MetricCard
              label={tr('stat.maxDrawdown')}
              value={formatMoney(-stats.maxDrawdown, currency)}
              tone={stats.maxDrawdown > 0 ? 'loss' : 'neutral'}
              icon={Gauge}
              sub={
                stats.maxDrawdownPct != null
                  ? tr('dash.fromPeak', { pct: formatPct(stats.maxDrawdownPct) })
                  : tr('dash.setBalance')
              }
              info={tr('dash.drawdownInfo')}
            />
            <MetricCard
              label={tr('stat.averageDay')}
              value={formatMoney(stats.avgDaily, currency, { sign: true })}
              tone={toneFor(stats.avgDaily)}
              icon={Sigma}
              sub={tr('dash.across', { count: stats.activeDays })}
            />
          </div>

          <ChartContainer
            className="mt-4"
            title={tr('dash.recent')}
            subtitle={tr('dash.recentHint')}
            bodyClassName="px-0 pt-1"
            actions={
              <Link href="/trades" className="text-xs text-accent underline-offset-4 transition hover:underline">
                {tr('dash.viewAll')}
              </Link>
            }
          >
            <RecentTrades trades={recent} currency={currency} />
          </ChartContainer>

          {/* last, as the targets for these numbers */}
          {goals.length > 0 && (
            <GoalsCard className="mt-4" lines={goals} currency={currency} before={beforeWords(range)} />
          )}
        </>
      )}

      {/* open positions reminder */}
      {openCount > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm md:flex-nowrap md:px-5">
          <Wallet className="size-4 shrink-0 text-accent" />
          <span className="text-fg">
            {tr('dash.openPositions', { count: openCount })}
            <span className="text-muted">{tr('dash.openExcluded', { count: openCount })}</span>
          </span>
          <Link href="/trades" className="ml-auto text-xs text-accent underline-offset-4 hover:underline">
            {tr('dash.openTable')}
          </Link>
        </div>
      )}

      <p className="mt-6 flex items-center gap-1.5 text-xs text-faint">
        <Receipt className="size-3.5" />
        {tr('dash.footer')}
      </p>
    </>
  );
}
