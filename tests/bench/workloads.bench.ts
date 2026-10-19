import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { it } from 'vitest';
import { importTradesFromCsv, tradesToCsv } from '@/lib/csv';
import { buildInsights } from '@/lib/insights';
import { computeStats, sniperScore } from '@/lib/stats';
import type { JournalData, Trade } from '@/lib/types';
import { normalize } from '@/lib/journal';
import { seeded, trade } from '../helpers';

/**
 * Measurements, not pass/fail tests: `npm run bench`. Each size is a
 * synthetic journal of closed trades spread over many days. Every workload
 * is warmed up, then run repeatedly for about half a second; the median is
 * reported, which is steadier than the mean on a busy machine.
 *
 * Each workload is timed at its own moment, so a machine busy for a few
 * seconds slows some columns of a run and not others, and two columns can
 * move in opposite directions between runs with no code changed. Compare runs
 * made one after another, and look at 'save: stringify', which runs none of
 * the app's code: when it moved with the rest, the machine did.
 *
 * Looked into on 2026-10-19: a 13 Oct run gave 44 ms for CSV export and
 * 31 ms for launch at 10,000 trades, a 19 Oct run 68 and 42. Neither function
 * got heavier. tradesToCsv is unchanged since 9 Oct, and a one-off script
 * timing each on its own at nine commits from 12 to 19 Oct, at 10,000 trades,
 * found export at 30–33 ms and parse+normalize at 18–21 ms throughout
 * (normalize is about 3 ms of that, the rest is JSON.parse). Full runs of
 * 12 and 19 Oct, taken in turn, matched, except one where export, launch and
 * stringify were all about twice as slow.
 */
function journalOf(size: number): Trade[] {
  const rand = seeded(size);
  const symbols = ['ES', 'NQ', 'AAPL', 'TSLA', 'EURUSD', 'BTCUSD'];
  return Array.from({ length: size }, (_, i) => {
    const day = new Date(2020, 0, 1 + Math.floor(i / 6));
    const d = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const entry = 100 + rand() * 50;
    return trade({
      id: `b${i}`,
      symbol: symbols[i % symbols.length],
      side: rand() > 0.5 ? 'LONG' : 'SHORT',
      openedAt: `${d}T${String(9 + (i % 6)).padStart(2, '0')}:00`,
      closedAt: `${d}T${String(10 + (i % 6)).padStart(2, '0')}:30`,
      entryPrice: entry,
      exitPrice: entry + (rand() - 0.47) * 4,
      stopLoss: entry - 2,
      quantity: 1 + Math.floor(rand() * 10),
      fees: 1.2,
      tags: i % 3 ? ['breakout'] : ['fomo', 'late'],
      notes: 'A synthetic note of ordinary length, the kind people write after a trade.',
      review: { discipline: 1 + (i % 5), execution: 3, patience: 4 },
      session: ['London', 'New York', 'Asia'][i % 3],
    });
  });
}

function median(fn: () => void): number {
  for (let i = 0; i < 2; i++) fn();
  const times: number[] = [];
  const until = performance.now() + 500;
  while (times.length < 3 || (performance.now() < until && times.length < 200)) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

const settings = { currency: 'USD', theme: 'dark', timezone: 'local', maxDailyLoss: 500, maxTradesPerDay: 5 } as const;
const accounts = [{ id: 'acc1', name: 'Main', startingBalance: 25000, createdAt: '' }];

it('workload timings', { timeout: 600_000 }, () => {
  const rows: Record<string, Record<string, string>> = {};
  for (const size of [100, 1000, 10000, 50000]) {
    const trades = journalOf(size);
    const csv = tradesToCsv(trades, [], accounts);
    // the same trades as a broker's execution report: one row per fill
    const fills = [
      'time,symbol,side,qty,price,commission',
      ...trades.flatMap((t) =>
        t.exitPrice == null || !t.closedAt
          ? []
          : [
              `${t.openedAt.replace('T', ' ')},${t.symbol},${t.side === 'LONG' ? 'Buy' : 'Sell'},${t.quantity},${t.entryPrice},${t.fees / 2}`,
              `${t.closedAt.replace('T', ' ')},${t.symbol},${t.side === 'LONG' ? 'Sell' : 'Buy'},${t.quantity},${t.exitPrice},${t.fees / 2}`,
            ],
      ),
    ].join('\n');
    const journal: JournalData = {
      version: 1,
      updatedAt: '',
      onboarded: true,
      profile: { name: '' },
      settings,
      accounts,
      activeAccountId: 'acc1',
      trades,
      setups: [],
      resources: [],
    };
    const json = JSON.stringify(journal);
    const ms = (fn: () => void) => `${median(fn).toFixed(2)} ms`;
    // the dashboard works the stats out once and hands them to sniperScore, so
    // sniperScore is timed on its own (until 2026-10-12 this column included a
    // computeStats call)
    const stats = computeStats(trades);
    rows[`${size} trades`] = {
      'journal JSON': `${(json.length / 1024 / 1024).toFixed(2)} MB`,
      computeStats: ms(() => computeStats(trades, 25000)),
      sniperScore: ms(() => sniperScore(trades, stats)),
      buildInsights: ms(() => buildInsights(trades, [], settings)),
      'CSV import': ms(() => importTradesFromCsv(csv, { accountId: 'acc1', accounts, setups: [] })),
      'CSV import, one row per fill': ms(() => importTradesFromCsv(fills, { accountId: 'acc1', accounts, setups: [] })),
      'CSV export': ms(() => tradesToCsv(trades, [], accounts)),
      'save: stringify': ms(() => JSON.stringify(journal)),
      'launch: parse+normalize': ms(() => normalize(JSON.parse(json))),
    };
  }
  // Vitest keeps a passing test's console quiet, so the table also goes to a file
  const out = join(tmpdir(), 'sniper-journal-bench.json');
  writeFileSync(out, JSON.stringify({ node: process.version, rows }, null, 2));
  console.table(rows);
  console.log(`timings written to ${out}`);
});
