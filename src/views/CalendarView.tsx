'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { aggregateDays, computeStats } from '@/lib/stats';
import {
  formatDate,
  formatMoney,
  formatMonthKey,
  formatPct,
  monthName,
  numberAndUnit,
  weekdayName,
} from '@/lib/format';
import { isClosed, netPnl, tradeDay } from '@/lib/trade-math';
import { cn, dateKey, pad2 } from '@/lib/utils';
import { realised } from '@/store/selectors';
import { tr } from '@/lib/i18n';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { MetricCard, toneFor } from '@/components/ui/MetricCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FitText } from '@/components/ui/FitText';
import { PnlValue, SideBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { rich } from '@/components/ui/Rich';

/** Monday-first grid cells, including the padding days from adjacent months */
function monthGrid(year: number, month: number): Array<{ key: string; inMonth: boolean; day: number }> {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // shift Sunday to the end
  const cells: Array<{ key: string; inMonth: boolean; day: number }> = [];
  const start = new Date(year, month, 1 - offset);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ key: dateKey(d), inMonth: d.getMonth() === month, day: d.getDate() });
  }
  // trim a trailing week that belongs entirely to the next month
  return cells.slice(0, cells.slice(35).every((c) => !c.inMonth) ? 35 : 42);
}

/** a short amount, with a unit the language writes after the number ("тыс. $") on a line of its own */
function ShortAmount({ text }: { text: string }) {
  const parts = numberAndUnit(text);
  if (!parts) return text;
  return (
    <>
      {parts[0]}
      <br />
      {parts[1]}
    </>
  );
}

