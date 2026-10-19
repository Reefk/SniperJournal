import { describe, expect, it } from 'vitest';
import { buildInsights, buildSignals } from '@/lib/insights';
import type { Settings, Setup, Trade } from '@/lib/types';
import { pnl } from './helpers';

/**
 * Every signal and insight is a numeric threshold. Each is tested just
 * either side of it, so a rule that moves its line by one fails here.
 */
const settings: Settings = {
  currency: 'USD',
  theme: 'dark',
  timezone: 'local',
  maxDailyLoss: null,
  maxTradesPerDay: null,
};
const pad = (n: number) => String(n).padStart(2, '0');
/** a closed trade netting `net` on 2026-03-`day` (2 Mar is a Monday), opened at `hour`, held an hour */
const on = (day: number, net: number, extra: Partial<Trade> = {}, hour = 10) =>
  pnl(net, {
    openedAt: `2026-03-${pad(day)}T${pad(hour)}:00`,
    closedAt: `2026-03-${pad(day)}T${pad(hour + 1)}:00`,
    ...extra,
  });
const many = <T>(n: number, make: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => make(i));

describe('signals', () => {
  const now = new Date(2026, 2, 10, 16, 0);
  const today = (net: number, i = 0) => on(10, net, {}, 9 + i);
  const ids = (trades: Trade[], s: Partial<Settings> = {}) =>
    buildSignals(trades, { ...settings, ...s }, now).map((x) => x.id);
  const signal = (trades: Trade[], id: string, s: Partial<Settings> = {}) =>
    buildSignals(trades, { ...settings, ...s }, now).find((x) => x.id === id);

  it('says nothing without a closed trade', () => {
    expect(buildSignals([pnl(0, { manualPnl: null, exitPrice: null, closedAt: undefined })], settings, now)).toEqual(
      [],
    );
  });

  it('daily loss limit: 69.998% says nothing, 70% warns, 99.998% still warns, 100% says stop', () => {
    const limit = { maxDailyLoss: 500 };
    expect(ids([today(-349.99)], limit)).not.toContain('daily-loss-near');
    expect(ids([today(-350)], limit)).toContain('daily-loss-near');
    expect(ids([today(-499.99)], limit)).toContain('daily-loss-near');
    expect(ids([today(-500)], limit)).toContain('daily-loss-breached');
    expect(ids([today(-500)], limit)).not.toContain('daily-loss-near');
  });

  it('daily loss limit: none set, or set to 0, or a winning day, says nothing', () => {
    for (const s of [{ maxDailyLoss: null }, { maxDailyLoss: 0 }]) expect(ids([today(-1000)], s)).toEqual([]);
    expect(ids([today(1000)], { maxDailyLoss: 500 })).not.toContain('daily-loss-breached');
  });

  it('trade count: one under the limit says nothing, the limit warns, one over is bad', () => {
    const limit = { maxTradesPerDay: 3 };
    expect(
      ids(
        many(2, (i) => today(1, i)),
        limit,
      ),
    ).not.toContain('trade-count');
    expect(
      signal(
        many(3, (i) => today(1, i)),
        'trade-count',
        limit,
      )?.tone,
    ).toBe('warn');
    expect(
      signal(
        many(4, (i) => today(1, i)),
        'trade-count',
        limit,
      )?.tone,
    ).toBe('bad');
    expect(
      ids(
        many(4, (i) => today(1, i)),
        { maxTradesPerDay: 0 },
      ),
    ).not.toContain('trade-count');
  });

  it('losing streak: two losses after a win say nothing, three do', () => {
    expect(ids([on(2, 5), on(3, -1), on(4, -1)])).not.toContain('losing-streak');
    expect(signal([on(2, 5), on(3, -1), on(4, -1), on(5, -1)], 'losing-streak')?.title).toBe('3 losses in a row');
  });

  it('winning streak: three wins after a loss say nothing, four do', () => {
    expect(ids([on(2, -5), on(3, 1), on(4, 1), on(5, 1)])).not.toContain('winning-streak');
    expect(signal([on(2, -5), on(3, 1), on(4, 1), on(5, 1), on(6, 1)], 'winning-streak')?.title).toBe(
      '4 wins in a row',
    );
  });

  describe('this week against last week (now: 10 Mar)', () => {
    /** days long past, in neither week, to make up the six days the trend needs */
    const filler = (n: number) =>
      many(n, (i) => pnl(1, { openedAt: `2026-01-${pad(i + 1)}T10:00`, closedAt: `2026-01-${pad(i + 1)}T11:00` }));

    it('needs six trading days: five say nothing', () => {
      expect(ids([...filler(4), on(9, 10)])).not.toContain('week-trend');
      expect(ids([...filler(5), on(9, 10)])).toContain('week-trend');
    });

    it('ahead is "Better", level is "Behind"', () => {
      expect(signal([...filler(4), on(2, 5), on(9, 6)], 'week-trend')).toMatchObject({
        tone: 'good',
        title: 'Better than last week',
      });
      expect(signal([...filler(4), on(2, 5), on(9, 5)], 'week-trend')).toMatchObject({
        tone: 'info',
        title: 'Behind last week',
      });
    });

    it('two quiet weeks say nothing', () => {
      expect(ids(filler(6))).not.toContain('week-trend');
    });

    it('7 days ago belongs to last week, and 14 days ago to neither', () => {
      // 24 Feb is 14 days before: counted, last week would be -80 and this week ahead
      const trades = [
        ...filler(3),
        pnl(-100, { openedAt: '2026-02-24T10:00', closedAt: '2026-02-24T11:00' }),
        on(3, 20),
        on(5, 10),
      ];
      expect(signal(trades, 'week-trend')?.title).toBe('Behind last week');
    });
  });
});

