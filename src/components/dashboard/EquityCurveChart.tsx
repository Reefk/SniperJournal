'use client';

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EquityPoint } from '@/lib/stats';
import { formatAxisMoney, formatShortDate } from '@/lib/format';
import { useChartTheme } from '@/hooks/useChartTheme';
import { EquityTooltip } from './ChartTooltip';

export function EquityCurveChart({
  points,
  currency,
  startingBalance,
}: {
  points: EquityPoint[];
  currency: string;
  startingBalance: number;
}) {
  const theme = useChartTheme();
  const last = points[points.length - 1];
  const up = last.equity >= startingBalance;
  const stroke = up ? theme.profit : theme.loss;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={points}
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
          minTickGap={48}
          tickFormatter={(v: string) => (v === 'Start' ? 'Start' : formatShortDate(v))}
        />
        <YAxis
          tick={{ fill: theme.axis }}
          tickLine={false}
          axisLine={false}
          width={74}
          domain={['auto', 'auto']}
          tickFormatter={(v: number) => formatAxisMoney(v, currency)}
        />
        {startingBalance > 0 && <ReferenceLine y={startingBalance} stroke={theme.axis} strokeDasharray="3 4" />}
        <Tooltip
          cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }}
          content={<EquityTooltip currency={currency} />}
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
