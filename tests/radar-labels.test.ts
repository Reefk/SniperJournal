// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SniperScoreChart } from '@/components/dashboard/SniperScoreChart';
import { NAME_GAP, nameLines, radarLayout } from '@/lib/radar-labels';
import type { SniperScore } from '@/lib/stats';
import { mount, until } from './render';

// the chart's colours come from the journal's theme: here, without a journal, the dark one's
vi.mock('@/hooks/useChartTheme', () => ({
  useChartTheme: () => ({ grid: '#222c42', muted: '#8b97ad', accent: '#818cf8' }),
}));

/**
 * The Sniper Score radar's axis names (src/lib/radar-labels.ts): recharts drew
 * each on one line, and at 1180 px the chart's edge cut the wider ones (Spanish
 * "Riesgo-beneficio" by 39 px, Russian "Риск:прибыль" by 25). jsdom measures
 * no text, so here every letter is 6 px wide; the real thing was measured in Edge.
 */
const width = (text: string) => text.length * 6;

describe("an axis name's lines", () => {
  it('is one line where it fits', () => {
    expect(nameLines('Win rate', 48, width)).toEqual(['Win rate']);
  });

  it('goes on two where it does not, split where the lines are most even', () => {
    // "Factor" + "de beneficio" would leave a 72 px line; "Factor de" + "beneficio", 54 px
    expect(nameLines('Factor de beneficio', 60, width)).toEqual(['Factor de', 'beneficio']);
  });

  it('keeps a hyphen or a colon at the end of the first line, an Arabic one too', () => {
    expect(nameLines('Riesgo-beneficio', 60, width)).toEqual(['Riesgo-', 'beneficio']);
    expect(nameLines('Risk:reward', 48, width)).toEqual(['Risk:', 'reward']);
    expect(nameLines('المخاطرة:العائد', 60, width)).toEqual(['المخاطرة:', 'العائد']);
  });

  it('stays on one line when it has nowhere to split, however narrow the room', () => {
    expect(nameLines('Исполнение', 30, width)).toEqual(['Исполнение']);
    // a hyphen or a space at either end is no place to split
    expect(nameLines('-Edge-', 12, width)).toEqual(['-Edge-']);
  });
});

describe('the names around the web, and its size', () => {
  // four axes: the top, the right, the bottom and the left of a web 60 px in a chart 200 px
  // wide; a name at the right or left has 100 - 2 - (60 + 8) = 30 px, one at the top or
  // bottom the whole width
  it('leaves the web as it is where every name fits', () => {
    const layout = radarLayout(['Top', 'Right', 'Bottom', 'Left'], 200, 60, width);
    expect(layout).toEqual({ radius: 60, lines: [['Top'], ['Right'], ['Bottom'], ['Left']] });
  });

  it('puts a name too wide for its side on two lines', () => {
    // 42 px, and 18 a line
    const layout = radarLayout(['Top', 'Abc def', 'Bottom', 'Left'], 200, 60, width);
    expect(layout.lines[1]).toEqual(['Abc', 'def']);
    expect(layout.radius).toBe(60);
  });

  it('draws the web smaller as far as a line that still does not fit needs', () => {
    // "Profit" and "factor" are 36 px each: the web comes in to 100 - 2 - 36 - 8 = 54 px
    const layout = radarLayout(['Top', 'Profit factor', 'Bottom', 'Left'], 200, 60, width);
    expect(layout.lines[1]).toEqual(['Profit', 'factor']);
    expect(layout.radius).toBe(54);
  });

  it('never draws the web smaller than half, whatever the names', () => {
    const layout = radarLayout(['Top', 'Right', 'Bottom', 'Abcdefghijklmnop'], 200, 60, width);
    expect(layout.radius).toBe(30);
  });

  it('gives a name at the top or the bottom the whole width', () => {
    const top = 'A name wider than either side';
    const layout = radarLayout([top, 'Right', 'Bottom', 'Left'], 200, 60, width);
    expect(layout.lines[0]).toEqual([top]);
    expect(layout.radius).toBe(60);
  });

  it('sees a side axis by how far out to the side it points', () => {
    // seven axes, as the Sniper Score has: the second points 38.6° above the right, so its
    // name has 129 - 2 - (72 + 8) × cos 38.6° = 64.5 px in a chart 258 px wide
    const names = ['Top', 'x'.repeat(10), 'a', 'b', 'c', 'd', 'e'];
    expect(radarLayout(names, 258, 72, width).radius).toBe(72);
    names[1] = 'x'.repeat(11);
    // 66 px: no room, and nowhere to split
    expect(radarLayout(names, 258, 72, width).radius).toBeCloseTo(
      (129 - 2 - 66) / Math.cos((38.571 * Math.PI) / 180) - NAME_GAP,
      1,
    );
  });
});

