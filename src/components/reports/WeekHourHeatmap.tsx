'use client';

import type { HeatCell, Heatmap } from '@/lib/heatmap';
import { formatMoney, weekdayName } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { CellAmount } from '@/components/ui/CellAmount';

/** an hour as the app writes times: 09:00 */
const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/** the strongest a cell's colour goes, so its text stays easy to read on it */
const DEEPEST = 0.5;

/** the most hours a wide screen's table runs across, about 54 px each at 1024 px; more run down the side */
const ACROSS_MAX = 12;

const head = 'px-0.5 py-1 text-[10px] font-medium text-muted';

function Cell({
  cell,
  strongest,
  currency,
  phone = false,
}: {
  cell: HeatCell | null;
  strongest: number;
  currency: string;
  /** a seventh of a phone's width: a smaller amount, a unit or the cents on a line of their own */
  phone?: boolean;
}) {
  if (!cell) {
    return (
      <td className="p-0.5">
        <div className="h-11 rounded-md bg-app">
          <span className="sr-only">{tr('rep.heat.none')}</span>
        </div>
      </td>
    );
  }
  const few = cell.mark === 'few';
  // shortened to fit the cell, the exact net on hover: on a PC thousands with one decimal ("+$1.7K");
  // on a phone whole amounts from 10 up ("+$20", "+20 $", "+$2K"), rounded first so 999.60 is "+$1K",
  // not a "+$1,000" too wide for the cell, and a unit of two words may take two lines ("тыс." over "$")
  const abs = Math.abs(cell.net);
  const whole = abs >= 10;
  const amount = phone
    ? formatMoney(whole ? Math.sign(cell.net) * Math.round(abs) : cell.net, currency, {
        sign: true,
        compact: true,
        ...(whole ? { decimals: 0 } : {}),
      }).replace(/(\D)\s(\D)/g, '$1 $2')
    : formatMoney(cell.net, currency, { sign: true, compact: true, ...(abs >= 1000 ? { decimals: 1 } : {}) });
  // green or red by the net, deeper the nearer the strongest cell; a cell of 1 or 2 trades stays grey
  const depth = few || strongest === 0 ? 0 : 0.12 + (DEEPEST - 0.12) * Math.min(1, abs / strongest);
  return (
    <td className="p-0.5" data-mark={cell.mark ?? undefined}>
      <div
        className={cn(
          'relative flex min-h-11 flex-col items-center justify-center overflow-hidden rounded-md px-0.5 py-1 text-center leading-tight',
          few ? 'bg-app text-faint' : 'text-fg',
        )}
        title={formatMoney(cell.net, currency, { sign: true })}
      >
        {depth > 0 && cell.net !== 0 && (
          <span
            aria-hidden
            className={cn('absolute inset-0', cell.net > 0 ? 'bg-profit' : 'bg-loss')}
            style={{ opacity: depth }}
          />
        )}
        <span className={cn('num relative font-medium', phone ? 'text-[10px] tracking-tight' : 'text-[11px]')}>
          <CellAmount text={amount} phone={phone} />
        </span>
        {/* under 10 trades, the count dotted, as in the tag tables */}
        <span
          className={cn(
            'num relative text-[10px]',
            few ? 'text-faint' : 'text-muted',
            cell.mark === 'thin' && 'underline decoration-dotted underline-offset-2',
          )}
        >
          {cell.trades}×
        </span>
      </div>
    </td>
  );
}

/** a row a weekday, a column an hour: a wide screen's, while the hours fit across */
function ByWeekday({ map, currency, className }: { map: Heatmap; currency: string; className: string }) {
  const { weekdays, hours, grid, strongest } = map;
  return (
    <table aria-label={tr('rep.heat')} className={cn('w-full table-fixed border-separate border-spacing-0', className)}>
      <thead>
        <tr>
          <th className={cn(head, 'w-12')}>
            <span className="sr-only">{tr('rep.heat.day')}</span>
          </th>
          {hours.map((hour) => (
            <th key={hour} scope="col" className={cn(head, 'num')}>
              {hourLabel(hour)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weekdays.map((weekday, row) => (
          <tr key={weekday}>
            <th scope="row" className={cn(head, 'text-start')}>
              {weekdayName(weekday)}
            </th>
            {grid[row].map((cell, col) => (
              <Cell key={hours[col]} cell={cell} strongest={strongest} currency={currency} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** a row an hour, a column a weekday: a phone's, a tablet's, and a wide screen's with more hours than fit across */
function ByHour({
  map,
  currency,
  phone = false,
  className,
}: {
  map: Heatmap;
  currency: string;
  phone?: boolean;
  className: string;
}) {
  const { weekdays, hours, grid, strongest } = map;
  return (
    <table aria-label={tr('rep.heat')} className={cn('w-full table-fixed border-separate border-spacing-0', className)}>
      <thead>
        <tr>
          <th className={cn(head, 'w-10')}>
            <span className="sr-only">{tr('rep.heat.hour')}</span>
          </th>
          {weekdays.map((weekday) => (
            <th key={weekday} scope="col" className={head}>
              {weekdayName(weekday)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {hours.map((hour, col) => (
          <tr key={hour}>
            <th scope="row" className={cn(head, 'num text-start')}>
              {hourLabel(hour)}
            </th>
            {weekdays.map((weekday, row) => (
              <Cell key={weekday} cell={grid[row][col]} strongest={strongest} currency={currency} phone={phone} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Reports → weekday and hour: a cell for each hour of each weekday a trade
 * was opened in, its net and trade count, coloured by the net. On a wide
 * screen the weekdays run down the side while the hours fit across; else the
 * hours do, so the grid fits without scrolling (or being cut when printed).
 */
export function WeekHourHeatmap({ map, currency }: { map: Heatmap; currency: string }) {
  const across = map.hours.length <= ACROSS_MAX;
  const marks = new Set(map.grid.flat().map((cell) => cell?.mark));
  const notes = [
    marks.has('few') ? tr('rep.tags.few') : null,
    marks.has('thin') ? tr('rep.tags.thin') : null,
    map.noTime ? tr('rep.heat.noTime', { count: map.noTime }) : null,
  ].filter(Boolean);
  return (
    <>
      {across && <ByWeekday map={map} currency={currency} className="max-lg:hidden" />}
      <ByHour map={map} currency={currency} className={cn('max-md:hidden', across && 'lg:hidden')} />
      <ByHour map={map} currency={currency} phone className="md:hidden" />
      {notes.length > 0 && <p className="px-2 pt-3 text-xs leading-relaxed text-faint">{notes.join(' ')}</p>}
    </>
  );
}
