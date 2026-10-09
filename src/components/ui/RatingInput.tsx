import { cn } from '@/lib/utils';

export function RatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(value === n ? undefined : n)}
            className={cn(
              'num size-9 rounded text-xs font-semibold transition md:size-7',
              value && n <= value
                ? 'bg-accent-strong text-white'
                : 'border border-line bg-app text-faint hover:text-fg',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
