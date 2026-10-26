'use client';

import { Check, X } from 'lucide-react';
import type { RuleChecks, RuleTick } from '@/lib/types';
import { tickOf } from '@/lib/rules';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';

/**
 * Kept or Broken for each rule of the trade's setup. Tapping the one already
 * chosen clears it again; a rule left alone counts as not checked.
 */
export function RuleChecklist({
  setupName,
  rules,
  setupRules,
  value,
  onChange,
}: {
  setupName: string;
  /** what to show: the setup's rules, then any removed rule the trade is ticked on */
  rules: string[];
  setupRules: string[];
  value: RuleChecks | undefined;
  onChange: (next: RuleChecks) => void;
}) {
  const set = (rule: string, tick: RuleTick) => onChange({ ...value, [rule]: tick });

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-fg">{tr('rules.of', { setup: setupName })}</div>
          <p className="mt-0.5 text-xs text-muted">{tr('rules.hint')}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange({ ...value, ...Object.fromEntries(rules.map((rule) => [rule, true])) })}
        >
          <Check className="size-3.5" /> {tr('rules.allKept')}
        </Button>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {rules.map((rule) => {
          const tick = tickOf(value, rule);
          return (
            <li key={rule} className="flex flex-col gap-2 py-2 md:flex-row md:items-center md:gap-3">
              <span className="min-w-0 flex-1 text-sm leading-relaxed text-fg">
                {rule}
                {!setupRules.includes(rule) && <span className="text-xs text-faint">{tr('rules.removed')}</span>}
              </span>
              <div role="group" aria-label={rule} className="flex shrink-0 gap-1.5">
                <TickButton
                  label={tr('rules.kept')}
                  pressed={tick === true}
                  tone="profit"
                  onClick={() => set(rule, tick === true ? null : true)}
                />
                <TickButton
                  label={tr('rules.broken')}
                  pressed={tick === false}
                  tone="loss"
                  onClick={() => set(rule, tick === false ? null : false)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TickButton({
  label,
  pressed,
  tone,
  onClick,
}: {
  label: string;
  pressed: boolean;
  tone: 'profit' | 'loss';
  onClick: () => void;
}) {
  const Icon = tone === 'profit' ? Check : X;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'flex h-10 items-center gap-1 rounded-md px-3 text-xs font-semibold transition md:h-8 md:px-2.5',
        pressed
          ? tone === 'profit'
            ? 'bg-profit/15 text-profit ring-1 ring-profit/30'
            : 'bg-loss/15 text-loss ring-1 ring-loss/30'
          : 'border border-line bg-app text-muted hover:text-fg',
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
