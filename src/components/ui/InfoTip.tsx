import { Info } from 'lucide-react';

/** Plain-language explanation for a metric, on hover or keyboard focus */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex" tabIndex={0} aria-label={text}>
      <Info className="size-3 cursor-help text-faint transition group-hover/tip:text-muted" />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-60 -translate-x-1/2 rounded-md border border-line bg-raised px-3 py-2 text-xs font-normal leading-relaxed text-fg opacity-0 shadow-xl transition group-hover/tip:opacity-100 group-focus/tip:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