export function CalendarView() {
  const { accountTrades, data, activeLabel } = useJournal();
  const { openTradeForm } = useUI();
  const currency = data.settings.currency;
  const today = new Date();

  // open on the current month, unless it is empty and there are trades elsewhere
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    const hasThisMonth = accountTrades.some((t) => tradeDay(t).startsWith(thisMonth));
    if (hasThisMonth || accountTrades.length === 0) return { year: now.getFullYear(), month: now.getMonth() };
    const latest = accountTrades.map(tradeDay).sort().at(-1) as string;
    const [y, m] = latest.split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const monthPrefix = `${cursor.year}-${pad2(cursor.month + 1)}`;
  const monthTrades = useMemo(
    () => accountTrades.filter((t) => tradeDay(t).startsWith(monthPrefix)),
    [accountTrades, monthPrefix],
  );
  const stats = useMemo(() => computeStats(monthTrades), [monthTrades]);
  const dayMap = useMemo(() => new Map(aggregateDays(monthTrades).map((d) => [d.day, d])), [monthTrades]);
  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  const tradesByDay = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of accountTrades) {
      const day = tradeDay(t);
      map.set(day, [...(map.get(day) ?? []), t]);
    }
    return map;
  }, [accountTrades]);

  const move = (delta: number) => {
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  // months that actually contain trades, for quick jumping
  const monthsWithTrades = useMemo(() => {
    const set = new Set(accountTrades.map((t) => tradeDay(t).slice(0, 7)));
    return [...set].sort().reverse();
  }, [accountTrades]);

  const selectedTrades = selectedDay ? (tradesByDay.get(selectedDay) ?? []) : [];
  const todayKey = dateKey(today);

  return (
    <>
      <PageHeader
        title={tr('cal.title')}
        description={
          <>
            {activeLabel} ·{' '}
            {rich(tr('cal.hint'), {
              phone: (text) => <span className="md:hidden">{text}</span>,
              pc: (text) => <span className="max-md:hidden">{text}</span>,
            })}
          </>
        }
        actions={
          <>
            <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5 max-md:flex-1">
              <Button size="icon" variant="ghost" onClick={() => move(-1)} aria-label={tr('cal.previous')}>
                <ChevronLeft className="size-4 rtl:-scale-x-100" />
              </Button>
              <span className="min-w-[150px] px-2 text-center text-sm font-medium text-fg max-md:min-w-0 max-md:flex-1">
                {formatMonthKey(cursor.year, cursor.month)}
              </span>
              <Button size="icon" variant="ghost" onClick={() => move(1)} aria-label={tr('cal.next')}>
                <ChevronRight className="size-4 rtl:-scale-x-100" />
              </Button>
            </div>
            <Button onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}>
              {tr('cal.today')}
            </Button>
            <Button variant="primary" className="max-md:hidden" onClick={() => openTradeForm()}>
              <Plus className="size-4" /> {tr('header.logTrade')}
            </Button>
          </>
        }
      />

      {accountTrades.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={tr('cal.empty.title')}
          description={tr('cal.empty.text')}
          actions={
            <Button variant="primary" onClick={() => openTradeForm()}>
              <Plus className="size-4" /> {tr('header.logTradeLabel')}
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <MetricCard
              label={tr('cal.net')}
              value={formatMoney(stats.net, currency, { sign: true })}
              tone={toneFor(stats.net)}
            />
            <MetricCard
              label={tr('stat.totalTrades')}
              value={stats.total}
              sub={stats.open > 0 ? tr('cal.stillOpen', { count: stats.open }) : undefined}
            />
            <MetricCard
              label={tr('cal.activeDays')}
              value={stats.activeDays}
              sub={tr('cal.greenRed', {
                count: stats.days.filter((d) => d.net > 0).length,
                red: stats.days.filter((d) => d.net < 0).length,
              })}
            />
            <MetricCard
              label={tr('cal.winRate')}
              value={stats.total ? formatPct(stats.winRate) : '—'}
              sub={
                stats.total
                  ? `${tr('stat.wins', { n: stats.wins })} · ${tr('stat.losses', { n: stats.losses })}`
                  : tr('cal.noneClosed')
              }
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
            <div className="grid grid-cols-7 border-b border-line bg-app/40">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="py-2 text-center text-[11px] font-medium text-muted md:px-3 md:py-2.5 md:text-xs"
                >
                  {weekdayName(i)}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((cell, i) => {
                const agg = dayMap.get(cell.key);
                const hasTrades = Boolean(agg) && cell.inMonth;
                const isToday = cell.key === todayKey;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    disabled={!hasTrades}
                    onClick={() => setSelectedDay(cell.key)}
                    className={cn(
                      'relative flex h-16 flex-col items-center justify-end gap-1 border-b border-e border-line px-0.5 pb-2 text-center transition md:h-[104px] md:justify-center md:p-2',
                      i % 7 === 6 && 'border-e-0',
                      i >= cells.length - 7 && 'border-b-0',
                      !cell.inMonth && 'bg-app/40',
                      hasTrades ? 'cursor-pointer hover:bg-raised' : 'cursor-default',
                      hasTrades && agg && agg.net > 0 && 'bg-profit/[0.07]',
                      hasTrades && agg && agg.net < 0 && 'bg-loss/[0.07]',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute start-1.5 top-1 text-[11px] md:start-2.5 md:top-2 md:text-xs',
                        isToday
                          ? 'grid size-5 place-items-center rounded-full bg-accent-strong font-semibold text-white'
                          : cell.inMonth
                            ? 'text-muted'
                            : 'text-faint/60',
                      )}
                    >
                      {cell.day}
                    </span>
                    {hasTrades && agg && (
                      <>
                        {/* a smaller figure rather than a cut one: "+$740.31" is 47 px in a 360 px
                            phone's 42 px cell, "+1624,91 US$" wider than a cell of the narrowest
                            desktop (1180 px) */}
                        <FitText
                          className={cn(
                            'num max-w-full text-[10px] font-semibold md:text-[17px]',
                            agg.net > 0 ? 'text-profit' : agg.net < 0 ? 'text-loss' : 'text-muted',
                          )}
                        >
                          {/* a phone cell is a seventh of the screen: always the short form there */}
                          <span className="md:hidden">
                            <ShortAmount text={formatMoney(agg.net, currency, { sign: true, compact: true })} />
                          </span>
                          <span className="max-md:hidden">
                            {formatMoney(agg.net, currency, { sign: true, compact: Math.abs(agg.net) >= 10000 })}
                          </span>
                        </FitText>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-faint max-md:hidden">
                          {tr('common.trades', { count: agg.trades })}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {monthTrades.length === 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>{tr('cal.noneIn', { month: formatMonthKey(cursor.year, cursor.month) })}</span>
              {monthsWithTrades.slice(0, 6).map((m) => {
                const [y, mo] = m.split('-').map(Number);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCursor({ year: y, month: mo - 1 })}
                    className="rounded border border-line px-2 py-0.5 text-xs text-fg transition hover:border-accent/60"
                  >
                    {monthName(mo - 1, 'short')} {y}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal
        open={Boolean(selectedDay)}
        onClose={() => setSelectedDay(null)}
        size="lg"
        title={selectedDay ? formatDate(selectedDay) : ''}
        description={
          selectedDay
            ? // the same trades the day cell counted, so the two totals agree
              tr('cal.dayNet', {
                count: selectedTrades.length,
                net: formatMoney(realised(selectedTrades), currency, { sign: true }),
              })
            : undefined
        }
      >
        <ul className="divide-y divide-line">
          {selectedTrades.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedDay(null);
                  openTradeForm({ trade: t });
                }}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-start transition hover:bg-raised"
              >
                <span dir="auto" className="w-20 shrink-0 truncate font-semibold text-fg">
                  {t.symbol}
                </span>
                <SideBadge side={t.side} />
                {/* in a narrow row the times take two lines, "09:59 –" over "11:22", not "09:59 –…";
                    they keep at least the room of "09:59" (the dash may reach into the gap), so a
                    longer amount ("-245,59 US$") takes two lines first */}
                <span className="num min-w-[5ch] flex-1 text-xs text-faint">
                  {t.openedAt.slice(11, 16)}
                  {t.closedAt ? `\u00a0– ${t.closedAt.slice(11, 16)}` : ''}
                </span>
                {t.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-raised px-1.5 py-0.5 text-[11px] text-muted ring-1 ring-line max-md:hidden"
                  >
                    {tag}
                  </span>
                ))}
                <PnlValue value={netPnl(t)} open={!isClosed(t)} currency={currency} className="text-end" breakable />
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
