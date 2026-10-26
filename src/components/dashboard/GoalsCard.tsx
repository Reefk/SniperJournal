import Link from 'next/link';
import { ArrowDown, ArrowUp } from 'lucide-react';
import {
  GOAL_WEEKS,
  goalTargetText,
  goalValueText,
  type GoalDef,
  type GoalLine,
  type GoalStatus,
  type GoalWeek,
  type Measure,
} from '@/lib/goals';
import { formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { InfoTip } from '@/components/ui/InfoTip';
import { rich } from '@/components/ui/Rich';
import { tr, type MessageKey } from '@/lib/i18n';

const counted = (def: GoalDef, n: number) => tr(`goals.basis.${def.basis}`, { count: n });

const BLOCKED: Record<NonNullable<Measure['blocked']>, MessageKey> = {
  'no-limits': 'goals.blocked.noLimits',
  'no-mistakes': 'goals.blocked.noMistakes',
};

const judged = (status: GoalStatus) => status === 'met' || status === 'missed';

function statusText({ def, measure, status, need }: GoalLine): string {
  if (status === 'met') return tr('goals.met');
  if (status === 'missed') return tr('goals.below');
  if (status === 'short') return tr('goals.needs', { need: counted(def, need), count: measure.count });
  return tr(measure.blocked ? BLOCKED[measure.blocked] : 'goals.nothing');
}

function weekText({ def, target }: GoalLine, week: GoalWeek, currency: string): string {
  const head = tr('goals.weekOf', { date: formatShortDate(week.start) });
  if (judged(week.status)) {
    const value = goalValueText(def, week.measure.value, target, currency);
    return tr(week.status === 'met' ? 'goals.weekMet' : 'goals.weekBelow', { week: head, value });
  }
  if (week.status === 'short') return tr('goals.weekShort', { week: head, counted: counted(def, week.measure.count) });
  return tr('goals.weekNone', { week: head });
}

/** how far to the target the bar is filled: all of it once met */
function progress({ measure, status, target }: GoalLine): number {
  if (status === 'met') return 100;
  const { value } = measure;
  if (value == null || value <= 0 || target <= 0) return 0;
  return Math.min(value / target, 1) * 100;
}

/** the number against the same length of time before the range, when both are judged */
function Trend({ line, currency }: { line: GoalLine; currency: string }) {
  const { before, measure, status, def, target } = line;
  if (!before || !judged(status) || !judged(before.status) || measure.value == null || before.measure.value == null) {
    return null;
  }
  const was = goalValueText(def, before.measure.value, target, currency);
  if (was === goalValueText(def, measure.value, target, currency)) {
    return <span className="text-faint">{tr('goals.same')}</span>;
  }
  const up = measure.value > before.measure.value;
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 text-faint">
      <Arrow className={cn('size-3', up ? 'text-profit' : 'text-loss')} aria-hidden />
      {rich(tr(up ? 'goals.upFrom' : 'goals.downFrom', { was }), {
        num: (text) => <span className="num">{text}</span>,
      })}
    </span>
  );
}

function GoalRow({ line, currency }: { line: GoalLine; currency: string }) {
  const { def, target, measure, status, weeks } = line;
  return (
    <li className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">
          {def.label}
          {/* held to the last word, so a label on two lines ends with it */}
          <span className="whitespace-nowrap">
            {' '}
            <InfoTip text={def.info} />
          </span>
        </span>
        <span className="num shrink-0 text-sm">
          <span className={cn('font-semibold', judged(status) ? 'text-fg' : 'text-muted')}>
            {goalValueText(def, measure.value, target, currency)}
          </span>
          <span className="text-faint"> / {goalTargetText(def, target, currency)}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div
          className={cn(
            'h-full rounded-full',
            status === 'met' ? 'bg-profit' : status === 'missed' ? 'bg-loss' : 'bg-line-strong',
          )}
          style={{ width: `${progress(line)}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px]">
        <span className={status === 'met' ? 'text-profit' : status === 'missed' ? 'text-loss' : 'text-faint'}>
          {statusText(line)}
        </span>
        <Trend line={line} currency={currency} />
      </div>
      <ol
        className="mt-2 flex items-center gap-1.5"
        aria-label={tr('goals.weeksLabel', { goal: def.label, count: GOAL_WEEKS })}
      >
        {weeks.map((week) => {
          const text = weekText(line, week, currency);
          return (
            <li key={week.start} title={text}>
              <span
                aria-hidden
                className={cn(
                  'block size-2.5 rounded-full',
                  week.status === 'met'
                    ? 'bg-profit'
                    : week.status === 'missed'
                      ? 'bg-loss'
                      : 'border border-line-strong',
                )}
              />
              <span className="sr-only">{text}</span>
            </li>
          );
        })}
      </ol>
    </li>
  );
}

/**
 * The goals set in Settings, for the Dashboard's range: each one's number
 * against its target, against the same length of time before, and a dot for
 * each of the last 8 weeks.
 */
export function GoalsCard({
  lines,
  currency,
  before,
  className,
}: {
  lines: GoalLine[];
  currency: string;
  /** the period the arrows compare with, in words ("the 30 days before"); null for all time, with no arrows */
  before: string | null;
  className?: string;
}) {
  const shown = lines.filter((line) => judged(line.status));
  const met = shown.filter((line) => line.status === 'met').length;
  // none judged: short of trades, or only goals with nothing to measure (no limit set, no mistake marked)
  const unjudged = lines.some((line) => line.status === 'short') ? tr('goals.notEnough') : tr('goals.nothing');
  return (
    <ChartContainer
      className={className}
      title={tr('goals.title')}
      subtitle={[
        shown.length ? tr('goals.metOf', { met, shown: shown.length }) : unjudged,
        before && tr('goals.arrows', { before }),
        tr('goals.dots', { count: GOAL_WEEKS }),
      ]
        .filter(Boolean)
        .join(' · ')}
      actions={
        <Link href="/settings" className="shrink-0 text-xs text-accent underline-offset-4 transition hover:underline">
          {tr('goals.edit')}
        </Link>
      }
    >
      <ul className="grid grid-cols-1 gap-x-10 gap-y-5 px-2 md:grid-cols-2">
        {lines.map((line) => (
          <GoalRow key={line.def.key} line={line} currency={currency} />
        ))}
      </ul>
    </ChartContainer>
  );
}
