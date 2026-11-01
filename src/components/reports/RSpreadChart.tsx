'use client';

import { SPREAD_HIGH, SPREAD_LOW, type RSpread } from '@/lib/r-spread';
import { formatAxisR, formatMoney, formatRatio, pctText, wholePct } from '@/lib/format';
import { isolate, tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** the tallest bar, in px: the rest of the chart's height is for the counts over the bars */
const TALLEST = 112;

/** a bar's R in words, as the axis writes it: "-1.5R", "0R", and at an end "-2R or worse" */
const barR = (r: number) =>
  r === SPREAD_LOW
    ? tr('rep.spread.low', { r: formatAxisR(r) })
    : r === SPREAD_HIGH
      ? tr('rep.spread.high', { r: formatAxisR(r) })
      : formatAxisR(r);

/**
 * A count too wide for its bar, which would run into the next one's: three digits need about 19 px,
 * four 25 px, so they go below the chart widths that give a bar that much (13 bars, 2 px apart).
 * An engine without container queries ignores this and shows them all.
 */
const tooWide = (count: number) =>
  count >= 1000 ? '@max-[23rem]:hidden' : count >= 100 ? '@max-[18rem]:hidden' : undefined;

/**
 * Reports → R spread (lib/r-spread.ts): a bar for each half R, from -2R or
 * worse to +4R or better, as tall as the trades that ended nearest it. Under
 * it, whether a few big winners carry the record, and the losses that went
 * past their stop.
 */
export function RSpreadChart({ spread, currency }: { spread: RSpread; currency: string }) {
  const tallest = Math.max(...spread.bars.map((bar) => bar.trades));
  const lines: Array<[key: string, text: string]> = [];
  const { top, pastStop } = spread;
  if (top) {
    const tenth = pctText(10);
    lines.push([
      'top',
      top.share == null
        ? tr('rep.spread.split', {
            count: top.of - top.count,
            tenth,
            top: top.count,
            of: top.of,
            best: formatMoney(top.best, currency, { sign: true }),
            rest: formatMoney(top.rest, currency, { sign: true }),
          })
        : tr('rep.spread.top', { tenth, count: top.count, of: top.of, share: pctText(wholePct(top.share)) }),
    ]);
  }
  if (spread.losses) {
    const stop = formatAxisR(-1);
    lines.push([
      'past',
      pastStop.count
        ? // how far past -1R, as a distance: "2.00R"
          tr('rep.spread.past', { count: pastStop.count, stop, beyond: isolate(`${formatRatio(-pastStop.beyond)}R`) })
        : tr('rep.spread.held', { stop }),
    ]);
  }
  const noStop = spread.noStop ? tr('rep.spread.noStop', { count: spread.noStop }) : null;
  if (noStop && spread.rated) lines.push(['noStop', noStop]);

  return (
    <>
      {spread.rated ? (
        // a number line, read left to right in every language
        <div dir="ltr" className="@container px-1 pt-2 md:px-2">
          <ul
            role="list"
            aria-label={tr('rep.spread')}
            className="flex items-end gap-0.5 border-b border-line-strong"
            style={{ height: TALLEST + 16 }}
          >
            {spread.bars.map((bar) => {
              const said = tr('rep.spread.bar', { r: barR(bar.r), count: bar.trades });
              return (
                <li key={bar.r} className="h-full min-w-0 flex-1">
                  {/* what the eye sees, its count on hover too; a screen reader hears only the line under it */}
                  <div aria-hidden title={said} className="flex h-full flex-col items-center justify-end">
                    {bar.trades > 0 && (
                      <span className={cn('num mb-0.5 text-[10px] leading-none text-muted', tooWide(bar.trades))}>
                        {bar.trades}
                      </span>
                    )}
                    <div
                      className={cn(
                        'w-full rounded-t-sm',
                        bar.r < 0 ? 'bg-loss' : bar.r > 0 ? 'bg-profit' : 'bg-line-strong',
                      )}
                      // a bar of one trade among hundreds still shows
                      style={{ height: bar.trades ? Math.max(2, Math.round((bar.trades / tallest) * TALLEST)) : 0 }}
                    />
                  </div>
                  <span className="sr-only">{said}</span>
                </li>
              );
            })}
          </ul>
          {/* the whole Rs, centred under their bars; a narrow bar's label runs into the unlabelled half R beside it */}
          <div aria-hidden className="mt-1 flex gap-0.5">
            {spread.bars.map((bar) => (
              <span key={bar.r} className="flex min-w-0 flex-1 justify-center">
                {Number.isInteger(bar.r) && (
                  <span className="num whitespace-nowrap text-[10px] text-faint">{formatAxisR(bar.r)}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      ) : (
        // no trade has a stop: no bars, but the best tenth still says something
        <p className="grid min-h-[120px] place-items-center px-6 text-center text-sm text-faint">{noStop}</p>
      )}
      {lines.length > 0 && (
        <div className="space-y-1 px-2 pt-3 text-xs md:px-3">
          {lines.map(([key, text]) => (
            <p key={key} className={key === 'noStop' ? 'text-faint' : 'text-muted'}>
              {text}
            </p>
          ))}
        </div>
      )}
    </>
  );
}
