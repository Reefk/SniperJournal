'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FlaskConical,
  ImageIcon,
  Merge,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  SquarePen,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import type { Trade } from '@/lib/types';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { computeStats } from '@/lib/stats';
import { SESSIONS } from '@/lib/sessions';
import { tradesToCsv } from '@/lib/csv';
import { formatDate, formatMoney, formatNumber, formatPct, formatPrice, formatTime } from '@/lib/format';
import { isClosed, isIncomplete, matchesSearch, missingDetails, netPnl, outcome, rMultiple } from '@/lib/trade-math';
import { cn, dateKey, downloadFile } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Select, inputClass } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PnlValue, SideBadge, StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { mergeIssue, mergeTrades as previewMerge } from '@/lib/merge';
import { ImportTradesModal } from '@/components/trades/ImportTradesModal';
import { BulkDetailsModal } from '@/components/trades/BulkDetailsModal';

interface Filters {
  q: string;
  symbol: string;
  session: string;
  leverage: string;
  setup: string;
  from: string;
  to: string;
  side: 'ALL' | 'LONG' | 'SHORT';
  result: 'ALL' | 'WIN' | 'LOSS' | 'OPEN' | 'NEEDS';
}

const EMPTY: Filters = {
  q: '',
  symbol: '',
  session: '',
  leverage: '',
  setup: '',
  from: '',
  to: '',
  side: 'ALL',
  result: 'ALL',
};
type SortKey = 'date' | 'symbol' | 'qty' | 'pnl';
const PAGE_SIZE = 50;

