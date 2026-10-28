import type { Message } from '../types';

/**
 * The test journal (Load test data): its setups and their rules, its tags and
 * its notes. They are written in the language on screen when it is loaded,
 * and from then on they are journal data, kept as written whatever the
 * language. A tag can't hold a comma: typing one ends the tag.
 */
export const sample = {
  'sample.orb.name': 'Opening Range Breakout',
  'sample.orb.description':
    'Break and hold of the first 15 minute range, taken only in the direction of the daily trend.',
  'sample.orb.wait': 'Wait for the first 15 minutes to complete',
  'sample.orb.retest': 'Enter on the retest, not the first push',
  'sample.orb.stop': 'Stop below the range mid',
  'sample.orb.target': 'Target 2R or the prior day high',

  'sample.vwap.name': 'VWAP Reclaim',
  'sample.vwap.description': 'Price loses VWAP, flushes, then reclaims it with volume.',
  'sample.vwap.within': 'Must reclaim within 30 minutes of losing it',
  'sample.vwap.volume': 'Volume on the reclaim candle above average',
  'sample.vwap.stop': 'Stop under the flush low',
  'sample.vwap.scale': 'Scale half at 1R',

  'sample.pullback.name': 'Trend Pullback',
  'sample.pullback.description': 'Buying the first controlled pullback into a rising moving average.',
  'sample.pullback.trend': 'Higher highs and higher lows on the 5 minute',
  'sample.pullback.volume': 'Pullback on falling volume',
  'sample.pullback.entry': 'Entry on the reversal candle close',
  'sample.pullback.late': 'No entry in the last hour',

  // tags, as a trader types them: short, lower case
  'sample.tag.planned': 'planned',
  'sample.tag.breakout': 'breakout',
  'sample.tag.pullback': 'pullback',
  'sample.tag.news': 'news',
  'sample.tag.fomo': 'fomo',
  'sample.tag.earlyEntry': 'early entry',
  'sample.tag.movedStop': 'moved stop',
  'sample.tag.aPlus': 'A+ setup',
  'sample.tag.tired': 'tired',
  'sample.tag.oversized': 'oversized',

  // a test trade's notes: one for a winner, one for a loser
  'sample.note.won': 'Followed the plan, let the runner work.',
  'sample.note.lost': 'Entered before confirmation and paid for it.',
} satisfies Record<string, Message>;
