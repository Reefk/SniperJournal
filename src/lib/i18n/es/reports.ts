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

  'rep.form': 'Forma reciente',
  'rep.form.subtitle': 'Tus últimas operaciones frente a todo tu historial, sea cual sea el periodo de arriba',
  'rep.form.last': {
    one: 'La última operación',
    many: 'Las últimas {count} operaciones',
    other: 'Las últimas {count} operaciones',
  },
  'rep.form.all': {
    one: '{count} operación en total',
    many: 'Las {count} operaciones',
    other: 'Las {count} operaciones',
  },
  'rep.form.needs': {
    one: 'Falta {count} operación',
    many: 'Faltan {count} operaciones',
    other: 'Faltan {count} operaciones',
  },
  'rep.form.above': 'por encima de todo tu historial',
  'rep.form.below': 'por debajo de todo tu historial',
  'rep.form.rNote': 'La R media cuenta las operaciones con stop: {count} de {total}.',
  'rep.form.noR': 'Ninguna operación tiene stop, así que no hay R que mostrar.',
  'rep.form.rThin': {
    one: 'Un R medio de menos de {count} operación con stop no lleva flecha: son muy pocas para comparar.',
    many: 'Un R medio de menos de {count} operaciones con stop no lleva flecha: son muy pocas para comparar.',
    other: 'Un R medio de menos de {count} operaciones con stop no lleva flecha: son muy pocas para comparar.',
  },

  'rep.holdVs': 'Duración frente a resultado',
  'rep.holdVs.subtitle':
    'Un punto por cada operación del periodo: cuánto la mantuviste y cómo salió. Tócalo para abrirla.',
  'rep.holdVs.held': 'mantenida {duration}',
  'rep.holdVs.split':
    'Mantenidas más de {duration}: {longer} por operación ({longerTrades}). Hasta {duration}: {shorter} por operación ({shorterTrades}).',
  'rep.holdVs.trades': { one: '{count} operación', many: '{count} operaciones', other: '{count} operaciones' },
  'rep.holdVs.thin': {
    one: 'Si mantener más tiempo rinde se verá cuando cada mitad tenga {count} operación.',
    many: 'Si mantener más tiempo rinde se verá cuando cada mitad tenga {count} operaciones.',
    other: 'Si mantener más tiempo rinde se verá cuando cada mitad tenga {count} operaciones.',
  },
  'rep.holdVs.noStop': {
    one: '{count} operación sin stop queda fuera: no tiene R.',
    many: '{count} operaciones sin stop quedan fuera: no tienen R.',
    other: '{count} operaciones sin stop quedan fuera: no tienen R.',
  },
  'rep.holdVs.noTime': {
    one: '{count} operación sin hora de cierre queda fuera.',
    many: '{count} operaciones sin hora de cierre quedan fuera.',
    other: '{count} operaciones sin hora de cierre quedan fuera.',
  },
  'rep.holdVs.same': 'Demasiadas operaciones tienen la misma duración para dividirlas en dos.',
  'rep.holdVs.empty': 'Ninguna operación del periodo tiene una duración que mostrar.',
  'rep.holdVs.summary': {
    one: 'Duración frente a resultado: {count} operación, mantenida de {from} a {to}.',
    many: 'Duración frente a resultado: {count} operaciones, mantenidas de {from} a {to}.',
    other: 'Duración frente a resultado: {count} operaciones, mantenidas de {from} a {to}.',
  },

  'rep.heat': 'Día y hora',
  'rep.heat.subtitle': 'Tus operaciones según el día y la hora en que las abriste: el neto y cuántas.',
  'rep.heat.day': 'Día',
  'rep.heat.hour': 'Hora',
  'rep.heat.none': 'Sin operaciones',
  'rep.heat.noTime': {
    one: '{count} operación con solo fecha, sin hora de apertura, queda fuera.',
    many: '{count} operaciones con solo fecha, sin hora de apertura, quedan fuera.',
    other: '{count} operaciones con solo fecha, sin hora de apertura, quedan fuera.',
  },
  'rep.heat.empty': 'Ninguna operación del periodo tiene hora de apertura.',

  'rep.spread': 'Distribución de R',
  'rep.spread.subtitle':
    'Cuántas operaciones terminaron cerca de cada R, en pasos de media R, de {low} o peor a {high} o mejor.',
  'rep.spread.bar': {
    one: '{r}: {count} operación',
    many: '{r}: {count} operaciones',
    other: '{r}: {count} operaciones',
  },
  'rep.spread.low': '{r} o peor',
  'rep.spread.high': '{r} o mejor',
  'rep.spread.top': 'Tus mejores operaciones, el {tenth} ({count} de {of}), hicieron el {share} de tu neto.',
  'rep.spread.split': {
    one: 'Tus mejores operaciones, el {tenth} ({top} de {of}), hicieron {best}; la otra {count} operación sumó {rest}.',
    many: 'Tus mejores operaciones, el {tenth} ({top} de {of}), hicieron {best}; las otras {count} operaciones sumaron {rest}.',
    other:
      'Tus mejores operaciones, el {tenth} ({top} de {of}), hicieron {best}; las otras {count} operaciones sumaron {rest}.',
  },
  'rep.spread.past': {
    one: '{count} pérdida superó {stop}: {beyond} más de lo que permitía su stop.',
    many: '{count} pérdidas superaron {stop}: {beyond} más de lo que permitían sus stops, en total.',
    other: '{count} pérdidas superaron {stop}: {beyond} más de lo que permitían sus stops, en total.',
  },
  'rep.spread.held': 'Ninguna pérdida superó {stop} en más de un cuarto de R: tus stops aguantaron.',
  'rep.spread.noStop': {
    one: '{count} operación sin stop queda fuera de las barras: no tiene R.',
    many: '{count} operaciones sin stop quedan fuera de las barras: no tienen R.',
    other: '{count} operaciones sin stop quedan fuera de las barras: no tienen R.',
  },
  'rep.spread.empty': 'No hay operaciones cerradas en este periodo.',

  'rep.months': 'Mes a mes',
  'rep.months.empty': 'No hay operaciones cerradas en este periodo.',
  'rep.month': 'Mes',
  'rep.net': 'Neto',
  'rep.balance': 'Saldo',
  'rep.netSoFar': 'Neto acumulado',
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
