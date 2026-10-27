import { describe, expect, it } from 'vitest';
import { buildInsights, buildSignals } from '@/lib/insights';
import type { Settings, Trade } from '@/lib/types';
import { pnl } from './helpers';
import { INSIGHTS, INSIGHT_SETUP, INSIGHT_SETUPS, INSIGHTS_NOW } from './insights-journal';

/**
 * Every sentence the Insights page writes, word for word, in English, from the journal its
 * screen is drawn with in each language (tests/i18n-views.test.ts). The other languages are
 * checked against the English, so an English sentence changed by mistake would pass there; here
 * it fails. And as that journal sets off every insight and signal listed here, none can drop out
 * of the screens and leave its translations unread.
 */
const settings: Settings = {
  currency: 'USD',
  theme: 'dark',
  timezone: 'local',
  maxDailyLoss: 100,
  maxTradesPerDay: 3,
};
const said = (signals: ReturnType<typeof buildSignals>) =>
  signals.map(({ id, tone, title, body }) => ({ id, tone, title, body }));
const two = (n: number) => String(n).padStart(2, '0');
/** a trade netting `net` on `date`, opened at `hour` */
const on = (date: string, net: number, hour = 10): Trade =>
  pnl(net, { openedAt: `${date}T${two(hour)}:00`, closedAt: `${date}T${two(hour)}:30` });

