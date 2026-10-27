import type { JournalData, Trade } from '@/lib/types';
import { STARTING_MISTAKES } from '@/lib/mistakes';
import { pnl } from './helpers';

/**
 * Insights: a journal with every pattern the page looks for in it. A losing trade is a short, in
 * London, NQ, tagged x1, with a starting mistake, rated 1 for discipline, held 90 minutes and,
 * in the setup with rules, broke one; a winner is the opposite, held 20. Mondays are busy and
 * lose, with one loss far bigger than the rest; other days are calm and win; today ends in three
 * losses, past the day's loss limit and trade limit. Two trades in a third setup are too few to
 * compare its rules, once that setup is in the journal.
 */
const two = (n: number) => String(n).padStart(2, '0');
const slot = (date: string, i: number, net: number) => {
  const loss = net < 0;
  const held = loss ? 90 : 20;
  return pnl(net, {
    openedAt: `${date}T${two(8 + i * 2)}:00`,
    closedAt: `${date}T${two(8 + i * 2 + Math.floor(held / 60))}:${two(held % 60)}`,
    symbol: loss || i % 2 === 0 ? 'NQ' : 'ES',
    side: loss ? 'SHORT' : 'LONG',
    session: loss ? 'London' : i % 2 ? 'New York' : 'Asia',
    setupId: i % 2 ? 's1' : 's2',
    ruleChecks: i % 2 ? { r1: !loss, r2: true } : undefined,
    stopLoss: i % 2 ? null : 90,
    entryPrice: 100,
    fees: 6,
    tags: [loss ? 'x1' : 'x2'],
    mistakes: loss ? [STARTING_MISTAKES[1]] : [],
    review: { discipline: loss ? 1 : 5, execution: 3, patience: 3 },
  });
};
const slots = (date: string, nets: number[]) => nets.map((net, i) => slot(date, i, net));
export const INSIGHTS: Trade[] = [
  ...['2026-10-05', '2026-10-19'].flatMap((date) => slots(date, [-30, -40, -35, 20, 25])),
  ...slots('2026-10-12', [-400, -40, -35, 20, 25]),
  ...['06', '07', '08', '09', '13', '14', '15', '16'].flatMap((d) => slots(`2026-10-${d}`, [45, 50])),
  ...slots('2026-10-21', [30, -40, -45, -50]),
  ...[true, false].map((kept, i) =>
    pnl(5, {
      openedAt: `2026-10-10T1${i}:00`,
      closedAt: `2026-10-10T1${i}:20`,
      symbol: 'X',
      setupId: 's3',
      ruleChecks: { r4: kept },
    }),
  ),
];
/** the journal's own setup, with the rules the losers broke */
export const INSIGHT_SETUP: JournalData['setups'][number] = { id: 's1', name: 'S', rules: ['r1', 'r2'] };
/** the second and third setups, which the journal starts without */
export const INSIGHT_SETUPS: JournalData['setups'] = [
  { id: 's2', name: 'T', rules: [] },
  { id: 's3', name: 'U', rules: ['r4'] },
];
/** the day the journal is looked at, with today's three losses in it */
export const INSIGHTS_NOW = new Date(2026, 9, 21, 12);
