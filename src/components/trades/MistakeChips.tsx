'use client';

import { useId, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { matchMistake } from '@/lib/mistakes';
import { cn } from '@/lib/utils';

/**
 * The mistakes a trade made, tapped from my list. "Add one" names a mistake
 * the list doesn't have; saving the trade puts it on the list.
 */
export function MistakeChips({
  shown,
  listed,
  value,
  onChange,
}: {
  /** the list, then any the trade has that the list no longer does */
  shown: string[];
  listed: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  // after Enter, focus goes back to "Add one" rather than to the page, so the keyboard can carry on
  const refocus = useRef(false);
  const labelId = useId();
  const chips = [...shown, ...value.filter((m) => !shown.includes(m))];

  const toggle = (mistake: string) =>
    onChange(value.includes(mistake) ? value.filter((m) => m !== mistake) : [...value, mistake]);
  const add = () => {
    const name = matchMistake(draft, chips);
    if (name && !value.includes(name)) onChange([...value, name]);
    setDraft('');
    setAdding(false);
  };

  return (
    <div role="group" aria-labelledby={labelId} className="rounded-lg border border-line p-3">
      <div id={labelId} className="text-sm font-medium text-fg">
        Mistakes
      </div>
      <p className="mt-0.5 text-xs text-muted">Tap any this trade made. Reports work out what each one costs you.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((mistake) => {
          const on = value.includes(mistake);
          return (
            <button
              key={mistake}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(mistake)}
              className={cn(
                'h-9 rounded-md px-2.5 text-xs font-medium transition md:h-7',
                on ? 'bg-loss/15 text-loss ring-1 ring-loss/30' : 'border border-line bg-app text-muted hover:text-fg',
              )}
            >
              {mistake}
              {!listed.includes(mistake) && ' (not on your list)'}
            </button>
          );
        })}
        {adding ? (
          <input
            autoFocus
            aria-label="New mistake"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                refocus.current = true;
                // leaving the box adds it, once
                e.currentTarget.blur();
              }
            }}
            onBlur={add}
            placeholder="Name it, then Enter"
            className="h-9 w-48 rounded-md border border-accent/70 bg-app px-2.5 text-xs text-fg outline-none ring-2 ring-accent/20 placeholder:text-placeholder md:h-7"
          />
        ) : (
          <button
            ref={(el) => {
              if (el && refocus.current) {
                refocus.current = false;
                el.focus();
              }
            }}
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-9 items-center gap-1 rounded-md border border-dashed border-line px-2.5 text-xs text-muted transition hover:text-fg md:h-7"
          >
            <Plus className="size-3.5" /> Add one
          </button>
        )}
      </div>
    </div>
  );
}
