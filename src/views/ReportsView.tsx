'use client';

import { useMemo, useState } from 'react';
import { Download, FileBarChart, Printer } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { computeStats, groupTrades, sqnLabel, thinMark } from '@/lib/stats';
import { groupTables, type GroupTable } from '@/lib/tags';
import { rangeOptions, splitByRange, type RangeKey } from '@/lib/ranges';
import { tradesToCsv } from '@/lib/csv';
import {
  formatDate,
  formatDuration,
  formatMoney,
  formatPct,
  formatRatio,
  monthName,
  weekdayName,
  wholePct,
} from '@/lib/format';
import {
  cleanMonths,
  MIN_MISTAKE_SIDE,
  mistakeList,
  mistakeReport,
  thisAndLastMonth,
  wholeShare,
  type CleanMonth,
  type MistakeReport,
} from '@/lib/mistakes';
import { netPnl, statTrades, tradeDay } from '@/lib/trade-math';
import { cn, dateKey, downloadFile, parseLocal } from '@/lib/utils';
import { storage } from '@/lib/storage';
import { openingBalance } from '@/store/selectors';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { InfoTip } from '@/components/ui/InfoTip';

export function ReportsView() {
  const { accountTrades, data, startingBalance, activeLabel } = useJournal();
  const { toast } = useUI();
  const [range, setRange] = useState<RangeKey>('ALL');
  const currency = data.settings.currency;

  const { inRange, before, start } = useMemo(() => splitByRange(accountTrades, range), [accountTrades, range]);
  // like the dashboard: the range starts from the balance it actually started at,
  // so its drawdown percentage matches the dashboard's for the same range
  const stats = useMemo(
    () => computeStats(inRange, openingBalance(startingBalance, before)),
    [inRange, before, startingBalance],
  );
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
    return groupTrades(
      closed,
      (t) => t.setupId,
      (k) => names.get(k) ?? 'Unknown',
    );
  }, [closed, data.setups]);
  const byWeekday = useMemo(
    () =>
      groupTrades(
        closed,
        (t) => String(parseLocal(t.openedAt).getDay()),
        (k) => weekdayName((Number(k) + 6) % 7),
      ),
    [closed],
  );

  // from every trade of the account, so the day mistakes started being logged is known whatever the range
  const mistakes = useMemo(
    () => mistakeReport(accountTrades, mistakeList(data.settings), start),
    [accountTrades, data.settings, start],
  );
  const cleanByMonth = useMemo(() => thisAndLastMonth(cleanMonths(accountTrades)), [accountTrades]);
  const byGroup = useMemo(
    () => groupTables(inRange, data.settings.tagGroups ?? []),
    [inRange, data.settings.tagGroups],
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

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${activeLabel} · ${stats.total} closed ${stats.total === 1 ? 'trade' : 'trades'}`}
        actions={
          <>
            <SegmentedControl value={range} onChange={setRange} options={rangeOptions()} />
            <Button
              onClick={() => {
                downloadFile(
                  `sniper-journal-trades-${dateKey(new Date())}.csv`,
                  tradesToCsv(inRange, data.setups, data.accounts),
                  'text/csv',
                );
                toast(`Exported ${inRange.length} ${inRange.length === 1 ? 'trade' : 'trades'}`);
              }}
            >
              <Download className="size-4" /> Export CSV
            </Button>
            {/* the phone's webview has no print dialog; the CSV export is the way out there */}
            {storage.device === 'pc' && (
              <Button onClick={() => window.print()}>
                <Printer className="size-4" /> Print
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface px-5 py-4">
          <h3 className="mb-2 text-sm font-semibold text-fg">Results</h3>
          <Row
            label="Net profit"
            value={formatMoney(stats.net, currency, { sign: true })}
            tone={stats.net > 0 ? 'profit' : stats.net < 0 ? 'loss' : undefined}
          />
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
          <Row
            label="Green days"
            value={stats.total ? `${wholePct(stats.greenDayRate)}% (${stats.greenDays} of ${stats.activeDays})` : '—'}
            info="The share of your trading days that ended above zero, after fees. A day counts once, however many trades it had."
          />
          <Row
            label="Best day's share"
            value={
              !stats.total
                ? '—'
                : stats.bestDayShare == null
                  ? 'no green day'
                  : `${wholePct(stats.bestDayShare)}% of ${stats.greenDays} green ${stats.greenDays === 1 ? 'day' : 'days'}`
            }
            info="Your best day's profit as a share of every green day's profit added up. High means one lucky day carries the record; low means the profit is spread over many days."
          />
          <Row
            label="Net without the best day"
            value={
              stats.netWithoutBestDay == null ? '—' : formatMoney(stats.netWithoutBestDay, currency, { sign: true })
            }
            tone={
              stats.netWithoutBestDay == null || stats.netWithoutBestDay === 0
                ? undefined
                : stats.netWithoutBestDay > 0
                  ? 'profit'
                  : 'loss'
            }
            info="Your net profit with your best day taken out. Red here means that one day is carrying the record."
          />
          <Row label="Average win" value={formatMoney(stats.avgWin, currency)} />
          <Row label="Average loss" value={formatMoney(-stats.avgLoss, currency)} />
          <Row label="Longest win streak" value={String(stats.maxWinStreak)} />
          <Row label="Longest loss streak" value={String(stats.maxLossStreak)} />
        </section>

        <section className="rounded-xl border border-line bg-surface px-5 py-4">
          <h3 className="mb-2 text-sm font-semibold text-fg">Risk</h3>
          <Row
            label="Max drawdown"
            value={formatMoney(-stats.maxDrawdown, currency)}
            tone={stats.maxDrawdown > 0 ? 'loss' : undefined}
          />
          <Row
            label="Drawdown from peak"
            value={stats.maxDrawdownPct != null ? formatPct(stats.maxDrawdownPct) : 'set a starting balance'}
          />
          <Row
            label="Recovery factor"
            value={formatRatio(stats.recoveryFactor)}
            info="Net profit divided by the max drawdown: how many times over the profit covers the deepest fall. Under 1, it is less than you once gave back; ∞ means no fall yet."
          />
          <Row label="Largest win" value={formatMoney(stats.largestWin, currency, { sign: true })} tone="profit" />
          <Row label="Largest loss" value={formatMoney(stats.largestLoss, currency, { sign: true })} tone="loss" />
          <Row
            label="System quality (SQN)"
            value={stats.sqn == null ? '—' : `${stats.sqn.toFixed(2)} · ${sqnLabel(stats.sqn)}`}
          />
          <Row label="Average hold time" value={formatDuration(stats.avgHoldMinutes)} />
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartContainer
          title="Month by month"
          bodyClassName="px-2 pb-3 pt-1"
          empty={months.length === 0}
          emptyText="No closed trades in this range."
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="px-3 py-2 text-start font-medium">Month</th>
                <th className="px-3 py-2 text-end font-medium">Trades</th>
                <th className="px-3 py-2 text-end font-medium">Win rate</th>
                <th className="px-3 py-2 text-end font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {months.map(([key, agg]) => {
                const [y, m] = key.split('-').map(Number);
                return (
                  <tr key={key} className="border-t border-line">
                    <td className="px-3 py-2 text-fg">
                      {monthName(m - 1, 'short')} {y}
                    </td>
                    <td className="num px-3 py-2 text-end text-muted">{agg.trades}</td>
                    <td className="num px-3 py-2 text-end text-muted">{formatPct((agg.wins / agg.trades) * 100, 0)}</td>
                    <td
                      className={cn(
                        'num px-3 py-2 text-end font-medium',
                        agg.net > 0 ? 'text-profit' : agg.net < 0 ? 'text-loss' : 'text-muted',
                      )}
                    >
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
          ]
            .filter((b) => b.rows.length > 0)
            .map((b) => (
              <ChartContainer key={b.title} title={b.title} bodyClassName="px-2 pb-3 pt-1">
                <table className="w-full text-sm">
                  <tbody>
                    {b.rows.slice(0, 6).map((row) => (
                      <tr key={row.key} className="border-b border-line last:border-0">
                        <td dir="auto" className="max-w-[130px] truncate px-3 py-2 text-fg md:max-w-[160px]">
                          {row.label}
                        </td>
                        <td className="num px-2 py-2 text-end text-xs text-faint">{row.trades}×</td>
                        <td className="num px-2 py-2 text-end text-xs text-muted">{formatPct(row.winRate, 0)}</td>
                        <td
                          className={cn(
                            'num px-3 py-2 text-end font-medium',
                            row.net > 0 ? 'text-profit' : row.net < 0 ? 'text-loss' : 'text-muted',
                          )}
                        >
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

      <TagGroupTables tables={byGroup} currency={currency} />

      <MistakesReport report={mistakes} rangeStart={start} months={cleanByMonth} currency={currency} />

      {stats.bestDay && stats.worstDay && (
        <p className="mt-4 text-xs text-faint">
          Best day {formatDate(stats.bestDay.day)} at {formatMoney(stats.bestDay.net, currency, { sign: true })}; worst
          day {formatDate(stats.worstDay.day)} at {formatMoney(stats.worstDay.net, currency, { sign: true })}.
        </p>
      )}
    </>
  );
}

/** a line of the Results, Consistency and Risk cards */
function Row({ label, value, tone, info }: { label: string; value: string; tone?: 'profit' | 'loss'; info?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-sm text-muted">
        {label}
        {/* held to the last word, so a label on two lines ends with it */}
        {info && (
          <span className="whitespace-nowrap">
            {' '}
            <InfoTip text={info} />
          </span>
        )}
      </span>
      <span
        className={cn(
          'num text-end text-sm font-medium',
          tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : 'text-fg',
        )}
      >
        {value}
      </span>
    </div>
  );
}

const tone = (v: number) => (v > 0 ? 'text-profit' : v < 0 ? 'text-loss' : 'text-muted');

/** Reports → a table for each tag group (Settings → Tags), with each of its tags */
function TagGroupTables({ tables, currency }: { tables: GroupTable[]; currency: string }) {
  if (!tables.length) return null;
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      {tables.map((g) => {
        const marks = new Set(g.rows.map((row) => thinMark(row.trades)));
        return (
          <ChartContainer
            key={g.name}
            title={g.name}
            subtitle="Tag group"
            bodyClassName="px-2 pb-3 pt-1"
            empty={!g.rows.length}
            emptyText="No trade in this range has its tags."
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="px-2 py-2 text-start font-medium md:px-3">Tag</th>
                  <th className="px-2 py-2 text-end font-medium md:px-3">Trades</th>
                  <th className="px-2 py-2 text-end font-medium max-md:hidden md:px-3">Win rate</th>
                  <th className="px-2 py-2 text-end font-medium md:px-3">Net</th>
                  <th className="px-2 py-2 text-end font-medium md:px-3">Avg R</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((row) => {
                  const mark = thinMark(row.trades);
                  const few = mark === 'few';
                  return (
                    <tr key={row.tag} className="border-t border-line" data-mark={mark ?? undefined}>
                      <td
                        dir="auto"
                        className={cn(
                          'max-w-[140px] truncate whitespace-pre px-2 py-2 md:px-3',
                          few ? 'text-faint' : 'text-fg',
                        )}
                      >
                        {row.tag}
                      </td>
                      <td className="num px-2 py-2 text-end md:px-3">
                        <span
                          className={cn(
                            few ? 'text-faint' : 'text-muted',
                            mark === 'thin' && 'underline decoration-dotted underline-offset-4',
                          )}
                        >
                          {row.trades}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'num px-2 py-2 text-end max-md:hidden md:px-3',
                          few ? 'text-faint' : 'text-muted',
                        )}
                      >
                        {formatPct(row.winRate, 0)}
                      </td>
                      <td
                        className={cn('num px-2 py-2 text-end font-medium md:px-3', few ? 'text-faint' : tone(row.net))}
                      >
                        {formatMoney(row.net, currency, { sign: true, compact: true })}
                      </td>
                      <td className={cn('num px-2 py-2 text-end md:px-3', few ? 'text-faint' : 'text-muted')}>
                        {row.avgR == null ? '—' : `${row.avgR >= 0 ? '+' : ''}${row.avgR.toFixed(2)}R`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-3 pt-3 text-xs leading-relaxed text-faint">
              Average R is over the trades with a stop.
              {marks.has('few') && ' Greyed: under 3 trades.'}
              {marks.has('thin') && ' Dotted: under 10, too few to go by yet.'}
              {g.shared > 0 &&
                ` ${g.shared} ${g.shared === 1 ? 'trade has' : 'trades have'} two of these tags and count${g.shared === 1 ? 's' : ''} in each row.`}
            </p>
          </ChartContainer>
        );
      })}
    </div>
  );
}
/** half a cent: less than that is what is left over from adding up cents, not money */
const isMoney = (v: number | null | undefined): v is number => v != null && v >= 0.005;

/** "58% clean (7 of 12)" */
const cleanShare = (m: CleanMonth) => `${wholeShare(m.clean, m.trades)}% clean (${m.clean} of ${m.trades})`;

/** What each mistake cost: how much less its trades made than the clean ones, with no mistake */
function MistakesReport({
  report,
  rangeStart,
  months: { thisMonth, lastMonth },
  currency,
}: {
  report: MistakeReport;
  /** the first day of the range shown, or null for all of it */
  rangeStart: string | null;
  months: { thisMonth: CleanMonth | null; lastMonth: CleanMonth | null };
  currency: string;
}) {
  const { clean, withMistake, lines, since, from } = report;
  const cleanCount = clean?.trades ?? 0;
  // per trade, so it never reads "$0.00 a trade less"
  const gap = clean && withMistake && report.cost != null ? clean.avg - withMistake.avg : null;
  const month = thisMonth
    ? `This month ${cleanShare(thisMonth)}${lastMonth ? `, last month ${cleanShare(lastMonth)}` : ''}.`
    : lastMonth
      ? `No trade closed this month yet; last month ${cleanShare(lastMonth)}.`
      : null;

  return (
    <ChartContainer
      title="Mistakes"
      subtitle={
        report.trades > 0 && from ? (
          <>
            Clean trades, with no mistake:{' '}
            <span className="num font-medium text-fg">{wholeShare(cleanCount, report.trades)}%</span> ({cleanCount} of{' '}
            {report.trades}) {from === rangeStart ? 'in this range' : `since ${formatDate(from)}`}. {month}
          </>
        ) : undefined
      }
      className="mt-4"
      bodyClassName="px-2 pb-3 pt-1"
      empty={!lines.length}
      emptyText={
        since
          ? 'No trade in this range made a mistake.'
          : 'No mistakes logged yet. Tap the ones a trade made in its form, under Mistakes, and this works out what each one costs you.'
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="px-2 py-2 text-start font-medium md:px-3">Mistake</th>
            <th className="px-2 py-2 text-end font-medium md:px-3">Times</th>
            <th className="px-2 py-2 text-end font-medium max-md:hidden md:px-3">Win rate</th>
            <th className="px-2 py-2 text-end font-medium md:px-3">Net</th>
            <th className="px-2 py-2 text-end font-medium md:px-3">Cost</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.mistake} className="border-t border-line">
              <td className="px-2 py-2 text-fg md:px-3">
                {line.mistake}
                {!line.listed && <span className="text-xs text-faint"> (not on your list)</span>}
              </td>
              <td className="num px-2 py-2 text-end text-muted md:px-3">{line.trades}</td>
              <td className="num px-2 py-2 text-end text-muted max-md:hidden md:px-3">{formatPct(line.winRate, 0)}</td>
              <td className={cn('num px-2 py-2 text-end md:px-3', tone(line.net))}>
                {formatMoney(line.net, currency, { sign: true, compact: true })}
              </td>
              <td
                className={cn(
                  'num px-2 py-2 text-end font-medium md:px-3',
                  isMoney(line.cost) ? 'text-loss' : 'text-faint',
                )}
              >
                {line.cost == null ? '—' : isMoney(line.cost) ? formatMoney(line.cost, currency) : 'none so far'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-1.5 px-3 pt-3 text-xs leading-relaxed text-faint">
        {withMistake && isMoney(gap) && isMoney(report.cost) && (
          <p className="text-muted">
            The {withMistake.trades} trades with a mistake made {formatMoney(gap, currency)} a trade less than the clean
            ones: about <span className="num font-semibold text-loss">{formatMoney(report.cost, currency)}</span> in
            all.
          </p>
        )}
        <p>
          A mistake&apos;s cost is what its trades would have made more at the average of the clean trades
          {clean ? ` (${formatMoney(clean.avg, currency, { sign: true })})` : ''}, so a trade that won despite it counts
          too. It shows once a mistake was made {MIN_MISTAKE_SIDE} times and {MIN_MISTAKE_SIDE} trades were clean. A
          trade with two mistakes counts for both.
          {since && <> Trades from before {formatDate(since)}, the first day a trade has a mistake, are not counted.</>}
        </p>
      </div>
    </ChartContainer>
  );
}
