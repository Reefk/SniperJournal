import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { Side } from '@/lib/types';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

export function SideBadge({ side }: { side: Side }) {
  const long = side === 'LONG';
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded border py-0.5 pl-1 pr-1.5 text-[11px] font-semibold',
      long ? 'border-profit/25 bg-profit/10 text-profit' : 'border-loss/25 bg-loss/10 text-loss',
    )}>
      {long ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {side}
    </span>
  );
}

export type BadgeTone = 'profit' | 'loss' | 'accent' | 'warn' | 'neutral';

const BADGE: Record<BadgeTone, string> = {
  profit: 'border-profit/25 bg-profit/10 text-profit',
  loss: 'border-loss/25 bg-loss/10 text-loss',
  accent: 'border-accent/25 bg-accent/10 text-accent',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  neutral: 'border-line bg-raised text-muted',
};

export function StatusBadge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium', BADGE[tone], className)}>
      {children}
    </span>
  );
}

export function PnlValue({
  value, currency, open, className, compact,
}: { value: number; currency: string; open?: boolean; className?: string; compact?: boolean }) {
  if (open) return <StatusBadge tone="accent">Open</StatusBadge>;
  return (
    <span className={cn('num font-medium', value > 0 ? 'text-profit' : value < 0 ? 'text-loss' : 'text-muted', className)}>
      {formatMoney(value, currency, { sign: true, compact })}
    </span>
  );
}