describe('the Sniper Score radar, drawn', () => {
  const score = (names: string[]): SniperScore => ({
    axes: names.map((axis) => ({ axis, score: 50, rated: true, detail: '' })),
    overall: 50,
    unrated: [],
  });
  const RUSSIAN = ['Винрейт', 'Профит-фактор', 'Риск:прибыль', 'Стабильность', 'Дисциплина', 'Исполнение', 'Терпение'];
  const ONE_LINE = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  // where the top name sits: 8 px over a web of `radius` around the middle, 128 px down
  const topAt = (radius: number) => 128 - radius - NAME_GAP;
  // the web recharts draws unasked: 72% of the most room, (258 - 56) / 2
  const FULL = 0.72 * 101;

  // the chart's box changing size, as the browser reports it
  let resize: (width: number, height: number) => void = () => {};
  // how wide a letter is in the font measured: 6 px, unless a test says otherwise
  let letter = 6;
  const measured = vi.fn((text: string) => ({ width: text.length * letter }));
  // what document.fonts calls when a font has arrived
  let arrivals: Array<() => void> = [];

  // jsdom has no document.fonts: one whose fonts have all arrived, unless a test holds them back
  const fonts = (ready: Promise<unknown>) =>
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        ready,
        addEventListener: (_: string, arrived: () => void) => arrivals.push(arrived),
        removeEventListener: (_: string, arrived: () => void) => {
          arrivals = arrivals.filter((a) => a !== arrived);
        },
      },
    });

  beforeEach(() => {
    letter = 6;
    arrivals = [];
    measured.mockClear();
    // the chart's box, 258 × 256 px at first: the Dashboard's at 1180 px
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private cb: ResizeObserverCallback) {}
        observe(box: Element) {
          const report = (width: number, height: number) =>
            this.cb([{ contentRect: { width, height } } as ResizeObserverEntry], this as never);
          // (recharts watches other boxes too; the chart is drawn at its container's size)
          if (box.classList.contains('recharts-responsive-container')) resize = report;
          report(258, 256);
        }
        disconnect() {}
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      font: '',
      measureText: measured,
    } as unknown as CanvasRenderingContext2D);
    fonts(Promise.resolve());
  });

  // (taken off the page after each test, passed or not: a chart left there adds its names to the next one's)
  let app: Awaited<ReturnType<typeof mount>> | undefined;
  afterEach(async () => {
    await app?.unmount();
    app = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'fonts');
  });

  const draw = async (axes: string[]) => {
    app = await mount(h(SniperScoreChart, { score: score(axes) }));
  };
  const texts = () => [...document.querySelectorAll('.recharts-polar-angle-axis-tick text')];
  const names = () => texts().map((t) => [...t.querySelectorAll('tspan')].map((s) => s.textContent));
  const top = () => Number(texts()[0]?.getAttribute('y'));
  // each line's distance down from the one before it (the first's from the point it is placed at)
  const steps = (i: number) => [...texts()[i].querySelectorAll('tspan')].map((s) => Number(s.getAttribute('dy')));

  it('puts a name too wide for its room on two lines, each its own way round', async () => {
    await draw(RUSSIAN);
    await until(() => names().length === 7 && names()[2].length === 2);
    // the lines of a name on two are each isolated, so an Arabic colon stays on its own side
    const fsi = String.fromCodePoint(0x2068);
    const pdi = String.fromCodePoint(0x2069);
    expect(names()).toEqual([
      ['Винрейт'],
      [fsi + 'Профит-' + pdi, fsi + 'фактор' + pdi],
      [fsi + 'Риск:' + pdi, fsi + 'прибыль' + pdi],
      ['Стабильность'],
      ['Дисциплина'],
      ['Исполнение'],
      ['Терпение'],
    ]);
  });

  it('draws the web smaller for a word that still does not fit, and the names with it', async () => {
    await draw(RUSSIAN);
    await until(() => names()[2]?.length === 2);
    // "Исполнение" (60 px) beside the web's left: (129 - 2 - 60) / cos 12.9° - 8 = 60.7 px
    expect(top()).toBeCloseTo(topAt((129 - 2 - 60) / Math.cos((12.857 * Math.PI) / 180) - NAME_GAP), 1);
  });

  it('keeps every name on one line, and the web as it was, where they fit', async () => {
    await draw(ONE_LINE);
    await until(() => names().length === 7);
    // measured, and nothing to change
    expect(measured).toHaveBeenCalled();
    expect(names().every((lines) => lines.length === 1)).toBe(true);
    expect(top()).toBeCloseTo(topAt(FULL), 1);
  });

  it('puts the first line over the point at the top, around it at the sides, under it at the bottom', async () => {
    // a name at the top too wide for the whole chart (282 px), and one at the bottom too wide
    // for its room (102 px in 92)
    const axes = [...RUSSIAN];
    axes[0] = 'Aaaaaaaaaaaaaaaaaaaaaaa Bbbbbbbbbbbbbbbbbbbbbbb';
    axes[3] = 'Cccccccc Dddddddd';
    axes[6] = 'Ejecución';
    await draw(axes);
    await until(() => names().length === 7 && names()[3].length === 2);
    // the second line 13 px under the first; a capital is 0.71 of the 11 px letters high
    expect(steps(0)).toEqual([-13, 13]);
    expect(steps(1)[0]).toBeCloseTo((0.71 * 11) / 2 - 13 / 2);
    expect(steps(1)[1]).toBe(13);
    expect(steps(3)[0]).toBeCloseTo(0.71 * 11);
    expect(steps(3)[1]).toBe(13);
    // and a name on one line where recharts put it
    expect(steps(6)).toHaveLength(1);
    expect(steps(6)[0]).toBeCloseTo((0.71 * 11) / 2);
  });

  it('waits for the font before measuring: one line and the full web until then', async () => {
    let arrive = () => {};
    fonts(new Promise<void>((r) => (arrive = r)));
    await draw(RUSSIAN);
    await until(() => names().length === 7);
    expect(names().every((lines) => lines.length === 1)).toBe(true);
    expect(top()).toBeCloseTo(topAt(FULL), 1);
    expect(measured).not.toHaveBeenCalled();
    await act(async () => arrive());
    await until(() => names()[2]?.length === 2);
  });

  it("measures again when a font arrives later, as Inter's Cyrillic part does", async () => {
    // at first in a font narrow enough for every name to fit
    letter = 3;
    await draw(RUSSIAN);
    await until(() => names().length === 7 && measured.mock.calls.length > 0);
    expect(names().every((lines) => lines.length === 1)).toBe(true);
    letter = 6;
    act(() => arrivals.forEach((arrived) => arrived()));
    await until(() => names()[2]?.length === 2);
  });

  it('lays the names out again for a new size, or in another language', async () => {
    await draw(RUSSIAN);
    await until(() => names()[2]?.length === 2);
    // 320 × 256, the Dashboard's at 1366 px: room for "Исполнение" and "Профит-фактор" now
    act(() => resize(320, 256));
    await until(() => names()[1]?.length === 1);
    expect(top()).toBeCloseTo(topAt((0.72 * 240) / 2), 1);
    await app?.render(h(SniperScoreChart, { score: score(ONE_LINE) }));
    await until(() => names()[0]?.[0] === 'A');
    expect(names().every((lines) => lines.length === 1)).toBe(true);
  });

  it('draws the names on one line, and the web as recharts does, where nothing can measure them', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await draw(RUSSIAN);
    await until(() => names().length === 7);
    expect(names().every((lines) => lines.length === 1)).toBe(true);
    expect(top()).toBeCloseTo(topAt(FULL), 1);
  });
});
