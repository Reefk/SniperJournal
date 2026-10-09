import type { Trade } from '@/lib/types';

/**
 * Synthetic trades for tests. Every trade is complete and closed unless the
 * test says otherwise, so a test only spells out what it is about.
 */
let next = 0;

export function trade(overrides: Partial<Trade> = {}): Trade {
  next += 1;
  return {
    id: `t${next}`,
    accountId: 'acc1',
    symbol: 'TEST',
    side: 'LONG',
    openedAt: '2026-03-02T10:00',
    closedAt: '2026-03-02T11:00',
    quantity: 1,
    entryPrice: 100,
    exitPrice: 100,
    stopLoss: null,
    takeProfit: null,
    fees: 0,
    multiplier: 1,
    manualPnl: null,
    leverage: null,
    tags: [],
    createdAt: '2026-03-02T11:00:00.000Z',
    updatedAt: '2026-03-02T11:00:00.000Z',
    ...overrides,
  };
}

/** a closed trade whose net P&L is exactly `net` (via the manual P&L field) */
export function pnl(net: number, overrides: Partial<Trade> = {}): Trade {
  return trade({ manualPnl: net, exitPrice: null, ...overrides });
}

/** deterministic pseudo-random numbers, so property tests are repeatable */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