describe('the English of the Insights page', () => {
  it('says every insight the journal sets off', () => {
    expect(
      buildInsights(INSIGHTS, [INSIGHT_SETUP], settings).map(({ id, tone, title, body, metric }) => ({
        id,
        tone,
        title,
        body,
        metric,
      })),
    ).toEqual([
      {
        id: 'expectancy',
        tone: 'bad',
        title: 'Your system is losing money per trade',
        body: 'Across 37 closed trades the average result is negative. Cutting the worst setup usually matters more than finding a new one.',
        metric: '-$2.57 per trade',
      },
      {
        id: 'break-even-wr',
        tone: 'bad',
        title: 'You need to win 70.0% to break even',
        body: 'You are winning 67.6%, below the break-even line. Either win more often or make your winners bigger relative to your losers.',
        metric: '-2.4 pts of margin',
      },
      {
        id: 'tag',
        tone: 'bad',
        title: 'Trades tagged "x1" lose money',
        body: '12 trades carry this tag and together they are down $892.00 at a 0% win rate. You already named the problem when you tagged them.',
        metric: '12 trades tagged',
      },
      {
        id: 'rules',
        tone: 'bad',
        title: 'Breaking your rules cost you about $419.09',
        body: '5 trades broke a rule of their setup and made $83.82 a trade less than the trades of the same setup that kept every rule. Had they done as well, you would be about that much better off. The rule that cost the most to break: "r1", -$240.00 over the 5 trades that broke it.',
        metric: '5 of 16 checked trades broke a rule',
      },
      {
        id: 'mistake',
        tone: 'bad',
        title: '"Chased the entry" is your most expensive mistake',
        body: 'You made it on 12 trades, and they averaged -$74.33 against +$31.88 for the 25 clean trades, the ones with no mistake. Had they done as well, you would be about $1,274.56 better off.',
        metric: 'about $1,274.56 over 12 trades',
      },
      {
        id: 'revenge',
        tone: 'bad',
        title: 'The trade right after a loss performs worse',
        body: '11 trades were taken immediately after a same-day loss, and they average below your normal trade. A short cool-off after a red trade would have saved money.',
        metric: '-$29.64 vs -$2.57 normally',
      },
      {
        id: 'outlier-loss',
        tone: 'bad',
        title: 'One loss is far bigger than the rest',
        body: 'Your largest loss is more than two and a half times your average one. A single trade like that undoes a week of good ones. Find out whether the stop was moved.',
        metric: '$406.00 vs $74.33 average',
      },
      {
        id: 'fees',
        tone: 'bad',
        title: 'Commissions turned a winning system into a losing one',
        body: 'Before fees you are profitable; after fees you are not. Fewer, larger trades or a cheaper broker would flip this.',
        metric: '$210.00 paid in fees',
      },
      {
        id: 'weekday',
        tone: 'warn',
        title: 'Mon is costing you',
        body: 'Mon is down $640.00 across 15 trades, while Tue is your strongest day at +$166.00. Worth asking what is different about that day.',
        metric: 'Mon: -$640.00',
      },
      {
        id: 'overtrading',
        tone: 'warn',
        title: 'Your busy days are your worst days',
        body: 'Days with 4 or more trades average less than your quieter days. Volume is not where your edge lives.',
        metric: '4 busy days measured',
      },
      {
        id: 'hold-asymmetry',
        tone: 'warn',
        title: 'You hold losers longer than winners',
        body: 'Losing trades stay open noticeably longer than winning ones. That is hope management, not risk management. A hard time stop fixes it.',
        metric: '90m vs 20m',
      },
      {
        id: 'stops',
        tone: 'warn',
        title: 'Only 51% of your trades record a stop',
        body: 'Without a stop price the journal cannot measure your R multiples, and more importantly you cannot prove you ever defined the risk. Add one on every trade.',
        metric: '19 of 37 trades',
      },
      {
        id: 'discipline',
        tone: 'good',
        title: 'Your own discipline ratings predict your results',
        body: 'Trades you rated 4–5 for discipline average better than the ones you rated 1–2. You can tell a good trade from a bad one in the moment, which means the fix is following your own read.',
        metric: '23 disciplined vs 12 rushed',
      },
      {
        id: 'session',
        tone: 'info',
        title: 'New York is your most profitable session',
        body: 'New York has made +$394.00 across 11 trades at a 100% win rate. London has made -$892.00 across 12 at 0%. If the gap holds for another month, the quiet session is the one to cut.',
        metric: '+$394.00 vs -$892.00',
      },
      {
        id: 'symbol',
        tone: 'info',
        title: 'ES is carrying you, NQ is dragging',
        body: 'ES has made +$394.00 over 11 trades. NQ has lost $499.00 over 24. Dropping your worst instrument is usually the cheapest improvement available.',
        metric: 'NQ: -$499.00',
      },
      {
        id: 'setup',
        tone: 'info',
        title: '"S" is your best playbook setup',
        body: 'It has produced +$154.00 over 16 trades at a 69% win rate, against -$259.00 for "Unknown setup". Give the better one more of your size.',
        metric: 'S',
      },
      {
        id: 'side',
        tone: 'info',
        title: 'You read longs better than shorts',
        body: 'Longs: 100% across 25 trades. Shorts: 0% across 12. A one-directional edge is still an edge.',
        metric: '100 point gap',
      },
    ]);
  });

  it('names the setup of the rule that cost the most, once there is more than one setup', () => {
    expect(
      buildInsights(INSIGHTS, [INSIGHT_SETUP, ...INSIGHT_SETUPS], settings).find((i) => i.id === 'rules')?.body,
    ).toBe(
      '5 trades broke a rule of their setup and made $83.82 a trade less than the trades of the same setup that kept every rule. Had they done as well, you would be about that much better off. One more trade broke a rule in a setup that needs 4 trades that kept every rule and 4 that broke one before it can be compared. The rule that cost the most to break: "r1" (S), -$240.00 over the 5 trades that broke it.',
    );
  });

  it('says every signal the journal sets off today', () => {
    expect(said(buildSignals(INSIGHTS, settings, INSIGHTS_NOW))).toEqual([
      {
        id: 'daily-loss-breached',
        tone: 'bad',
        title: 'Daily loss limit reached',
        body: 'Today is down past the limit you set. Your own rule says stop here.',
      },
      {
        id: 'trade-count',
        tone: 'bad',
        title: '4 trades today',
        body: 'Your limit is 3 a day. Extra trades past the plan are usually the expensive ones.',
      },
      {
        id: 'losing-streak',
        tone: 'warn',
        title: '3 losses in a row',
        body: 'Size down or step away until you have a clean setup. Streaks are when discipline slips.',
      },
      {
        id: 'week-trend',
        tone: 'good',
        title: 'Better than last week',
        body: 'The last 7 days are running ahead of the 7 days before them.',
      },
    ]);
  });

  it('says the signals that journal does not: near the loss limit, one trade today, behind last week', () => {
    const trades = [
      ...['08', '09', '12', '13', '14'].map((d) => on(`2026-10-${d}`, 50)),
      on('2026-10-15', 20),
      on('2026-10-21', -80, 9),
    ];
    expect(said(buildSignals(trades, { ...settings, maxTradesPerDay: 1 }, INSIGHTS_NOW))).toEqual([
      {
        id: 'daily-loss-near',
        tone: 'warn',
        title: 'Close to your daily loss limit',
        body: 'You have used 80% of the loss you allow yourself in a day.',
      },
      {
        id: 'trade-count',
        tone: 'warn',
        title: '1 trade today',
        body: 'Your limit is 1 a day. Extra trades past the plan are usually the expensive ones.',
      },
      {
        id: 'week-trend',
        tone: 'info',
        title: 'Behind last week',
        body: 'The last 7 days are running behind the 7 days before them.',
      },
    ]);
  });

  it('says a winning streak, and a day past its trade limit', () => {
    const trades = [5, 5, 5, 5].map((net, i) => on('2026-10-21', net, 8 + i));
    expect(said(buildSignals(trades, settings, INSIGHTS_NOW))).toEqual([
      {
        id: 'trade-count',
        tone: 'bad',
        title: '4 trades today',
        body: 'Your limit is 3 a day. Extra trades past the plan are usually the expensive ones.',
      },
      {
        id: 'winning-streak',
        tone: 'good',
        title: '4 wins in a row',
        body: 'Running well. Keep the position size you had when the streak started.',
      },
    ]);
  });
});
