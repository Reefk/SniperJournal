'use client';

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DayAgg } from '@/lib/stats';
import { formatAxisMoney, formatShortDate } from '@/lib/format';
import { useChartTheme } from '@/hooks/useChartTheme';
import { DayTooltip } from './ChartTooltip';

export function DailyPnlChart({ days, currency }: { days: DayAgg[]; currency: string }) {
  const theme = useChartTheme();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={days} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: theme.axis }}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          minTickGap={28}
          tickFormatter={formatShortDate}
        />
        <YAxis
          tick={{ fill: theme.axis }}
          tickLine={false}
          axisLine={false}
          width={66}
          tickFormatter={(v: number) => formatAxisMoney(v, currency)}
        />
        <ReferenceLine y={0} stroke={theme.axis} />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.4 }} content={<DayTooltip currency={currency} />} />
        <Bar dataKey="net" radius={[3, 3, 0, 0]} maxBarSize={34}>
          {days.map((d) => (
            <Cell key={d.day} fill={d.net >= 0 ? theme.profit : theme.loss} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
