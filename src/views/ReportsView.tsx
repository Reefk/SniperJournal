'use client';

import { useMemo, useState } from 'react';
import { Download, FileBarChart, Printer } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { computeStats, groupTrades, sqnLabel } from '@/lib/stats';
import { RANGE_OPTIONS, splitByRange, type RangeKey } from '@/lib/ranges';
import { tradesToCsv } from '@/lib/csv';
import { formatDate, formatDuration, formatMoney, formatPct, formatRatio, MONTHS_SHORT, WEEKDAYS } from '@/lib/format';
import { netPnl, statTrades, tradeDay } from '@/lib/trade-math';
import { cn, dateKey, downloadFile, parseLocal } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChartContainer } from '@/components/ui/ChartContainer';

export function ReportsView() {
  const { accountTrades, data, startingBalance, activeLabel } = useJournal();
  const { toast } = useUI();
  const [range, setRange] = useState<RangeKey>('ALL');
  const currency = data.settings.currency;

  const inRange = useMemo(() => splitByRange(accountTrades, range).inRange, [accountTrades, range]);
  const stats = useMemo(() => computeStats(inRange, startingBalance), [inRange, startingBalance]);
  const closed = useMemo(() => statTrades(inRange), [inRange]);

  const months = useMemo(() => {
    const map = new Map<string, { net: number; trades: number; wins: number }>();
    for (const t of closed) {
      const key = tradeDay(t).slice(0, 7);
      const agg = map.get(key) ?? { net: 0, trades: 0, wins: 0 };
      const p = netPnl(t);
      agg.net += p;
      agg.trades += 1;
      if (p > 0) agg.wins += 1;
      map.set(key, agg);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [closed]);

  const bySymbol = useMemo(() => groupTrades(closed, (t) => t.symbol), [closed]);
  const bySetup = useMemo(() => {
    const names = new Map(data.setups.map((s) => [s.id, s.name]));
    return groupTrades(closed, (t) => t.setupId, (k) => names.get(k) ?? 'Unknown');
  }, [closed, data.setups]);
  const byWeekday = useMemo(
    () => groupTrades(closed, (t) => String(parseLocal(t.openedAt).getDay()), (k) => WEEKDAYS[(Number(k) + 6) % 7]),
    [closed],
  );

  if (accountTrades.length === 0) {
    return (
      <>
        <PageHeader title="Reports" description="Printable summaries of your trading record." />
        <EmptyState
          icon={FileBarChart}
          title="No report to build yet"
          description="Reports summarise what you have logged: a monthly breakdown, performance per symbol and per setup, and the headline statistics, all ready to print or export."
        />
      </>
    );
  }

  const Row = ({ label, value, tone }: { label: string; value: string; tone?: 'profit' | 'loss' }) => (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className={cn('num text-sm font-medium', tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : 'text-fg')}>{value}</span>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${activeLabel} · ${stats.total} closed trades`}
        actions={
          <>
            <SegmentedControl value={range} onChange={setRange} options={RANGE_OPTIONS} />
            <Button
              onClick={() => {
                downloadFile(`sniper-journal-trades-${dateKey(new Date())}.csv`, tradesToCsv(inRange, data.setups, data.accounts), 'text/csv');
                toast(`Exported ${inRange.length} trades`);
              }}
            >
              <Download className="size-4" /> Export CSV
            </Button>
            <Button onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <section className="rounded-xl border border-line bg-surface px-5 py-4">
          <h3 className="mb-2 text-sm font-semibold text-fg">Results</h3>
          <Row label="Net profit" value={formatMoney(stats.net, currency, { sign: true })} tone={stats.net > 0 ? 'profit' : stats.net < 0 ? 'loss' : undefined} />
          <Row label="Gross profit" value={formatMoney(stats.grossProfit, currency)} />
          <Row label="Gross loss" value={formatMoney(-stats.grossLoss, currency)} />
          <Row label="Commissions" value={formatMoney(stats.fees, currency)} />
          <Row label="Profit factor" value={formatRatio(stats.profitFactor)} />
          <Row label="Expectancy per trade" value={formatMoney(stats.expectancy, currency, { sign: true })} />
        </section>

        <section className="rounded-xl border border-line bg-surface px-5 py-4">
          <h3 className="mb-2 text-sm font-semibold text-fg">Consistency</h3>
          <Row label="Trades" value={String(stats.total)} />
          <Row label="Win rate" value={stats.total ? formatPct(stats.winRate) : '—'} />
          <Row label="Average win" value={formatMoney(stats.avgWin, currency)} />
          <Row label="Average loss" value={formatMoney(-stats.avgLoss, currency)} />
          <Row label="Longest win streak" value={String(stats.maxWinStreak)} />
          <Row label="Longest loss streak" value={String(stats.maxLossStreak)} />
        </section>

        <section className="rounded-xl border border-line bg-surface px-5 py-4">
          <h3 className="mb-2 text-sm font-semibold text-fg">Risk</h3>
          <Row label="Max drawdown" value={formatMoney(-stats.maxDrawdown, currency)} tone={stats.maxDrawdown > 0 ? 'loss' : undefined} />
          <Row label="Drawdown from peak" value={stats.maxDrawdownPct != null ? formatPct(stats.maxDrawdownPct) : 'set a starting balance'} />
          <Row label="Largest win" value={formatMoney(stats.largestWin, currency, { sign: true })} tone="profit" />
          <Row label="Largest loss" value={formatMoney(stats.largestLoss, currency, { sign: true })} tone="loss" />
          <Row label="System quality (SQN)" value={stats.sqn == null ? '—' : `${stats.sqn.toFixed(2)} · ${sqnLabel(stats.sqn)}`} />
          <Row label="Average hold time" value={formatDuration(stats.avgHoldMinutes)} />
        </section>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <ChartContainer title="Month by month" bodyClassName="px-2 pb-3 pt-1" empty={months.length === 0} emptyText="No closed trades in this range.">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="px-3 py-2 text-left font-medium">Month</th>
                <th className="px-3 py-2 text-right font-medium">Trades</th>
                <th className="px-3 py-2 text-right font-medium">Win rate</th>
                <th className="px-3 py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {months.map(([key, agg]) => {
                const [y, m] = key.split('-').map(Number);
                return (
                  <tr key={key} className="border-t border-line">
                    <td className="px-3 py-2 text-fg">{MONTHS_SHORT[m - 1]} {y}</td>
                    <td className="num px-3 py-2 text-right text-muted">{agg.trades}</td>
                    <td className="num px-3 py-2 text-right text-muted">{formatPct((agg.wins / agg.trades) * 100, 0)}</td>
                    <td className={cn('num px-3 py-2 text-right font-medium', agg.net > 0 ? 'text-profit' : agg.net < 0 ? 'text-loss' : 'text-muted')}>
                      {formatMoney(agg.net, currency, { sign: true })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ChartContainer>

        <div className="space-y-4">
          {[
            { title: 'Best and worst symbols', rows: bySymbol },
            { title: 'Playbook setups', rows: bySetup },
            { title: 'Day of the week', rows: byWeekday },
          ].filter((b) => b.rows.length > 0).map((b) => (
            <ChartContainer key={b.title} title={b.title} bodyClassName="px-2 pb-3 pt-1">
              <table className="w-full text-sm">
                <tbody>
                  {b.rows.slice(0, 6).map((row) => (
                    <tr key={row.key} className="border-b border-line last:border-0">
                      <td className="max-w-[160px] truncate px-3 py-2 text-fg">{row.label}</td>
                      <td className="num px-2 py-2 text-right text-xs text-faint">{row.trades}×</td>
                      <td className="num px-2 py-2 text-right text-xs text-muted">{formatPct(row.winRate, 0)}</td>
                      <td className={cn('num px-3 py-2 text-right font-medium', row.net > 0 ? 'text-profit' : row.net < 0 ? 'text-loss' : 'text-muted')}>
                        {formatMoney(row.net, currency, { sign: true, compact: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ChartContainer>
          ))}
        </div>
      </div>

      {stats.bestDay && stats.worstDay && (
        <p className="mt-4 text-xs text-faint">
          Best day {formatDate(stats.bestDay.day)} at {formatMoney(stats.bestDay.net, currency, { sign: true })}; worst day{' '}
          {formatDate(stats.worstDay.day)} at {formatMoney(stats.worstDay.net, currency, { sign: true })}.
        </p>
      )}
    </>
  );
}
