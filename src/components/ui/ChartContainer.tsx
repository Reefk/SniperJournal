import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function ChartContainer({
  title, subtitle, actions, children, className, bodyClassName, empty, emptyText,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  empty?: boolean;
  emptyText?: ReactNode;
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-xl border border-line bg-surface', className)}>
      <header className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className={cn('relative min-h-0 flex-1 px-3 pb-4 pt-3', bodyClassName)}>
        {empty ? (
          <div className="grid h-full min-h-[180px] place-items-center px-6 text-center text-sm leading-relaxed text-faint">
            {emptyText ?? 'No data yet'}
          </div>
        ) : children}
      </div>
    </section>
  );
}