export function TradesView() {
  const { accountTrades, data, actions, activeLabel } = useJournal();
  const { openTradeForm, confirm, toast, globalSearch, setGlobalSearch } = useUI();
  const currency = data.settings.currency;

  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // a search submitted from the header lands here
  useEffect(() => {
    if (!globalSearch) return;
    setFilters((f) => ({ ...f, q: globalSearch }));
    setPage(1);
    setGlobalSearch('');
  }, [globalSearch, setGlobalSearch]);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const setupNames = useMemo(() => new Map(data.setups.map((s) => [s.id, s.name])), [data.setups]);
  const symbols = useMemo(() => [...new Set(accountTrades.map((t) => t.symbol))].sort(), [accountTrades]);
  const sessions = useMemo(
    () => [...new Set([...SESSIONS, ...accountTrades.map((t) => t.session).filter((s): s is string => Boolean(s))])],
    [accountTrades],
  );
  const leverages = useMemo(
    () =>
      [...new Set(accountTrades.map((t) => t.leverage).filter((l): l is number => l != null))].sort((a, b) => a - b),
    [accountTrades],
  );

  const filtered = useMemo(() => {
    const term = filters.q.trim().toLowerCase();
    return accountTrades.filter((t) => {
      if (term && !matchesSearch(t, term, setupNames)) return false;
      if (filters.symbol && t.symbol !== filters.symbol) return false;
      if (filters.session && t.session !== filters.session) return false;
      if (filters.leverage && String(t.leverage ?? '') !== filters.leverage) return false;
      if (filters.setup && t.setupId !== filters.setup) return false;
      const day = t.openedAt.slice(0, 10);
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;
      if (filters.side !== 'ALL' && t.side !== filters.side) return false;
      if (filters.result === 'NEEDS' && !isIncomplete(t)) return false;
      if (filters.result !== 'ALL' && filters.result !== 'NEEDS' && outcome(t) !== filters.result) return false;
      return true;
    });
  }, [accountTrades, filters, setupNames]);

  // A bulk action must only ever touch trades you can see. When the search,
  // a filter or the account changes, the selection keeps only the trades
  // still shown (on any page); before this, "Delete 3 trades" could delete
  // three that had been filtered out of view, even in another account.
  useEffect(() => {
    const shown = new Set(filtered.map((t) => t.id));
    setSelected((s) => {
      const kept = [...s].filter((id) => shown.has(id));
      return kept.length === s.size ? s : new Set(kept);
    });
  }, [filtered]);

  const sorted = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const value = (t: Trade): number | string => {
      if (sort.key === 'symbol') return t.symbol;
      if (sort.key === 'qty') return t.quantity;
      if (sort.key === 'pnl') return isClosed(t) ? netPnl(t) : Number.NEGATIVE_INFINITY;
      return t.openedAt;
    };
    return [...filtered].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const needsDetails = useMemo(() => accountTrades.filter(isIncomplete), [accountTrades]);
  const activeFilterCount = (Object.keys(EMPTY) as (keyof Filters)[]).filter((k) => filters[k] !== EMPTY[k]).length;

  const allOnPageSelected = rows.length > 0 && rows.every((t) => selected.has(t.id));
  const someSelected = rows.some((t) => selected.has(t.id));
  const headerCheckbox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckbox.current) headerCheckbox.current.indeterminate = someSelected && !allOnPageSelected;
  }, [someSelected, allOnPageSelected]);

  const mergeSelected = async () => {
    const legs = accountTrades.filter((t) => selected.has(t.id));
    const issue = mergeIssue(legs);
    if (issue) {
      toast(issue, 'error');
      return;
    }

    const preview = previewMerge(legs);
    const ok = await confirm({
      title: `Merge ${legs.length} parts into one trade?`,
      message: (
        <>
          These look like one position you scaled out of. Merging gives you a single{' '}
          <strong className="text-fg">
            {preview.symbol} {preview.side.toLowerCase()}
          </strong>{' '}
          of <strong className="text-fg">{formatNumber(preview.quantity, 4)}</strong>, entered around{' '}
          <span className="num">{formatPrice(preview.entryPrice)}</span>
          {preview.exitPrice != null && (
            <>
              {' '}
              and exited around <span className="num">{formatPrice(preview.exitPrice)}</span>
            </>
          )}
          , worth <strong className="text-fg">{formatMoney(netPnl(preview), currency, { sign: true })}</strong> — the
          same as the parts added together.
          <br />
          <br />
          <span className="text-faint">
            This cannot be undone, though re-importing the original CSV brings the separate parts back.
          </span>
        </>
      ),
      confirmLabel: `Merge into one trade`,
    });
    if (!ok) return;

    const failed = actions.mergeTrades([...selected]);
    if (failed) {
      toast(failed, 'error');
      return;
    }
    setSelected(new Set());
    toast(`${legs.length} parts merged into one trade`);
  };

  const deleteIds = async (ids: string[]) => {
    const ok = await confirm({
      title: ids.length === 1 ? 'Delete this trade?' : `Delete ${ids.length} trades?`,
      message: 'Deleted trades are removed from your journal and from every statistic. This cannot be undone.',
      confirmLabel: ids.length === 1 ? 'Delete trade' : `Delete ${ids.length} trades`,
      tone: 'danger',
    });
    if (!ok) return;
    actions.deleteTrades(ids);
    setSelected((s) => {
      const next = new Set(s);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    toast(ids.length === 1 ? 'Trade deleted' : `${ids.length} trades deleted`);
  };

  const header = (
    <PageHeader
      title="Trades"
      description={`${accountTrades.length} ${accountTrades.length === 1 ? 'trade' : 'trades'} in ${activeLabel}`}
      actions={
        <>
          <Button onClick={() => setImporting(true)}>
            <Upload className="size-4" /> Import CSV
          </Button>
          <Button
            disabled={!sorted.length}
            onClick={() => {
              downloadFile(
                `sniper-journal-trades-${dateKey(new Date())}.csv`,
                tradesToCsv(sorted, data.setups, data.accounts),
                'text/csv',
              );
              toast(`Exported ${sorted.length} trades`);
            }}
          >
            <Download className="size-4" /> Export CSV
          </Button>
          <Button variant="primary" className="max-md:hidden" onClick={() => openTradeForm()}>
            <Plus className="size-4" /> Log trade
          </Button>
        </>
      }
    />
  );

  if (accountTrades.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={ArrowLeftRight}
          title="No trades logged yet"
          description="Log each trade as you close it, or import a CSV from your broker. Every chart and statistic in Sniper Journal is built from these entries."
          actions={
            <>
              <Button variant="primary" onClick={() => openTradeForm()}>
                <Plus className="size-4" /> Log your first trade
              </Button>
              <Button onClick={() => setImporting(true)}>
                <Upload className="size-4" /> Import CSV
              </Button>
              <Button variant="ghost" onClick={() => actions.loadSampleData()}>
                <FlaskConical className="size-4" /> Load test data
              </Button>
            </>
          }
        />
        <ImportTradesModal open={importing} onClose={() => setImporting(false)} />
      </>
    );
  }

  const SortHeader = ({ label, k, align = 'left' }: { label: string; k: SortKey; align?: 'left' | 'right' }) => {
    const active = sort.key === k;
    const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th className={cn('px-3 py-3 font-medium', align === 'right' ? 'text-right' : 'text-left')}>
        <button
          type="button"
          onClick={() =>
            setSort((s) =>
              s.key === k
                ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' }
                : { key: k, dir: k === 'symbol' ? 'asc' : 'desc' },
            )
          }
          className={cn('inline-flex items-center gap-1 transition hover:text-fg', active && 'text-fg')}
        >
          {label}
          <Icon className={cn('size-3', !active && 'opacity-40')} />
        </button>
      </th>
    );
  };

  return (
    <>
      {header}

      {needsDetails.length > 0 && filters.result !== 'NEEDS' && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-2.5 text-sm">
          <TriangleAlert className="size-4 shrink-0 text-warn" />
          <span className="text-fg">
            <span className="num font-semibold">{needsDetails.length}</span>{' '}
            {needsDetails.length === 1 ? 'trade is' : 'trades are'} missing something.
            <span className="text-muted max-md:hidden"> They stay out of every statistic until you fill the gaps.</span>
          </span>
          <Button size="sm" className="ml-auto" onClick={() => update('result', 'NEEDS')}>
            Show them
          </Button>
        </div>
      )}

      {/* ---------- filters ---------- */}
      {/* on a phone everything but the search folds away behind one button */}
      <div className="mb-3 rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[55%] flex-1 md:w-64 md:min-w-0 md:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input
              value={filters.q}
              onChange={(e) => update('q', e.target.value)}
              placeholder="Search trades"
              className="pl-9"
              aria-label="Search trades"
            />
          </div>
          <Button className="md:hidden" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}>
            <SlidersHorizontal className="size-4" />
            Filters
            {activeFilterCount > 0 && <span className="num text-accent">{activeFilterCount}</span>}
          </Button>
          <Select
            className={cn('w-[calc(50%_-_0.25rem)] md:w-36', !showFilters && 'max-md:hidden')}
            value={filters.symbol}
            onChange={(e) => update('symbol', e.target.value)}
            aria-label="Pair"
          >
            <option value="">All pairs</option>
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            className={cn('w-[calc(50%_-_0.25rem)] md:w-40', !showFilters && 'max-md:hidden')}
            value={filters.session}
            onChange={(e) => update('session', e.target.value)}
            aria-label="Session"
          >
            <option value="">All sessions</option>
            {sessions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            className={cn('w-[calc(50%_-_0.25rem)] md:w-36', !showFilters && 'max-md:hidden')}
            value={filters.leverage}
            onChange={(e) => update('leverage', e.target.value)}
            aria-label="Leverage"
          >
            <option value="">All leverage</option>
            {leverages.map((l) => (
              <option key={l} value={String(l)}>
                {l}×
              </option>
            ))}
          </Select>
          {data.setups.length > 0 && (
            <Select
              className={cn('w-[calc(50%_-_0.25rem)] md:w-44', !showFilters && 'max-md:hidden')}
              value={filters.setup}
              onChange={(e) => update('setup', e.target.value)}
              aria-label="Setup"
            >
              <option value="">All setups</option>
              {data.setups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
          <div className={cn('flex items-center gap-1.5 max-md:w-full', !showFilters && 'max-md:hidden')}>
            {/* an empty date box on a phone shows nothing at all, so say what it is */}
            <span className="text-faint md:hidden">From</span>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => update('from', e.target.value)}
              className={cn(inputClass, 'num w-[150px] max-md:min-w-0 max-md:flex-1')}
              aria-label="From date"
            />
            <span className="text-faint">to</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => update('to', e.target.value)}
              className={cn(inputClass, 'num w-[150px] max-md:min-w-0 max-md:flex-1')}
              aria-label="To date"
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SegmentedControl
            className={cn(!showFilters && 'max-md:hidden')}
            value={filters.side}
            onChange={(v) => update('side', v)}
            options={[
              { value: 'ALL', label: 'All sides' },
              {
                value: 'LONG',
                label: (
                  <>
                    <ArrowUp className="size-3 text-profit" /> Long
                  </>
                ),
              },
              {
                value: 'SHORT',
                label: (
                  <>
                    <ArrowDown className="size-3 text-loss" /> Short
                  </>
                ),
              },
            ]}
          />
          <SegmentedControl
            className={cn('max-md:flex-wrap', !showFilters && 'max-md:hidden')}
            value={filters.result}
            onChange={(v) => update('result', v)}
            options={[
              { value: 'ALL', label: 'All results' },
              { value: 'WIN', label: 'Wins' },
              { value: 'LOSS', label: 'Losses' },
              { value: 'OPEN', label: 'Open' },
              ...(needsDetails.length
                ? [
                    {
                      value: 'NEEDS' as const,
                      label: (
                        <>
                          <TriangleAlert className="size-3 text-warn" /> Needs details
                        </>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters(EMPTY);
                setPage(1);
              }}
            >
              <RotateCcw className="size-3.5" /> Clear {activeFilterCount}{' '}
              {activeFilterCount === 1 ? 'filter' : 'filters'}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-5 pr-1 text-xs text-muted max-md:w-full max-md:justify-between max-md:pl-1">
            <span>
              <span className="num text-fg">{filtered.length}</span> shown
            </span>
            <span>
              Win rate <span className="num text-fg">{stats.total ? formatPct(stats.winRate) : '—'}</span>
            </span>
            <span className="flex items-center gap-1">
              Net <PnlValue value={stats.net} currency={currency} className="text-xs" />
            </span>
          </div>
        </div>
      </div>

      {/* ---------- bulk actions ---------- */}
      {selected.size > 0 && (
        <div className="animate-pop mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm md:flex-nowrap">
          <span className="text-fg">
            <span className="num font-semibold">{selected.size}</span> selected
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          <div className="ml-auto flex flex-wrap gap-2 max-md:w-full md:flex-nowrap">
            {selected.size > 1 && (
              <Button size="sm" onClick={mergeSelected}>
                <Merge className="size-3.5" /> Merge into one
              </Button>
            )}
            <Button size="sm" onClick={() => setBulkEditing(true)}>
              <SquarePen className="size-3.5" /> Add details
            </Button>
            <Button
              size="sm"
              onClick={() => {
                actions.setExcluded([...selected], true);
                toast('Excluded from statistics');
              }}
            >
              <EyeOff className="size-3.5" /> Exclude from stats
            </Button>
            <Button
              size="sm"
              onClick={() => {
                actions.setExcluded([...selected], false);
                toast('Included in statistics');
              }}
            >
              <Eye className="size-3.5" /> Include
            </Button>
            <Button size="sm" variant="danger" onClick={() => deleteIds([...selected])}>
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* ---------- table ---------- */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm text-fg">No trades match these filters.</p>
            <Button className="mt-3" size="sm" onClick={() => setFilters(EMPTY)}>
              <RotateCcw className="size-3.5" /> Clear filters
            </Button>
          </div>
        ) : (
          <>
          {/* phone: ten columns cannot fit, so each trade is a card */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((t) => {
              const r = rMultiple(t);
              const setupName = t.setupId ? setupNames.get(t.setupId) : undefined;
              const fills = t.fillCount ?? 1;
              return (
                <li key={t.id} className={cn('flex items-start gap-1 py-1 pl-1 pr-0.5', selected.has(t.id) && 'bg-accent/5')}>
                  <label className="grid size-11 shrink-0 cursor-pointer place-items-center">
                    <input
                      type="checkbox"
                      className="size-[18px] cursor-pointer"
                      checked={selected.has(t.id)}
                      aria-label={`Select ${t.symbol} trade`}
                      onChange={() =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (next.has(t.id)) next.delete(t.id);
                          else next.add(t.id);
                          return next;
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => openTradeForm({ trade: t })}
                    className={cn('min-w-0 flex-1 py-2.5 text-left', t.excluded && 'opacity-50')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-fg">{t.symbol}</span>
                      <SideBadge side={t.side} />
                      {(t.screenshotFile || t.screenshotUrl) && (
                        <ImageIcon className="size-3.5 shrink-0 text-faint" aria-label="Has a chart" />
                      )}
                      <span className="ml-auto shrink-0">
                        {isIncomplete(t) ? (
                          <StatusBadge tone="warn">needs details</StatusBadge>
                        ) : (
                          <PnlValue value={netPnl(t)} open={!isClosed(t)} currency={currency} />
                        )}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-faint">
                      <span className="shrink-0">{formatDate(t.openedAt)}</span>
                      <span className="num shrink-0">{formatTime(t.openedAt)}</span>
                      {setupName && <span className="truncate">· {setupName}</span>}
                      {r != null && !isIncomplete(t) && (
                        <span className="num ml-auto shrink-0">{`${r >= 0 ? '+' : ''}${r.toFixed(2)}R`}</span>
                      )}
                    </div>
                    {(t.tags.length > 0 || fills > 1) && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {fills > 1 && <span className="px-0.5 text-[11px] text-accent">{fills} fills</span>}
                        {t.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded bg-raised px-1.5 py-0.5 text-[11px] text-muted ring-1 ring-line">
                            {tag}
                          </span>
                        ))}
                        {t.tags.length > 3 && <span className="px-1 text-[11px] text-faint">+{t.tags.length - 3}</span>}
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.setExcluded([t.id], !t.excluded)}
                    aria-label={t.excluded ? 'Include in statistics' : 'Exclude from statistics'}
                    className={cn('grid size-11 shrink-0 place-items-center', t.excluded ? 'text-warn' : 'text-faint')}
                  >
                    {t.excluded ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="overflow-x-auto max-md:hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-app/50 text-xs text-muted">
                <tr>
                  <th className="w-[84px] px-4 py-3 text-left">
                    <input
                      ref={headerCheckbox}
                      type="checkbox"
                      className="size-4 cursor-pointer align-middle"
                      checked={allOnPageSelected}
                      aria-label="Select all on this page"
                      onChange={() =>
                        setSelected((s) => {
                          const next = new Set(s);
                          rows.forEach((t) => (allOnPageSelected ? next.delete(t.id) : next.add(t.id)));
                          return next;
                        })
                      }
                    />
                  </th>
                  <SortHeader label="Date & time" k="date" />
                  <SortHeader label="Pair / asset" k="symbol" />
                  <th className="px-3 py-3 text-left font-medium">Side</th>
                  <SortHeader label="Qty" k="qty" align="right" />
                  <th className="px-3 py-3 text-right font-medium">Entry</th>
                  <th className="px-3 py-3 text-right font-medium">Exit</th>
                  <SortHeader label="PNL" k="pnl" align="right" />
                  <th className="px-3 py-3 text-left font-medium">Tags</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((t) => {
                  const r = rMultiple(t);
                  const dim = t.excluded ? 'opacity-50' : '';
                  return (
                    <tr
                      key={t.id}
                      onClick={() => openTradeForm({ trade: t })}
                      className={cn(
                        'group cursor-pointer transition-colors hover:bg-raised/70',
                        selected.has(t.id) && 'bg-accent/5',
                      )}
                    >
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            className="size-4 cursor-pointer"
                            checked={selected.has(t.id)}
                            aria-label={`Select ${t.symbol} trade`}
                            onChange={() =>
                              setSelected((s) => {
                                const next = new Set(s);
                                if (next.has(t.id)) next.delete(t.id);
                                else next.add(t.id);
                                return next;
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => actions.setExcluded([t.id], !t.excluded)}
                            title={
                              t.excluded
                                ? 'Excluded from statistics. Click to include.'
                                : 'Included in statistics. Click to exclude.'
                            }
                            className={cn('transition hover:text-fg', t.excluded ? 'text-warn' : 'text-faint')}
                          >
                            {t.excluded ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </td>
                      <td className={cn('whitespace-nowrap px-3 py-2.5', dim)}>
                        <div className="text-fg">{formatDate(t.openedAt)}</div>
                        <div className="num text-xs text-faint">
                          {formatTime(t.openedAt)}
                          {t.closedAt && ` – ${formatTime(t.closedAt)}`}
                        </div>
                      </td>
                      <td className={cn('px-3 py-2.5', dim)}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-fg">{t.symbol}</span>
                          {(t.screenshotFile || t.screenshotUrl) && (
                            <ImageIcon className="size-3.5 shrink-0 text-faint" aria-label="Has a chart" />
                          )}
                          {isIncomplete(t) && <StatusBadge tone="warn">needs details</StatusBadge>}
                        </div>
                        <div className="flex max-w-[190px] items-center gap-1.5 truncate text-xs text-faint">
                          {(t.fillCount ?? 1) > 1 && <span className="text-accent">{t.fillCount} fills</span>}
                          {(t.fillCount ?? 1) > 1 && t.setupId && setupNames.get(t.setupId) && <span>·</span>}
                          {t.setupId && setupNames.get(t.setupId) && (
                            <span className="truncate">{setupNames.get(t.setupId)}</span>
                          )}
                        </div>
                      </td>
                      <td className={cn('px-3 py-2.5', dim)}>
                        <SideBadge side={t.side} />
                      </td>
                      <td className={cn('num px-3 py-2.5 text-right text-fg', dim)}>
                        {t.quantity > 0 ? formatNumber(t.quantity, 4) : '—'}
                      </td>
                      <td className={cn('num px-3 py-2.5 text-right text-muted', dim)}>
                        {t.entryPrice ? formatPrice(t.entryPrice) : '—'}
                      </td>
                      <td className={cn('num px-3 py-2.5 text-right text-muted', dim)}>
                        {t.manualPnl != null && t.exitPrice == null ? (
                          <span className="text-faint">manual</span>
                        ) : (
                          formatPrice(t.exitPrice)
                        )}
                      </td>
                      <td className={cn('px-3 py-2.5 text-right', dim)}>
                        {isIncomplete(t) ? (
                          <span className="text-xs text-warn">needs {missingDetails(t).join(', ')}</span>
                        ) : (
                          <>
                            <PnlValue value={netPnl(t)} open={!isClosed(t)} currency={currency} />
                            {r != null && (
                              <div className="num text-[11px] text-faint">{`${r >= 0 ? '+' : ''}${r.toFixed(2)}R`}</div>
                            )}
                          </>
                        )}
                      </td>
                      <td className={cn('px-3 py-2.5', dim)}>
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {t.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-raised px-1.5 py-0.5 text-[11px] text-muted ring-1 ring-line"
                            >
                              {tag}
                            </span>
                          ))}
                          {t.tags.length > 2 && (
                            <span className="px-1 text-[11px] text-faint">+{t.tags.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5 opacity-60 transition group-hover:opacity-100">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openTradeForm({ trade: t })}
                            aria-label={`Edit ${t.symbol} trade`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="hover:bg-loss/10 hover:text-loss"
                            onClick={() => deleteIds([t.id])}
                            aria-label={`Delete ${t.symbol} trade`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
            <span>
              Showing{' '}
              <span className="num text-fg">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sorted.length)}
              </span>{' '}
              of <span className="num text-fg">{sorted.length}</span>
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="num px-2 text-fg">
                {currentPage} / {pageCount}
              </span>
              <Button
                size="icon"
                variant="ghost"
                disabled={currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-faint">
        <span className="md:hidden">Tap a trade to edit it.</span>
        <span className="max-md:hidden">Click any row to edit that trade.</span> The eye icon keeps a trade in your
        journal but leaves it out of the statistics.
      </p>

      <ImportTradesModal open={importing} onClose={() => setImporting(false)} />
      {bulkEditing && <BulkDetailsModal ids={[...selected]} onClose={() => setBulkEditing(false)} />}
    </>
  );
}
