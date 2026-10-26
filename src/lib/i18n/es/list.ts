import type { list as en } from '../en/list';
import type { Translation } from '../types';

export const list: Translation<typeof en> = {
  'list.description': {
    one: '{count} operación en {account}',
    many: '{count} operaciones en {account}',
    other: '{count} operaciones en {account}',
  },
  'list.import': 'Importar',
  'list.exportCsv': 'Exportar CSV',
  'list.exported': {
    one: '{count} operación exportada',
    many: '{count} operaciones exportadas',
    other: '{count} operaciones exportadas',
  },
  'list.empty.title': 'Aún no hay operaciones registradas',
  'list.empty.description':
    'Registra cada operación al cerrarla o importa el archivo de tu bróker. Todos los gráficos y estadísticas de Sniper Journal se construyen a partir de estas entradas.',
  'list.empty.logFirst': 'Registra tu primera operación',

  'list.missing': {
    one: 'A <num>{count}</num> operación le falta algo.',
    many: 'A <num>{count}</num> operaciones les falta algo.',
    other: 'A <num>{count}</num> operaciones les falta algo.',
  },
  'list.missingHint': ' Quedan fuera de todas las estadísticas hasta que completes lo que falta.',
  'list.showThem': 'Mostrarlas',

  'list.search': 'Buscar operaciones',
  'list.filters': 'Filtros',
  'list.allSymbols': 'Todos los símbolos',
  'list.allSessions': 'Todas las sesiones',
  'list.allLeverage': 'Cualquier apalancamiento',
  'list.allSetups': 'Todos los setups',
  'list.mistake': 'Error',
  'list.allMistakes': 'Todos los errores',
  'list.madeMistake': 'Con algún error',
  'list.noMistake': 'Sin errores registrados',
  'list.from': 'Desde',
  'list.to': 'hasta',
  'list.fromDate': 'Fecha desde',
  'list.toDate': 'Fecha hasta',
  'list.allSides': 'Ambos lados',
  'list.long': 'Largo',
  'list.short': 'Corto',
  'list.allResults': 'Todos los resultados',
  'list.wins': 'Ganadoras',
  'list.losses': 'Perdedoras',
  'list.open': 'Abiertas',
  'list.needsDetails': 'Faltan detalles',
  'list.clearFilters': {
    one: 'Quitar {count} filtro',
    many: 'Quitar {count} filtros',
    other: 'Quitar {count} filtros',
  },
  'list.shown': {
    one: '<num>{count}</num> mostrada',
    many: '<num>{count}</num> mostradas',
    other: '<num>{count}</num> mostradas',
  },
  'list.net': 'Neto',

  'list.selected': {
    one: '<num>{count}</num> seleccionada',
    many: '<num>{count}</num> seleccionadas',
    other: '<num>{count}</num> seleccionadas',
  },
  'list.clear': 'Deseleccionar',
  'list.mergeIntoOne': 'Unir en una',
  'list.addDetails': 'Añadir detalles',
  'list.exclude': 'Excluir de las estadísticas',
  'list.excluded': 'Excluidas de las estadísticas',
  'list.include': 'Incluir',
  'list.included': 'Incluidas en las estadísticas',

  'list.noMatch': 'Ninguna operación coincide con estos filtros.',
  'list.clearAll': 'Quitar filtros',
  'list.select': 'Seleccionar la operación de {symbol}',
  'list.selectPage': 'Seleccionar todas las de esta página',
  'list.hasChart': 'Tiene gráfico',
  'list.needsBadge': 'faltan detalles',
  'list.fills': { one: '{count} ejecución', many: '{count} ejecuciones', other: '{count} ejecuciones' },
  'list.includeStats': 'Incluir en las estadísticas',
  'list.excludeStats': 'Excluir de las estadísticas',
  'list.excludedTitle': 'Excluida de las estadísticas. Haz clic para incluirla.',
  'list.includedTitle': 'Incluida en las estadísticas. Haz clic para excluirla.',
  'list.col.date': 'Fecha y hora',
  'list.col.qty': 'Cant.',
  'list.col.entry': 'Entrada',
  'list.col.exit': 'Salida',
  'list.col.pnl': 'P&L',
  'list.col.action': 'Acción',
  'list.manual': 'manual',
  'list.edit': 'Editar la operación de {symbol}',
  'list.delete': 'Eliminar la operación de {symbol}',
  'list.showing': 'Mostrando <num>{from}–{to}</num> de <num>{total}</num>',
  'list.previous': 'Página anterior',
  'list.next': 'Página siguiente',
  'list.tapToEdit': 'Toca una operación para editarla.',
  'list.clickToEdit': 'Haz clic en cualquier fila para editar esa operación.',
  'list.eyeHint': ' El icono del ojo mantiene una operación en tu diario, pero la deja fuera de las estadísticas.',

  'needs.list': 'falta: {list}',
  'needs.symbol': 'símbolo',
  'needs.entryTime': 'hora de entrada',
  'needs.quantity': 'cantidad',
  'needs.entryPrice': 'precio de entrada',

  'list.delete.titleOne': '¿Eliminar esta operación?',
  'list.delete.title': { other: '¿Eliminar {count} operaciones?' },
  'list.delete.message':
    'Las operaciones eliminadas se quitan de tu diario y de todas las estadísticas. No se puede deshacer.',
  'list.delete.confirmOne': 'Eliminar operación',
  'list.delete.confirm': { other: 'Eliminar {count} operaciones' },
  'list.deletedOne': 'Operación eliminada',
  'list.deleted': { other: '{count} operaciones eliminadas' },

  'list.merge.title': { other: '¿Unir {count} partes en una sola operación?' },
  'list.merge.body':
    'Parecen una sola posición de la que saliste por partes. Al unirlas obtienes un único <pos></pos> de <qty></qty>, con entrada en torno a <entry></entry> y salida en torno a <exit></exit>, por <pnl></pnl>: lo mismo que la suma de las partes.',
  'list.merge.bodyOpen':
    'Parecen una sola posición de la que saliste por partes. Al unirlas obtienes un único <pos></pos> de <qty></qty>, con entrada en torno a <entry></entry>, por <pnl></pnl>: lo mismo que la suma de las partes.',
  'list.merge.chart':
    'La operación unida conserva el gráfico de la primera parte que tenga uno; la otra imagen de gráfico se elimina.',
  'list.merge.charts': {
    other:
      'La operación unida conserva el gráfico de la primera parte que tenga uno; las otras {count} imágenes de gráfico se eliminan.',
  },
  'list.merge.link':
    'Conserva el enlace al gráfico de la primera parte que tenga uno, y el otro enlace se añade a sus notas.',
  'list.merge.links': {
    other:
      'Conserva el enlace al gráfico de la primera parte que tenga uno, y los otros {count} enlaces se añaden a sus notas.',
  },
  'list.merge.undo':
    'No se puede deshacer, aunque al volver a importar el CSV original recuperas las partes por separado.',
  'list.merge.confirm': 'Unir en una operación',
  'list.merged': { other: '{count} partes unidas en una operación' },

  'merge.atLeastTwo': 'Selecciona al menos dos operaciones para unirlas.',
  'merge.sameSymbol': 'Tienen que ser del mismo símbolo.',
  'merge.sameSide': 'Tienen que tener la misma dirección.',
  'merge.sameAccount': 'Tienen que estar en la misma cuenta.',
  'merge.quantity': 'Cada parte necesita una cantidad antes de poder unirlas.',
  'merge.entryPrice': 'Cada parte necesita un precio de entrada antes de poder unirlas.',
  'merge.someOpen': 'Algunas siguen abiertas. Une las cerradas o cierra primero las demás.',
};
