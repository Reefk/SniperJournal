import type { review as en } from '../en/review';
import type { Translation } from '../types';

export const review: Translation<typeof en> = {
  'review.head.trade': 'Una operación mía para revisar: {symbol}, {date}.',
  'review.head.day': 'Un día de trading mío para revisar: {day}, {date}.',
  'review.head.week': 'Una semana de trading mía para revisar: {from} – {to}.',
  'review.leftOut':
    'Los importes no aparecen: los resultados van en R (el resultado de una operación frente al riesgo que fijó su stop) y en % de mi saldo.',
  'review.leftOutNoBalance':
    'Los importes no aparecen: los resultados van en R, el resultado de una operación frente al riesgo que fijó su stop.',

  'review.count': {
    one: '{count} operación; ganadoras: {won}, perdedoras: {lost}.',
    many: '{count} operaciones; ganadoras: {won}, perdedoras: {lost}.',
    other: '{count} operaciones; ganadoras: {won}, perdedoras: {lost}.',
  },
  'review.net': 'Neto: {result}.',
  'review.rTotal': {
    one: 'En R: {r} en {count} operación con stop.',
    many: 'En R: {r} en las {count} operaciones con stop.',
    other: 'En R: {r} en las {count} operaciones con stop.',
  },
  'review.uncounted.day': {
    one: 'Otra operación, más abajo, sigue abierta o quedó fuera de mis estadísticas, así que estas cifras no la cuentan.',
    many: 'Otras {count} operaciones, más abajo, siguen abiertas o quedaron fuera de mis estadísticas, así que estas cifras no las cuentan.',
    other:
      'Otras {count} operaciones, más abajo, siguen abiertas o quedaron fuera de mis estadísticas, así que estas cifras no las cuentan.',
  },
  'review.uncounted.week': {
    one: 'Otra operación sigue abierta o quedó fuera de mis estadísticas, así que estas cifras y las líneas de los días no la cuentan.',
    many: 'Otras {count} operaciones siguen abiertas o quedaron fuera de mis estadísticas, así que estas cifras y las líneas de los días no las cuentan.',
    other:
      'Otras {count} operaciones siguen abiertas o quedaron fuera de mis estadísticas, así que estas cifras y las líneas de los días no las cuentan.',
  },
  'review.pct': '{pct} de mi saldo',
  'review.days': 'Día a día:',
  'review.dayLine': '{day}: {trades}, {result}',
  'review.wonLost': 'ganadoras: {won}, perdedoras: {lost}',
  'review.flagged': 'Completas, las operaciones que incumplieron una regla o tuvieron un error:',
  'review.flagged.none': 'Ninguna operación incumplió una regla ni tuvo un error.',
  'review.flagged.rest': {
    one: 'La otra operación solo aparece en las líneas de los días, más arriba.',
    many: 'Las otras {count} operaciones solo aparecen en las líneas de los días, más arriba.',
    other: 'Las otras {count} operaciones solo aparecen en las líneas de los días, más arriba.',
  },

  'review.trade': '{symbol}, {side}, {date}',
  'review.times': 'Abierta {open}, cerrada {close}, duración {hold}.',
  'review.stillOpen': 'Abierta {open}; sigue abierta.',
  'review.sizePrices': 'Tamaño {size}; entrada {entry}; salida {exit}.',
  'review.prices': 'Entrada {entry}; salida {exit}.',
  'review.sizeEntry': 'Tamaño {size}; entrada {entry}.',
  'review.entry': 'Entrada {entry}.',
  'review.stop': 'Stop {stop}.',
  'review.stopTarget': 'Stop {stop}; objetivo {target}.',
  'review.noStop': 'Sin stop.',
  'review.result': 'Resultado: {result}.',
  'review.rAndAmount': '{r}, {amount}',
  'review.afterFees': '{result}, después de {fees} de comisiones',
  'review.win': 'ganó',
  'review.loss': 'perdió',
  'review.even': 'quedó a cero',
  'review.setup': 'Setup: {name}.',
  'review.ruleSep': '; ',
  'review.kept': 'Reglas cumplidas: {rules}.',
  'review.broken': 'Reglas incumplidas: {rules}.',
  'review.unticked': 'Reglas sin marcar: {rules}.',
  'review.noTicks': 'Sus reglas no se marcaron.',
  'review.mistakes': 'Errores: {list}.',
  'review.tags': 'Etiquetas: {list}.',
  'review.ratings': 'Mis notas, sobre 5: {list}.',
  'review.session': 'Sesión: {session}.',
  'review.notes': 'Notas: {notes}',
  'review.excluded': 'La dejé fuera de mis estadísticas.',

  'review.mine': 'Mis propias reglas, para calificar con ellas:',
  'review.rules': '{name}: {rules}.',
  'review.noRules': '{name}: aún sin reglas escritas.',
  'review.mistakeList': 'Errores que vigilo: {list}.',
  'review.goals': 'Mis objetivos: {list}.',
  'review.note':
    'Revisa estas operaciones como mi coach de trading. Califica cada una por su proceso, no por su resultado: una línea por operación, con el motivo, según mis propias reglas y errores de arriba, no según consejos generales de trading. Después nombra una cosa que debo seguir haciendo y una que debo cambiar.',

  'review.copy': 'Copiar para revisión',
  'review.copyTrade': 'Copiar esta operación para revisión',
  'review.copyWeek': 'Copiar esta semana para revisión',
  'review.copyDay': 'Copiar este día para revisión',
  'review.dialog':
    'Pégalo en cualquier chat de IA o envíalo a un mentor. La app no envía nada: el texto solo va donde lo pegues.',
  'review.leaveOut': 'Dejar fuera el dinero',
  'review.leaveOut.hint':
    'R y % de tu saldo en lugar de importes, tamaños y comisiones, así el tamaño de tu cuenta queda solo para ti. Tus notas van tal como las escribiste.',
  'review.leaveOut.hidden': 'Los importes están ocultos (el ojo de la cabecera), así que aquí también quedan fuera.',
  'review.text': 'El texto',
  'review.copied': 'Copiado. Pégalo donde quieras.',
  'review.failed':
    'Este dispositivo no dejó copiar a la app. El texto está seleccionado: cópialo con Ctrl+C, o mantenlo pulsado en un teléfono.',
};
