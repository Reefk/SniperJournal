import type { importDialog as en } from '../en/importDialog';
import type { Translation } from '../types';

export const importDialog: Translation<typeof en> = {
  'impw.title': 'Importar operaciones desde un archivo',
  'impw.description':
    'Suelta una exportación de tu bróker o plataforma de trading: operaciones completas o ejecuciones individuales. Lo que falte se puede completar después.',
  'impw.account': 'Importar a la cuenta',
  'impw.account.hint': 'si el archivo tiene una columna de cuenta que coincide, manda esa',
  'impw.template': 'Descargar plantilla',
  'impw.drop.tap': 'Toca para elegir un archivo CSV o de Excel',
  'impw.drop.click': 'Suelta aquí un archivo CSV o de Excel, o haz clic para elegir uno',
  'impw.drop.works': {
    other:
      'Funciona con las exportaciones de las {count} plataformas de la lista de abajo, con los archivos de casi cualquier otro bróker, con operaciones completas o ejecuciones individuales y con la plantilla de arriba.',
  },
  'impw.sheet': 'Hoja',
  'impw.sheet.hint': { other: '{count} en este libro' },
  'impw.sheet.empty': 'Esta hoja está vacía.',
  'impw.unreadable': 'No se pudo leer este libro. Ábrelo en Excel, guarda la hoja como CSV e importa ese archivo.',

  'impw.recognised': 'Reconocido: {name}, {file}',
  'impw.ready': {
    one: '<num>{count}</num> lista para importar',
    many: '<num>{count}</num> listas para importar',
    other: '<num>{count}</num> listas para importar',
  },
  'impw.finished': {
    one: '<num>{count}</num> operación abierta completada',
    many: '<num>{count}</num> operaciones abiertas completadas',
    other: '<num>{count}</num> operaciones abiertas completadas',
  },
  'impw.duplicates': {
    one: '<num>{count}</num> ya en tu diario, omitida',
    many: '<num>{count}</num> ya en tu diario, omitidas',
    other: '<num>{count}</num> ya en tu diario, omitidas',
  },
  'impw.incomplete': {
    one: '<num>{count}</num> necesita detalles antes de contar',
    many: '<num>{count}</num> necesitan detalles antes de contar',
    other: '<num>{count}</num> necesitan detalles antes de contar',
  },
  'impw.combined': {
    one: '<num>{count}</num> ejecución parcial integrada en posiciones completas',
    many: '<num>{count}</num> ejecuciones parciales integradas en posiciones completas',
    other: '<num>{count}</num> ejecuciones parciales integradas en posiciones completas',
  },
  'impw.newSetups': {
    one: 'Se creará {count} setup nuevo en el Playbook',
    many: 'Se crearán {count} setups nuevos en el Playbook',
    other: 'Se crearán {count} setups nuevos en el Playbook',
  },
  'impw.more': { other: '…y {count} más' },

  'impw.likely': {
    one: '<num>{count}</num> parece una operación que ya está en tu diario: misma cuenta, símbolo, dirección, hora de entrada y tamaño.',
    many: '<num>{count}</num> parecen operaciones que ya están en tu diario: misma cuenta, símbolo, dirección, hora de entrada y tamaño.',
    other:
      '<num>{count}</num> parecen operaciones que ya están en tu diario: misma cuenta, símbolo, dirección, hora de entrada y tamaño.',
  },
  'impw.likely.imported.one': 'También se importará.',
  'impw.likely.imported.many': 'También se importarán.',
  'impw.likely.leftOut.one': 'Se deja fuera, para que nada se añada dos veces.',
  'impw.likely.leftOut.many': 'Se dejan fuera, para que nada se añada dos veces.',
  'impw.likely.anyway.one': 'Importarla de todos modos: es otra operación',
  'impw.likely.anyway.many': 'Importarlas de todos modos: son otras operaciones',

  'impw.closes.one': 'Este archivo cierra una operación que tu diario tiene abierta.',
  'impw.closes': { other: 'Este archivo cierra <num>{count}</num> operaciones que tu diario tiene abiertas.' },
  'impw.closes.finish.one': 'Se completa con la salida del archivo: tus notas, setup y etiquetas se mantienen.',
  'impw.closes.finish.many': 'Se completan con la salida del archivo: tus notas, setups y etiquetas se mantienen.',
  'impw.closes.stay.one': 'Sigue abierta, y las ejecuciones de cierre del archivo entran como operaciones propias.',
  'impw.closes.stay.many': 'Siguen abiertas, y las ejecuciones de cierre del archivo entran como operaciones propias.',
  'impw.closes.opened': 'abierta el {when}',
  'impw.closes.part': '{part} de {whole}',
  'impw.closes.closed': 'cerrada el {when}',
  'impw.closes.at': 'a {price}',
  'impw.closes.rest': ', el resto sigue abierto',
  'impw.closes.leave.one': 'Dejarla abierta e importar las ejecuciones de cierre como operaciones propias',
  'impw.closes.leave.many': 'Dejarlas abiertas e importar las ejecuciones de cierre como operaciones propias',

  'impw.fee.none':
    'Este archivo no tiene comisiones, así que las operaciones entran sin ellas y su P&L es antes de comisiones. Si tu bróker cobra una comisión, añádela aquí.',
  'impw.fee.zero':
    'Todas las comisiones de este archivo son 0, así que las operaciones entran sin ellas y su P&L es antes de comisiones. Si tu bróker cobra una comisión, añádela aquí.',
  'impw.fee.fromFile':
    'Las comisiones vienen de este archivo. Si no son correctas, o pagas otra cosa, aplica las tuyas en su lugar en esta importación.',
  'impw.fee.toAdd': 'Comisión que añadir',
  'impw.fee.fees': 'Comisiones',
  'impw.fee.opt.none': 'Ninguna',
  'impw.fee.opt.fromFile': 'Las del archivo',
  'impw.fee.opt.trade': 'Por operación',
  'impw.fee.opt.ownTrade': 'Las tuyas, por operación',
  'impw.fee.opt.contract': 'Por contrato, en cada lado',
  'impw.fee.opt.ownContract': 'Las tuyas, por contrato, en cada lado',
  'impw.fee.amount': 'Importe',
  'impw.fee.hint.contract': 'se cobra al entrar y otra vez al salir',
  'impw.fee.hint.trade': 'una vez por operación',
  'impw.fee.aboveZero': 'Escribe un importe mayor que 0',
  'impw.fee.totals': 'Comisiones de estas operaciones <money></money> · P&L neto después de ellas <pnl></pnl>',
  'impw.fee.whole': '. A las operaciones abiertas que este archivo completa se les cobra la operación entera.',

  'impw.rowKind.trades': 'Una operación completa',
  'impw.rowKind.fills': 'Una ejecución (se juntan en operaciones)',
  'impw.dates': 'Las fechas como 03/04/2026 son',
  'impw.dates.mdy': 'Primero el mes: 4 de marzo',
  'impw.dates.dmy': 'Primero el día: 3 de abril',
  'impw.symbolForAll': 'Símbolo para todas las filas',
  'impw.symbolForAll.hint': 'este archivo no tiene',
  'impw.columns.used': '{columns}: {used} de {total} en uso',
  'impw.columns.guessed': {
    one: ', {count} deducida de su nombre',
    many: ', {count} deducidas de sus nombres',
    other: ', {count} deducidas de sus nombres',
  },
  'impw.columns.restored': ', como las configuraste para este formato la última vez',
  'impw.columns.explain':
    'Cambia cómo se lee una columna si el importador se equivocó. Lo que elijas se recuerda en este dispositivo para los archivos con las mismas columnas.',
  'impw.columns.unnamed': 'Columna {n}',
  'impw.columns.unnamedLower': 'columna {n}',
  'impw.columns.what': 'Qué es {name}',
  'impw.columns.guessedOne': 'deducida de su nombre',
  'impw.columns.notUsed': 'Sin usar',
  'impw.columns.automatic': 'Volver a automático',
  'impw.combine': 'Unir las salidas parciales en una operación',
  'impw.combine.explain':
    'Cuando sales por partes, el bróker escribe una fila por cada salida. Con esto activado, las filas que comparten una ejecución de entrada pasan a ser una sola posición: los tamaños se suman, los precios pasan a ser medias ponderadas por tamaño y el P&L sigue siendo exactamente la suma de las partes.',
  'impw.paired':
    'Esta exportación empareja una ejecución de compra con una de venta en lugar de indicar una dirección, así que la ejecución que ocurrió primero se toma como la entrada. Cuando el archivo indica un P&L, el multiplicador del contrato se calcula a partir de él; así es como una operación de 2 lotes de MNQ sale a $2 por punto. Revisa una o dos filas de abajo antes de importar.',

  'impw.col.date': 'Fecha',
  'impw.noDate': 'sin fecha',
  'impw.moreRows': { one: '…y {count} fila más.', many: '…y {count} filas más.', other: '…y {count} filas más.' },
  'impw.ignored': 'Columnas sin usar: <num></num>. No se perdió nada: simplemente no tienen lugar en el diario.',
  'impw.moreErrors': { other: '…y {count} más.' },

  'impw.help.platforms': 'Qué archivo exportar desde tu plataforma',
  'impw.help.platformsIntro':
    'Las exportaciones de estas plataformas se importan tal cual, y la vista previa nombra la plataforma cuando reconoce el archivo. Cualquier otro CSV con una columna de símbolo también funciona: revisa las columnas en la vista previa.',
  'impw.help.columns': 'Qué columnas se entienden',
  'impw.help.files':
    'Se leen tanto archivos CSV como libros de Excel (.xlsx). En un libro se usa la hoja que más se parece a una lista de operaciones, y puedes elegir otra. Un archivo .xls antiguo hay que guardarlo antes como .xlsx o CSV.',
  'impw.help.symbol':
    'Solo hace falta un <fg>símbolo</fg>, y para un archivo que no lo tiene (la lista de operaciones de TradingView) puedes escribirlo tú. Todo lo demás es opcional.',
  'impw.help.rows':
    'Un archivo puede listar <fg>operaciones completas</fg>, con la entrada y la salida en una fila, o <fg>ejecuciones individuales</fg>, una compra o una venta por fila. Las ejecuciones se vuelven a juntar siguiendo la posición de cada símbolo: entrar y salir por partes sigue siendo una operación, y una posición todavía abierta al final del archivo se importa como abierta.',
  'impw.help.names':
    'Los nombres de columna se reconocen en las muchas formas que usan los brókers (<names></names>, columnas separadas de fecha y hora), y varias columnas de comisiones se suman; una comisión por contrato se multiplica por el tamaño. Un archivo sin ninguna comisión entra sin ellas, salvo que añadas una comisión por operación o por contrato en la vista previa; se recuerda para la cuenta en este dispositivo. Un archivo con comisiones mantiene las suyas, salvo que apliques las tuyas en su lugar, solo para ese archivo. Un nombre que no conoce entero se lee por sus palabras cuando las conoce todas, así que <start></start> es el precio de entrada y <lots></lots> la cantidad; la vista previa dice qué columnas leyó así. Se omiten las líneas de título encima de la tabla y las de totales debajo. Lo que se lea mal se puede cambiar en «{columns}». Separa varias etiquetas con el carácter |.',
  'impw.help.points':
    'Lo que vale un punto sale de una columna de multiplicador, del importe frente al precio o del P&L del archivo. Si no hay nada de eso, los futuros se reconocen por un código de contrato completo como {first} o {second}, y las opciones cuentan 100 acciones. La vista previa avisa siempre que lo calculó así.',
  'impw.help.needs':
    'Las filas a las que les falta la fecha, la cantidad o el precio de entrada se importan igualmente. Se marcan con <warn>faltan detalles</warn>, quedan fuera de todas las estadísticas y aparecen arriba en la página Operaciones para que las completes a mano.',
  'impw.help.again':
    'Importar otra vez las mismas operaciones no añade nada, así que una exportación diaria que se solapa con la anterior es segura. Cuando el bróker numera sus operaciones o ejecuciones, deciden esos números. Si no, una operación con la misma cuenta, símbolo, dirección, hora de entrada y tamaño que otra que ya está en tu diario se deja fuera, y la vista previa la muestra por si de verdad es una segunda operación.',
  'impw.help.finish':
    'Una posición que una exportación anterior dejó abierta se completa con la exportación que la cierra: la operación de tu diario recibe la salida, y tus notas, setup y etiquetas se mantienen. La vista previa muestra esas operaciones, con la opción de dejarlas abiertas.',

  'impw.button.import': 'Importar operaciones',
  'impw.button.importN': {
    one: 'Importar {count} operación',
    many: 'Importar {count} operaciones',
    other: 'Importar {count} operaciones',
  },
  'impw.button.importAndFinish': {
    one: 'Importar {count} operación y completar {open}',
    many: 'Importar {count} operaciones y completar {open}',
    other: 'Importar {count} operaciones y completar {open}',
  },
  'impw.button.open': {
    one: '{count} operación abierta',
    many: '{count} operaciones abiertas',
    other: '{count} operaciones abiertas',
  },
  'impw.button.finish': {
    one: 'Completar {count} operación abierta',
    many: 'Completar {count} operaciones abiertas',
    other: 'Completar {count} operaciones abiertas',
  },
  'impw.done.imported': {
    one: '{count} operación importada',
    many: '{count} operaciones importadas',
    other: '{count} operaciones importadas',
  },
  'impw.done.importedAndFinished': {
    one: '{count} operación importada, {open}',
    many: '{count} operaciones importadas, {open}',
    other: '{count} operaciones importadas, {open}',
  },
  'impw.done.open': {
    one: '{count} operación abierta completada',
    many: '{count} operaciones abiertas completadas',
    other: '{count} operaciones abiertas completadas',
  },
  'impw.done.finished': {
    one: '{count} operación abierta completada',
    many: '{count} operaciones abiertas completadas',
    other: '{count} operaciones abiertas completadas',
  },
  'impw.done.needDetails': {
    one: '{done} — {count} necesita detalles',
    many: '{done} — {count} necesitan detalles',
    other: '{done} — {count} necesitan detalles',
  },
};
