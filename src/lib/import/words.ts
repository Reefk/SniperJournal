import type { Role } from './columns';

/**
 * Column names the alias lists in columns.ts don't know as a whole, read by
 * their words: "Start Price" is an entry price, "Lots Traded" a quantity,
 * "Realised P&L" the P&L. A name is read only when every word in it is listed
 * here and together they fit exactly one role, so "Limit Price", "Mark Price",
 * "Open Interest" and "Cumulative P&L" are left alone: one word not listed is
 * enough. Words run together are taken apart ("StartPrice", "entrypx").
 * planColumns (columns.ts) then checks the column's values, and gives a column
 * read this way only a role no known name took.
 */

/** a currency or a time zone in a name says nothing about what the column is */
export const CURRENCIES = new Set(
  'usd eur gbp jpy chf aud cad nzd ils nis hkd sgd cnh cny inr krw sek nok dkk pln zar mxn brl try usdt usdc busd'.split(
    ' ',
  ),
);
const SAYS_NOTHING = new Set([...CURRENCIES, 'utc', 'gmt']);

/** what a word says about a column */
type Sense =
  | 'entry'
  | 'exit'
  | 'price'
  | 'level'
  | 'time'
  | 'date'
  | 'quantity'
  | 'symbol'
  | 'name'
  | 'side'
  | 'buy'
  | 'sell'
  | 'flag'
  | 'fee'
  | 'fee_kind'
  | 'pnl'
  | 'loss'
  | 'net'
  | 'gross'
  | 'realized'
  | 'stop'
  | 'sl'
  | 'take'
  | 'tp'
  | 'target'
  | 'note'
  | 'setup'
  | 'tag'
  | 'account'
  | 'average'
  | 'fill'
  | 'number'
  | 'joining';

const SENSES = new Map<string, Sense>();
const words = (sense: Sense, list: string) => list.split(' ').forEach((w) => SENSES.set(w, sense));

words('entry', 'entry entries enter entered entering open opening opened start starting initial');
words('exit', 'exit exits exited exiting close closing closed end ending final');
words('price', 'price prices px prc');
// a level is a price only with an entry or an exit: IG's Opening level
words('level', 'level');
words('time', 'time timestamp stamp datetime dt');
words('date', 'date day');
words('quantity', 'quantity qty size volume vol shares share contracts lots lot units unit qte quantite');
// "Contracts" is a size, "Contract" names one; not "Market", "Product",
// "Asset" or "Security", which as often hold a kind (FUT, STK) as a symbol
words('symbol', 'symbol ticker instrument pair stock coin contract');
words('name', 'name code');
words('side', 'side direction dir action bs');
words('buy', 'buy bought long');
words('sell', 'sell sold short');
words('flag', 'flag indicator');
words('fee', 'fee fees commission commissions comm comms charge charges brokerage tax taxes levy');
words('fee_kind', 'broker exchange clearing regulatory platform other misc');
// not "Result", often in R; and no "Total" anywhere, often a running total
words('pnl', 'pnl pl profit gain');
words('loss', 'loss');
words('net', 'net');
words('gross', 'gross');
words('realized', 'realized realised');
words('stop', 'stop');
words('sl', 'sl');
words('take', 'take');
words('tp', 'tp');
words('target', 'target');
// not "Remarks": Rithmic's are the platform's own ("OCO cancel")
words('note', 'note notes comment comments memo');
words('setup', 'setup strategy playbook');
words('tag', 'tag tags label labels');
words('account', 'account acct portfolio');
words('average', 'avg average mean weighted');
words('fill', 'fill fills filled execution executions executed exec trade trades traded trading deal transaction');
words('number', 'number no num nr');
// "Price at Entry", "Time of Trade", "Comm and Fees", "Buy or Sell"
words('joining', 'at of the and or');

/**
 * Which words make a role: every word of a name has to be one of a set in
 * `needs` (all of that set present) or in `may`. Not listed, on purpose: roles
 * that change how the rows are read (open or close, order status, trade
 * number, paired fills) or what a point is worth (multiplier, amount), and
 * the broker's ids, which decide what counts as imported already.
 */
