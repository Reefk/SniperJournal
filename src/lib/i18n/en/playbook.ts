import type { Message } from '../types';

/** the Playbook: its setups, how their trades kept the rules, and the setup editor */
export const playbook = {
  'pb.description': 'Write down the setups you are allowed to trade, then see which ones actually pay.',
  'pb.new': 'New setup',
  'pb.empty.title': 'Your playbook is empty',
  'pb.empty.text':
    'A setup is a pattern you have decided is worth your money, with the rules that make it valid. Once you tag trades with a setup, this page shows you which of your patterns earn and which only feel good.',
  'pb.empty.first': 'Write your first setup',
  'pb.editNamed': 'Edit {name}',

  'pb.delete.title': 'Delete "{name}"?',
  'pb.delete.used': {
    one: '{count} trade is tagged with this setup. The trades stay in your journal, they just lose the setup label.',
    other:
      '{count} trades are tagged with this setup. The trades stay in your journal, they just lose the setup label.',
  },
  'pb.delete.unused': 'This setup will be removed from your playbook.',
  'pb.delete.confirm': 'Delete setup',
  'pb.deleted': 'Setup deleted',
  'pb.saved': 'Setup "{name}" saved',

  'pb.noRules': 'No rules written yet. Rules are what make a setup checkable.',
  'pb.removedRules': 'No longer in this setup',
  'pb.trades': 'Trades',
  // a setup's profit factor, in a narrow column
  'pb.factor': 'Factor',
  'pb.noTrades': 'No trades tagged with this setup yet',
  // after a badge with the count in it
  'pb.unassigned': {
    one: 'trade has no setup attached. Tagging them is what makes this page useful.',
    other: 'trades have no setup attached. Tagging them is what makes this page useful.',
  },

  // under each rule: how the setup's trades did against it
  'pb.keptOf': 'kept {kept} of {total}',
  'pb.brokenTimes': 'broken {count}× · {net}',
  'pb.costliest': 'costliest to break',

  // the trades that kept every rule against the ones that broke one
  'pb.everyKeptOn': {
    one: 'Every rule kept on <num>{kept}</num> of {count} checked trade',
    other: 'Every rule kept on <num>{kept}</num> of {count} checked trades',
  },
  'pb.partly': { one: '{count} partly checked', other: '{count} partly checked' },
  'pb.unchecked': { one: '{count} not checked', other: '{count} not checked' },
  'pb.rules': 'Rules',
  'pb.avgR': 'Avg R',
  'pb.allKept': 'Every rule kept',
  'pb.oneBroken': 'A rule broken',
  'pb.cost': {
    one: 'Breaking a rule cost about <loss>{money}</loss> here: the {count} trade that broke one would have made that much more at the average of the trades that kept every rule.',
    other:
      'Breaking a rule cost about <loss>{money}</loss> here: the {count} trades that broke one would have made that much more at the average of the trades that kept every rule.',
  },
  'pb.noCost': 'Breaking a rule has not cost money on this setup so far.',
  'pb.costNeeds': {
    one: 'What breaking a rule costs shows once {count} trades are on each side.',
    other: 'What breaking a rule costs shows once {count} trades are on each side.',
  },

  // the setup editor
  'pb.editor.hint': 'A setup you can check against before you click buy.',
  'pb.nameRequired': 'Give the setup a name',
  'pb.name': 'Setup name',
  'pb.namePlaceholder': 'e.g. Opening Range Breakout',
  'pb.colour': 'Colour',
  'pb.useColour': 'Use colour {colour}',
  'pb.what': 'What it is',
  'pb.whatPlaceholder': 'Describe the pattern in a sentence or two, the way you would explain it to someone else.',
  'pb.rulesHint': 'every one must be true before you take the trade',
  'pb.rulePlaceholder': 'e.g. Volume above the 20 period average',
  'pb.removeRule': 'Remove rule {n}',
  'pb.addRule': 'Add a rule',
  'pb.save': 'Save setup',
} satisfies Record<string, Message>;
