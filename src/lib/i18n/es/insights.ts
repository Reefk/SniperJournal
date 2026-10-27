import type { insights as en } from '../en/insights';
import type { Translation } from '../types';

export const insights: Translation<typeof en> = {
  'ins.description': 'Patrones encontrados en tus propias operaciones, no consejos genéricos.',
  'ins.empty.none': 'Aún no hay nada que analizar',
  'ins.empty.more': {
    one: 'Falta {count} operación cerrada más',
    many: 'Faltan {count} operaciones cerradas más',
    other: 'Faltan {count} operaciones cerradas más',
  },
  'ins.empty.text': {
    one: 'Esta página lee tu diario y te cuenta lo que encuentra: qué sesión te da dinero, si operas por venganza, si mantienes las operaciones perdedoras más tiempo que las ganadoras. No dice nada hasta que haya al menos {count} operación cerrada, porque con menos solo hay ruido, no un patrón.',
    many: 'Esta página lee tu diario y te cuenta lo que encuentra: qué sesión te da dinero, si operas por venganza, si mantienes las operaciones perdedoras más tiempo que las ganadoras. No dice nada hasta que haya al menos {count} operaciones cerradas, porque con menos solo hay ruido, no un patrón.',
    other:
      'Esta página lee tu diario y te cuenta lo que encuentra: qué sesión te da dinero, si operas por venganza, si mantienes las operaciones perdedoras más tiempo que las ganadoras. No dice nada hasta que haya al menos {count} operaciones cerradas, porque con menos solo hay ruido, no un patrón.',
  },
  'ins.readFrom': {
    one: 'Basado en {count} operación cerrada. Cada afirmación remite a un número que puedes comprobar en la tabla.',
    many: 'Basado en {count} operaciones cerradas. Cada afirmación remite a un número que puedes comprobar en la tabla.',
    other:
      'Basado en {count} operaciones cerradas. Cada afirmación remite a un número que puedes comprobar en la tabla.',
  },
  'ins.live': 'Señales en directo',
  'ins.says': 'Lo que dice tu diario',
  'ins.money': 'De dónde sale el dinero',
  'ins.bySymbol': 'Por símbolo',
  'ins.bySession': 'Por sesión',
  'ins.byWeekday': 'Por día de la semana',
  'ins.byTag': 'Por etiqueta',
  'ins.score': 'Desglose del Sniper Score',
  'ins.notRated': 'sin valorar',
  'ins.unrated': {
    one: '{axes} aún no tiene puntuación. Anota un stop loss y valora tu disciplina, ejecución y paciencia cuando registres una operación.',
    many: '{axes} aún no tienen puntuación. Anota un stop loss y valora tu disciplina, ejecución y paciencia cuando registres una operación.',
    other:
      '{axes} aún no tienen puntuación. Anota un stop loss y valora tu disciplina, ejecución y paciencia cuando registres una operación.',
  },
  'ins.allScored': 'Cada eje se puntúa con datos que tú has aportado.',

  'ins.cat.Edge': 'Ventaja',
  'ins.cat.Timing': 'Momento',
  'ins.cat.Risk': 'Riesgo',
  'ins.cat.Behaviour': 'Conducta',
  'ins.cat.Cost': 'Coste',
  'ins.vs': '{a} frente a {b}',
  'ins.labelNet': '{label}: {net}',

  'sig.lossBreached.title': 'Límite de pérdida diaria alcanzado',
  'sig.lossBreached.text': 'Hoy has perdido más del límite que te fijaste. Tu propia regla dice que pares aquí.',
  'sig.lossNear.title': 'Cerca de tu límite de pérdida diaria',
  'sig.lossNear.text': 'Has usado el {pct} de la pérdida que te permites en un día.',
  'sig.tradeCount.title': {
    one: '{count} operación hoy',
    many: '{count} operaciones hoy',
    other: '{count} operaciones hoy',
  },
  'sig.tradeCount.text':
    'Tu límite es de {max} al día. Las operaciones de más, fuera del plan, suelen ser las que salen caras.',
  'sig.losing.title': {
    one: '{count} pérdida seguida',
    many: '{count} pérdidas seguidas',
    other: '{count} pérdidas seguidas',
  },
  'sig.losing.text':
    'Reduce el tamaño o tómate un descanso hasta tener un setup limpio. En las rachas es cuando se pierde la disciplina.',
  'sig.winning.title': {
    one: '{count} ganancia seguida',
    many: '{count} ganancias seguidas',
    other: '{count} ganancias seguidas',
  },
  'sig.winning.text': 'Vas bien. Mantén el tamaño de posición que tenías cuando empezó la racha.',
  'sig.better.title': 'Mejor que la semana pasada',
  'sig.better.text': 'Los últimos 7 días van por delante de los 7 días anteriores.',
  'sig.behind.title': 'Por detrás de la semana pasada',
  'sig.behind.text': 'Los últimos 7 días van por detrás de los 7 días anteriores.',

  'ins.expectancy.goodTitle': 'Tu sistema tiene una expectativa positiva',
  'ins.expectancy.badTitle': 'Tu sistema pierde dinero por operación',
  'ins.expectancy.goodText': {
    one: 'En {count} operación cerrada te quedas de media con esta cantidad por operación. Más operaciones de la misma calidad deberían hacerla crecer.',
    many: 'En {count} operaciones cerradas te quedas de media con esta cantidad por operación. Más operaciones de la misma calidad deberían hacerla crecer.',
    other:
      'En {count} operaciones cerradas te quedas de media con esta cantidad por operación. Más operaciones de la misma calidad deberían hacerla crecer.',
  },
  'ins.expectancy.badText': {
    one: 'En {count} operación cerrada el resultado medio es negativo. Dejar el peor setup suele importar más que encontrar uno nuevo.',
    many: 'En {count} operaciones cerradas el resultado medio es negativo. Dejar el peor setup suele importar más que encontrar uno nuevo.',
    other:
      'En {count} operaciones cerradas el resultado medio es negativo. Dejar el peor setup suele importar más que encontrar uno nuevo.',
  },
  'ins.expectancy.metric': '{money} por operación',

  'ins.breakEven.title': 'Necesitas acertar un {pct} para llegar al punto de equilibrio',
  'ins.breakEven.above':
    'Aciertas un {pct}, lo que te deja {points} puntos de margen. Protege esa diferencia antes de perseguir una tasa de acierto más alta.',
  'ins.breakEven.below':
    'Aciertas un {pct}, por debajo del punto de equilibrio. O aciertas más a menudo o haces tus ganancias más grandes en relación con tus pérdidas.',
  'ins.breakEven.metric': '{points} pts de margen',

  'ins.session.title': '{session} es tu sesión más rentable',
  'ins.session.text':
    '{best} ha dado {bestNet} en {bestTrades} operaciones, con una tasa de acierto del {bestRate}. {worst} ha dado {worstNet} en {worstTrades}, con un {worstRate}. Si la diferencia se mantiene otro mes, la sesión floja es la que conviene dejar.',

  // day, worst, best: a weekday's full name, as Intl writes it ("viernes")
  'ins.weekday.title': 'El {day} te está costando dinero',
  'ins.weekday.text': {
    one: 'El {worst} acumula una pérdida de {loss} en {count} operación, mientras que tu mejor día es el {best}, con {bestNet}. Merece la pena preguntarse qué tiene de distinto ese día.',
    many: 'El {worst} acumula una pérdida de {loss} en {count} operaciones, mientras que tu mejor día es el {best}, con {bestNet}. Merece la pena preguntarse qué tiene de distinto ese día.',
    other:
      'El {worst} acumula una pérdida de {loss} en {count} operaciones, mientras que tu mejor día es el {best}, con {bestNet}. Merece la pena preguntarse qué tiene de distinto ese día.',
  },

  'ins.symbol.title': '{best} te sostiene, {worst} te lastra',
  'ins.symbol.text':
    '{best} ha dado {bestNet} en {bestTrades} operaciones. {worst} ha perdido {worstLoss} en {worstTrades}. Dejar tu peor instrumento suele ser la mejora más barata que tienes a mano.',

  'ins.setup.unknown': 'Setup desconocido',
  'ins.setup.title': '«{name}» es el mejor setup de tu playbook',
  'ins.setup.text': {
    one: 'Ha dado {bestNet} en {count} operación con una tasa de acierto del {rate}, frente a {worstNet} de «{worst}». Dale más tamaño al mejor.',
    many: 'Ha dado {bestNet} en {count} operaciones con una tasa de acierto del {rate}, frente a {worstNet} de «{worst}». Dale más tamaño al mejor.',
    other:
      'Ha dado {bestNet} en {count} operaciones con una tasa de acierto del {rate}, frente a {worstNet} de «{worst}». Dale más tamaño al mejor.',
  },

  'ins.tag.title': 'Las operaciones con la etiqueta «{tag}» pierden dinero',
  'ins.tag.text': {
    one: '{count} operación lleva esta etiqueta y va perdiendo {loss} con una tasa de acierto del {rate}. Ya nombraste el problema al etiquetarla.',
    many: '{count} operaciones llevan esta etiqueta y en conjunto pierden {loss} con una tasa de acierto del {rate}. Ya nombraste el problema al etiquetarlas.',
    other:
      '{count} operaciones llevan esta etiqueta y en conjunto pierden {loss} con una tasa de acierto del {rate}. Ya nombraste el problema al etiquetarlas.',
  },
  'ins.tag.metric': {
    one: '{count} operación etiquetada',
    many: '{count} operaciones etiquetadas',
    other: '{count} operaciones etiquetadas',
  },

  'ins.rules.costTitle': 'Romper tus reglas te ha costado unos {money}',
  'ins.rules.costText': {
    one: '{count} operación rompió una regla de su setup y ganó {gap} menos que las operaciones del mismo setup que cumplieron todas las reglas. Si le hubiera ido igual de bien, tendrías aproximadamente esa cantidad más.',
    many: '{count} operaciones rompieron una regla de su setup y ganaron {gap} menos por operación que las del mismo setup que cumplieron todas las reglas. Si les hubiera ido igual de bien, tendrías aproximadamente esa cantidad más.',
    other:
      '{count} operaciones rompieron una regla de su setup y ganaron {gap} menos por operación que las del mismo setup que cumplieron todas las reglas. Si les hubiera ido igual de bien, tendrías aproximadamente esa cantidad más.',
  },
  'ins.rules.noCostTitle': 'Romper tus reglas no te ha costado nada por ahora',
  'ins.rules.noCostMore': {
    one: 'La única operación que rompió una regla de su setup ganó {gap} más que las del mismo setup que cumplieron todas las reglas. O esas reglas no son lo que hace funcionar tus setups, o aún es pronto para saberlo. Vale la pena releerlas.',
    many: 'Las {count} operaciones que rompieron una regla de su setup ganaron {gap} más por operación que las del mismo setup que cumplieron todas las reglas. O esas reglas no son lo que hace funcionar tus setups, o aún es pronto para saberlo. Vale la pena releerlas.',
    other:
      'Las {count} operaciones que rompieron una regla de su setup ganaron {gap} más por operación que las del mismo setup que cumplieron todas las reglas. O esas reglas no son lo que hace funcionar tus setups, o aún es pronto para saberlo. Vale la pena releerlas.',
  },
  'ins.rules.noCostSame': {
    one: 'La única operación que rompió una regla de su setup ganó lo mismo que las del mismo setup que cumplieron todas las reglas. O esas reglas no son lo que hace funcionar tus setups, o aún es pronto para saberlo. Vale la pena releerlas.',
    many: 'Las {count} operaciones que rompieron una regla de su setup ganaron lo mismo que las del mismo setup que cumplieron todas las reglas. O esas reglas no son lo que hace funcionar tus setups, o aún es pronto para saberlo. Vale la pena releerlas.',
    other:
      'Las {count} operaciones que rompieron una regla de su setup ganaron lo mismo que las del mismo setup que cumplieron todas las reglas. O esas reglas no son lo que hace funcionar tus setups, o aún es pronto para saberlo. Vale la pena releerlas.',
  },
  'ins.rules.others': {
    one: 'Una operación más rompió una regla en un setup que necesita {min} operaciones que cumplieron todas las reglas y {min} que rompieron alguna antes de poder compararse.',
    many: 'Otras {count} rompieron una regla en setups que necesitan {min} operaciones que cumplieron todas las reglas y {min} que rompieron alguna antes de poder compararse.',
    other:
      'Otras {count} rompieron una regla en setups que necesitan {min} operaciones que cumplieron todas las reglas y {min} que rompieron alguna antes de poder compararse.',
  },
  'ins.rules.worst': {
    one: 'La regla que más ha costado romper: «{rule}», {net} en la operación que la rompió.',
    many: 'La regla que más ha costado romper: «{rule}», {net} en las {count} operaciones que la rompieron.',
    other: 'La regla que más ha costado romper: «{rule}», {net} en las {count} operaciones que la rompieron.',
  },
  'ins.rules.worstIn': {
    one: 'La regla que más ha costado romper: «{rule}» ({setup}), {net} en la operación que la rompió.',
    many: 'La regla que más ha costado romper: «{rule}» ({setup}), {net} en las {count} operaciones que la rompieron.',
    other: 'La regla que más ha costado romper: «{rule}» ({setup}), {net} en las {count} operaciones que la rompieron.',
  },
  'ins.rules.metric': {
    one: '{broken} de {count} operación revisada con una regla rota',
    many: '{broken} de {count} operaciones revisadas con una regla rota',
    other: '{broken} de {count} operaciones revisadas con una regla rota',
  },

  'ins.mistake.title': '«{mistake}» es tu error más caro',
  'ins.mistake.text': {
    one: 'Lo cometiste en {count} operación, y su resultado fue {avg} frente a una media de {cleanAvg} en las operaciones limpias, las que no tienen ningún error ({clean}). Si le hubiera ido igual de bien, tendrías unos {cost} más.',
    many: 'Lo cometiste en {count} operaciones, y su media fue {avg} frente a {cleanAvg} en las operaciones limpias, las que no tienen ningún error ({clean}). Si les hubiera ido igual de bien, tendrías unos {cost} más.',
    other:
      'Lo cometiste en {count} operaciones, y su media fue {avg} frente a {cleanAvg} en las operaciones limpias, las que no tienen ningún error ({clean}). Si les hubiera ido igual de bien, tendrías unos {cost} más.',
  },
  'ins.mistake.metric': {
    one: 'unos {cost} en {count} operación',
    many: 'unos {cost} en {count} operaciones',
    other: 'unos {cost} en {count} operaciones',
  },

  'ins.side.longsTitle': 'Se te dan mejor los largos que los cortos',
  'ins.side.shortsTitle': 'Se te dan mejor los cortos que los largos',
  'ins.side.longsText':
    'Largos: {strongRate} en {strongTrades} operaciones. Cortos: {weakRate} en {weakTrades}. Una ventaja en una sola dirección sigue siendo una ventaja.',
  'ins.side.shortsText':
    'Cortos: {strongRate} en {strongTrades} operaciones. Largos: {weakRate} en {weakTrades}. Una ventaja en una sola dirección sigue siendo una ventaja.',
  'ins.side.metric': '{points} puntos de diferencia',

  'ins.busy.title': 'Tus días más activos son tus peores días',
  'ins.busy.text':
    'Los días con {min} operaciones o más dan de media menos que tus días más tranquilos. Tu ventaja no está en el volumen.',
  'ins.busy.metric': {
    one: '{count} día activo medido',
    many: '{count} días activos medidos',
    other: '{count} días activos medidos',
  },

  'ins.revenge.title': 'La operación justo después de una pérdida rinde peor',
  'ins.revenge.text': {
    one: '{count} operación se abrió justo después de una pérdida del mismo día, y queda por debajo de tu operación normal. Una breve pausa después de una operación en rojo te habría ahorrado dinero.',
    many: '{count} operaciones se abrieron justo después de una pérdida del mismo día, y de media quedan por debajo de tu operación normal. Una breve pausa después de una operación en rojo te habría ahorrado dinero.',
    other:
      '{count} operaciones se abrieron justo después de una pérdida del mismo día, y de media quedan por debajo de tu operación normal. Una breve pausa después de una operación en rojo te habría ahorrado dinero.',
  },
  'ins.revenge.metric': '{after} frente a {normal} normalmente',

  'ins.hold.title': 'Mantienes las perdedoras más tiempo que las ganadoras',
  'ins.hold.text':
    'Las operaciones perdedoras siguen abiertas bastante más tiempo que las ganadoras. Eso es gestionar la esperanza, no el riesgo. Un stop por tiempo estricto lo soluciona.',

  'ins.stops.title': 'Solo el {pct} de tus operaciones registra un stop',
  'ins.stops.text':
    'Sin precio de stop, el diario no puede medir tus múltiplos R y, sobre todo, no puedes demostrar que alguna vez definiste el riesgo. Añade uno en cada operación.',
  'ins.stops.metric': {
    one: '{n} de {count} operación',
    many: '{n} de {count} operaciones',
    other: '{n} de {count} operaciones',
  },

  'ins.outlier.title': 'Una pérdida es mucho mayor que las demás',
  'ins.outlier.text':
    'Tu mayor pérdida es más de dos veces y media tu pérdida media. Una sola operación así deshace una semana de buenas. Averigua si se movió el stop.',
  'ins.outlier.metric': '{worst} frente a {avg} de media',

  'ins.fees.flipTitle': 'Las comisiones convirtieron un sistema ganador en uno perdedor',
  'ins.fees.flipText':
    'Antes de comisiones eres rentable; después, no. Menos operaciones y más grandes, o un bróker más barato, le darían la vuelta.',
  'ins.fees.shareTitle': 'Las comisiones se comen una gran parte de tu beneficio',
  'ins.fees.shareText': 'Las comisiones suponen aproximadamente el {pct} de tu beneficio bruto.',
  'ins.fees.metric': '{money} pagados en comisiones',

  'ins.discipline.title': 'Tus propias valoraciones de disciplina predicen tus resultados',
  'ins.discipline.text':
    'Las operaciones que valoraste con 4–5 en disciplina rinden de media mejor que las que valoraste con 1–2. Sabes distinguir en el momento una buena operación de una mala, así que la solución es hacer caso a tu propia lectura.',
  'ins.discipline.metric': '{high} disciplinadas frente a {low} precipitadas',
};
