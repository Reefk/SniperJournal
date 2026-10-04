'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Search } from 'lucide-react';
import { useJournal } from '@/store/JournalProvider';
import { useUI } from '@/store/UIProvider';
import { formatDate } from '@/lib/format';
import { isClosed, matchesSearch, netPnl, tradeTimestamp } from '@/lib/trade-math';
import { PnlValue, SideBadge } from '@/components/ui/StatusBadge';

export function GlobalSearch() {
  const { accountTrades, data } = useJournal();
  const { openTradeForm, setGlobalSearch } = useUI();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        if (document.querySelector('[data-modal-root]')) return;
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setupNames = useMemo(() => new Map(data.setups.map((s) => [s.id, s.name])), [data.setups]);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return accountTrades
      .filter((t) => matchesSearch(t, term, setupNames))
      .sort((a, b) => tradeTimestamp(b).localeCompare(tradeTimestamp(a)))
      .slice(0, 6);
  }, [accountTrades, query, setupNames]);

  const showAll = () => {
    setGlobalSearch(query.trim());
    router.push('/trades');
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-[380px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && query.trim()) showAll();
          if (e.key === 'Escape') inputRef.current?.blur();
        }}
        placeholder="Search symbols, tags, notes, setups"
        aria-label="Search trades"
        className="h-9 w-full rounded-md border border-line bg-app pl-9 pr-16 text-sm text-fg placeholder:text-faint transition focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 py-px text-[10px] text-faint">
        Ctrl K
      </kbd>

      {focused && query.trim() && (
        <div
          className="animate-pop absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-lg border border-line bg-surface shadow-2xl shadow-black/40"
          onMouseDown={(e) => e.preventDefault()}
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted">No trades match that search.</div>
          ) : (
            <ul className="p-1">
              {results.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      openTradeForm({ trade: t });
                      inputRef.current?.blur();
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition hover:bg-raised"
                  >
                    <span className="w-16 truncate font-semibold text-fg">{t.symbol}</span>
                    <SideBadge side={t.side} />
                    <span className="flex-1 truncate text-xs text-muted">{formatDate(t.openedAt)}</span>
                    <PnlValue
                      value={netPnl(t)}
                      open={!isClosed(t)}
                      currency={data.settings.currency}
                      className="text-sm"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={showAll}
            className="flex w-full items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted transition hover:bg-raised hover:text-fg"
          >
            Show all matches in Trades
            <CornerDownLeft className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
