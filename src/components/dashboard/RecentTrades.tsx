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
            className="grid w-full grid-cols-[auto_1fr] items-center gap-3 rounded-md px-3 py-2.5 text-start transition hover:bg-raised [&>:last-child]:justify-self-end"
          >
            {/* in a narrow row a long amount takes two lines ("+958,75" over "US$") and so may the
                day ("29" over "oct"), rather than the amount squeezing the day down to "…"; the
                amount, or the open badge, sits at the end of its column instead of filling it */}
            <div className="flex min-w-0 items-center gap-2.5">
              <span dir="auto" className="w-16 shrink-0 truncate font-semibold text-fg md:w-[72px]">
                {t.symbol}
              </span>
              <SideBadge side={t.side} />
              <span className="num text-xs text-faint">
                {formatShortDate(t.openedAt)}
                {/* a phone row has room for the day, not the time as well */}
                <span className="max-md:hidden"> · {formatTime(t.openedAt)}</span>
              </span>
            </div>
            <PnlValue
              value={netPnl(t)}
              open={!isClosed(t)}
              currency={currency}
              className="text-end text-sm"
              breakable
            />
          </button>
        </li>
      ))}
    </ul>
  );
}
