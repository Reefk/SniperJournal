import { Info } from 'lucide-react';

/**
 * Plain-language explanation for a metric, on hover or keyboard focus. On a
 * phone, tapping the icon shows it in a bar above the tabs, since a bubble
 * beside a small icon near the screen edge would be cut off.
 */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex max-md:-m-2 max-md:p-2" tabIndex={0} aria-label={text}>
      <Info className="size-3 cursor-help text-faint transition group-hover/tip:text-muted" />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-60 -translate-x-1/2 rounded-md border border-line bg-raised px-3 py-2 text-xs font-normal leading-relaxed text-fg opacity-0 shadow-xl transition group-hover/tip:opacity-100 group-focus/tip:opacity-100 max-md:invisible max-md:fixed max-md:inset-x-4 max-md:bottom-[calc(5rem_+_var(--safe-area-inset-bottom,0px))] max-md:top-auto max-md:mt-0 max-md:w-auto max-md:translate-x-0 max-md:text-sm max-md:group-focus/tip:visible"
      >
        {text}
      </span>
    </span>
  );
}
