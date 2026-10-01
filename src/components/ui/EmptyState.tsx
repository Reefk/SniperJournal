import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** An invitation to act — never a placeholder pretending to be data */
export function EmptyState({
  icon: Icon, title, description, actions, className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong/70 px-6 py-14 text-center', className)}>
      <div className="grid size-11 place-items-center rounded-full border border-line bg-raised">
        <Icon className="size-5 text-muted" />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">{description}</p>}
      {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
