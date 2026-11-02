import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '@/lib/i18n';
import { dayReview, tradeReview, weekReview, type ReviewBook, type ReviewMoney } from '@/lib/review-text';
import { pnl, trade } from './helpers';

/** a made-up playbook: one setup with three rules, two mistakes, and a goal in % and one in money */
const BOOK: ReviewBook = {
  setups: [
    { id: 's1', name: 'Breakout', rules: ['Wait for the close', 'Volume above average', 'Stop under the range'] },
  ],
  mistakes: ['Early entry', 'Moved my stop'],
  goals: { winRate: 50, expectancy: 20 },
  currency: 'USD',
};
const MONEY: ReviewMoney = { leaveOut: false, opening: 10_000 };
const LEFT_OUT: ReviewMoney = { leaveOut: true, opening: 10_000 };

/** Monday 2 March 2026: a long that broke a rule and made a mistake, and a short that lost at its stop's two thirds */
const AAPL = trade({
  symbol: 'AAPL',
  openedAt: '2026-03-02T09:30',
  closedAt: '2026-03-02T10:15',
  quantity: 100,
  entryPrice: 182.5,
  exitPrice: 183.49,
  stopLoss: 181.5,
  takeProfit: 185,
  fees: 1,
  setupId: 's1',
  ruleChecks: { 'Wait for the close': true, 'Volume above average': true, 'Stop under the range': false },
  mistakes: ['Early entry'],
  tags: ['breakout'],
  review: { discipline: 4, execution: 3 },
  session: 'New York',
  notes: 'Chased the open.',
});
const TSLA = trade({
  symbol: 'TSLA',
  side: 'SHORT',
  openedAt: '2026-03-02T11:00',
  closedAt: '2026-03-02T11:30',
  quantity: 10,
  entryPrice: 200,
  exitPrice: 202,
  stopLoss: 203,
});
/** Tuesday: a trade with only a date, no stop, +$30 */
const MSFT = pnl(30, { symbol: 'MSFT', openedAt: '2026-03-03', closedAt: '2026-03-03' });

afterEach(() => setLanguage('en'));

const NOTE =
  'Review these trades as my trading coach. Grade each one on its process, not its result: one line each, with the reason, against my own rules and mistakes above, not general trading advice. Then name one thing to keep doing and one thing to change.';

