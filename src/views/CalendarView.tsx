'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { aggregateDays, computeStats } from '@/lib/stats';
import { formatDate, formatMoney, formatMonthKey, formatPct, MONTHS_SHORT, WEEKDAYS } from '@/lib/format';
import { isClosed, netPnl, tradeDay } from '@/lib/trade-math';
import { cn, dateKey, pad2 } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { MetricCard, toneFor } from '@/components/ui/MetricCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PnlValue, SideBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';

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
        title="Performance Calendar"
        description={`${activeLabel} · click any day to see the trades behind the number`}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
              <Button size="icon" variant="ghost" onClick={() => move(-1)} aria-label="Previous month">
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[150px] px-2 text-center text-sm font-medium text-fg">
                {formatMonthKey(cursor.year, cursor.month)}
              </span>
              <Button size="icon" variant="ghost" onClick={() => move(1)} aria-label="Next month">
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}>Today</Button>
            <Button variant="primary" onClick={() => openTradeForm()}>
              <Plus className="size-4" /> Log trade
            </Button>
          </>
        }
      />

      {accountTrades.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Your trading calendar is empty"
          description="Once you log trades, each day fills in with its net profit or loss and the number of trades you took, so streaks and problem days become obvious at a glance."
          actions={
            <Button variant="primary" onClick={() => openTradeForm()}>
              <Plus className="size-4" /> Log a trade
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              label="Monthly net P&L"
              value={formatMoney(stats.net, currency, { sign: true })}
              tone={toneFor(stats.net)}
            />
            <MetricCard
              label="Total trades"
              value={stats.total}
              sub={stats.open > 0 ? `${stats.open} still open` : undefined}
            />
            <MetricCard
              label="Active days"
              value={stats.activeDays}
              sub={`${stats.days.filter((d) => d.net > 0).length} green, ${stats.days.filter((d) => d.net < 0).length} red`}
            />
            <MetricCard
              label="Win rate this month"
              value={stats.total ? formatPct(stats.winRate) : '—'}
              sub={stats.total ? `${stats.wins}W · ${stats.losses}L` : 'no closed trades yet'}
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
            <div className="grid grid-cols-7 border-b border-line bg-app/40">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-3 py-2.5 text-center text-xs font-medium text-muted">
                  {d}
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
                      'relative flex h-[104px] flex-col items-center justify-center gap-1 border-b border-r border-line p-2 text-center transition',
                      i % 7 === 6 && 'border-r-0',
                      i >= cells.length - 7 && 'border-b-0',
                      !cell.inMonth && 'bg-app/40',
                      hasTrades ? 'cursor-pointer hover:bg-raised' : 'cursor-default',
                      hasTrades && agg && agg.net > 0 && 'bg-profit/[0.07]',
                      hasTrades && agg && agg.net < 0 && 'bg-loss/[0.07]',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute left-2.5 top-2 text-xs',
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
                        <span
                          className={cn(
                            'num text-[17px] font-semibold',
                            agg.net > 0 ? 'text-profit' : agg.net < 0 ? 'text-loss' : 'text-muted',
                          )}
                        >
                          {formatMoney(agg.net, currency, { sign: true, compact: Math.abs(agg.net) >= 10000 })}
                        </span>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-faint">
                          {agg.trades} {agg.trades === 1 ? 'trade' : 'trades'}
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
              <span>No trades in {formatMonthKey(cursor.year, cursor.month)}.</span>
              {monthsWithTrades.slice(0, 6).map((m) => {
                const [y, mo] = m.split('-').map(Number);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCursor({ year: y, month: mo - 1 })}
                    className="rounded border border-line px-2 py-0.5 text-xs text-fg transition hover:border-accent/60"
                  >
                    {MONTHS_SHORT[mo - 1]} {y}
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
            ? `${selectedTrades.length} ${selectedTrades.length === 1 ? 'trade' : 'trades'} · net ${formatMoney(
                selectedTrades.reduce((a, t) => a + netPnl(t), 0),
                currency,
                { sign: true },
              )}`
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
                className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition hover:bg-raised"
              >
                <span className="w-20 shrink-0 truncate font-semibold text-fg">{t.symbol}</span>
                <SideBadge side={t.side} />
                <span className="num flex-1 truncate text-xs text-faint">
                  {t.openedAt.slice(11, 16)}
                  {t.closedAt ? ` – ${t.closedAt.slice(11, 16)}` : ''}
                </span>
                {t.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded bg-raised px-1.5 py-0.5 text-[11px] text-muted ring-1 ring-line">
                    {tag}
                  </span>
                ))}
                <PnlValue value={netPnl(t)} open={!isClosed(t)} currency={currency} />
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
