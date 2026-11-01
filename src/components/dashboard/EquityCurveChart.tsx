'use client';

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { equityInPercent, type EquityPoint } from '@/lib/stats';
import { formatAxisMoney, formatAxisPct, formatShortDate, isMoneyHidden } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { useChartTheme } from '@/hooks/useChartTheme';
import { EquityTooltip } from './ChartTooltip';

export function EquityCurveChart({
  points,
  currency,
  startingBalance,
  inPercent = false,
}: {
  points: EquityPoint[];
  currency: string;
  startingBalance: number;
  /** privacy mode: the balance as its change from `startingBalance`, in %, the curve's shape the same */
  inPercent?: boolean;
}) {
  const theme = useChartTheme();
  const last = points[points.length - 1];
  const up = last.equity >= startingBalance;
  const stroke = up ? theme.profit : theme.loss;
  const shown = inPercent ? equityInPercent(points, startingBalance) : points;
  // how much the axis covers, so its labels tell the ticks apart
  const span =
    shown.reduce((hi, p) => Math.max(hi, p.equity), -Infinity) -
    shown.reduce((lo, p) => Math.min(lo, p.equity), Infinity);
  // amounts hidden with no starting balance to measure against: no axis, rather than ••• at every tick
  const noAxis = isMoneyHidden() && !inPercent;

  return (
    // left to right in every language, as time runs; Arabic labels read right to left inside it
    <ResponsiveContainer width="100%" height="100%" style={{ direction: 'ltr' }}>
      <AreaChart
        data={shown}
        margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
        className={up ? 'glow-line' : undefined}
      >
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: theme.axis }}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          // the dates a little lower, so the first ("Start") clears the lowest amount at the corner
          tickMargin={6}
          minTickGap={48}
          tickFormatter={(v: string) => (v === 'Start' ? tr('dash.start') : formatShortDate(v))}
        />
        <YAxis
          hide={noAxis}
          tick={{ fill: theme.axis }}
          tickLine={false}
          axisLine={false}
          width={74}
          domain={['auto', 'auto']}
          // the labels count on recharts' default five ticks (tickCount): fewer would put them further apart, more closer
          tickFormatter={(v: number) => (inPercent ? formatAxisPct(v) : formatAxisMoney(v, currency, span))}
        />
        {startingBalance > 0 && (
          <ReferenceLine y={inPercent ? 0 : startingBalance} stroke={theme.axis} strokeDasharray="3 4" />
        )}
        <Tooltip
          cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }}
          content={<EquityTooltip currency={currency} inPercent={inPercent} />}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke={stroke}
          strokeWidth={2}
          fill="url(#equityFill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
