'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export function TagInput({
  value,
  onChange,
  suggestions,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const tag = raw.trim().replace(/,$/, '');
    if (tag && !value.some((v) => v.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft('');
  };

  const matches = suggestions
    .filter((s) => !value.includes(s) && s.toLowerCase().includes(draft.trim().toLowerCase()))
    .slice(0, 8);

  return (
    <div>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-line bg-app px-2 py-1.5 transition focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/20">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded bg-accent/15 py-0.5 pl-1.5 pr-1 text-xs text-accent"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`Remove tag ${tag}`}
              className="rounded hover:bg-accent/20"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(draft)}
          placeholder={value.length ? '' : 'Type a tag and press Enter'}
          className="h-6 min-w-[140px] flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-faint"
        />
      </div>
      {matches.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s)}
              className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted transition hover:border-accent/50 hover:text-fg"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
