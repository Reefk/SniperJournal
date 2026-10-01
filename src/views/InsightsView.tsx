'use client';

import { useMemo } from 'react';
import {
  BrainCircuit, CircleAlert, CircleCheck, Info, Lightbulb, Plus, TriangleAlert,
} from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { buildInsights, buildSignals, MIN_TRADES_FOR_INSIGHTS, type Tone } from '@/lib/insights';
import { computeStats, groupTrades, sniperScore } from '@/lib/stats';
import { formatMoney, formatPct, WEEKDAYS } from '@/lib/format';
import { statTrades } from '@/lib/trade-math';
import { cn, parseLocal } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChartContainer } from '@/components/ui/ChartContainer';

const TONE_STYLES: Record<Tone, { ring: string; text: string; icon: typeof Info }> = {
  good: { ring: 'border-profit/30 bg-profit/5', text: 'text-profit', icon: CircleCheck },
  bad: { ring: 'border-loss/30 bg-loss/5', text: 'text-loss', icon: CircleAlert },
  warn: { ring: 'border-warn/30 bg-warn/5', text: 'text-warn', icon: TriangleAlert },
  info: { ring: 'border-accent/30 bg-accent/5', text: 'text-accent', icon: Info },
};

export function InsightsView() {
  const { accountTrades, data } = useJournal();
  const { openTradeForm } = useUI();
  const currency = data.settings.currency;

  const closedCount = statTrades(accountTrades).length;
  const signals = useMemo(() => buildSignals(accountTrades, data.settings), [accountTrades, data.settings]);
  const insights = useMemo(() => buildInsights(accountTrades, data.setups, data.settings), [accountTrades, data.setups, data.settings]);
  const stats = useMemo(() => computeStats(accountTrades), [accountTrades]);
  const score = useMemo(() => sniperScore(accountTrades, stats), [accountTrades, stats]);

  const breakdowns = useMemo(() => {
    const closed = statTrades(accountTrades);
    return [
      { title: 'By symbol', rows: groupTrades(closed, (t) => t.symbol).slice(0, 6) },
      { title: 'By session', rows: groupTrades(closed, (t) => t.session).slice(0, 6) },
      { title: 'By weekday', rows: groupTrades(closed, (t) => String(parseLocal(t.openedAt).getDay()), (k) => WEEKDAYS[(Number(k) + 6) % 7]).slice(0, 7) },
      { title: 'By tag', rows: groupTrades(closed, (t) => t.tags).slice(0, 6) },
    ].filter((b) => b.rows.length > 0);
  }, [accountTrades]);

  if (closedCount < MIN_TRADES_FOR_INSIGHTS) {
    return (
      <>
        <PageHeader title="AI Insights & Signals" description="Patterns found in your own trades, not generic advice." />
        <EmptyState
          icon={BrainCircuit}
          title={closedCount === 0 ? 'Nothing to analyse yet' : `${MIN_TRADES_FOR_INSIGHTS - closedCount} more closed trades needed`}
          description={`This page reads your journal and reports what it finds: which session pays you, whether you revenge trade, whether you hold losers longer than winners. It stays quiet until there are at least ${MIN_TRADES_FOR_INSIGHTS} closed trades, because anything less is noise rather than a pattern.`}
          actions={<Button variant="primary" onClick={() => openTradeForm()}><Plus className="size-4" /> Log a trade</Button>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="AI Insights & Signals"
        description={`Read from ${closedCount} closed trades. Every claim points at a number you can check in the table.`}
      />

      {signals.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2.5 text-sm font-semibold text-fg">Live signals</h2>
          <div className="grid grid-cols-2 gap-3 2xl:grid-cols-3">
            {signals.map((s) => {
              const style = TONE_STYLES[s.tone];
              const Icon = style.icon;
              return (
                <div key={s.id} className={cn('flex gap-3 rounded-xl border px-4 py-3.5', style.ring)}>
                  <Icon className={cn('mt-0.5 size-4 shrink-0', style.text)} />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-fg">{s.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{s.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-fg">What your journal says</h2>
        <div className="grid grid-cols-2 gap-3">
          {insights.map((insight) => {
            const style = TONE_STYLES[insight.tone];
            const Icon = style.icon;
            return (
              <article key={insight.id} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex items-center gap-2">
                  <Icon className={cn('size-4 shrink-0', style.text)} />
                  <span className="rounded border border-line px-1.5 py-0.5 text-[11px] font-medium text-muted">{insight.category}</span>
                  {insight.metric && <span className="num ml-auto text-xs text-faint">{insight.metric}</span>}
                </div>
                <h3 className="mt-3 text-[15px] font-semibold leading-snug text-fg">{insight.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{insight.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2.5 text-sm font-semibold text-fg">Where the money comes from</h2>
        <div className="grid grid-cols-2 gap-4 2xl:grid-cols-4">
          {breakdowns.map((b) => (
            <ChartContainer key={b.title} title={b.title} bodyClassName="px-2 pb-3 pt-2">
              <table className="w-full text-sm">
                <tbody>
                  {b.rows.map((row) => (
                    <tr key={row.key} className="border-b border-line last:border-0">
                      <td className="max-w-[120px] truncate px-2 py-2 text-fg">{row.label}</td>
                      <td className="num px-1 py-2 text-right text-xs text-faint">{row.trades}×</td>
                      <td className="num px-1 py-2 text-right text-xs text-muted">{formatPct(row.winRate, 0)}</td>
                      <td className={cn('num px-2 py-2 text-right font-medium', row.net > 0 ? 'text-profit' : row.net < 0 ? 'text-loss' : 'text-muted')}>
                        {formatMoney(row.net, currency, { sign: true, compact: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ChartContainer>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-accent" />
          <h2 className="text-sm font-semibold text-fg">Sniper Score breakdown</h2>
          {score.overall != null && <span className="num ml-auto text-sm font-semibold text-accent">{score.overall} / 100</span>}
        </div>
        <div className="mt-4 space-y-2.5">
          {score.axes.map((axis) => (
            <div key={axis.axis} className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
              <span className="truncate text-sm text-muted">{axis.axis}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${axis.rated ? axis.score : 0}%`, background: axis.rated ? 'var(--accent)' : 'var(--line-strong)' }}
                />
              </div>
              <span className={cn('num w-32 text-right text-xs', axis.rated ? 'text-fg' : 'text-faint')}>
                {axis.rated ? Math.round(axis.score) : 'not rated'}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-faint">
          {score.unrated.length > 0
            ? `${score.unrated.join(', ')} ${score.unrated.length === 1 ? 'is' : 'are'} not scored yet. Record a stop loss and rate your discipline, execution and patience when you log a trade.`
            : 'Every axis is scored from data you supplied.'}
        </p>
      </section>
    </>
  );
}
