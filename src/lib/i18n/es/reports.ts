import type { reports as en } from '../en/reports';
import type { Translation } from '../types';

export const reports: Translation<typeof en> = {
  'rep.description': 'Resúmenes de tu historial de operaciones, listos para imprimir.',
  'rep.empty.title': 'Todavía no hay ningún informe que preparar',
  'rep.empty.text':
    'Los informes resumen lo que has registrado: un desglose por meses, el rendimiento por símbolo y por setup, y las estadísticas principales, todo listo para imprimir o exportar.',
  'rep.closed': {
    one: '{label} · {count} operación cerrada',
    many: '{label} · {count} operaciones cerradas',
    other: '{label} · {count} operaciones cerradas',
  },
  'rep.print': 'Imprimir',

  'rep.results': 'Resultados',
  'rep.grossProfit': 'Beneficio bruto',
  'rep.grossLoss': 'Pérdida bruta',
  'rep.expectancy': 'Expectativa por operación',

  'rep.consistency': 'Constancia',
  'rep.trades': 'Operaciones',
  'rep.winRate': 'Tasa de acierto',
  'rep.greenDays': 'Días en verde',
  'rep.greenDays.value': '{pct} ({green} de {days})',
  'rep.greenDays.info':
    'La proporción de tus días de trading que terminaron por encima de cero, después de comisiones. Un día cuenta una vez, tenga las operaciones que tenga.',
  'rep.bestShare': 'Peso del mejor día',
  'rep.bestShare.value': {
    one: '{pct} de {count} día en verde',
    many: '{pct} de {count} días en verde',
    other: '{pct} de {count} días en verde',
  },
  'rep.bestShare.none': 'ningún día en verde',
  'rep.bestShare.info':
    'El beneficio de tu mejor día como parte de la suma del beneficio de todos tus días en verde. Alto significa que un solo día de suerte sostiene el historial; bajo, que el beneficio está repartido entre muchos días.',
  'rep.withoutBest': 'Neto sin el mejor día',
  'rep.withoutBest.info':
    'Tu beneficio neto sin tu mejor día. Si aquí sale en rojo, ese único día está sosteniendo el historial.',
  'rep.avgWin': 'Ganancia media',
  'rep.avgLoss': 'Pérdida media',
  'rep.winStreak': 'Racha ganadora más larga',
  'rep.lossStreak': 'Racha perdedora más larga',

  'rep.risk': 'Riesgo',
  'rep.fromPeak': 'Drawdown desde el máximo',
  'rep.setBalance': 'fija un saldo inicial',
  'rep.recovery': 'Factor de recuperación',
  'rep.recovery.info':
    'El beneficio neto dividido entre el drawdown máximo: cuántas veces cubre el beneficio la caída más profunda. Por debajo de 1, es menos de lo que llegaste a devolver; ∞ significa que aún no ha habido ninguna caída.',
  'rep.sqn': 'Calidad del sistema (SQN)',
  'rep.hold': 'Duración media de una operación',

  'rep.months': 'Mes a mes',
  'rep.months.empty': 'No hay operaciones cerradas en este periodo.',
  'rep.month': 'Mes',
  'rep.net': 'Neto',
  'rep.bySymbol': 'Mejores y peores símbolos',
  'rep.bySetup': 'Setups del Playbook',
  'rep.byWeekday': 'Día de la semana',
  'rep.unknownSetup': 'Desconocido',
  'rep.bestWorst': 'Mejor día: {best}, con {bestNet}; peor día: {worst}, con {worstNet}.',

  'rep.tags.kind': 'Grupo de etiquetas',
  'rep.tags.empty': 'Ninguna operación de este periodo tiene etiquetas de este grupo.',
  'rep.tags.tag': 'Etiqueta',
  'rep.tags.avgR': 'El R medio se calcula sobre las operaciones con stop.',
  'rep.tags.few': 'En gris: menos de 3 operaciones.',
  'rep.tags.thin': 'Subrayado con puntos: menos de 10, todavía pocas para fiarse.',
  'rep.tags.shared': {
    one: '{count} operación tiene dos de estas etiquetas y cuenta en cada fila.',
    many: '{count} operaciones tienen dos de estas etiquetas y cuentan en cada fila.',
    other: '{count} operaciones tienen dos de estas etiquetas y cuentan en cada fila.',
  },

  'rep.mis.clean': '{pct} sin errores ({clean} de {count})',
  'rep.mis.thisMonth': 'Este mes, {share}.',
  'rep.mis.bothMonths': 'Este mes, {share}; el mes pasado, {last}.',
  'rep.mis.lastMonth': 'Aún no has cerrado ninguna operación este mes; el mes pasado, {last}.',
  'rep.mis.cleanInRange':
    'Operaciones limpias, sin ningún error: <num>{pct}</num> ({clean} de {count}) en este periodo.',
  'rep.mis.cleanSince': 'Operaciones limpias, sin ningún error: <num>{pct}</num> ({clean} de {count}) desde el {date}.',
  'rep.mis.mistake': 'Error',
  'rep.mis.times': 'Veces',
  'rep.mis.cost': 'Coste',
  'rep.mis.noCost': 'ninguno por ahora',
  'rep.mis.gap': {
    one: 'La {count} operación con un error ganó {gap} menos por operación que las limpias: unos <loss>{cost}</loss> en total.',
    many: 'Las {count} operaciones con algún error ganaron {gap} menos por operación que las limpias: unos <loss>{cost}</loss> en total.',
    other:
      'Las {count} operaciones con algún error ganaron {gap} menos por operación que las limpias: unos <loss>{cost}</loss> en total.',
  },
  'rep.mis.how':
    'El coste de un error es lo que sus operaciones habrían ganado de más con la media de las operaciones limpias ({avg}), así que también cuenta una operación que ganó a pesar del error. Aparece cuando un error se ha cometido {min} veces y hay {min} operaciones limpias. Una operación con dos errores cuenta para los dos.',
  'rep.mis.howNoClean':
    'El coste de un error es lo que sus operaciones habrían ganado de más con la media de las operaciones limpias, así que también cuenta una operación que ganó a pesar del error. Aparece cuando un error se ha cometido {min} veces y hay {min} operaciones limpias. Una operación con dos errores cuenta para los dos.',
  'rep.mis.before':
    'No se cuentan las operaciones anteriores al {date}, el primer día en que una operación tiene un error.',
  'rep.mis.noneInRange': 'Ninguna operación de este periodo cometió un error.',
  'rep.mis.noneYet':
    'Aún no has registrado errores. Toca los que cometió una operación en su formulario, en Errores, y aquí se calcula lo que te cuesta cada uno.',
};
