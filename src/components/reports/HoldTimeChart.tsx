'use client';

import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { holdAxis, HOLD_SHORTEST, type HoldDot, type HoldMeasure } from '@/lib/hold';
import type { Trade } from '@/lib/types';
import {
  formatAxisDuration,
  formatAxisMoney,
  formatDuration,
  formatMoney,
  formatR,
  formatShortDate,
  isMoneyHidden,
} from '@/lib/format';
import { language, tr } from '@/lib/i18n';
import { tradeDay } from '@/lib/trade-math';
import { useChartTheme } from '@/hooks/useChartTheme';

interface Point {
  x: number;
  y: number;
  dot: HoldDot;
}

export function HoldTooltip({
  active,
  payload,
  measure,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Point }>;
  measure: HoldMeasure;
  currency: string;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  const { trade, minutes, value } = point.dot;
  return (
    <div
      dir={language().dir}
      className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-2xl shadow-black/40"
    >
      <div className="mb-1 font-medium text-fg">
        <span dir="auto">{trade.symbol}</span> · {formatShortDate(tradeDay(trade))}
      </div>
      <div className="space-y-0.5 text-muted">
        <div className={`num text-sm ${value > 0 ? 'text-profit' : value < 0 ? 'text-loss' : 'text-fg'}`}>
          {measure === 'R' ? formatR(value) : formatMoney(value, currency, { sign: true })}
        </div>
        <div>{tr('rep.holdVs.held', { duration: formatDuration(minutes) })}</div>
      </div>
    </div>
  );
}

/**
 * Reports → hold time against result: a dot for each trade, how long it was
 * held (a log scale, so a minute and a week both fit) against its R or net.
 * Tapping a dot opens the trade.
 */
export function HoldTimeChart({
  dots,
  measure,
  currency,
  onOpen,
}: {
  dots: HoldDot[];
  measure: HoldMeasure;
  currency: string;
  onOpen: (trade: Trade) => void;
}) {
  const theme = useChartTheme();
  if (!dots.length) return null;
  const data: Point[] = dots.map((dot) => ({ x: Math.max(dot.minutes, HOLD_SHORTEST), y: dot.value, dot }));
  const { lo, hi, marks } = holdAxis(data.map((p) => p.x));
  // money hidden: no axis, rather than ••• at every tick
  const noAxis = measure === 'net' && isMoneyHidden();

  return (
    // left to right in every language, like the other charts; Arabic labels read right to left inside it
    <ResponsiveContainer width="100%" height="100%" style={{ direction: 'ltr' }}>
      <ScatterChart margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={theme.grid} />
        <XAxis
          type="number"
          dataKey="x"
          scale="log"
          domain={[lo, hi]}
          ticks={marks.length ? marks : undefined}
          allowDataOverflow
          tick={{ fill: theme.axis }}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          tickMargin={6}
          tickFormatter={(v: number) => formatAxisDuration(v)}
        />
        <YAxis
          type="number"
          dataKey="y"
          hide={noAxis}
          tick={{ fill: theme.axis }}
          tickLine={false}
          axisLine={false}
          width={measure === 'R' ? 56 : 66}
          tickFormatter={(v: number) => (measure === 'R' ? formatR(v) : formatAxisMoney(v, currency))}
        />
        <ReferenceLine y={0} stroke={theme.axis} />
        <Tooltip
          cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }}
          content={<HoldTooltip measure={measure} currency={currency} />}
        />
        <Scatter
          data={data}
          isAnimationActive={false}
          cursor="pointer"
          onClick={(point) => {
            const dot = (point.payload as Point | undefined)?.dot;
            if (dot) onOpen(dot.trade);
          }}
        >
          {data.map((p) => (
            <Cell
              key={p.dot.trade.id}
              fill={p.y > 0 ? theme.profit : p.y < 0 ? theme.loss : theme.axis}
              fillOpacity={0.75}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
