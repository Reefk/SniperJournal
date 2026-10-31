'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  type BaseTickContentProps,
} from 'recharts';
import type { SniperScore } from '@/lib/stats';
import { radarLayout } from '@/lib/radar-labels';
import { useChartTheme } from '@/hooks/useChartTheme';
import { ScoreTooltip } from './ChartTooltip';

/** room around the web, for the names beside it */
const MARGIN = { top: 8, right: 28, bottom: 8, left: 28 };
/** the web's share of the most room it could have (recharts' outerRadius, "72%") */
const SHARE = 0.72;
/** the names' size, and the distance from one line of a name to the next, px */
const NAME_SIZE = 11;
const NAME_LINE = 13;
// each line of a name on two goes its own way, an Arabic one right to left, inside the
// chart's left to right: the colon at the end of "المخاطرة:" stays on its left
const ISOLATE = String.fromCodePoint(0x2068);
const END_ISOLATE = String.fromCodePoint(0x2069);

/** how wide a text is at `size` in `family`, px; null where nothing can measure it (jsdom) */
function measurer(size: string, family: string): ((text: string) => number) | null {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return null;
  context.font = `${size} ${family}`;
  return (text) => context.measureText(text).width;
}

/** an axis name where recharts puts it, on its lines (one, without a layout yet) */
function AxisName({
  x,
  y,
  textAnchor,
  verticalAnchor,
  payload,
  lines,
  fill,
}: Pick<BaseTickContentProps, 'x' | 'y' | 'textAnchor' | 'verticalAnchor' | 'payload'> & {
  lines: string[] | undefined;
  fill: string;
}) {
  const shown = lines ?? [String(payload.value)];
  // the first line's baseline: under the point (bottom), around it (sides) or over it (top),
  // as recharts' own Text puts it, 0.71em being a capital's height
  const cap = 0.71 * NAME_SIZE;
  const first =
    verticalAnchor === 'start'
      ? cap
      : verticalAnchor === 'middle'
        ? cap / 2 - ((shown.length - 1) * NAME_LINE) / 2
        : -(shown.length - 1) * NAME_LINE;
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fill={fill}
      fontSize={NAME_SIZE}
      className="recharts-polar-angle-axis-tick-value"
    >
      {shown.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? first : NAME_LINE}>
          {shown.length > 1 ? ISOLATE + line + END_ISOLATE : line}
        </tspan>
      ))}
    </text>
  );
}

export function SniperScoreChart({ score }: { score: SniperScore }) {
  const theme = useChartTheme();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // the names are measured in the page's font once it has arrived, and again as each font
  // arrives after that: Inter comes in parts, its Cyrillic one when Russian is first drawn
  const [fontsIn, setFontsIn] = useState(0);
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    let live = true;
    const arrived = () => {
      if (live) setFontsIn((n) => n + 1);
    };
    void fonts.ready.then(arrived);
    fonts.addEventListener('loadingdone', arrived);
    return () => {
      live = false;
      fonts.removeEventListener('loadingdone', arrived);
    };
  }, []);

  // a name too wide for the room beside the web goes on two lines, and a word that still
  // doesn't fit draws the web smaller: recharts' one line was cut at the chart's edge
  const names = score.axes.map((a) => a.axis).join('\n');
  const layout = useMemo(() => {
    if (!size || !fontsIn) return null;
    const width = measurer(`${NAME_SIZE}px`, getComputedStyle(document.body).fontFamily);
    if (!width) return null;
    const room = Math.min(size.width - MARGIN.left - MARGIN.right, size.height - MARGIN.top - MARGIN.bottom);
    return radarLayout(names.split('\n'), size.width, (SHARE * Math.max(0, room)) / 2, width);
  }, [size, fontsIn, names]);

  return (
    // left to right in every language, as time runs; Arabic labels read right to left inside it
    <ResponsiveContainer
      width="100%"
      height="100%"
      style={{ direction: 'ltr' }}
      // the chart is drawn at its box's size rounded to whole pixels, so the names are placed for that
      onResize={(width, height) => setSize({ width: Math.round(width), height: Math.round(height) })}
    >
      <RadarChart data={score.axes} outerRadius={layout?.radius ?? `${SHARE * 100}%`} margin={MARGIN}>
        <PolarGrid stroke={theme.grid} />
        <PolarAngleAxis
          dataKey="axis"
          tick={(props: BaseTickContentProps) => (
            <AxisName {...props} lines={layout?.lines[props.index]} fill={theme.muted} />
          )}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Tooltip content={<ScoreTooltip />} />
        <Radar dataKey="score" stroke={theme.accent} fill={theme.accent} fillOpacity={0.22} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
