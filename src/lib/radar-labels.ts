/**
 * The Sniper Score radar's axis names (src/components/dashboard/SniperScoreChart.tsx):
 * on how many lines, and how big the web can be with them beside it. Recharts
 * puts each name a little way out from the web, on one line: starting there on
 * the right, ending there on the left, centred at the top and the bottom. A
 * name wider than the room left to the chart's edge was cut at it (at 1180 px,
 * Spanish "Riesgo-beneficio" by 39 px, Russian "Риск:прибыль" by 25, English
 * "Risk:reward" by 11).
 */

/** how far out from the web a name sits (recharts' tick size) */
export const NAME_GAP = 8;
/** what a name keeps from the chart's edge */
const EDGE = 2;
/** a cosine this small is the top or the bottom: a name centred there (recharts' own) */
const EPS = 1e-5;

/**
 * A name on one line if it fits in `room` px, or else on two: split after a
 * space (dropped), a hyphen or a colon (kept on the first line), wherever that
 * makes the wider line narrowest. One line still where it can't be split, or
 * where no split is narrower.
 */
export function nameLines(name: string, room: number, width: (text: string) => number): string[] {
  let lines = [name];
  let widest = width(name);
  if (widest <= room) return lines;
  for (let i = 1; i < name.length - 1; i++) {
    const at = name[i];
    if (at !== ' ' && at !== '-' && at !== ':') continue;
    const split = [name.slice(0, at === ' ' ? i : i + 1).trimEnd(), name.slice(i + 1).trimStart()];
    if (!split[0] || !split[1]) continue;
    const wide = Math.max(width(split[0]), width(split[1]));
    if (wide < widest) {
      lines = split;
      widest = wide;
    }
  }
  return lines;
}

export interface RadarLayout {
  /** the web's radius, px */
  radius: number;
  /** each name's lines, in the axes' order */
  lines: string[][];
}

/**
 * The names' lines, and the web's radius, in a chart `chartWidth` px wide whose
 * web would be `radius` px. The axes go clockwise from the top, as recharts
 * draws them, and the web sits in the middle. A name too wide for the room
 * beside it goes on two lines; a line that still doesn't fit (a single long
 * word) draws the web smaller, down to half its size, so the line moves in.
 * (The lines are chosen beside the full-size web: one of them that would fit on
 * one line beside the smaller web stays on two.)
 */
export function radarLayout(
  names: string[],
  chartWidth: number,
  radius: number,
  width: (text: string) => number,
): RadarLayout {
  const half = chartWidth / 2;
  // how far right (+) or left (-) of the middle each name sits, per px out from it
  const across = names.map((_, i) => Math.cos(((90 - (i * 360) / names.length) * Math.PI) / 180));
  const lines = names.map((name, i) => {
    const side = Math.abs(across[i]);
    // centred, a name has the whole width; beside the web, what is left between it and the edge
    const room = side < EPS ? chartWidth - 2 * EDGE : half - EDGE - (radius + NAME_GAP) * side;
    return nameLines(name, room, width);
  });
  let fits = radius;
  lines.forEach((name, i) => {
    const side = Math.abs(across[i]);
    if (side < EPS) return;
    const widest = Math.max(...name.map(width));
    fits = Math.min(fits, (half - EDGE - widest) / side - NAME_GAP);
  });
  return { radius: Math.max(fits, radius / 2), lines };
}
