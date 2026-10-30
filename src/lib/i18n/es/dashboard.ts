import type { dashboard as en } from '../en/dashboard';
import type { Translation } from '../types';

export const dashboard: Translation<typeof en> = {
  'range.7D': '7 d',
  'range.30D': '30 d',
  'range.90D': '90 d',
  'range.YTD': 'Este año',
  'range.ALL': 'Todo',
  'range.none.7D': 'No hay operaciones cerradas en los últimos 7 días',
  'range.none.30D': 'No hay operaciones cerradas en los últimos 30 días',
  'range.none.90D': 'No hay operaciones cerradas en los últimos 90 días',
  'range.none.YTD': 'No hay operaciones cerradas este año',
  'range.none.ALL': 'Aún no hay operaciones cerradas',
  'range.before.7D': 'los 7 días anteriores',
  'range.before.30D': 'los 30 días anteriores',
  'range.before.90D': 'los 90 días anteriores',
  'range.before.YTD': 'el mismo número de días antes',

  'stat.netProfit': 'Beneficio neto',
  'stat.profitFactor': 'Factor de beneficio',
  'stat.avgRR': 'R:R medio',
  'stat.expectancy': 'Expectativa',
  'stat.sqn': 'Calidad del sistema',
  'stat.commissions': 'Comisiones',
  'stat.totalTrades': 'Operaciones totales',
  'stat.maxStreak': 'Racha máxima',
  'stat.bestDay': 'Mejor día',
  'stat.worstDay': 'Peor día',
  'stat.avgWinLoss': 'Ganancia / pérdida media',
  'stat.largestWin': 'Mayor ganancia',
  'stat.largestLoss': 'Mayor pérdida',
  'stat.maxDrawdown': 'Drawdown máximo',
  'stat.averageDay': 'Día medio',
  'stat.wins': '{n}G',
  'stat.losses': '{n}P',
  'stat.breakeven': '{n}E',
  'stat.tradingDays': {
    one: '{count} día de trading',
    many: '{count} días de trading',
    other: '{count} días de trading',
  },

  'dash.empty.title': 'Tu panel se construye solo a partir de tus operaciones',
  'dash.empty.body':
    'Aquí no hay nada rellenado de antemano. Registra tu primera operación y la curva de capital, la tasa de acierto, el factor de beneficio y el Sniper Score empiezan a calcularse con tus propios números.',
  'dash.empty.first': 'Registra tu primera operación',
  'dash.empty.import': 'Importar un CSV',
  'dash.empty.sample': 'Cargar datos de prueba para explorar',
  'dash.closedInRange': {
    one: '<num>{count}</num> operación cerrada en el periodo',
    many: '<num>{count}</num> operaciones cerradas en el periodo',
    other: '<num>{count}</num> operaciones cerradas en el periodo',
  },
  'dash.open': { one: '{count} abierta', many: '{count} abiertas', other: '{count} abiertas' },
  'dash.noClosedHint':
    'Tus estadísticas se calculan solo con operaciones cerradas. Amplía el periodo, o cierra una posición para verla contada.',
  'dash.showAllTime': 'Ver todo el historial',

  'dash.balance': 'Saldo {money}',
  'dash.netInfo':
    'El beneficio total después de comisiones y tarifas, en todas las operaciones cerradas del periodo elegido.',
  'dash.winRateInfo':
    'La proporción de operaciones cerradas que terminaron por encima del punto de equilibrio después de comisiones.',
  'dash.wonLost': '{won} ganados frente a {lost} perdidos',
  'dash.pfInfo':
    'El beneficio bruto dividido entre la pérdida bruta. Por encima de 1 significa que ganas más de lo que devuelves; 2 o más es sólido.',
  'dash.rrSub': 'Tu ganadora media frente a tu perdedora media',
  'dash.avgResult': 'resultado medio de {r}',
  'dash.rrInfo':
    'Tu operación ganadora media comparada con tu perdedora media. La línea de abajo muestra el resultado medio en unidades del riesgo que definió tu stop loss.',
  'dash.perTrade': 'por operación',
  'dash.expectancyInfo': 'Lo que ganas en una operación media. La expectativa positiva lo es todo.',
  'dash.sqnInfo':
    'El SQN de Van Tharp: lo fuerte que es tu ventaja en relación con lo irregulares que son tus resultados.',
  'dash.feesShare': '{pct} del beneficio bruto',
  'dash.paidInFees': 'pagado en comisiones',
  'dash.feesInfo': 'Todo lo que pagaste a tu bróker en estas operaciones.',
  'dash.noStreak': 'sin racha activa',
  'dash.currently': 'ahora {streak}',
  'dash.streakInfo': 'La serie más larga de ganadoras seguidas y de perdedoras seguidas.',
  'dash.held': 'mantenida {duration} de media',
  'dash.avgWinLossInfo': 'El tamaño de tu ganadora media frente a tu perdedora media.',

  'dash.equity': 'Curva de capital',
  'dash.drawdown': 'Drawdown máximo {money}',
  'dash.drawdownPct': 'Drawdown máximo {money} ({pct})',
  'dash.equityHint': 'El saldo de la cuenta después de cada operación cerrada',
  'dash.currentBalance': 'saldo actual',
  'dash.currentBalanceExcluded': 'saldo actual, con las operaciones excluidas',
  'dash.start': 'Inicio',
  'dash.onThisTrade': '{money} en esta operación',
  'dash.dayTrades': {
    one: '{count} operación · {wl}',
    many: '{count} operaciones · {wl}',
    other: '{count} operaciones · {wl}',
  },

  'dash.score': 'Sniper Score',
  'dash.scoreHint': 'Valora tus operaciones para construirlo',
  'dash.scoreOverall': '{score} / 100 en total',
  'dash.notRated': 'Aún sin valorar: {axes}. Añade stops y autovaloraciones al registrar una operación.',

  'dash.daily': 'P&L diario',
  'dash.dailyHint': {
    one: '{count} día en verde, {red} en rojo · {pct} en verde',
    many: '{count} días en verde, {red} en rojo · {pct} en verde',
    other: '{count} días en verde, {red} en rojo · {pct} en verde',
  },
  'dash.dailyEmpty': 'Aún no hay operaciones cerradas en este periodo.',

  'dash.avgWinner': 'Ganadora media {money}',
  'dash.avgLoser': 'Perdedora media {money}',
  'dash.fromPeak': '{pct} desde el máximo',
  'dash.setBalance': 'Fija un saldo inicial para ver el %',
  'dash.drawdownInfo': 'La mayor caída desde un máximo de tu curva de capital.',
  'dash.across': {
    one: 'En {count} día de trading',
    many: 'En {count} días de trading',
    other: 'En {count} días de trading',
  },

  'dash.recent': 'Operaciones recientes',
  'dash.recentHint': 'Tus cinco últimas, la más reciente primero',
  'dash.viewAll': 'Ver todas',

  'dash.openPositions': {
    one: 'Tienes {count} posición abierta.',
    many: 'Tienes {count} posiciones abiertas.',
    other: 'Tienes {count} posiciones abiertas.',
  },
  'dash.openExcluded': {
    one: ' Queda fuera de las estadísticas hasta que añadas un precio de salida.',
    many: ' Quedan fuera de las estadísticas hasta que añadas un precio de salida.',
    other: ' Quedan fuera de las estadísticas hasta que añadas un precio de salida.',
  },
  'dash.openTable': 'Abrir la tabla de operaciones',
  'dash.footer':
    'Todas las cifras de arriba se calculan a partir de las operaciones que introdujiste. Nada se estima ni se rellena por ti.',

  'score.winRate': 'Tasa de acierto',
  'score.profitFactor': 'Factor de beneficio',
  'score.riskReward': 'Riesgo-beneficio',
  'score.consistency': 'Constancia',
  'score.discipline': 'Disciplina',
  'score.execution': 'Ejecución',
  'score.patience': 'Paciencia',
  'score.winRate.detail': '{pct} de las operaciones cerraron en verde',
  'score.profitFactor.detail': '{pf} ganados por cada unidad perdida',
  'score.riskReward.detail': 'resultado medio de {r}',
  'score.consistency.detail': {
    one: '{green} en verde de {count} día de trading',
    many: '{green} en verde de {count} días de trading',
    other: '{green} en verde de {count} días de trading',
  },
  'score.rating.detail': {
    one: '{avg} de 5 en {count} operación',
    many: '{avg} de 5 en {count} operaciones',
    other: '{avg} de 5 en {count} operaciones',
  },
  'score.needsTrades': 'Necesita al menos 5 operaciones cerradas',
  'score.needsStops': 'Registra un stop loss en al menos 5 operaciones',
  'score.needsDays': 'Necesita operaciones en al menos 5 días',
  'score.needsRatings': 'Valora al menos 3 operaciones al registrarlas',
  'sqn.none': 'Faltan datos',
  'sqn.below': 'Por debajo de la media',
  'sqn.average': 'En la media',
  'sqn.good': 'Bueno',
  'sqn.excellent': 'Excelente',
  'sqn.superb': 'Magnífico',
  'sqn.exceptional': 'Excepcional',

  'summary.equityEmpty':
    'Saldo de la cuenta: aún no hay operaciones cerradas en este periodo, así que se queda en {money}.',
  'summary.equity': {
    one: 'Saldo de la cuenta después de cada una de {count} operación cerrada, del {from} al {to}: de {start} a {end}, mínimo {low}, máximo {high}.',
    many: 'Saldo de la cuenta después de cada una de {count} operaciones cerradas, del {from} al {to}: de {start} a {end}, mínimo {low}, máximo {high}.',
    other:
      'Saldo de la cuenta después de cada una de {count} operaciones cerradas, del {from} al {to}: de {start} a {end}, mínimo {low}, máximo {high}.',
  },
  'summary.dailyEmpty': 'P&L diario: aún no hay operaciones cerradas en este periodo.',
  'summary.daily': {
    one: 'P&L neto de cada uno de {count} día de trading, del {from} al {to}: peor {worst}, mejor {best}, último día {last}.',
    many: 'P&L neto de cada uno de {count} días de trading, del {from} al {to}: peor {worst}, mejor {best}, último día {last}.',
    other:
      'P&L neto de cada uno de {count} días de trading, del {from} al {to}: peor {worst}, mejor {best}, último día {last}.',
  },
  'summary.score': 'Sniper Score sobre 100 en cada eje: {axes}.',
  'summary.scoreAxis': '{axis} {score}',
  'summary.scoreNone': 'Sniper Score: aún no hay ningún eje valorado.',
  'summary.unrated': 'Aún sin valorar: {axes}.',
  'summary.overall': 'En total, {score} sobre 100.',
};