describe('insights', () => {
  const insight = (trades: Trade[], id: string, setups: Setup[] = []) =>
    buildInsights(trades, setups, settings).find((x) => x.id === id);
  const has = (trades: Trade[], id: string, setups: Setup[] = []) => Boolean(insight(trades, id, setups));

  it('four closed trades say nothing, five do', () => {
    expect(
      buildInsights(
        many(4, () => pnl(10)),
        [],
        settings,
      ),
    ).toEqual([]);
    expect(
      has(
        many(5, () => pnl(10)),
        'expectancy',
      ),
    ).toBe(true);
  });

  it('expectancy: exactly 0 a trade counts as losing, a cent above as positive', () => {
    expect(insight([pnl(10), pnl(-10), pnl(10), pnl(-10), pnl(0)], 'expectancy')?.tone).toBe('bad');
    expect(insight([pnl(10), pnl(-10), pnl(10), pnl(-10), pnl(0.05)], 'expectancy')?.tone).toBe('good');
  });

  it('break-even margin: none is bad, a sliver warns, just under 5 points warns, just over is good', () => {
    const book = (wins: number, win: number, losses: number, loss: number) => [
      ...many(wins, () => pnl(win)),
      ...many(losses, () => pnl(-loss)),
    ];
    const tone = (trades: Trade[]) => insight(trades, 'break-even-wr')?.tone;
    expect(tone(book(5, 10, 5, 10))).toBe('bad'); // 50% won, 50% needed
    expect(tone(book(5, 10.01, 5, 10))).toBe('warn'); // 0.02 points over
    // 65% won against 60% needed is exactly 5 points: still a warning
    expect(tone(book(13, 10, 7, 15))).toBe('warn');
    // a cent less on the losses and it is just over 5: good
    expect(tone(book(13, 10, 7, 14.99))).toBe('good');
  });

  it('sessions: compared once two have at least four trades each', () => {
    const london = many(4, () => pnl(10, { session: 'London' }));
    expect(has([...london, ...many(3, () => pnl(-5, { session: 'Asia' }))], 'session')).toBe(false);
    expect(insight([...london, ...many(4, () => pnl(-5, { session: 'Asia' }))], 'session')?.title).toBe(
      'London is your most profitable session',
    );
  });

  it('weekdays: the worst day is named once it is below zero, not at zero', () => {
    const mondays = many(4, (i) => on(2, 10, {}, 9 + i));
    expect(has([...mondays, ...[5, -5, 5, -5].map((v, i) => on(3, v, {}, 9 + i))], 'weekday')).toBe(false);
    expect(insight([...mondays, ...[5, -5, 5, -5.01].map((v, i) => on(3, v, {}, 9 + i))], 'weekday')?.title).toBe(
      'Tue is costing you',
    );
  });

  it('symbols: the worst is named once it has four trades and is below zero', () => {
    const aapl = many(4, () => pnl(10, { symbol: 'AAPL' }));
    expect(has([...aapl, ...many(3, () => pnl(-1, { symbol: 'TSLA' }))], 'symbol')).toBe(false);
    expect(has([...aapl, ...[1, -1, 1, -1].map((v) => pnl(v, { symbol: 'TSLA' }))], 'symbol')).toBe(false);
    expect(has([...aapl, ...[1, -1, 1, -1.01].map((v) => pnl(v, { symbol: 'TSLA' }))], 'symbol')).toBe(true);
  });

  it('setups: compared once two have four trades each, a deleted one named as unknown', () => {
    const orb: Setup = { id: 'orb', name: 'ORB', rules: [] };
    const best = many(4, () => pnl(10, { setupId: 'orb' }));
    expect(has([...best, ...many(3, () => pnl(-5, { setupId: 'gone' }))], 'setup', [orb])).toBe(false);
    const found = insight([...best, ...many(4, () => pnl(-5, { setupId: 'gone' }))], 'setup', [orb]);
    expect(found?.title).toBe('"ORB" is your best playbook setup');
    expect(found?.body).toContain('"Unknown setup"');
  });

  it('tags: a losing tag is named at four trades, not three, and not at zero', () => {
    const rest = many(4, () => pnl(10));
    expect(has([...rest, ...many(3, () => pnl(-1, { tags: ['fomo'] }))], 'tag')).toBe(false);
    expect(has([...rest, ...[1, -1, 1, -1].map((v) => pnl(v, { tags: ['fomo'] }))], 'tag')).toBe(false);
    expect(insight([...rest, ...many(4, () => pnl(-1, { tags: ['fomo'] }))], 'tag')?.title).toBe(
      'Trades tagged "fomo" lose money',
    );
  });

  it('long against short: a 15-point gap in win rate is named, 10 is not', () => {
    const side = (longWins: number, shortWins: number) => [
      ...many(20, (i) => pnl(i < longWins ? 10 : -10, { side: 'LONG' })),
      ...many(20, (i) => pnl(i < shortWins ? 10 : -10, { side: 'SHORT' })),
    ];
    expect(has(side(13, 10), 'side')).toBe(true); // 65% against 50%
    expect(has(side(12, 10), 'side')).toBe(false); // 60% against 50%
  });

  describe('busy days', () => {
    const busy = (day: number, net: number, trades = 4) => many(trades, (i) => on(day, net / trades, {}, 9 + i));
    const calm = (day: number, net: number) => [on(day, net)];

    it('three busy days of six, worse than the calm ones, are named', () => {
      expect(
        has(
          [...busy(2, -4), ...busy(3, -4), ...busy(4, -4), ...calm(5, 5), ...calm(6, 5), ...calm(9, 5)],
          'overtrading',
        ),
      ).toBe(true);
    });

    it('a day of three trades is not busy, so two busy days say nothing', () => {
      expect(
        has(
          [...busy(2, -4), ...busy(3, -4), ...busy(4, -3, 3), ...calm(5, 5), ...calm(6, 5), ...calm(9, 5)],
          'overtrading',
        ),
      ).toBe(false);
    });

    it('five trading days say nothing', () => {
      expect(has([...busy(2, -4), ...busy(3, -4), ...busy(4, -4), ...calm(5, 5), ...calm(6, 5)], 'overtrading')).toBe(
        false,
      );
    });

    it('calm days no better than busy ones say nothing', () => {
      expect(
        has([...busy(2, 4), ...busy(3, 4), ...busy(4, 4), ...calm(5, 4), ...calm(6, 4), ...calm(9, 4)], 'overtrading'),
      ).toBe(false);
    });
  });

  describe('the trade after a loss', () => {
    /** on each day a loss, then the trade after it; plus a winner elsewhere */
    const days = (n: number, after: number) => [
      ...many(n, (i) => [on(2 + i, -10, {}, 9), on(2 + i, after, {}, 11)]).flat(),
      on(20, 50),
    ];

    it('three trades after a same-day loss say nothing, four are compared', () => {
      expect(has(days(3, -5), 'revenge')).toBe(false);
      expect(insight(days(4, -5), 'revenge')?.tone).toBe('bad');
    });

    it('below the normal trade but above zero warns, rather than calling it bad', () => {
      // after a loss each earns 1, below the average trade of (4 x -10 + 4 x 1 + 100) / 9 = 7.1
      const trades = [...many(4, (i) => [on(2 + i, -10, {}, 9), on(2 + i, 1, {}, 11)]).flat(), on(20, 100)];
      expect(insight(trades, 'revenge')?.tone).toBe('warn');
    });

    it('no worse than the normal trade says nothing', () => {
      // every trade after a loss earns 30, more than the average trade
      expect(has(days(4, 30), 'revenge')).toBe(false);
    });
  });

  it('holding losers: exactly 1.3 times the winners says nothing, longer is named', () => {
    const held = (lossMinutes: number) => [
      ...many(3, (i) => pnl(10, { openedAt: `2026-03-0${2 + i}T10:00`, closedAt: `2026-03-0${2 + i}T11:40` })), // 100 min
      ...many(2, (i) =>
        pnl(-5, {
          openedAt: `2026-03-0${5 + i}T10:00`,
          closedAt: new Date(Date.UTC(2026, 2, 5 + i, 10, lossMinutes)).toISOString().slice(0, 16),
        }),
      ),
    ];
    expect(has(held(130), 'hold-asymmetry')).toBe(false);
    expect(has(held(131), 'hold-asymmetry')).toBe(true);
  });

  it('stops: 70% of trades with one says nothing, 60% is named', () => {
    const withStops = (n: number) => many(10, (i) => pnl(10, { stopLoss: i < n ? 95 : null }));
    expect(has(withStops(7), 'stops')).toBe(false);
    expect(insight(withStops(6), 'stops')?.title).toBe('Only 60% of your trades record a stop');
  });

  it('outlier loss: needs four losses, and one more than 2.5 times their average', () => {
    const losses = (big: number, small = 3) => [...many(small, () => pnl(-10)), pnl(-big), ...many(4, () => pnl(20))];
    expect(has(losses(50), 'outlier-loss')).toBe(false); // 50 against an average of 20: exactly 2.5 times
    expect(has(losses(50.01), 'outlier-loss')).toBe(true);
    expect(has(losses(500, 2), 'outlier-loss')).toBe(false); // only three losses
  });

  describe('fees', () => {
    /** five winners netting 10 each after `fees` each */
    const winners = (fees: number) => many(5, () => pnl(10 + fees, { fees }));

    it('up to 15% of gross profit says nothing, over 15% warns', () => {
      expect(has(winners(1.5), 'fees')).toBe(false); // 7.5 of 50: 15%
      expect(insight(winners(1.51), 'fees')).toMatchObject({
        tone: 'warn',
        title: 'Commissions are eating a large share of your profit',
      });
    });

    it('fees that turn a winning record into a losing one are bad, even with no winning trade', () => {
      // each trade made 0.5 before a fee of 1: no winner, -2.5 after fees, +2.5 before
      expect(
        insight(
          many(5, () => pnl(0.5, { fees: 1 })),
          'fees',
        )?.tone,
      ).toBe('bad');
      // made exactly the fees back: even before fees, so nothing to blame them for
      expect(
        has(
          many(5, () => pnl(1, { fees: 1 })),
          'fees',
        ),
      ).toBe(false);
    });
  });

  describe('discipline ratings', () => {
    const rated = (discipline: number, net: number) => pnl(net, { review: { discipline } });

    it('eight rated trades, three or more at each end, the disciplined ones better: named', () => {
      const trades = [...many(4, () => rated(5, 10)), ...many(4, () => rated(1, -10))];
      expect(has(trades, 'discipline')).toBe(true);
    });

    it('seven rated trades say nothing', () => {
      expect(has([...many(4, () => rated(5, 10)), ...many(3, () => rated(1, -10))], 'discipline')).toBe(false);
    });

    it('only two at one end say nothing', () => {
      expect(
        has(
          [...many(2, () => rated(5, 10)), ...many(3, () => rated(3, 0)), ...many(3, () => rated(1, -10))],
          'discipline',
        ),
      ).toBe(false);
      expect(
        has(
          [...many(3, () => rated(4, 10)), ...many(3, () => rated(3, 0)), ...many(2, () => rated(2, -10))],
          'discipline',
        ),
      ).toBe(false);
    });

    it('disciplined trades no better than rushed ones say nothing', () => {
      expect(has([...many(4, () => rated(5, 10)), ...many(4, () => rated(1, 10))], 'discipline')).toBe(false);
    });
  });
});
