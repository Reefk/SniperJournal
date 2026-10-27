import type { Message } from '../types';

/** Insights & Signals: the screen, and every sentence lib/insights.ts writes about the journal */
export const insights = {
  'ins.description': 'Patterns found in your own trades, not generic advice.',
  'ins.empty.none': 'Nothing to analyse yet',
  'ins.empty.more': { one: '{count} more closed trade needed', other: '{count} more closed trades needed' },
  'ins.empty.text': {
    one: 'This page reads your journal and reports what it finds: which session pays you, whether you revenge trade, whether you hold losers longer than winners. It stays quiet until there is at least {count} closed trade, because anything less is noise rather than a pattern.',
    other:
      'This page reads your journal and reports what it finds: which session pays you, whether you revenge trade, whether you hold losers longer than winners. It stays quiet until there are at least {count} closed trades, because anything less is noise rather than a pattern.',
  },
  'ins.readFrom': {
    one: 'Read from {count} closed trade. Every claim points at a number you can check in the table.',
    other: 'Read from {count} closed trades. Every claim points at a number you can check in the table.',
  },
  'ins.live': 'Live signals',
  'ins.says': 'What your journal says',
  'ins.money': 'Where the money comes from',
  'ins.bySymbol': 'By symbol',
  'ins.bySession': 'By session',
  'ins.byWeekday': 'By weekday',
  'ins.byTag': 'By tag',
  'ins.score': 'Sniper Score breakdown',
  'ins.notRated': 'not rated',
  // axes: the Sniper Score's axes not scored, joined
  'ins.unrated': {
    one: '{axes} is not scored yet. Record a stop loss and rate your discipline, execution and patience when you log a trade.',
    other:
      '{axes} are not scored yet. Record a stop loss and rate your discipline, execution and patience when you log a trade.',
  },
  'ins.allScored': 'Every axis is scored from data you supplied.',

  'ins.cat.Edge': 'Edge',
  'ins.cat.Timing': 'Timing',
  'ins.cat.Risk': 'Risk',
  'ins.cat.Behaviour': 'Behaviour',
  'ins.cat.Cost': 'Cost',
  // two amounts or durations side by side: "12m vs 8m"
  'ins.vs': '{a} vs {b}',
  // a weekday's or a symbol's net: "Friday: -$120"
  'ins.labelNet': '{label}: {net}',

  // --- the live signals, about today and this week
  'sig.lossBreached.title': 'Daily loss limit reached',
  'sig.lossBreached.text': 'Today is down past the limit you set. Your own rule says stop here.',
  'sig.lossNear.title': 'Close to your daily loss limit',
  'sig.lossNear.text': 'You have used {pct} of the loss you allow yourself in a day.',
  'sig.tradeCount.title': { one: '{count} trade today', other: '{count} trades today' },
  'sig.tradeCount.text': 'Your limit is {max} a day. Extra trades past the plan are usually the expensive ones.',
  'sig.losing.title': { one: '{count} loss in a row', other: '{count} losses in a row' },
  'sig.losing.text': 'Size down or step away until you have a clean setup. Streaks are when discipline slips.',
  'sig.winning.title': { one: '{count} win in a row', other: '{count} wins in a row' },
  'sig.winning.text': 'Running well. Keep the position size you had when the streak started.',
  'sig.better.title': 'Better than last week',
  'sig.better.text': 'The last 7 days are running ahead of the 7 days before them.',
  'sig.behind.title': 'Behind last week',
  'sig.behind.text': 'The last 7 days are running behind the 7 days before them.',

  // --- what the journal says
  'ins.expectancy.goodTitle': 'Your system has a positive expectancy',
  'ins.expectancy.badTitle': 'Your system is losing money per trade',
  'ins.expectancy.goodText': {
    one: 'Across {count} closed trade you keep an average of this much per trade. More trades of the same quality should compound it.',
    other:
      'Across {count} closed trades you keep an average of this much per trade. More trades of the same quality should compound it.',
  },
  'ins.expectancy.badText': {
    one: 'Across {count} closed trade the average result is negative. Cutting the worst setup usually matters more than finding a new one.',
    other:
      'Across {count} closed trades the average result is negative. Cutting the worst setup usually matters more than finding a new one.',
  },
  'ins.expectancy.metric': '{money} per trade',

  // pct: a win rate; points: the gap to it, in percentage points
  'ins.breakEven.title': 'You need to win {pct} to break even',
  'ins.breakEven.above':
    'You are winning {pct}, which leaves {points} points of cushion. Protect that gap before chasing a higher win rate.',
  'ins.breakEven.below':
    'You are winning {pct}, below the break-even line. Either win more often or make your winners bigger relative to your losers.',
  'ins.breakEven.metric': '{points} pts of margin',

  'ins.session.title': '{session} is your most profitable session',
  'ins.session.text':
    '{best} has made {bestNet} across {bestTrades} trades at a {bestRate} win rate. {worst} has made {worstNet} across {worstTrades} at {worstRate}. If the gap holds for another month, the quiet session is the one to cut.',

  'ins.weekday.title': '{day} is costing you',
  'ins.weekday.text': {
    one: '{worst} is down {loss} across {count} trade, while {best} is your strongest day at {bestNet}. Worth asking what is different about that day.',
    other:
      '{worst} is down {loss} across {count} trades, while {best} is your strongest day at {bestNet}. Worth asking what is different about that day.',
  },

  'ins.symbol.title': '{best} is carrying you, {worst} is dragging',
  'ins.symbol.text':
    '{best} has made {bestNet} over {bestTrades} trades. {worst} has lost {worstLoss} over {worstTrades}. Dropping your worst instrument is usually the cheapest improvement available.',

  'ins.setup.unknown': 'Unknown setup',
  'ins.setup.title': '"{name}" is your best playbook setup',
  'ins.setup.text': {
    one: 'It has produced {bestNet} over {count} trade at a {rate} win rate, against {worstNet} for "{worst}". Give the better one more of your size.',
    other:
      'It has produced {bestNet} over {count} trades at a {rate} win rate, against {worstNet} for "{worst}". Give the better one more of your size.',
  },

  'ins.tag.title': 'Trades tagged "{tag}" lose money',
  'ins.tag.text': {
    one: '{count} trade carries this tag and it is down {loss} at a {rate} win rate. You already named the problem when you tagged it.',
    other:
      '{count} trades carry this tag and together they are down {loss} at a {rate} win rate. You already named the problem when you tagged them.',
  },
  'ins.tag.metric': { one: '{count} trade tagged', other: '{count} trades tagged' },

  // gap: what a trade that broke a rule made less (or more) than one of the same setup that kept them all
  'ins.rules.costTitle': 'Breaking your rules cost you about {money}',
  'ins.rules.costText': {
    one: '{count} trade broke a rule of its setup and made {gap} less than the trades of the same setup that kept every rule. Had it done as well, you would be about that much better off.',
    other:
      '{count} trades broke a rule of their setup and made {gap} a trade less than the trades of the same setup that kept every rule. Had they done as well, you would be about that much better off.',
  },
  'ins.rules.noCostTitle': 'Breaking your rules has not cost you so far',
  'ins.rules.noCostMore': {
    one: 'The {count} trade that broke a rule of its setup made {gap} more than the trades of the same setup that kept every rule. Either those rules are not what makes your setups work, or it is too early to tell. Worth reading them again.',
    other:
      'The {count} trades that broke a rule of their setup made {gap} a trade more than the trades of the same setup that kept every rule. Either those rules are not what makes your setups work, or it is too early to tell. Worth reading them again.',
  },
  'ins.rules.noCostSame': {
    one: 'The {count} trade that broke a rule of its setup made as much as the trades of the same setup that kept every rule. Either those rules are not what makes your setups work, or it is too early to tell. Worth reading them again.',
    other:
      'The {count} trades that broke a rule of their setup made as much as the trades of the same setup that kept every rule. Either those rules are not what makes your setups work, or it is too early to tell. Worth reading them again.',
  },
  // count: the trades left out; min: how many a setup needs on each side
  'ins.rules.others': {
    one: 'One more trade broke a rule in a setup that needs {min} trades that kept every rule and {min} that broke one before it can be compared.',
    other:
      '{count} more broke a rule in setups that need {min} trades that kept every rule and {min} that broke one before they can be compared.',
  },
  'ins.rules.worst': {
    one: 'The rule that cost the most to break: "{rule}", {net} over the trade that broke it.',
    other: 'The rule that cost the most to break: "{rule}", {net} over the {count} trades that broke it.',
  },
  'ins.rules.worstIn': {
    one: 'The rule that cost the most to break: "{rule}" ({setup}), {net} over the trade that broke it.',
    other: 'The rule that cost the most to break: "{rule}" ({setup}), {net} over the {count} trades that broke it.',
  },
  // count: the trades checked against their rules
  'ins.rules.metric': {
    one: '{broken} of {count} checked trade broke a rule',
    other: '{broken} of {count} checked trades broke a rule',
  },

  'ins.mistake.title': '"{mistake}" is your most expensive mistake',
  'ins.mistake.text': {
    one: 'You made it on {count} trade, and it averaged {avg} against {cleanAvg} for the {clean} clean trades, the ones with no mistake. Had it done as well, you would be about {cost} better off.',
    other:
      'You made it on {count} trades, and they averaged {avg} against {cleanAvg} for the {clean} clean trades, the ones with no mistake. Had they done as well, you would be about {cost} better off.',
  },
  'ins.mistake.metric': { one: 'about {cost} over {count} trade', other: 'about {cost} over {count} trades' },

  'ins.side.longsTitle': 'You read longs better than shorts',
  'ins.side.shortsTitle': 'You read shorts better than longs',
  'ins.side.longsText':
    'Longs: {strongRate} across {strongTrades} trades. Shorts: {weakRate} across {weakTrades}. A one-directional edge is still an edge.',
  'ins.side.shortsText':
    'Shorts: {strongRate} across {strongTrades} trades. Longs: {weakRate} across {weakTrades}. A one-directional edge is still an edge.',
  'ins.side.metric': '{points} point gap',

  'ins.busy.title': 'Your busy days are your worst days',
  'ins.busy.text':
    'Days with {min} or more trades average less than your quieter days. Volume is not where your edge lives.',
  'ins.busy.metric': { one: '{count} busy day measured', other: '{count} busy days measured' },

  'ins.revenge.title': 'The trade right after a loss performs worse',
  'ins.revenge.text': {
    one: '{count} trade was taken immediately after a same-day loss, and it is below your normal trade. A short cool-off after a red trade would have saved money.',
    other:
      '{count} trades were taken immediately after a same-day loss, and they average below your normal trade. A short cool-off after a red trade would have saved money.',
  },
  'ins.revenge.metric': '{after} vs {normal} normally',

  'ins.hold.title': 'You hold losers longer than winners',
  'ins.hold.text':
    'Losing trades stay open noticeably longer than winning ones. That is hope management, not risk management. A hard time stop fixes it.',

  'ins.stops.title': 'Only {pct} of your trades record a stop',
  'ins.stops.text':
    'Without a stop price the journal cannot measure your R multiples, and more importantly you cannot prove you ever defined the risk. Add one on every trade.',
  // n: the trades with a stop; count: every trade
  'ins.stops.metric': { one: '{n} of {count} trade', other: '{n} of {count} trades' },

  'ins.outlier.title': 'One loss is far bigger than the rest',
  'ins.outlier.text':
    'Your largest loss is more than two and a half times your average one. A single trade like that undoes a week of good ones. Find out whether the stop was moved.',
  'ins.outlier.metric': '{worst} vs {avg} average',

  'ins.fees.flipTitle': 'Commissions turned a winning system into a losing one',
  'ins.fees.flipText':
    'Before fees you are profitable; after fees you are not. Fewer, larger trades or a cheaper broker would flip this.',
  'ins.fees.shareTitle': 'Commissions are eating a large share of your profit',
  'ins.fees.shareText': 'Fees account for roughly {pct} of your gross profit.',
  'ins.fees.metric': '{money} paid in fees',

  'ins.discipline.title': 'Your own discipline ratings predict your results',
  'ins.discipline.text':
    'Trades you rated 4–5 for discipline average better than the ones you rated 1–2. You can tell a good trade from a bad one in the moment, which means the fix is following your own read.',
  'ins.discipline.metric': '{high} disciplined vs {low} rushed',
} satisfies Record<string, Message>;
