'use client';

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { SniperScore } from '@/lib/stats';
import { useChartTheme } from '@/hooks/useChartTheme';
import { ScoreTooltip } from './ChartTooltip';

export function SniperScoreChart({ score }: { score: SniperScore }) {
  const theme = useChartTheme();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={score.axes} outerRadius="72%" margin={{ top: 8, right: 28, bottom: 8, left: 28 }}>
        <PolarGrid stroke={theme.grid} />
        <PolarAngleAxis dataKey="axis" tick={{ fill: theme.muted, fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Tooltip content={<ScoreTooltip />} />
        <Radar dataKey="score" stroke={theme.accent} fill={theme.accent} fillOpacity={0.22} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
