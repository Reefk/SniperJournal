'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useJournal } from '@/store/JournalProvider';
import { GOALS, goalTarget, goalTargetText, type GoalDef } from '@/lib/goals';
import { breakEvenWinRate, computeStats } from '@/lib/stats';
import type { GoalKey } from '@/lib/types';
import { toNumberOrNull } from '@/lib/utils';
import { Field, Input } from '@/components/ui/Field';
import { formatPct } from '@/lib/format';
import { decimalMark, tr } from '@/lib/i18n';

/** example text only: no goal has a target until one is typed */
const EXAMPLE: Record<GoalKey, string> = {
  rulesKept: '90',
  cleanTrades: '80',
  daysInLimits: '95',
  withStop: '100',
  winRate: '50',
  profitFactor: '1.5',
  avgR: '0.3',
  expectancy: '25',
  winLossRatio: '1.5',
  greenDayRate: '60',
};

function hintFor(def: GoalDef, currency: string): string {
  switch (def.unit) {
    case 'pct':
      return tr('goals.hint.pct');
    case 'ratio':
      return tr('goals.hint.ratio');
    case 'r':
      return tr('goals.hint.r');
    case 'money':
      return tr('goals.hint.money', { currency });
  }
}

const shownTarget = (target: number | undefined) => (target == null ? '' : String(target));

/** why a number typed isn't a target the goal can take, or undefined when it is */
function refusal(def: GoalDef, n: number | null): string | undefined {
  const target = goalTarget(def, n);
  if (target == null) {
    if (def.unit === 'pct') return tr('goals.refuse.pct');
    // 0.004 is above 0, but under the hundredth a target has to be
    return n != null && n > 0 ? tr('goals.refuse.twoDecimals') : tr('goals.refuse.aboveZero');
  }
  if (target !== n) return def.unit === 'pct' ? tr('goals.refuse.oneDecimal') : tr('goals.refuse.twoDecimals');
  return undefined;
}

/**
 * One goal's target. What is typed is saved as it is typed; a number the goal
 * can't take says why and which target is still in use, and leaving the box
 * puts that target back in it. Blank takes the goal off.
 */
function GoalField({
  def,
  disabled,
  hint,
  children,
}: {
  def: GoalDef;
  disabled?: boolean;
  hint?: string;
  children?: ReactNode;
}) {
  const { data, actions } = useJournal();
  const saved = data.settings.goals?.[def.key];
  const [text, setText] = useState(() => shownTarget(saved));
  const [error, setError] = useState<string>();
  // the target changed somewhere else (a restored backup, another window): the box follows it
  const [seen, setSeen] = useState(saved);
  if (saved !== seen) {
    setSeen(saved);
    setText(shownTarget(saved));
    setError(undefined);
  }

  const change = (raw: string) => {
    setText(raw);
    const target = raw.trim() ? toNumberOrNull(raw) : null;
    const why = raw.trim() ? refusal(def, target) : undefined;
    if (why) {
      // typing 150 saved 1 and then 15 on the way, so say which target counts
      setError(
        saved == null
          ? why
          : tr('goals.stillUsing', { why, target: goalTargetText(def, saved, data.settings.currency) }),
      );
      return;
    }
    setError(undefined);
    // what this box saves is not a change from somewhere else, so "1." stays as typed
    setSeen(target ?? undefined);
    actions.setGoal(def.key, target);
  };

  // leaving the box with a number it can't take shows the target in use again
  const leave = () => {
    if (!error) return;
    setText(shownTarget(saved));
    setError(undefined);
  };

  return (
    <Field label={def.label} hint={hint ?? hintFor(def, data.settings.currency)} error={error}>
      <Input
        inputMode="decimal"
        className="num"
        value={text}
        onChange={(e) => change(e.target.value)}
        onBlur={leave}
        placeholder={tr('goals.example', { n: decimalMark(EXAMPLE[def.key]) })}
        disabled={disabled}
      />
      {children}
    </Field>
  );
}

/**
 * Settings → Limits and goals, below the daily limits: a box for each goal,
 * the ones I control on the day first. A goal shows on the Dashboard once it
 * has a target.
 */
export function GoalFields() {
  const { data, accountTrades, activeLabel } = useJournal();
  const { maxDailyLoss, maxTradesPerDay, goals } = data.settings;
  const noLimit = !(maxDailyLoss != null && maxDailyLoss > 0) && !(maxTradesPerDay != null && maxTradesPerDay > 0);
  // the win rate my numbers need, so the target isn't picked blind
  const breakEven = useMemo(() => breakEvenWinRate(computeStats(accountTrades)), [accountTrades]);

  const field = (def: GoalDef) => {
    if (def.key === 'daysInLimits') {
      // nothing to keep inside without a limit; a target already set can still be cleared
      const off = noLimit && goals?.daysInLimits == null;
      return <GoalField key={def.key} def={def} disabled={off} hint={off ? tr('goals.setLimitFirst') : undefined} />;
    }
    if (def.key === 'winRate') {
      return (
        <GoalField key={def.key} def={def}>
          <p className="mt-1 text-xs text-faint">
            {breakEven == null
              ? tr('goals.breakEvenNone')
              : tr('goals.breakEven', { pct: formatPct(breakEven), account: activeLabel })}
          </p>
        </GoalField>
      );
    }
    return <GoalField key={def.key} def={def} />;
  };

  return (
    <>
      <h3 className="mt-6 text-xs font-semibold text-fg">{tr('goals.process')}</h3>
      <p className="mt-0.5 text-xs text-muted">{tr('goals.processHint')}</p>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        {GOALS.filter((def) => def.kind === 'process').map(field)}
      </div>
      <h3 className="mt-6 text-xs font-semibold text-fg">{tr('goals.result')}</h3>
      <p className="mt-0.5 text-xs text-muted">{tr('goals.resultHint')}</p>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        {GOALS.filter((def) => def.kind === 'result').map(field)}
      </div>
    </>
  );
}
