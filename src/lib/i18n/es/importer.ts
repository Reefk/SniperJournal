import type { importer as en } from '../en/importer';
import type { Translation } from '../types';

export const importer: Translation<typeof en> = {
  'imp.label.eachRowIs': 'Cada fila es',
  'imp.label.columns': 'Columnas',
  'imp.quoted': '«{text}»',

  'imp.row': 'Fila {row}',
  'imp.rows': { other: 'Fila {row} y {count} más' },
  'imp.rowsNote': '{rows}: {text}',

  'imp.noFees':
    'Este archivo no tiene comisiones, así que las operaciones entran sin ellas y su P&L es antes de comisiones. Para añadirlas, selecciona las operaciones en la página Operaciones y luego Añadir detalles > Comisiones, por operación o por contrato.',
  'imp.zeroFees':
    'Todas las comisiones de este archivo son 0, así que las operaciones entran sin ninguna. Si hubo comisiones, añádelas: selecciona las operaciones en la página Operaciones y luego Añadir detalles > Comisiones, por operación o por contrato.',

  'imp.guessed.one': 'La columna {header} se leyó como {role} por las palabras de su nombre.',
  'imp.guessed.many': 'Leídas por las palabras de sus nombres: {list}.',
  'imp.guessed.item': '{header} como {role}',
  'imp.guessed.fills.one':
    ' Por ella, cada fila se leyó como una ejecución; si cada fila es una operación completa, elígelo en «{eachRowIs}».',
  'imp.guessed.fills.many':
    ' Por ellas, cada fila se leyó como una ejecución; si cada fila es una operación completa, elígelo en «{eachRowIs}».',
  'imp.guessed.trades.one':
    ' Por ella, cada fila se leyó como una operación completa; si cada fila es una ejecución, elígelo en «{eachRowIs}».',
  'imp.guessed.trades.many':
    ' Por ellas, cada fila se leyó como una operación completa; si cada fila es una ejecución, elígelo en «{eachRowIs}».',
  'imp.guessed.check.one': ' Revísala en {columns} si no es correcto.',
  'imp.guessed.check.many': ' Revísalas en {columns} si no es correcto.',

  'imp.noSymbol.one': 'sin símbolo, así que la fila se omitió.',
  'imp.noSymbol.many': 'sin símbolo, así que se omitieron.',
  'imp.unknownSide.one': '{rows}: la dirección «{value}» no se reconoció, así que se importó como {side}. Compruébala.',
  'imp.unknownSide.many':
    '{rows}: la dirección «{value}» no se reconoció, así que se importaron como {side}. Compruébalas.',
  'imp.badMultiplier.one':
    '{rows}: el multiplicador «{value}» tiene que ser mayor que 0, así que se omitió. Compruébala.',
  'imp.badMultiplier.many':
    '{rows}: el multiplicador «{value}» tiene que ser mayor que 0, así que se omitió. Compruébalas.',
  'imp.foreignFees': 'Se omitieron las comisiones pagadas en {currencies}: no están en la moneda de los precios.',
  'imp.rateNoSize.one':
    'una comisión por contrato pero ningún tamaño por el que multiplicarla, así que no se añadió comisión. Añádela con el tamaño.',
  'imp.rateNoSize.many':
    'una comisión por contrato pero ningún tamaño por el que multiplicarla, así que no se añadieron comisiones. Añádelas con los tamaños.',
  'imp.netAboveGross.one':
    'el P&L después de comisiones es mayor que el de antes, así que no se calculó ninguna comisión a partir de los dos. Revisa sus comisiones.',
  'imp.netAboveGross.many':
    'el P&L después de comisiones es mayor que el de antes, así que no se calcularon comisiones a partir de los dos. Revisa sus comisiones.',
  'imp.inferred': '{symbol}: se tomó un punto como {how}. Compruébalo si no es correcto.',
  'imp.how.future': '{value} (futuros de {root})',
  'imp.how.option': '{value} (un contrato de opciones)',
  'imp.how.amount': '{value} (por el importe frente al precio)',
  'imp.andMore': { other: '{list} y {count} más' },
  'imp.pnlSetAside.one':
    '{symbols}: el P&L del archivo no se corresponde con los precios a su valor por punto, así que se calculó a partir de los precios (el P&L de un bróker puede medirse contra una entrada anterior a la del archivo). Compruébalo si no es correcto.',
  'imp.pnlSetAside.many':
    '{symbols}: el P&L del archivo no se corresponde con los precios a sus valores por punto, así que se calculó a partir de los precios (el P&L de un bróker puede medirse contra una entrada anterior a la del archivo). Compruébalo si no es correcto.',
  'imp.grouped': 'El símbolo de cada bloque se tomó de la línea que hay sobre los nombres de sus columnas.',
  'imp.cashFees': {
    one: 'Las comisiones de {count} ejecución se tomaron de la sección {section} del extracto, emparejadas por hora.',
    many: 'Las comisiones de {count} ejecuciones se tomaron de la sección {section} del extracto, emparejadas por hora.',
    other:
      'Las comisiones de {count} ejecuciones se tomaron de la sección {section} del extracto, emparejadas por hora.',
  },
  'imp.cashUnmatched': {
    one: '{count} línea de comisión del extracto no se pudo emparejar con una ejecución de su {section} (mismo símbolo, lado y tamaño, en 2 segundos), así que sus comisiones ({amount}) se omitieron.',
    many: '{count} líneas de comisión del extracto no se pudieron emparejar con una ejecución de su {section} (mismo símbolo, lado y tamaño, en 2 segundos), así que sus comisiones ({amount} en total) se omitieron.',
    other:
      '{count} líneas de comisión del extracto no se pudieron emparejar con una ejecución de su {section} (mismo símbolo, lado y tamaño, en 2 segundos), así que sus comisiones ({amount} en total) se omitieron.',
  },
  'imp.statement': 'Se leyó la sección {section} de este extracto de Interactive Brokers.',
  'imp.preamble': 'Los nombres de las columnas están en la línea {line}; se omitieron las líneas de arriba.',
  'imp.skipped': {
    one: 'Se omitió {count} línea de total, resumen o encabezado repetido.',
    many: 'Se omitieron {count} líneas de total, resumen o encabezado repetido.',
    other: 'Se omitieron {count} líneas de total, resumen o encabezado repetido.',
  },
  'imp.zoned.some':
    'Algunas horas de este archivo llevan zona horaria, así que se convirtieron a la hora local de este dispositivo; las demás no la llevan y se tomaron tal cual.',
  'imp.zoned.all':
    'Las horas de este archivo llevan zona horaria, así que se convirtieron a la hora local de este dispositivo.',
  'imp.zoned.none':
    'Las horas de este archivo no llevan zona horaria, así que se tomaron tal cual, en la hora local de este dispositivo.',

  'imp.unreadOpen.one':
    'la hora de entrada «{value}» no se pudo leer, así que se dejó en blanco y la operación quedó marcada con «faltan detalles».',
  'imp.unreadOpen.many':
    'la hora de entrada no se pudo leer (la primera es «{value}»), así que se dejó en blanco y las operaciones quedaron marcadas con «faltan detalles».',
  'imp.unreadClose.one':
    'la hora de salida «{value}» no se pudo leer, así que se dejó en blanco: hasta que se complete, la operación cuenta el día en que se abrió.',
  'imp.unreadClose.many':
    'la hora de salida no se pudo leer (la primera es «{value}»), así que se dejó en blanco: hasta que se complete, las operaciones cuentan el día en que se abrieron.',
  'imp.noSizeColumn':
    'No hay columna de tamaño, así que todas las operaciones quedaron marcadas con «faltan detalles». Completa los tamaños después de importar.',
  'imp.noSize.one': 'ningún tamaño mayor que 0, así que la operación quedó marcada con «faltan detalles».',
  'imp.noSize.many': 'ningún tamaño mayor que 0, así que las operaciones quedaron marcadas con «faltan detalles».',
  'imp.noSideColumn':
    'No hay columna de dirección, así que todas las filas se importaron como {side}. Revisa los cortos.',
  'imp.notTrades': {
    one: '{count} fila no tiene precio ni tamaño ({examples}), así que no es una operación y se omitió.',
    many: '{count} filas no tienen precio ni tamaño ({examples}), así que no son operaciones y se omitieron.',
    other: '{count} filas no tienen precio ni tamaño ({examples}), así que no son operaciones y se omitieron.',
  },

  'imp.fills.combined': 'Cada fila es una ejecución: {fills} en {trades}, siguiendo la posición de cada símbolo.',
  'imp.fills.count': {
    one: '{count} ejecución se reunió',
    many: '{count} ejecuciones se reunieron',
    other: '{count} ejecuciones se reunieron',
  },
  'imp.fills.into': { one: '{count} operación', many: '{count} operaciones', other: '{count} operaciones' },
  'imp.unfilled': {
    one: 'Se omitió {count} orden cancelada o nunca ejecutada.',
    many: 'Se omitieron {count} órdenes canceladas o nunca ejecutadas.',
    other: 'Se omitieron {count} órdenes canceladas o nunca ejecutadas.',
  },
  'imp.notBuySell': {
    one: '{count} fila no es una compra ni una venta ({examples}), así que se omitió.',
    many: '{count} filas no son compras ni ventas ({examples}), así que se omitieron.',
    other: '{count} filas no son compras ni ventas ({examples}), así que se omitieron.',
  },
  'imp.noQuantity.one': 'sin cantidad, así que la ejecución se omitió.',
  'imp.noQuantity.many': 'sin cantidad, así que se omitieron.',
  'imp.noPrice.one': 'sin precio, así que la ejecución se omitió.',
  'imp.noPrice.many': 'sin precio, así que se omitieron.',
  'imp.noSideFills':
    'No hay columna de dirección y ninguna ejecución tiene un tamaño menor que cero, así que todas se leyeron como compras. Revisa las ventas.',
  'imp.stillOpen': {
    one: '{count} posición seguía abierta al final del archivo, así que se importó como operación abierta.',
    many: '{count} posiciones seguían abiertas al final del archivo, así que se importaron como operaciones abiertas.',
    other: '{count} posiciones seguían abiertas al final del archivo, así que se importaron como operaciones abiertas.',
  },
  'imp.orphans': {
    one: '{count} operación cierra una posición abierta antes del comienzo del archivo, así que la entrada es desconocida y está marcada con «faltan detalles».',
    many: '{count} operaciones cierran posiciones abiertas antes del comienzo del archivo, así que la entrada es desconocida y están marcadas con «faltan detalles».',
    other:
      '{count} operaciones cierran posiciones abiertas antes del comienzo del archivo, así que la entrada es desconocida y están marcadas con «faltan detalles».',
  },
  'imp.overlapping': {
    one: '{count} operación comparte ejecuciones con operaciones que ya están en tu diario (una posición que abarca dos exportaciones). Revisa si hay duplicados.',
    many: '{count} operaciones comparten ejecuciones con operaciones que ya están en tu diario (una posición que abarca dos exportaciones). Revisa si hay duplicados.',
    other:
      '{count} operaciones comparten ejecuciones con operaciones que ya están en tu diario (una posición que abarca dos exportaciones). Revisa si hay duplicados.',
  },
  'imp.alike': {
    one: '{count} ejecución es igual a otra de la misma orden (hora, tamaño y precio), así que se mantuvo como parte de esa orden. Si el archivo lista las ejecuciones dos veces, revisa los tamaños de esas operaciones.',
    many: '{count} ejecuciones son iguales a otras de la misma orden (hora, tamaño y precio), así que se mantuvieron como parte de esa orden. Si el archivo lista las ejecuciones dos veces, revisa los tamaños de esas operaciones.',
    other:
      '{count} ejecuciones son iguales a otras de la misma orden (hora, tamaño y precio), así que se mantuvieron como parte de esa orden. Si el archivo lista las ejecuciones dos veces, revisa los tamaños de esas operaciones.',
  },

  'imp.noRows': 'El archivo no tiene filas de datos.',
  'imp.closesOpen': {
    one: '{count} operación cierra una posición que tu diario todavía tiene abierta. Se conservan las dos: elimina la copia abierta cuando lo hayas comprobado.',
    many: '{count} operaciones cierran posiciones que tu diario todavía tiene abiertas. Se conservan todas: elimina las copias abiertas cuando lo hayas comprobado.',
    other:
      '{count} operaciones cierran posiciones que tu diario todavía tiene abiertas. Se conservan todas: elimina las copias abiertas cuando lo hayas comprobado.',
  },
  'imp.closesPart.finished': {
    one: '{count} operación cierra parte de una posición que tu diario tenía abierta: esa parte se completó, y el resto sigue abierto como una operación propia.',
    many: '{count} operaciones cierran parte de posiciones que tu diario tenía abiertas: esas partes se completaron, y el resto de cada una sigue abierto como una operación propia.',
    other:
      '{count} operaciones cierran parte de posiciones que tu diario tenía abiertas: esas partes se completaron, y el resto de cada una sigue abierto como una operación propia.',
  },
  'imp.closesPart.kept': {
    one: '{count} operación cierra parte de una posición que tu diario todavía tiene abierta. Se conservan las dos: reduce la operación abierta cuando lo hayas comprobado.',
    many: '{count} operaciones cierran parte de posiciones que tu diario todavía tiene abiertas. Se conservan todas: reduce las operaciones abiertas cuando lo hayas comprobado.',
    other:
      '{count} operaciones cierran parte de posiciones que tu diario todavía tiene abiertas. Se conservan todas: reduce las operaciones abiertas cuando lo hayas comprobado.',
  },
  'imp.noSymbolColumn':
    'No se encontró una columna de símbolo. Las columnas de este archivo son: {columns}. Elige qué columna tiene el símbolo en «{columnsLabel}», más abajo, o escribe el símbolo para todas las filas.',
  'imp.newSetup': 'Creado durante una importación de CSV.',

  'imp.tooLarge.file': 'Este archivo ocupa {size}, más de lo que admite una importación ({limit}).',
  'imp.tooLarge.sheet': 'Esta hoja contiene {size} de datos, más de lo que admite una importación ({limit}).',
  'imp.tooLarge.workbook': 'Este libro contiene más de lo que admite una importación ({limit}).',
  'imp.tooLarge.split': 'Exporta un periodo más corto desde tu plataforma, o divide el archivo, e importa cada parte.',

  'imp.xlsx.noReader': 'Este dispositivo no puede abrir archivos de Excel. Guarda la hoja como CSV e impórtala.',
  'imp.xlsx.damaged': 'Este archivo está dañado o no es un libro de Excel.',
  'imp.xlsx.packed': 'Este libro está comprimido de una forma que no se puede leer. Guárdalo como CSV e impórtalo.',
  'imp.xlsx.old': 'Es un archivo antiguo de Excel (.xls). Ábrelo en Excel y guárdalo como .xlsx o CSV.',
  'imp.xlsx.notWorkbook': 'Este archivo no es un libro de Excel.',
  'imp.xlsx.zipNotWorkbook': 'Este archivo zip no es un libro de Excel.',
  'imp.xlsx.noSheets': 'Este libro no tiene hojas.',
  'imp.xlsx.sheet': 'Hoja {n}',

  'role.symbol': 'Símbolo',
  'role.side': 'Dirección (compra / venta, largo / corto)',
  'role.quantity': 'Cantidad',
  'role.price': 'Precio de ejecución',
  'role.entry_price': 'Precio de entrada',
  'role.exit_price': 'Precio de salida',
  'role.time': 'Fecha y hora',
  'role.date': 'Fecha',
  'role.opened_at': 'Apertura: fecha y hora',
  'role.opened_date': 'Apertura: fecha',
  'role.closed_at': 'Cierre: fecha y hora',
  'role.closed_date': 'Cierre: fecha',
  'role.fees': 'Comisiones (varias se suman)',
  'role.fee_rate': 'Comisión por contrato, por lado',
  'role.pnl': 'P&L antes de comisiones',
  'role.net_pnl': 'P&L después de comisiones',
  'role.gross_pnl': 'P&L bruto',
  'role.multiplier': 'Multiplicador / valor por punto',
  'role.notional': 'Importe (precio × tamaño)',
  'role.effect': 'Abre o cierra una posición',
  'role.status': 'Estado de la orden',
  'role.trade_no': 'Número de operación (agrupa las filas de entrada y salida)',
  'role.external_id': 'ID (para omitir lo ya importado)',
  'role.stop_loss': 'Stop loss',
  'role.take_profit': 'Take profit',
  'role.account': 'Cuenta',
  'role.setup': 'Setup del playbook / estrategia',
  'role.tags': 'Etiquetas',
  'role.notes': 'Notas',
  'role.session': 'Sesión',
  'role.leverage': 'Apalancamiento',
  'role.asset_class': 'Clase de activo',
  'role.put_call': 'Call o put',
  'role.strike': 'Strike',
  'role.expiry': 'Vencimiento',
  'role.underlying': 'Subyacente',
  'role.buy_price': 'Precio de compra (ejecuciones emparejadas)',
  'role.sell_price': 'Precio de venta (ejecuciones emparejadas)',
  'role.bought_at': 'Hora de compra (ejecuciones emparejadas)',
  'role.sold_at': 'Hora de venta (ejecuciones emparejadas)',
  'role.buy_fill_id': 'ID de la ejecución de compra (ejecuciones emparejadas)',
  'role.sell_fill_id': 'ID de la ejecución de venta (ejecuciones emparejadas)',
};
