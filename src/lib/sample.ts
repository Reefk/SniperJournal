import type { Setup, Trade } from './types';
import { detectSession } from './sessions';
import { pad2, uid } from './utils';

/**
 * TEST DATA ONLY.
 * Everything produced here is flagged isSample so it can be wiped in one
 * click. Nothing in the app generates trades unless the user asks for it.
 */

// deterministic RNG so "load test data" gives a believable, stable set
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// `tick` is the unit a stop is measured in for that instrument, so the
// generated stop distances stay in a range a real trader would use
const SYMBOLS = [
  { symbol: 'NVDA', price: 118, tick: 0.05, decimals: 2, mult: 1 },
  { symbol: 'PLTR', price: 42, tick: 0.02, decimals: 2, mult: 1 },
  { symbol: 'HOOD', price: 27, tick: 0.02, decimals: 2, mult: 1 },
  { symbol: 'LYFT', price: 14, tick: 0.01, decimals: 2, mult: 1 },
  { symbol: 'AAPL', price: 221, tick: 0.08, decimals: 2, mult: 1 },
  { symbol: 'TSLA', price: 248, tick: 0.15, decimals: 2, mult: 1 },
  { symbol: 'SPY', price: 571, tick: 0.1, decimals: 2, mult: 1 },
  { symbol: 'EURUSD', price: 1.0864, tick: 0.0001, decimals: 5, mult: 1 },
  { symbol: 'BTCUSD', price: 64200, tick: 40, decimals: 2, mult: 1 },
  { symbol: 'ES', price: 5720, tick: 0.25, decimals: 2, mult: 50 },
];

const TAGS = ['planned', 'breakout', 'pullback', 'news', 'fomo', 'early entry', 'moved stop', 'A+ setup', 'tired', 'oversized'];

export function sampleSetups(): Setup[] {
  return [
    {
      id: uid(),
      name: 'Opening Range Breakout',
      description: 'Break and hold of the first 15 minute range, taken only in the direction of the daily trend.',
      rules: ['Wait for the first 15 minutes to complete', 'Enter on the retest, not the first push', 'Stop below the range mid', 'Target 2R or the prior day high'],
      color: '#6366f1',
      isSample: true,
    },
    {
      id: uid(),
      name: 'VWAP Reclaim',
      description: 'Price loses VWAP, flushes, then reclaims it with volume.',
      rules: ['Must reclaim within 30 minutes of losing it', 'Volume on the reclaim candle above average', 'Stop under the flush low', 'Scale half at 1R'],
      color: '#34d399',
      isSample: true,
    },
    {
      id: uid(),
      name: 'Trend Pullback',
      description: 'Buying the first controlled pullback into a rising moving average.',
      rules: ['Higher highs and higher lows on the 5 minute', 'Pullback on falling volume', 'Entry on the reversal candle close', 'No entry in the last hour'],
      color: '#f59e0b',
      isSample: true,
    },
  ];
}

export function generateSampleData(accountId: string): { trades: Trade[]; setups: Setup[] } {
  const rand = mulberry32(20260101);
  const setups = sampleSetups();
  const trades: Trade[] = [];
  const now = new Date().toISOString();

  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - 95);

  while (day <= new Date() && trades.length < 95) {
    const weekday = day.getDay();
    // weekdays only, and not every weekday is a trading day
    if (weekday !== 0 && weekday !== 6 && rand() > 0.42) {
      const count = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < count; i++) {
        const spec = SYMBOLS[Math.floor(rand() * SYMBOLS.length)];
        const side = rand() > 0.38 ? 'LONG' : 'SHORT';
        const hour = 9 + Math.floor(rand() * 8);
        const minute = Math.floor(rand() * 60);
        const openedAt = `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}T${pad2(hour)}:${pad2(minute)}`;
        const holdMins = 8 + Math.floor(rand() * 180);
        const close = new Date(day);
        close.setHours(hour, minute + holdMins);

        const entry = Number((spec.price * (1 + (rand() - 0.5) * 0.04)).toFixed(spec.decimals));
        const riskTicks = 12 + Math.floor(rand() * 40);
        const stopDistance = riskTicks * spec.tick;
        const dir = side === 'LONG' ? 1 : -1;
        const stopLoss = Number((entry - stopDistance * dir).toFixed(spec.decimals));
        const rr = 1.2 + rand() * 1.6;
        const takeProfit = Number((entry + stopDistance * rr * dir).toFixed(spec.decimals));

        // a positive but imperfect edge, so the sample looks like a real trader
        const roll = rand();
        const rMultipleOutcome = roll < 0.47 ? rr * (0.75 + rand() * 0.45) : roll < 0.56 ? (rand() - 0.5) * 0.3 : -(0.75 + rand() * 0.4);
        const exitPrice = Number((entry + stopDistance * rMultipleOutcome * dir).toFixed(spec.decimals));

        // size each position off a target risk, the way a real plan would,
        // so the generated equity curve stays in a believable range
        const targetRisk = 140 + rand() * 260;
        const rawQty = targetRisk / (stopDistance * spec.mult);
        const quantity =
          spec.symbol === 'ES' ? Math.max(1, Math.round(rawQty))
          : spec.symbol === 'BTCUSD' ? Math.max(0.01, Number(rawQty.toFixed(3)))
          : spec.symbol === 'EURUSD' ? Math.max(1000, Math.round(rawQty / 1000) * 1000)
          : Math.max(5, Math.round(rawQty));

        const tags: string[] = [];
        if (rand() > 0.55) tags.push(TAGS[Math.floor(rand() * TAGS.length)]);
        if (rand() > 0.85) tags.push(TAGS[Math.floor(rand() * TAGS.length)]);

        const good = rMultipleOutcome > 0;
        const rate = (base: number) => Math.max(1, Math.min(5, Math.round(base + (rand() - 0.5) * 2)));

        trades.push({
          id: uid(),
          accountId,
          symbol: spec.symbol,
          side,
          openedAt,
          closedAt: `${close.getFullYear()}-${pad2(close.getMonth() + 1)}-${pad2(close.getDate())}T${pad2(close.getHours())}:${pad2(close.getMinutes())}`,
          quantity,
          entryPrice: entry,
          exitPrice,
          stopLoss,
          takeProfit,
          fees: Number((0.6 + rand() * 3.4).toFixed(2)),
          multiplier: spec.mult,
          manualPnl: null,
          leverage: spec.symbol === 'EURUSD' ? 10 : spec.symbol === 'BTCUSD' ? 5 : null,
          session: detectSession(openedAt),
          setupId: setups[Math.floor(rand() * setups.length)].id,
          tags: [...new Set(tags)],
          notes: good ? 'Followed the plan, let the runner work.' : 'Entered before confirmation and paid for it.',
          review: { discipline: rate(good ? 4 : 2.5), execution: rate(good ? 4 : 3), patience: rate(good ? 4 : 2.5) },
          excluded: false,
          isSample: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    day.setDate(day.getDate() + 1);
  }

  return { trades, setups };
}
