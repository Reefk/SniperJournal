import type { playbook as en } from '../en/playbook';
import type { Translation } from '../types';

export const playbook: Translation<typeof en> = {
  'pb.description': 'Anota los setups que te permites operar y luego mira cuáles pagan de verdad.',
  'pb.new': 'Nuevo setup',
  'pb.empty.title': 'Tu playbook está vacío',
  'pb.empty.text':
    'Un setup es un patrón que has decidido que merece tu dinero, con las reglas que lo hacen válido. Cuando asignes un setup a tus operaciones, esta página te mostrará cuáles de tus patrones ganan dinero y cuáles solo dan buena sensación.',
  'pb.empty.first': 'Escribe tu primer setup',
  'pb.editNamed': 'Editar {name}',

  'pb.delete.title': '¿Eliminar «{name}»?',
  'pb.delete.used': {
    one: '{count} operación tiene este setup. La operación se queda en tu diario; solo pierde la etiqueta del setup.',
    many: '{count} operaciones tienen este setup. Las operaciones se quedan en tu diario; solo pierden la etiqueta del setup.',
    other:
      '{count} operaciones tienen este setup. Las operaciones se quedan en tu diario; solo pierden la etiqueta del setup.',
  },
  'pb.delete.unused': 'Este setup se quitará de tu playbook.',
  'pb.delete.confirm': 'Eliminar setup',
  'pb.deleted': 'Setup eliminado',
  'pb.saved': 'Setup «{name}» guardado',

  'pb.noRules': 'Aún no hay reglas escritas. Las reglas son lo que permite comprobar un setup.',
  'pb.removedRules': 'Ya no forman parte de este setup',
  'pb.trades': 'Operaciones',
  'pb.factor': 'Factor benef.',
  'pb.noTrades': 'Aún no hay operaciones con este setup',
  'pb.unassigned': {
    one: 'operación no tiene setup. Asignarle uno es lo que hace útil esta página.',
    many: 'operaciones no tienen setup. Asignarles uno es lo que hace útil esta página.',
    other: 'operaciones no tienen setup. Asignarles uno es lo que hace útil esta página.',
  },

  'pb.keptOf': 'cumplida en {kept} de {total}',
  'pb.brokenTimes': 'incumplida {count}× · {net}',
  'pb.costliest': 'la más cara de incumplir',

  'pb.everyKeptOn': {
    one: 'Todas las reglas cumplidas en <num>{kept}</num> de {count} operación marcada',
    many: 'Todas las reglas cumplidas en <num>{kept}</num> de {count} operaciones marcadas',
    other: 'Todas las reglas cumplidas en <num>{kept}</num> de {count} operaciones marcadas',
  },
  'pb.partly': {
    one: '{count} marcada en parte',
    many: '{count} marcadas en parte',
    other: '{count} marcadas en parte',
  },
  'pb.unchecked': { other: '{count} sin marcar' },
  'pb.rules': 'Reglas',
  'pb.avgR': 'R medio',
  'pb.allKept': 'Todas las reglas cumplidas',
  'pb.oneBroken': 'Alguna regla incumplida',
  'pb.cost': {
    one: 'Incumplir una regla costó aquí unos <loss>{money}</loss>: la operación que incumplió alguna habría ganado esa cantidad más si hubiera rendido como la media de las que cumplieron todas.',
    many: 'Incumplir una regla costó aquí unos <loss>{money}</loss>: las {count} operaciones que incumplieron alguna habrían ganado esa cantidad más si hubieran rendido como la media de las que cumplieron todas.',
    other:
      'Incumplir una regla costó aquí unos <loss>{money}</loss>: las {count} operaciones que incumplieron alguna habrían ganado esa cantidad más si hubieran rendido como la media de las que cumplieron todas.',
  },
  'pb.noCost': 'Incumplir una regla aún no ha costado dinero en este setup.',
  'pb.costNeeds': {
    one: 'Lo que cuesta incumplir una regla aparecerá cuando haya {count} operación en cada lado.',
    many: 'Lo que cuesta incumplir una regla aparecerá cuando haya {count} operaciones en cada lado.',
    other: 'Lo que cuesta incumplir una regla aparecerá cuando haya {count} operaciones en cada lado.',
  },

  'pb.editor.hint': 'Un setup que puedes comprobar antes de pulsar comprar.',
  'pb.nameRequired': 'Ponle un nombre al setup',
  'pb.name': 'Nombre del setup',
  'pb.namePlaceholder': 'p. ej., Ruptura del rango de apertura',
  'pb.colour': 'Color',
  'pb.useColour': 'Usar el color {colour}',
  'pb.what': 'Qué es',
  'pb.whatPlaceholder': 'Describe el patrón en una o dos frases, como se lo explicarías a otra persona.',
  'pb.rulesHint': 'todas deben cumplirse antes de entrar en la operación',
  'pb.rulePlaceholder': 'p. ej., Volumen por encima de la media de 20 periodos',
  'pb.removeRule': 'Quitar la regla {n}',
  'pb.addRule': 'Añadir una regla',
  'pb.save': 'Guardar setup',
};
