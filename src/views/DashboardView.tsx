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
import { RANGE_OPTIONS, splitByRange, type RangeKey } from '@/lib/ranges';
import { formatDate, formatDuration, formatMoney, formatPct, formatRatio } from '@/lib/format';
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
import { ImportTradesModal } from '@/components/trades/ImportTradesModal';

export function DashboardView() {
  const { accountTrades, data, startingBalance, activeLabel, actions } = useJournal();
  const { openTradeForm } = useUI();
  const [range, setRange] = useState<RangeKey>('30D');
  const [importing, setImporting] = useState(false);
  const currency = data.settings.currency;

  const { inRange, before } = useMemo(() => splitByRange(accountTrades, range), [accountTrades, range]);
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
  const recent = useMemo(
    () => [...accountTrades].sort((a, b) => tradeTimestamp(b).localeCompare(tradeTimestamp(a))).slice(0, 5),
    [accountTrades],
  );

  // ---------- nothing logged yet ----------
  if (accountTrades.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" description={activeLabel} />
        <EmptyState
          icon={Target}
          title="Your dashboard builds itself from your trades"
          description="Nothing here is pre-filled. Log your first trade and the equity curve, win rate, profit factor and Sniper Score all start calculating from your own numbers."
          actions={
            <>
              <Button variant="primary" onClick={() => openTradeForm()}>
                <Plus className="size-4" /> Log your first trade
              </Button>
              <Button onClick={() => setImporting(true)}>
                <Upload className="size-4" /> Import a CSV
              </Button>
              <Button variant="ghost" onClick={() => actions.loadSampleData()}>
                <FlaskConical className="size-4" /> Load test data to explore
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

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {activeLabel}
            <span className="text-faint">·</span>
            <span className="num">{closedInRange}</span> closed {closedInRange === 1 ? 'trade' : 'trades'} in range
            {stats.open > 0 && <StatusBadge tone="accent">{stats.open} open</StatusBadge>}
          </span>
        }
        actions={
          <>
            <SegmentedControl value={range} onChange={setRange} options={RANGE_OPTIONS} />
            {/* a phone already has Log trade in the header */}
            <Button variant="primary" className="max-md:hidden" onClick={() => openTradeForm()}>
              <Plus className="size-4" /> Log trade
            </Button>
          </>
        }
      />

      {noClosedTrades ? (
        <EmptyState
          icon={CalendarRange}
          title={`No closed trades in the last ${range === 'YTD' ? 'year to date' : range}`}
          description="Your statistics are calculated from closed trades only. Widen the range, or close out a position to see it counted."
          actions={<Button onClick={() => setRange('ALL')}>Show all time</Button>}
        />
      ) : (
        <>
          {/* ---------- headline metrics ---------- */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
            <MetricCard
              label="Net profit"
              value={formatMoney(stats.net, currency, { sign: true })}
              tone={toneFor(stats.net)}
              icon={TrendingUp}
              sub={`Balance ${formatMoney(balanceNow, currency)}`}
              info="Total profit after fees and commissions, across every closed trade in the selected range."
            />
            <MetricCard
              label="Win rate"
              value={formatPct(stats.winRate)}
              icon={Target}
              sub={`${stats.wins}W · ${stats.losses}L${stats.breakeven ? ` · ${stats.breakeven}BE` : ''}`}
              info="The share of closed trades that finished above break-even after fees."
              aside={
                <RingProgress
                  value={stats.winRate / 100}
                  color="var(--profit)"
                  track="color-mix(in srgb, var(--loss) 35%, transparent)"
                >
                  <span className="num text-[11px] font-semibold text-fg">{Math.round(stats.winRate)}%</span>
                </RingProgress>
              }
            />
            <MetricCard
              label="Profit factor"
              value={formatRatio(pf)}
              tone={pf != null && pf >= 1 ? 'profit' : pf != null ? 'loss' : 'neutral'}
              icon={Scale}
              sub={`${formatMoney(stats.grossProfit, currency, { compact: true })} won vs ${formatMoney(stats.grossLoss, currency, { compact: true })} lost`}
              info="Gross profit divided by gross loss. Above 1 means you make more than you give back; 2 or more is strong."
              aside={
                <RingProgress value={pfRing} color={pf != null && pf >= 1 ? 'var(--profit)' : 'var(--loss)'}>
                  <Scale className="size-4 text-muted" />
                </RingProgress>
              }
            />
            <MetricCard
              label="Avg R:R"
              value={stats.payoff == null ? '—' : `1:${formatRatio(stats.payoff)}`}
              tone={stats.payoff != null && stats.payoff >= 1 ? 'profit' : stats.payoff != null ? 'loss' : 'neutral'}
              icon={Activity}
              sub={
                stats.avgR == null
                  ? 'Your average winner against your average loser'
                  : `${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(2)}R average result`
              }
              info="Your average winner measured against your average loser. The sub-line shows the average result in units of the risk your stop loss defined."
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
              label="Expectancy"
              value={formatMoney(stats.expectancy, currency, { sign: true })}
              tone={toneFor(stats.expectancy)}
              sub="per trade"
              info="What you earn on an average trade. Positive expectancy is the whole game."
            />
            <MetricCell
              label="System quality"
              value={stats.sqn == null ? '—' : stats.sqn.toFixed(2)}
              sub={sqnLabel(stats.sqn)}
              info="Van Tharp's SQN: how strong your edge is relative to how erratic your results are."
            />
            <MetricCell
              label="Commissions"
              value={formatMoney(stats.fees, currency)}
              tone={stats.fees > 0 ? 'loss' : 'neutral'}
              sub={
                stats.grossProfit > 0
                  ? `${((stats.fees / stats.grossProfit) * 100).toFixed(0)}% of gross profit`
                  : 'paid in fees'
              }
              info="Everything you paid your broker across these trades."
            />
            <MetricCell
              label="Total trades"
              value={stats.total}
              sub={`${stats.activeDays} trading ${stats.activeDays === 1 ? 'day' : 'days'}`}
            />
            <MetricCell
              label="Max streak"
              value={`${stats.maxWinStreak}W / ${stats.maxLossStreak}L`}
              sub={
                stats.currentStreak === 0
                  ? 'no active streak'
                  : `currently ${Math.abs(stats.currentStreak)}${stats.currentStreak > 0 ? 'W' : 'L'}`
              }
              info="The longest run of consecutive wins and consecutive losses."
            />
            <MetricCell
              label="Best day"
              value={stats.bestDay ? formatMoney(stats.bestDay.net, currency, { sign: true, compact: true }) : '—'}
              tone={toneFor(stats.bestDay?.net ?? 0)}
              sub={stats.bestDay ? formatDate(stats.bestDay.day) : undefined}
            />
            <MetricCell
              label="Worst day"
              value={stats.worstDay ? formatMoney(stats.worstDay.net, currency, { sign: true, compact: true }) : '—'}
              tone={toneFor(stats.worstDay?.net ?? 0)}
              sub={stats.worstDay ? formatDate(stats.worstDay.day) : undefined}
            />
            <MetricCell
              label="Avg win / loss"
              value={`${formatMoney(stats.avgWin, currency, { compact: true, decimals: 0 })} / ${formatMoney(-stats.avgLoss, currency, { compact: true, decimals: 0 })}`}
              sub={stats.avgHoldMinutes != null ? `held ${formatDuration(stats.avgHoldMinutes)} on average` : undefined}
              info="The size of your average winner against your average loser."
            />
          </MetricStrip>

          {/* ---------- charts ---------- */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <ChartContainer
              className="h-[280px] md:col-span-2 md:h-[340px]"
              title="Equity curve"
              subtitle={
                stats.maxDrawdown > 0
                  ? `Max drawdown ${formatMoney(stats.maxDrawdown, currency)}${stats.maxDrawdownPct != null ? ` (${stats.maxDrawdownPct.toFixed(1)}%)` : ''}`
                  : 'Account balance after every closed trade'
              }
              actions={
                <div className="text-right">
                  <div
                    className={`num text-lg font-semibold ${stats.net > 0 ? 'text-profit' : stats.net < 0 ? 'text-loss' : 'text-fg'}`}
                  >
                    {formatMoney(balanceNow, currency)}
                  </div>
                  <div className="text-[11px] text-faint">
                    {excludedNet !== 0 ? 'current balance, incl. excluded trades' : 'current balance'}
                  </div>
                </div>
              }
            >
              <EquityCurveChart points={stats.equity} currency={currency} startingBalance={opening} />
            </ChartContainer>

            <ChartContainer
              className="h-[320px] md:h-[340px]"
              title="Sniper Score"
              subtitle={score.overall == null ? 'Rate your trades to build this' : `${score.overall} / 100 overall`}
              actions={
                score.overall != null && <div className="num text-lg font-semibold text-accent">{score.overall}</div>
              }
            >
              <SniperScoreChart score={score} />
              {score.unrated.length > 0 && (
                <p className="px-3 text-center text-[11px] leading-relaxed text-faint">
                  Not yet rated: {score.unrated.join(', ')}. Add stops and self-ratings when you log a trade.
                </p>
              )}
            </ChartContainer>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <ChartContainer
              className="h-[240px] md:col-span-2 md:h-[300px]"
              title="Daily P&L"
              subtitle={`${stats.days.filter((d) => d.net > 0).length} green days, ${stats.days.filter((d) => d.net < 0).length} red`}
              empty={stats.days.length === 0}
              emptyText="No closed trades in this range yet."
            >
              <DailyPnlChart days={stats.days} currency={currency} />
            </ChartContainer>

            <ChartContainer
              className="md:h-[300px]"
              title="Recent trades"
              subtitle="Your last five, newest first"
              bodyClassName="px-0 pt-1"
              actions={
                <Link href="/trades" className="text-xs text-accent underline-offset-4 transition hover:underline">
                  View all
                </Link>
              }
            >
              <RecentTrades trades={recent} currency={currency} />
            </ChartContainer>
          </div>

          {/* ---------- footer stats ---------- */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <MetricCard
              label="Largest win"
              value={formatMoney(stats.largestWin, currency, { sign: true })}
              tone="profit"
              icon={Trophy}
              sub={`Avg winner ${formatMoney(stats.avgWin, currency)}`}
            />
            <MetricCard
              label="Largest loss"
              value={formatMoney(stats.largestLoss, currency, { sign: true })}
              tone="loss"
              icon={Flame}
              sub={`Avg loser ${formatMoney(-stats.avgLoss, currency)}`}
            />
            <MetricCard
              label="Max drawdown"
              value={formatMoney(-stats.maxDrawdown, currency)}
              tone={stats.maxDrawdown > 0 ? 'loss' : 'neutral'}
              icon={Gauge}
              sub={
                stats.maxDrawdownPct != null
                  ? `${stats.maxDrawdownPct.toFixed(1)}% from peak`
                  : 'Set a starting balance for %'
              }
              info="The deepest fall from a peak in your equity curve."
            />
            <MetricCard
              label="Average day"
              value={formatMoney(stats.avgDaily, currency, { sign: true })}
              tone={toneFor(stats.avgDaily)}
              icon={Sigma}
              sub={`Across ${stats.activeDays} trading ${stats.activeDays === 1 ? 'day' : 'days'}`}
            />
          </div>
        </>
      )}

      {/* open positions reminder */}
      {accountTrades.some((t) => !isClosed(t)) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm md:flex-nowrap md:px-5">
          <Wallet className="size-4 shrink-0 text-accent" />
          <span className="text-fg">
            You have {accountTrades.filter((t) => !isClosed(t)).length} open{' '}
            {accountTrades.filter((t) => !isClosed(t)).length === 1 ? 'position' : 'positions'}.
            <span className="text-muted"> They are excluded from statistics until you add an exit price.</span>
          </span>
          <Link href="/trades" className="ml-auto text-xs text-accent underline-offset-4 hover:underline">
            Open the trades table
          </Link>
        </div>
      )}

      <p className="mt-6 flex items-center gap-1.5 text-xs text-faint">
        <Receipt className="size-3.5" />
        Every figure above is calculated from the trades you entered. Nothing is estimated or filled in for you.
      </p>
    </>
  );
}
