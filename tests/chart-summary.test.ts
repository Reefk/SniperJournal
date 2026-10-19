import { describe, expect, it } from 'vitest';
import { dailySummary, equitySummary, scoreSummary } from '@/lib/chart-summary';
import { computeStats, sniperScore, type SniperScore } from '@/lib/stats';
import { pnl } from './helpers';

/**
 * The dashboard's charts in words, for a screen reader (ChartContainer's
 * summary): what each plots, over which days, between which values, and
 * where it ends.
 */
const trades = [
  pnl(99, { openedAt: '2026-03-02T09:30', closedAt: '2026-03-02T10:15' }),
  pnl(-41.5, { openedAt: '2026-03-04T09:45', closedAt: '2026-03-04T12:00' }),
  pnl(5.5, { openedAt: '2026-03-05T14:00', closedAt: '2026-03-05T15:00' }),
  pnl(-20, { openedAt: '2026-03-05T15:10', closedAt: '2026-03-05T15:40' }),
];
const stats = computeStats(trades, 10000);

describe('equitySummary', () => {
  it('names the trades, their days, where the balance starts and ends, and its lowest and highest', () => {
    expect(equitySummary(stats.equity, 'USD')).toBe(
      'Account balance after each of 4 closed trades, 02 Mar 2026 to 05 Mar 2026: ' +
        'from $10,000.00 to $10,043.00, lowest $10,000.00, highest $10,099.00.',
    );
  });

  it('counts a lowest point below the opening balance', () => {
    const down = computeStats(
      [pnl(-50, { closedAt: '2026-03-02T10:00' }), pnl(80, { closedAt: '2026-03-03T10:00' })],
      1000,
    );
    expect(equitySummary(down.equity, 'USD')).toBe(
      'Account balance after each of 2 closed trades, 02 Mar 2026 to 03 Mar 2026: ' +
        'from $1,000.00 to $1,030.00, lowest $950.00, highest $1,030.00.',
    );
  });

  it('says one trade, not "1 trades"', () => {
    expect(equitySummary(computeStats([trades[0]], 0).equity, 'USD')).toContain('each of 1 closed trade,');
  });

  it('with no closed trades, says the balance stays where it opened', () => {
    expect(equitySummary(computeStats([], 2500).equity, 'USD')).toBe(
      'Account balance: no closed trades in this range yet, so it stays at $2,500.00.',
    );
  });

  it('copes with more points than a function call takes arguments', () => {
    const many = Array.from({ length: 200_000 }, (_, i) => ({
      index: i,
      label: '2026-03-02',
      equity: i,
      net: 1,
      peak: i,
    }));
    expect(equitySummary(many, 'USD')).toContain('lowest $0.00, highest $199,999.00.');
  });
});

describe('dailySummary', () => {
  it('names the days, the worst and best, and the last day, with their signs', () => {
    expect(dailySummary(stats.days, 'USD')).toBe(
      'Net P&L of each of 3 trading days, 02 Mar 2026 to 05 Mar 2026: worst -$41.50, best +$99.00, last day -$14.50.',
    );
  });

  it('says one trading day, not "1 trading days"', () => {
    expect(dailySummary(computeStats([trades[0]]).days, 'USD')).toContain('each of 1 trading day,');
  });

  it('with no days, says so', () => {
    expect(dailySummary([], 'USD')).toBe('Daily P&L: no closed trades in this range yet.');
  });
});

describe('scoreSummary', () => {
  const axis = (name: string, score: number, rated = true) => ({ axis: name, score, rated, detail: '' });

  it('lists each rated axis out of 100, the ones not yet rated, and the overall score', () => {
    const score: SniperScore = {
      axes: [axis('Win rate', 70.4), axis('Profit factor', 55.6), axis('Discipline', 0, false)],
      overall: 63,
      unrated: ['Discipline'],
    };
    expect(scoreSummary(score)).toBe(
      'Sniper Score out of 100 on each axis: Win rate 70, Profit factor 56. Not yet rated: Discipline. Overall 63 out of 100.',
    );
  });

  it('with nothing rated, says so and gives no overall score', () => {
    const score = sniperScore([], computeStats([]));
    expect(score.overall).toBeNull();
    expect(scoreSummary(score)).toMatch(/^Sniper Score: no axis rated yet\. Not yet rated: .+\.$/);
  });

  it('with every axis rated, lists none as unrated', () => {
    const score: SniperScore = { axes: [axis('Win rate', 80)], overall: 80, unrated: [] };
    expect(scoreSummary(score)).toBe('Sniper Score out of 100 on each axis: Win rate 80. Overall 80 out of 100.');
  });
});