const RULES: Array<{ role: Role; needs: Sense[][]; may: Sense[] }> = [
  { role: 'symbol', needs: [['symbol']], may: ['name', 'fill'] },
  // not the closing side: "Exit Side" is a sell for a long
  { role: 'side', needs: [['side'], ['buy', 'sell']], may: ['buy', 'sell', 'flag', 'fill', 'entry'] },
  // not an order's size, nor what is still open: those are not what was traded
  { role: 'quantity', needs: [['quantity']], may: ['fill', 'number'] },
  { role: 'price', needs: [['price']], may: ['average', 'fill'] },
  {
    role: 'entry_price',
    needs: [
      ['entry', 'price'],
      ['entry', 'level'],
    ],
    may: ['average', 'fill'],
  },
  {
    role: 'exit_price',
    needs: [
      ['exit', 'price'],
      ['exit', 'level'],
    ],
    may: ['average', 'fill'],
  },
  { role: 'time', needs: [['time']], may: ['date', 'fill'] },
  { role: 'date', needs: [['date']], may: ['fill'] },
  { role: 'opened_at', needs: [['entry', 'time']], may: ['date', 'fill'] },
  { role: 'opened_date', needs: [['entry', 'date']], may: ['fill'] },
  { role: 'closed_at', needs: [['exit', 'time']], may: ['date', 'fill'] },
  { role: 'closed_date', needs: [['exit', 'date']], may: ['fill'] },
  // guessed fee columns add up: a total among them would count the others twice
  { role: 'fees', needs: [['fee']], may: ['fee_kind', 'fill'] },
  // a closed trade's P&L, never an open one's: "Open P&L" is not read
  { role: 'pnl', needs: [['pnl']], may: ['loss', 'realized', 'fill', 'exit'] },
  { role: 'net_pnl', needs: [['net', 'pnl']], may: ['loss', 'realized', 'fill', 'exit'] },
  { role: 'gross_pnl', needs: [['gross', 'pnl']], may: ['loss', 'realized', 'fill', 'exit'] },
  // a "Stop Price" can be a stop order's, so a stop needs its loss
  { role: 'stop_loss', needs: [['stop', 'loss'], ['sl']], may: ['price', 'level', 'entry'] },
  { role: 'take_profit', needs: [['take', 'pnl'], ['tp'], ['target', 'price']], may: ['price', 'level'] },
  { role: 'notes', needs: [['note']], may: ['fill'] },
  { role: 'setup', needs: [['setup']], may: ['name', 'fill'] },
  { role: 'tags', needs: [['tag']], may: ['fill'] },
  { role: 'account', needs: [['account']], may: ['name', 'number', 'fill'] },
];

/** a word run together from listed ones ("startprice", "pnlusd"), in the fewest pieces; null when it is not */
function apart(word: string): string[] | null {
  // a run of letters this long is no column name, and would take long to try
  if (word.length > 40) return null;
  const best: Array<string[] | null> = [[], ...Array<null>(word.length).fill(null)];
  for (let end = 2; end <= word.length; end++) {
    for (let start = 0; start <= end - 2; start++) {
      const before = best[start];
      const piece = word.slice(start, end);
      if (!before || !(SENSES.has(piece) || SAYS_NOTHING.has(piece))) continue;
      const current = best[end];
      if (!current || before.length + 1 < current.length) best[end] = [...before, piece];
    }
  }
  return best[word.length];
}

/** what the words of a name say, or null when one of them is not listed */
function sensesOf(nameWords: string[]): Sense[] | null {
  const senses: Sense[] = [];
  for (let i = 0; i < nameWords.length; i++) {
    let word = nameWords[i];
    // "P&L" and "B/S" come apart into letters
    const pair = word + (nameWords[i + 1] ?? '');
    if (word.length === 1 && (pair === 'pl' || pair === 'bs')) {
      word = pair;
      i++;
    }
    const pieces = SENSES.has(word) || SAYS_NOTHING.has(word) ? [word] : apart(word);
    if (!pieces) return null;
    for (const piece of pieces) {
      const sense = SENSES.get(piece);
      if (sense) senses.push(sense);
    }
  }
  return senses;
}

/**
 * The role the words of a column name add up to (see headerParts in
 * columns.ts for how a name is split into words), or null when they don't add
 * up to exactly one.
 */
export function roleFromWords(nameWords: string[]): Role | null {
  const senses = sensesOf(nameWords);
  if (!senses?.length) return null;
  const fitting = RULES.filter(({ needs, may }) =>
    needs.some(
      (need) =>
        need.every((s) => senses.includes(s)) &&
        senses.every((s) => s === 'joining' || need.includes(s) || may.includes(s)),
    ),
  );
  return fitting.length === 1 ? fitting[0].role : null;
}
