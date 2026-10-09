import { describe, expect, it } from 'vitest';
import { splitByRange } from '@/lib/ranges';
import { computeStats } from '@/lib/stats';
import { accountBalances, openingBalance, realised } from '@/store/selectors';
import { pnl, seeded, trade } from './helpers';

const accounts = [
  { id: 'acc1', name: 'Main', startingBalance: 1000, createdAt: '' },
  { id: 'acc2', name: 'Prop', startingBalance: 50000, createdAt: '' },
];

describe('balances agree with the statistics', () => {
  it('an incomplete import never inflates a balance', () => {
    // an ES exit at 5000 against a missing entry price: +$250,000 if counted
    const bogus = trade({ accountId: 'acc1', entryPrice: 0, exitPrice: 5000, quantity: 1, multiplier: 50 });
    expect(accountBalances({ accounts, trades: [pnl(100, { accountId: 'acc1' }), bogus] }).acc1).toBe(1100);
  });

  it('excluded and open trades leave the balance alone; accounts stay separate', () => {
    const balances = accountBalances({
      accounts,
      trades: [
        pnl(100, { accountId: 'acc1' }),
        pnl(999, { accountId: 'acc1', excluded: true }),
        trade({ accountId: 'acc1', exitPrice: null, closedAt: undefined }),
        pnl(-250, { accountId: 'acc2' }),
      ],
    });
    expect(balances).toEqual({ acc1: 1100, acc2: 49750 });
  });

  it('the account balance is exactly where the all-time equity curve ends', () => {
    const rand = seeded(7);
    for (let k = 0; k < 50; k++) {
      const trades = Array.from({ length: 30 }, (_, i) => {
        const kind = rand();
        const day = `2026-05-${String(1 + (i % 28)).padStart(2, '0')}T10:${String(i).padStart(2, '0')}`;
        if (kind < 0.1) return trade({ accountId: 'acc1', entryPrice: 0, exitPrice: 4000, closedAt: day });
        if (kind < 0.2) return pnl(500, { accountId: 'acc1', excluded: true, closedAt: day });
        return pnl(Math.round((rand() - 0.5) * 40000) / 100, { accountId: 'acc1', closedAt: day });
      });
      const balance = accountBalances({ accounts, trades }).acc1;
      expect(computeStats(trades, 1000).equity.at(-1)?.equity).toBeCloseTo(balance, 6);
    }
  });

  it("a date range's opening balance plus its own results lands on the same balance", () => {
    const now = new Date(2026, 4, 30, 12);
    const trades = [
      pnl(300, { closedAt: '2026-04-01T10:00' }),
      trade({ entryPrice: 0, exitPrice: 4000, closedAt: '2026-04-02T10:00' }), // incomplete, before the range
      pnl(700, { closedAt: '2026-04-03T10:00', excluded: true }), // excluded, before the range
      pnl(-120, { closedAt: '2026-05-28T10:00' }),
      pnl(40, { closedAt: '2026-05-29T10:00' }),
    ];
    const { inRange, before } = splitByRange(trades, '7D', now);
    const opening = openingBalance(1000, before);
    expect(opening).toBe(1300);
    const end = computeStats(inRange, opening).equity.at(-1)?.equity;
    expect(end).toBe(accountBalances({ accounts, trades }).acc1);
  });

  it('a day total counts the same trades as the day cell', () => {
    expect(realised([pnl(10), pnl(-4), pnl(99, { excluded: true }), trade({ entryPrice: 0, exitPrice: 50 })])).toBe(6);
  });
});
