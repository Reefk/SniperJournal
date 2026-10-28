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
  formatR,
  formatRatio,
  monthName,
  pctText,
  weekdayName,
  wholePct,
} from '@/lib/format';
import { decimalMark, isolate, tr } from '@/lib/i18n';
import {
  cleanMonths,
  MIN_MISTAKE_SIDE,
  mistakeList,
  mistakeName,
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
import { rich } from '@/components/ui/Rich';

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
      (k) => names.get(k) ?? tr('rep.unknownSetup'),
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
        <PageHeader title={tr('nav.reports')} description={tr('rep.description')} />
        <EmptyState icon={FileBarChart} title={tr('rep.empty.title')} description={tr('rep.empty.text')} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={tr('nav.reports')}
        description={tr('rep.closed', { label: activeLabel, count: stats.total })}
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
                toast(tr('list.exported', { count: inRange.length }));
              }}
            >
              <Download className="size-4" /> {tr('list.exportCsv')}
            </Button>
            {/* the phone's webview has no print dialog; the CSV export is the way out there */}
            {storage.device === 'pc' && (
              <Button onClick={() => window.print()}>
                <Printer className="size-4" /> {tr('rep.print')}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface px-5 py-4">
          <h3 className="mb-2 text-sm font-semibold text-fg">{tr('rep.results')}</h3>
          <Row
            label={tr('stat.netProfit')}
            value={formatMoney(stats.net, currency, { sign: true })}
            tone={stats.net > 0 ? 'profit' : stats.net < 0 ? 'loss' : undefined}
          />
          <Row label={tr('rep.grossProfit')} value={formatMoney(stats.grossProfit, currency)} />
          <Row label={tr('rep.grossLoss')} value={formatMoney(-stats.grossLoss, currency)} />
          <Row label={tr('stat.commissions')} value={formatMoney(stats.fees, currency)} />
          <Row label={tr('stat.profitFactor')} value={formatRatio(stats.profitFactor)} />
          <Row label={tr('rep.expectancy')} value={formatMoney(stats.expectancy, currency, { sign: true })} />
        </section>

        <section className="rounded-xl border border-line bg-surface px-5 py-4">
          <h3 className="mb-2 text-sm font-semibold text-fg">{tr('rep.consistency')}</h3>
          <Row label={tr('rep.trades')} value={String(stats.total)} />
          <Row label={tr('rep.winRate')} value={stats.total ? formatPct(stats.winRate) : '—'} />
          <Row
            label={tr('rep.greenDays')}
            value={
              stats.total
                ? tr('rep.greenDays.value', {
                    pct: pctText(wholePct(stats.greenDayRate)),
                    green: stats.greenDays,
                    days: stats.activeDays,
                  })
                : '—'
            }
            info={tr('rep.greenDays.info')}
          />
          <Row
            label={tr('rep.bestShare')}
            value={
              !stats.total
                ? '—'
                : stats.bestDayShare == null
                  ? tr('rep.bestShare.none')
                  : tr('rep.bestShare.value', { pct: pctText(wholePct(stats.bestDayShare)), count: stats.greenDays })
            }
            info={tr('rep.bestShare.info')}
          />
          <Row
            label={tr('rep.withoutBest')}
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
            info={tr('rep.withoutBest.info')}
          />
          <Row label={tr('rep.avgWin')} value={formatMoney(stats.avgWin, currency)} />
          <Row label={tr('rep.avgLoss')} value={formatMoney(-stats.avgLoss, currency)} />
          <Row label={tr('rep.winStreak')} value={String(stats.maxWinStreak)} />
          <Row label={tr('rep.lossStreak')} value={String(stats.maxLossStreak)} />
        </section>

        <section className="rounded-xl border border-line bg-surface px-5 py-4">
          <h3 className="mb-2 text-sm font-semibold text-fg">{tr('rep.risk')}</h3>
          <Row
            label={tr('stat.maxDrawdown')}
            value={formatMoney(-stats.maxDrawdown, currency)}
            tone={stats.maxDrawdown > 0 ? 'loss' : undefined}
          />
          <Row
            label={tr('rep.fromPeak')}
            value={stats.maxDrawdownPct != null ? formatPct(stats.maxDrawdownPct) : tr('rep.setBalance')}
          />
          <Row label={tr('rep.recovery')} value={formatRatio(stats.recoveryFactor)} info={tr('rep.recovery.info')} />
          <Row
            label={tr('stat.largestWin')}
            value={formatMoney(stats.largestWin, currency, { sign: true })}
            tone="profit"
          />
          <Row
            label={tr('stat.largestLoss')}
            value={formatMoney(stats.largestLoss, currency, { sign: true })}
            tone="loss"
          />
          <Row
            label={tr('rep.sqn')}
            value={stats.sqn == null ? '—' : `${isolate(decimalMark(stats.sqn.toFixed(2)))} · ${sqnLabel(stats.sqn)}`}
          />
          <Row label={tr('rep.hold')} value={formatDuration(stats.avgHoldMinutes)} />
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartContainer
          title={tr('rep.months')}
          bodyClassName="px-2 pb-3 pt-1"
          empty={months.length === 0}
          emptyText={tr('rep.months.empty')}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="px-3 py-2 text-start font-medium">{tr('rep.month')}</th>
                <th className="px-3 py-2 text-end font-medium">{tr('rep.trades')}</th>
                <th className="px-3 py-2 text-end font-medium">{tr('rep.winRate')}</th>
                <th className="px-3 py-2 text-end font-medium">{tr('rep.net')}</th>
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
            { title: tr('rep.bySymbol'), rows: bySymbol },
            { title: tr('rep.bySetup'), rows: bySetup },
            { title: tr('rep.byWeekday'), rows: byWeekday },
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
          {tr('rep.bestWorst', {
            best: formatDate(stats.bestDay.day),
            bestNet: formatMoney(stats.bestDay.net, currency, { sign: true }),
            worst: formatDate(stats.worstDay.day),
            worstNet: formatMoney(stats.worstDay.net, currency, { sign: true }),
          })}
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
            subtitle={tr('rep.tags.kind')}
            bodyClassName="px-2 pb-3 pt-1"
            empty={!g.rows.length}
            emptyText={tr('rep.tags.empty')}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="px-2 py-2 text-start font-medium md:px-3">{tr('rep.tags.tag')}</th>
                  <th className="px-2 py-2 text-end font-medium md:px-3">{tr('rep.trades')}</th>
                  <th className="px-2 py-2 text-end font-medium max-md:hidden md:px-3">{tr('rep.winRate')}</th>
                  <th className="px-2 py-2 text-end font-medium md:px-3">{tr('rep.net')}</th>
                  <th className="px-2 py-2 text-end font-medium md:px-3">{tr('pb.avgR')}</th>
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
                        {row.avgR == null ? '—' : formatR(row.avgR)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-3 pt-3 text-xs leading-relaxed text-faint">
              {tr('rep.tags.avgR')}
              {marks.has('few') && ` ${tr('rep.tags.few')}`}
              {marks.has('thin') && ` ${tr('rep.tags.thin')}`}
              {g.shared > 0 && ` ${tr('rep.tags.shared', { count: g.shared })}`}
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
const cleanShare = (m: CleanMonth) =>
  tr('rep.mis.clean', { pct: pctText(wholeShare(m.clean, m.trades)), clean: m.clean, count: m.trades });

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
    ? lastMonth
      ? tr('rep.mis.bothMonths', { share: cleanShare(thisMonth), last: cleanShare(lastMonth) })
      : tr('rep.mis.thisMonth', { share: cleanShare(thisMonth) })
    : lastMonth
      ? tr('rep.mis.lastMonth', { last: cleanShare(lastMonth) })
      : null;

  return (
    <ChartContainer
      title={tr('settings.mistakes')}
      subtitle={
        report.trades > 0 && from ? (
          <>
            {rich(
              tr(from === rangeStart ? 'rep.mis.cleanInRange' : 'rep.mis.cleanSince', {
                pct: pctText(wholeShare(cleanCount, report.trades)),
                clean: cleanCount,
                count: report.trades,
                date: formatDate(from),
              }),
              { num: (text) => <span className="num font-medium text-fg">{text}</span> },
            )}{' '}
            {month}
          </>
        ) : undefined
      }
      className="mt-4"
      bodyClassName="px-2 pb-3 pt-1"
      empty={!lines.length}
      emptyText={since ? tr('rep.mis.noneInRange') : tr('rep.mis.noneYet')}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="px-2 py-2 text-start font-medium md:px-3">{tr('rep.mis.mistake')}</th>
            <th className="px-2 py-2 text-end font-medium md:px-3">{tr('rep.mis.times')}</th>
            <th className="px-2 py-2 text-end font-medium max-md:hidden md:px-3">{tr('rep.winRate')}</th>
            <th className="px-2 py-2 text-end font-medium md:px-3">{tr('rep.net')}</th>
            <th className="px-2 py-2 text-end font-medium md:px-3">{tr('rep.mis.cost')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.mistake} className="border-t border-line">
              <td className="px-2 py-2 text-fg md:px-3">
                {mistakeName(line.mistake)}
                {!line.listed && <span className="text-xs text-faint">{tr('chips.notListed')}</span>}
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
                {line.cost == null ? '—' : isMoney(line.cost) ? formatMoney(line.cost, currency) : tr('rep.mis.noCost')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-1.5 px-3 pt-3 text-xs leading-relaxed text-faint">
        {withMistake && isMoney(gap) && isMoney(report.cost) && (
          <p className="text-muted">
            {rich(
              tr('rep.mis.gap', {
                count: withMistake.trades,
                gap: formatMoney(gap, currency),
                cost: formatMoney(report.cost, currency),
              }),
              { loss: (text) => <span className="num font-semibold text-loss">{text}</span> },
            )}
          </p>
        )}
        <p>
          {clean
            ? tr('rep.mis.how', { avg: formatMoney(clean.avg, currency, { sign: true }), min: MIN_MISTAKE_SIDE })
            : tr('rep.mis.howNoClean', { min: MIN_MISTAKE_SIDE })}
          {since && <> {tr('rep.mis.before', { date: formatDate(since) })}</>}
        </p>
      </div>
    </ChartContainer>
  );
}