describe('tradeReview: a trade, for review', () => {
  it('everything the trade has, then the rules, mistakes and goals to grade it against, then what to do', () => {
    expect(tradeReview(AAPL, BOOK, MONEY)).toBe(
      [
        'A trade of mine to review: AAPL, 02 Mar 2026.',
        '',
        'AAPL, LONG, 02 Mar 2026',
        'Opened 09:30, closed 10:15, held 45m.',
        'Size 100; entry 182.50; exit 183.49.',
        'Stop 181.50; target 185.00.',
        'Result: +0.98R, +$98.00, after $1.00 of fees.',
        'Setup: Breakout.',
        'Rules kept: Wait for the close; Volume above average.',
        'Rules broken: Stop under the range.',
        'Mistakes: Early entry.',
        'Tags: breakout.',
        'My ratings, out of 5: Discipline 4, Execution 3.',
        'Session: New York.',
        'Notes: Chased the open.',
        '',
        'My own rules, to grade against:',
        '- Breakout: Wait for the close; Volume above average; Stop under the range.',
        '- Mistakes I watch for: Early entry, Moved my stop.',
        '- My goals: Win rate 50%, Expectancy +$20.00.',
        '',
        NOTE,
      ].join('\n'),
    );
  });

  it('with money left out: no size, amount or fees, and no goal in money; R and % of the balance instead', () => {
    const text = tradeReview(AAPL, BOOK, LEFT_OUT);
    expect(text.split('\n').slice(0, 2)).toEqual([
      'A trade of mine to review: AAPL, 02 Mar 2026.',
      "Amounts are left out: results are in R (a trade's result against the risk its stop set) and in % of my balance.",
    ]);
    expect(text).toContain('\nEntry 182.50; exit 183.49.\n');
    expect(text).toContain('\nResult: +0.98R, +0.98% of my balance.\n');
    expect(text).toContain('\n- My goals: Win rate 50%.\n');
    expect(text).not.toMatch(/\$|Size|fees/);
  });

  it('with money left out, no balance and no stop: whether it won', () => {
    const text = tradeReview(MSFT, BOOK, { leaveOut: true, opening: null });
    expect(text).toContain("Amounts are left out: results are in R, a trade's result against the risk its stop set.");
    expect(text).toContain('\nNo stop set.\nResult: a win.');
  });

  it('a trade with only a date has no times, one with no exit price no exit, and one still open no result', () => {
    expect(tradeReview(MSFT, BOOK, MONEY)).toContain('MSFT, LONG, 03 Mar 2026\nSize 1; entry 100.00.\nNo stop set.');
    const open = trade({ symbol: 'NVDA', openedAt: '2026-03-02T14:00', closedAt: undefined, exitPrice: null });
    const text = tradeReview(open, BOOK, MONEY);
    expect(text).toContain('\nOpened 14:00, still open.\nSize 1; entry 100.00.\n');
    expect(text).not.toContain('Result');
    expect(tradeReview(open, BOOK, LEFT_OUT)).toContain('\nEntry 100.00.\n');
  });

  it('a trade held overnight counts on the day it closed, and gives the day it was opened', () => {
    const swing = trade({ openedAt: '2026-03-02T15:30', closedAt: '2026-03-03T10:00', exitPrice: 101 });
    expect(tradeReview(swing, BOOK, MONEY)).toContain(
      ', 03 Mar 2026\nOpened 02 Mar 15:30, closed 10:00, held 18h 30m.\n',
    );
  });

  it("a setup's rules not ticked, a setup since deleted, and a trade left out of the statistics", () => {
    expect(tradeReview(trade({ setupId: 's1' }), BOOK, MONEY)).toContain(
      '\nSetup: Breakout.\nIts rules were not ticked.\n',
    );
    expect(tradeReview(trade({ setupId: 'gone' }), BOOK, MONEY)).toContain('\nSetup: Unknown.\n');
    expect(tradeReview({ ...TSLA, excluded: true }, BOOK, MONEY)).toContain('\nI left it out of my statistics.\n');
  });

  it("the trader's own instructions in place of the app's; blank ones are the app's", () => {
    expect(tradeReview(TSLA, { ...BOOK, note: 'Be brief.' }, MONEY).endsWith('\n\nBe brief.')).toBe(true);
    expect(tradeReview(TSLA, { ...BOOK, note: '  \n ' }, MONEY).endsWith(`\n\n${NOTE}`)).toBe(true);
  });

  it("names the app's own mistakes and sessions in the app's language; the trader's own as they are", () => {
    setLanguage('es');
    const t = { ...TSLA, mistakes: ['Moved my stop', 'Sized up after a loss'], session: 'London' };
    const text = tradeReview(t, { ...BOOK, mistakes: ['Moved my stop'] }, MONEY);
    expect(text).toContain('\nErrores: Moví mi stop, Sized up after a loss.\n');
    expect(text).toContain('\nSesión: Londres.\n');
    expect(text).toContain('\n- Errores que vigilo: Moví mi stop.\n');
  });

  it("separates lists, rules and the result with the language's own commas and semicolons", () => {
    setLanguage('ar');
    const text = tradeReview(AAPL, BOOK, MONEY);
    expect(text).toContain('؛');
    expect(text).toContain('،');
    expect(text).not.toMatch(/[,;]/);
  });

  it('in Arabic each line it writes reads right to left, one made only of dates and numbers too; my own instructions stay as written', () => {
    setLanguage('ar');
    const RLM = String.fromCharCode(0x200f);
    const FSI = String.fromCharCode(0x2068);
    const book = { ...BOOK, note: 'Grade me hard.\nOne line each.' };
    const lines = weekReview('2026-03-02', '2026-03-08', [AAPL, TSLA], book, MONEY).split('\n');
    expect(lines.slice(-2)).toEqual(['Grade me hard.', 'One line each.']);
    expect(lines.slice(0, -2).filter((line) => line && !line.startsWith(RLM))).toEqual([]);
    // lines with no letter of their own, each part isolated (the Arabic comma sets no direction):
    // a day's "- {day}: {trades}، {result}" and a setup's "- {name}: {rules}"
    expect(lines.filter((line) => line.startsWith(`${RLM}- ${FSI}`)).map((line) => line.slice(0, 6))).toEqual([
      `${RLM}- ${FSI}ال`,
      `${RLM}- ${FSI}Br`,
    ]);
    // the app's own instructions are marked like the rest; blank lines stay blank
    expect(tradeReview(AAPL, BOOK, MONEY).split('\n').at(-1)?.startsWith(RLM)).toBe(true);
    expect(lines).toContain('');
    setLanguage('en');
    expect(weekReview('2026-03-02', '2026-03-08', [AAPL, TSLA], BOOK, MONEY)).not.toContain(RLM);
  });

  it('with no setup used, no mistakes listed and no goals, it goes straight to the instructions', () => {
    const bare: ReviewBook = { setups: [], mistakes: [], currency: 'USD' };
    expect(tradeReview(TSLA, bare, MONEY).endsWith(`Result: -0.67R, -$20.00.\n\n${NOTE}`)).toBe(true);
  });
});

