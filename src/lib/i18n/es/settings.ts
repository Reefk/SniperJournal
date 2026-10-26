import type { settings as en } from '../en/settings';
import type { Translation } from '../types';

export const settings: Translation<typeof en> = {
  'settings.title': 'Ajustes',
  'settings.description': 'Cuentas, divisa y tus datos.',

  'settings.profile': 'Perfil y pantalla',
  'settings.currencyHint': 'se usa en todas las cifras',
  'settings.theme': 'Tema',
  'settings.theme.dark': 'Oscuro',
  'settings.theme.light': 'Claro',
  'settings.placeholders': 'Texto de ejemplo en los campos vacíos',
  'settings.placeholders.clear': 'Nítido, fácil de leer',
  'settings.placeholders.faded': 'Tenue, nunca parece rellenado',

  'settings.limits': 'Límites y objetivos',
  'settings.limitsHint':
    'Los límites diarios activan las señales de la página Análisis. Un objetivo aparece en el Panel en cuanto le das una meta. Deja una casilla en blanco para desactivarla.',
  'settings.dailyLimits': 'Límites diarios',
  'settings.maxLoss': 'Pérdida máxima en un día',
  'settings.maxTrades': 'Operaciones máximas en un día',

  'settings.mistakes': 'Errores',
  'settings.mistakesHint':
    'Los que el formulario de la operación ofrece para marcar con un toque. Informes calcula lo que te costó cada uno.',
  'settings.yourMistakes': 'Tus errores',
  'settings.mistakesEmpty': 'La lista está vacía, así que el formulario de la operación no ofrece ninguno.',
  'settings.editList': 'Editar la lista',
  'settings.mistakesSaved': 'Errores guardados',
  'settings.mistakesRenamed': {
    one: 'Errores guardados y renombrados en {count} operación',
    many: 'Errores guardados y renombrados en {count} operaciones',
    other: 'Errores guardados y renombrados en {count} operaciones',
  },
  'settings.mistakesEditorHint':
    'Renombrar uno lo renombra en todas las operaciones que lo tienen. Quitar uno de la lista deja esas operaciones como están, e Informes lo sigue contando.',
  'settings.mistakeN': 'Error {n}',
  'settings.mistakePlaceholder': 'p. ej., Operé en el primer minuto',
  'settings.removeMistakeN': 'Quitar el error {n}',
  'settings.addMistake': 'Añadir un error',
  'settings.saveMistakes': 'Guardar errores',

  'settings.tags': 'Etiquetas',
  'settings.tagsHint':
    'Todas las etiquetas de tus operaciones, en todas las cuentas. Renombrar, fusionar o eliminar una cambia todas las operaciones que la tienen.',

  'settings.accounts': 'Cuentas',
  'settings.accountsHint': 'Cada cuenta tiene sus propias operaciones, saldo y estadísticas.',
  'settings.accountTrades': {
    one: '{count} operación',
    many: '{count} operaciones',
    other: '{count} operaciones',
  },
  'settings.oneAccountNeeded': 'Necesitas al menos una cuenta',
  'settings.deleteThisAccount': 'Eliminar esta cuenta',
  'settings.deleteNamed': 'Eliminar {name}',
  'settings.addAccount': 'Añadir una cuenta',
  'settings.deleteAccount.title': '¿Eliminar «{name}»?',
  'settings.deleteAccount.message': {
    one: 'Esto elimina para siempre la cuenta y su {count} operación.',
    many: 'Esto elimina para siempre la cuenta y sus {count} operaciones.',
    other: 'Esto elimina para siempre la cuenta y sus {count} operaciones.',
  },
  'settings.deleteAccount.empty': 'Esta cuenta no tiene operaciones.',
  'settings.deleteAccount.confirm': 'Eliminar cuenta',
  'settings.accountDeleted': 'Cuenta eliminada',
  'settings.countExcluded': 'Contar las operaciones excluidas en el saldo',
  'settings.countExcludedHint':
    'Desactivado: una operación que excluyes con el icono del ojo queda fuera del saldo y de las estadísticas. Activado: el saldo la cuenta, así coincide con el extracto de tu bróker. La tasa de acierto, el beneficio neto, la curva de capital y el drawdown siempre dejan fuera las operaciones excluidas.',

  'settings.backups': 'Copias de seguridad',
  'settings.backupsHint':
    'Tu diario ya se guarda en el disco automáticamente. Estas sirven para moverlo o para guardar una copia en otro sitio.',
  'settings.restore': 'Restaurar desde una copia de seguridad',
  'settings.bringOver': 'Traer de la versión anterior',
  'settings.backups.phone':
    'También se guarda automáticamente una copia con fecha dentro de la app, una vez cada día en que haces cambios, y se conservan las 30 últimas. Pero esas copias se borran junto con la app, así que guarda de vez en cuando una copia de seguridad en Drive, en el correo o en tus archivos. Las imágenes de gráficos no se incluyen en la copia de seguridad.',
  'settings.backups.app':
    'Tu diario está en la carpeta Sniper Journal de tus Documentos, y se queda ahí si desinstalas la app. También se escribe automáticamente una copia con fecha en la carpeta backups, a su lado, una vez cada día en que haces cambios. Se conservan las 30 últimas. Las imágenes de gráficos se guardan como archivos en la carpeta screenshots y no dentro de la copia de seguridad, así que copia también esa carpeta si te pasas a otro ordenador.',
  'settings.backups.server':
    'También se escribe automáticamente una copia con fecha en la carpeta data/backups, una vez cada día en que haces cambios. Se conservan las 30 últimas. Las imágenes de gráficos se guardan como archivos en data/screenshots y no dentro de la copia de seguridad, así que copia también esa carpeta si te pasas a otro ordenador.',
  'settings.unreadable': 'No se pudo leer ese archivo',
  'settings.restore.title': '¿Restaurar esta copia de seguridad?',
  'settings.restore.message': {
    one: 'La copia de seguridad tiene {count} operación. Restaurarla sustituye todo lo que hay ahora en tu diario y borra las imágenes de gráficos que sus operaciones no usan.',
    many: 'La copia de seguridad tiene {count} operaciones. Restaurarla sustituye todo lo que hay ahora en tu diario y borra las imágenes de gráficos que sus operaciones no usan.',
    other:
      'La copia de seguridad tiene {count} operaciones. Restaurarla sustituye todo lo que hay ahora en tu diario y borra las imágenes de gráficos que sus operaciones no usan.',
  },
  'settings.restore.confirm': 'Sustituir mi diario',
  'settings.restored':
    'Diario restaurado. El que sustituyó se guardó en tus copias de seguridad, sin sus imágenes de gráficos.',
  'settings.noCopy': 'No se pudo guardar antes una copia de tu diario actual, así que no se cambió nada.',

  'settings.charts': 'Imágenes de gráficos',
  'settings.chartsHint':
    'Imágenes que ya no usa ninguna operación, como una pegada en un formulario de operación que nunca se guardó.',
  'settings.reclaim': 'Recuperar imágenes de gráficos sin usar',
  'settings.reclaimHint':
    'Ves cuántas hay, y cuánto espacio ocupan, antes de que se borre nada. Una imagen se conserva mientras tu diario o alguna copia de tus copias de seguridad la use, y durante un día después de añadirla, por si un formulario de operación abierto en otra ventana está a punto de guardarla.',
  'settings.reclaim.none': 'Todas las imágenes de gráficos siguen en uso. No hay nada que recuperar.',
  'settings.reclaim.title': {
    one: '¿Borrar {count} imagen de gráfico sin usar?',
    many: '¿Borrar {count} imágenes de gráficos sin usar?',
    other: '¿Borrar {count} imágenes de gráficos sin usar?',
  },
  'settings.reclaim.message': {
    one: 'Ninguna operación de tu diario ni ninguna copia de tus copias de seguridad la usa. Borrarla libera {size}.',
    many: 'Ninguna operación de tu diario ni ninguna copia de tus copias de seguridad las usa. Borrarlas libera {size}.',
    other:
      'Ninguna operación de tu diario ni ninguna copia de tus copias de seguridad las usa. Borrarlas libera {size}.',
  },
  'settings.reclaim.confirm': { one: 'Borrarla', many: 'Borrarlas', other: 'Borrarlas' },
  'settings.reclaim.done': {
    one: '{size} liberados: {count} imagen de gráfico sin usar borrada.',
    many: '{size} liberados: {count} imágenes de gráficos sin usar borradas.',
    other: '{size} liberados: {count} imágenes de gráficos sin usar borradas.',
  },
  'settings.reclaim.nothing': 'No se borró nada: las imágenes vuelven a estar en uso, o no se pudieron quitar.',
  'settings.reclaim.unreachable':
    'La app no pudo llegar a su carpeta de datos, así que no se borró ninguna imagen de gráfico.',

  'settings.testData': 'Datos de prueba',
  'settings.testDataHint':
    'Operaciones generadas para probar la app. Se marcan aparte y nunca se mezclan con tus propios registros.',
  'settings.testDataLoaded': 'Datos de prueba cargados',
  'settings.loadTestData': 'Cargar datos de prueba',
  'settings.regenerateTestData': 'Volver a generar los datos de prueba',
  'settings.testTradesLoaded': {
    one: '{count} operación de prueba cargada ahora',
    many: '{count} operaciones de prueba cargadas ahora',
    other: '{count} operaciones de prueba cargadas ahora',
  },

  'settings.danger': 'Zona de peligro',
  'settings.dangerHint': 'Esto no se puede deshacer.',
  'settings.erase': 'Borrar todos los datos',
  'settings.erase.title': '¿Borrarlo todo?',
  'settings.erase.message': {
    one: 'Esto borra para siempre tu {count} operación y su imagen de gráfico, tus setups, tus recursos y tus cuentas. Descarga antes una copia de seguridad si no estás seguro; las copias de seguridad no incluyen las imágenes de gráficos.',
    many: 'Esto borra para siempre tus {count} operaciones y sus imágenes de gráficos, tus setups, tus recursos y tus cuentas. Descarga antes una copia de seguridad si no estás seguro; las copias de seguridad no incluyen las imágenes de gráficos.',
    other:
      'Esto borra para siempre tus {count} operaciones y sus imágenes de gráficos, tus setups, tus recursos y tus cuentas. Descarga antes una copia de seguridad si no estás seguro; las copias de seguridad no incluyen las imágenes de gráficos.',
  },
  'settings.erase.empty':
    'Esto borra para siempre tus setups, tus recursos y tus cuentas. Descarga antes una copia de seguridad si no estás seguro; las copias de seguridad no incluyen las imágenes de gráficos.',
  'settings.erase.confirm': 'Borrar mi diario',
  'settings.erased': 'Diario borrado. Se guardó una copia, sin las imágenes de gráficos, en tus copias de seguridad.',

  'tags.none': 'Aún no hay etiquetas. Las que escribas en el formulario de una operación aparecen aquí.',
  'tags.alike': 'Estas parecen una sola etiqueta',
  'tags.merge': 'Fusionar…',
  'tags.moveToMistakes': 'Pasar a errores…',
  'tags.keepApart': 'Mantener separadas',
  'tags.keptApart': 'Se mantienen separadas',
  'tags.find': 'Buscar una etiqueta',
  'tags.yours': 'Tus etiquetas',
  'tags.noMatch': 'Ninguna etiqueta contiene «{text}».',
  'tags.showFewer': 'Mostrar menos',
  'tags.showAll': {
    one: 'Mostrar las {count} etiquetas',
    many: 'Mostrar las {count} etiquetas',
    other: 'Mostrar las {count} etiquetas',
  },
  'tags.groups': 'Grupos',
  'tags.newGroup': 'Nuevo grupo',
  'tags.groupsHint':
    'Agrupa las etiquetas a tu manera, por ejemplo Emoción u Origen de la idea. Informes muestra una tabla para cada grupo.',
  'tags.groupEmpty': 'Aún no tiene etiquetas',
  'tags.editGroup': 'Editar el grupo {name}',
  'tags.change': 'Cambiar «{tag}»',
  'tags.rename': 'Renombrar…',
  'tags.mergeInto': 'Fusionar con…',
  'tags.delete': 'Eliminar…',

  'tags.delete.title': '¿Eliminar «{tag}»?',
  'tags.delete.message': {
    one: 'Se quita de {count} operación, en todas las cuentas. Las operaciones se quedan.',
    many: 'Se quita de {count} operaciones, en todas las cuentas. Las operaciones se quedan.',
    other: 'Se quita de {count} operaciones, en todas las cuentas. Las operaciones se quedan.',
  },
  'tags.delete.confirm': 'Eliminar etiqueta',
  'tags.deleted': {
    one: '«{tag}» eliminada de {count} operación',
    many: '«{tag}» eliminada de {count} operaciones',
    other: '«{tag}» eliminada de {count} operaciones',
  },

  'tags.rename.title': 'Renombrar «{tag}»',
  'tags.rename.newName': 'Nombre nuevo',
  'tags.rename.action': 'Renombrar',
  'tags.rename.done': {
    one: 'Renombrada en {count} operación, en todas las cuentas',
    many: 'Renombrada en {count} operaciones, en todas las cuentas',
    other: 'Renombrada en {count} operaciones, en todas las cuentas',
  },
  'tags.rename.hint': {
    one: 'Cambia en {count} operación, en todas las cuentas.',
    many: 'Cambia en {count} operaciones, en todas las cuentas.',
    other: 'Cambia en {count} operaciones, en todas las cuentas.',
  },
  'tags.rename.mergeHint': {
    one: '«{tag}» ya es una etiqueta: las dos se convierten en una, en {count} operación, en todas las cuentas. Una operación con ambas la conserva una vez.',
    many: '«{tag}» ya es una etiqueta: las dos se convierten en una, en {count} operaciones, en todas las cuentas. Una operación con ambas la conserva una vez.',
    other:
      '«{tag}» ya es una etiqueta: las dos se convierten en una, en {count} operaciones, en todas las cuentas. Una operación con ambas la conserva una vez.',
  },
  'tags.merge.action': 'Fusionar',
  'tags.merge.done': {
    one: 'Fusionada con «{tag}» en {count} operación, en todas las cuentas',
    many: 'Fusionada con «{tag}» en {count} operaciones, en todas las cuentas',
    other: 'Fusionada con «{tag}» en {count} operaciones, en todas las cuentas',
  },
  'tags.merge.titleMany': 'Fusionar estas etiquetas',
  'tags.merge.title': 'Fusionar «{tag}»',
  'tags.merge.keep': 'Qué forma de escribirla conservar',
  'tags.merge.become': {
    one: 'Se convierten en una sola etiqueta en {count} operación, en todas las cuentas.',
    many: 'Se convierten en una sola etiqueta en {count} operaciones, en todas las cuentas.',
    other: 'Se convierten en una sola etiqueta en {count} operaciones, en todas las cuentas.',
  },
  'tags.merge.into': 'Con',
  'tags.merge.intoHint': {
    one: '«{tag}» se quita de {count} operación y la etiqueta que elijas ocupa su lugar. Una operación con ambas la conserva una vez.',
    many: '«{tag}» se quita de {count} operaciones y la etiqueta que elijas ocupa su lugar. Una operación con ambas la conserva una vez.',
    other:
      '«{tag}» se quita de {count} operaciones y la etiqueta que elijas ocupa su lugar. Una operación con ambas la conserva una vez.',
  },
  'tags.merge.noOther': 'No hay otra etiqueta con la que fusionarla.',
  'tags.move.title': 'Pasar a errores',
  'tags.move.done': {
    one: 'Pasada a errores como «{mistake}» en {count} operación, en todas las cuentas',
    many: 'Pasada a errores como «{mistake}» en {count} operaciones, en todas las cuentas',
    other: 'Pasada a errores como «{mistake}» en {count} operaciones, en todas las cuentas',
  },
  'tags.move.bodyMany': {
    one: 'Estas etiquetas se quitan de {count} operación, en todas las cuentas, y en su lugar recibe el error. Informes cuenta luego esa operación en lo que costó el error.',
    many: 'Estas etiquetas se quitan de {count} operaciones, en todas las cuentas, y cada una recibe el error en su lugar. Informes cuenta luego esas operaciones en lo que costó el error.',
    other:
      'Estas etiquetas se quitan de {count} operaciones, en todas las cuentas, y cada una recibe el error en su lugar. Informes cuenta luego esas operaciones en lo que costó el error.',
  },
  'tags.move.body': {
    one: '«{tag}» se quita de {count} operación, en todas las cuentas, y en su lugar recibe el error. Informes cuenta luego esa operación en lo que costó el error.',
    many: '«{tag}» se quita de {count} operaciones, en todas las cuentas, y cada una recibe el error en su lugar. Informes cuenta luego esas operaciones en lo que costó el error.',
    other:
      '«{tag}» se quita de {count} operaciones, en todas las cuentas, y cada una recibe el error en su lugar. Informes cuenta luego esas operaciones en lo que costó el error.',
  },
  'tags.move.mistake': 'El error',
  'tags.move.newMistake': 'Un error nuevo…',
  'tags.move.name': 'Su nombre',
  'tags.move.nameHint': 'se añade a tu lista',

  'tags.group.nameIt': 'Ponle nombre al grupo',
  'tags.group.taken': 'Ya hay un grupo con ese nombre',
  'tags.group.made': 'Grupo creado',
  'tags.group.saved': 'Grupo guardado',
  'tags.group.edit': 'Editar «{name}»',
  'tags.group.hint': 'Una etiqueta está como mucho en un grupo. Informes muestra una tabla para cada grupo.',
  'tags.group.delete': 'Eliminar grupo',
  'tags.group.save': 'Guardar grupo',
  'tags.group.name': 'Nombre',
  'tags.group.namePlaceholder': 'p. ej., Emoción',
  'tags.group.tags': 'Sus etiquetas',
  'tags.group.inOther': 'en {name}',
  'tags.group.unused': 'sin operaciones',
  'tags.group.noTags': 'Aún no hay etiquetas. Etiqueta antes una operación y luego pon aquí sus etiquetas.',
  'tags.group.delete.title': '¿Eliminar el grupo «{name}»?',
  'tags.group.delete.message':
    'Sus etiquetas se quedan en tus operaciones; solo desaparece el grupo, y su tabla en Informes.',
  'tags.group.deleted': 'Grupo eliminado',
};
