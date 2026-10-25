'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useJournal } from '@/store/JournalProvider';
import { GOALS, goalTarget, goalTargetText, type GoalDef } from '@/lib/goals';
import { breakEvenWinRate, computeStats } from '@/lib/stats';
import type { GoalKey } from '@/lib/types';
import { toNumberOrNull } from '@/lib/utils';
import { Field, Input } from '@/components/ui/Field';

/** example text only: no goal has a target until one is typed */
const EXAMPLE: Record<GoalKey, string> = {
  rulesKept: 'e.g. 90',
  cleanTrades: 'e.g. 80',
  daysInLimits: 'e.g. 95',
  withStop: 'e.g. 100',
  winRate: 'e.g. 50',
  profitFactor: 'e.g. 1.5',
  avgR: 'e.g. 0.3',
  expectancy: 'e.g. 25',
  winLossRatio: 'e.g. 1.5',
  greenDayRate: 'e.g. 60',
};

function hintFor(def: GoalDef, currency: string): string {
  switch (def.unit) {
    case 'pct':
      return '% at least';
    case 'ratio':
      return 'at least';
    case 'r':
      return 'R at least';
    case 'money':
      return `${currency} a trade, at least`;
  }
}

const shownTarget = (target: number | undefined) => (target == null ? '' : String(target));

/** why a number typed isn't a target the goal can take, or undefined when it is */
function refusal(def: GoalDef, n: number | null): string | undefined {
  const target = goalTarget(def, n);
  if (target == null) {
    if (def.unit === 'pct') return 'A number from 0 to 100';
    // 0.004 is above 0, but under the hundredth a target has to be
    return n != null && n > 0 ? 'Two decimals at most' : 'A number above 0';
  }
  if (target !== n) return def.unit === 'pct' ? 'One decimal at most' : 'Two decimals at most';
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
      setError(saved == null ? why : `${why}. Still using ${goalTargetText(def, saved, data.settings.currency)}`);
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
        placeholder={EXAMPLE[def.key]}
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
      return <GoalField key={def.key} def={def} disabled={off} hint={off ? 'set a limit above first' : undefined} />;
    }
    if (def.key === 'winRate') {
      return (
        <GoalField key={def.key} def={def}>
          <p className="mt-1 text-xs text-faint">
            {breakEven == null
              ? 'Once you have a win and a loss, the win rate you break even at shows here.'
              : `You break even at ${breakEven.toFixed(1)}% with your average win and loss (${activeLabel}, all time).`}
          </p>
        </GoalField>
      );
    }
    return <GoalField key={def.key} def={def} />;
  };

  return (
    <>
      <h3 className="mt-6 text-xs font-semibold text-fg">Process goals</h3>
      <p className="mt-0.5 text-xs text-muted">What you control on the day.</p>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        {GOALS.filter((def) => def.kind === 'process').map(field)}
      </div>
      <h3 className="mt-6 text-xs font-semibold text-fg">Result goals</h3>
      <p className="mt-0.5 text-xs text-muted">What the trades add up to.</p>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        {GOALS.filter((def) => def.kind === 'result').map(field)}
      </div>
    </>
  );
}