describe('dayReview: a day and its trades', () => {
  it("the day's numbers, then each trade in full, in the order they closed", () => {
    const text = dayReview('2026-03-02', [TSLA, AAPL], BOOK, LEFT_OUT);
    expect(text.split('\n').slice(0, 7)).toEqual([
      'A trading day of mine to review: Mon, 02 Mar 2026.',
      "Amounts are left out: results are in R (a trade's result against the risk its stop set) and in % of my balance.",
      '',
      '2 trades: 1 won, 1 lost.',
      'Net: +0.78% of my balance.',
      'In R: +0.31R over the 2 trades with a stop.',
      '',
    ]);
    expect(text.indexOf('1. AAPL, LONG')).toBeLessThan(text.indexOf('2. TSLA, SHORT'));
    expect(text).toContain(
      '\n2. TSLA, SHORT, 02 Mar 2026\nOpened 11:00, closed 11:30, held 30m.\nEntry 200.00; exit 202.00.\nStop 203.00.\nResult: -0.67R, -0.20% of my balance.\n',
    );
  });

  it('counts only what every statistic counts, says how many more there are, and shows every trade of the day', () => {
    const open = trade({ symbol: 'NVDA', openedAt: '2026-03-02T14:00', closedAt: undefined, exitPrice: null });
    const text = dayReview('2026-03-02', [AAPL, { ...TSLA, excluded: true }, open], BOOK, MONEY);
    expect(text).toContain(
      '\n1 trade: 1 won, 0 lost.\nNet: +$98.00.\nIn R: +0.98R over the 1 trade with a stop.\n' +
        '2 more trades below are still open or left out of my statistics, so these numbers leave them out.\n',
    );
    expect(text).toContain('\n2. TSLA, SHORT');
    expect(text).toContain('\n3. NVDA, LONG');
    expect(dayReview('2026-03-02', [AAPL], BOOK, MONEY)).not.toContain('more trade');
  });
});

describe('weekReview: a week, short', () => {
  it('its numbers and a line a day; in full only the trades that broke a rule or had a mistake', () => {
    const text = weekReview('2026-03-02', '2026-03-08', [AAPL, TSLA, MSFT], BOOK, MONEY);
    expect(text.split('\n').slice(0, 10)).toEqual([
      'A trading week of mine to review: 02 Mar – 08 Mar 2026.',
      '',
      '3 trades: 2 won, 1 lost.',
      'Net: +$108.00.',
      'In R: +0.31R over the 2 trades with a stop.',
      '',
      'Day by day:',
      '- Mon 02 Mar: 2 trades, +$78.00',
      '- Tue 03 Mar: 1 trade, +$30.00',
      '',
    ]);
    expect(text).toContain('\nIn full, the trades that broke a rule or had a mistake:\n\n1. AAPL, LONG');
    expect(text).not.toContain('TSLA');
    expect(text).toContain('\nThe other 2 trades are only in the day lines above.\n');
  });

  it('says how many trades are open or left out, which are in neither the numbers nor the day lines', () => {
    const open = trade({ symbol: 'NVDA', openedAt: '2026-03-04T14:00', closedAt: undefined, exitPrice: null });
    const text = weekReview('2026-03-02', '2026-03-08', [AAPL, TSLA, open], BOOK, MONEY);
    expect(text).toContain(
      '\nIn R: +0.31R over the 2 trades with a stop.\n' +
        '1 more trade is still open or left out of my statistics, so these numbers and the day lines leave it out.\n',
    );
    expect(text).toContain('\nThe other trade is only in the day lines above.\n');
    expect(text).not.toContain('NVDA');
  });

  it("only the week's own trades", () => {
    const later = pnl(500, { openedAt: '2026-03-09T10:00', closedAt: '2026-03-09T11:00' });
    expect(weekReview('2026-03-02', '2026-03-08', [AAPL, later], BOOK, MONEY)).toContain('\n1 trade: 1 won, 0 lost.\n');
  });

  it("a day's result in R with amounts left out and no balance, and with no stop either, what it won and lost", () => {
    const text = weekReview('2026-03-02', '2026-03-08', [AAPL, TSLA, MSFT], BOOK, { leaveOut: true, opening: null });
    expect(text).toContain('\n- Mon 02 Mar: 2 trades, +0.31R\n- Tue 03 Mar: 1 trade, 1 won, 0 lost\n');
    expect(text).not.toContain('Net:');
  });

  it('with nothing broken or missed, it says so and grades against the rules of every setup used', () => {
    const clean = { ...AAPL, ruleChecks: { 'Wait for the close': true }, mistakes: [] };
    const text = weekReview('2026-03-02', '2026-03-08', [clean, TSLA], BOOK, MONEY);
    expect(text).toContain('\nNo trade broke a rule or had a mistake.\n\nMy own rules, to grade against:\n- Breakout:');
    expect(text).not.toContain('The other');
  });
});
