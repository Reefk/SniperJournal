'use client';

import type { Trade } from '@/lib/types';
import { useUI } from '@/store/UIProvider';
import { formatShortDate, formatTime } from '@/lib/format';
import { isClosed, netPnl } from '@/lib/trade-math';
import { PnlValue, SideBadge } from '@/components/ui/StatusBadge';

export function RecentTrades({ trades, currency }: { trades: Trade[]; currency: string }) {
  const { openTradeForm } = useUI();

  return (
    <ul className="divide-y divide-line px-2">
      {trades.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => openTradeForm({ trade: t })}
            className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-raised"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="w-[72px] shrink-0 truncate font-semibold text-fg">{t.symbol}</span>
              <SideBadge side={t.side} />
              <span className="num truncate text-xs text-faint">
                {formatShortDate(t.openedAt)} · {formatTime(t.openedAt)}
              </span>
            </div>
            <PnlValue value={netPnl(t)} open={!isClosed(t)} currency={currency} className="text-sm" />
          </button>
        </li>
      ))}
    </ul>
  );
}
