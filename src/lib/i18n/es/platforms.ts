import type { platforms as en } from '../en/platforms';
import type { Translation } from '../types';

export const platforms: Translation<typeof en> = {
  'plat.group.Futures': 'Futuros',
  'plat.group.TradingView': 'TradingView',
  'plat.group.Forex and CFDs': 'Forex y CFD',
  'plat.group.Stocks and options': 'Acciones y opciones',
  'plat.group.Crypto': 'Cripto',
  'plat.group.Other journals': 'Otros diarios',

  'plat.file.executions': 'ejecuciones',
  'plat.file.trades': 'operaciones',
  'plat.file.performance report': 'informe de rendimiento',
  'plat.file.orders': 'órdenes',
  'plat.file.completed orders': 'órdenes completadas',
  'plat.file.trade performance': 'rendimiento de operaciones',
  'plat.file.trades history': 'historial de operaciones',
  'plat.file.journal': 'diario',
  'plat.file.trade activity log': 'registro de actividad de trading',
  'plat.file.trade list': 'lista de operaciones',
  'plat.file.order history': 'historial de órdenes',
  'plat.file.strategy tester list of trades': 'lista de operaciones del probador de estrategias',
  'plat.file.account history': 'historial de la cuenta',
  'plat.file.trading journal': 'diario de trading',
  'plat.file.positions': 'posiciones',
  'plat.file.deals': 'transacciones',
  'plat.file.history': 'historial',
  'plat.file.transaction history': 'historial de transacciones',
  'plat.file.activity statement': 'extracto de actividad',
  'plat.file.Flex Query': '{flex}',
  'plat.file.account statement': 'extracto de cuenta',
  'plat.file.transactions': 'transacciones',
  'plat.file.account activity': 'actividad de la cuenta',
  'plat.file.spot trade history': 'historial de operaciones spot',
  'plat.file.futures trade history': 'historial de operaciones de futuros',
  'plat.file.Advanced fills': 'ejecuciones de {advanced}',
  'plat.file.trade history': 'historial de operaciones',

  'plat.how.ninjaTrader':
    'En {performance}, muestra {executions} o {trades} y genera el informe; luego haz clic derecho en la lista y expórtala como CSV. En cualquier idioma.',
  'plat.how.tradovate': 'El informe {performance}, o la lista {orders}, descargado como CSV.',
  'plat.how.topstepX': 'La lista {trades} o la lista {orders} de tu cuenta, exportada como CSV.',
  'plat.how.rithmic':
    '{history}: elige la cuenta y el día, y exporta {completed} como CSV, un día cada vez. El informe de rendimiento de operaciones también sirve.',
  'plat.how.quantower': 'El panel {panel}, exportado como CSV.',
  'plat.how.atas': 'El diario de {statistics}, exportado a Excel: el archivo .xlsx se importa tal cual.',
  'plat.how.sierraChart': 'El {log} mostrando {fills}, guardado con {save}.',
  'plat.how.tradeStation': 'El informe {orders}, exportado como CSV.',
  'plat.how.deepcharts': 'La lista de operaciones, exportada como CSV.',
  'plat.how.tradingView':
    '{paper} o un bróker conectado: en {history}, marca todas las columnas en {setup} y luego {download}. O el {tester}: {list}, y luego escribe el símbolo en la vista previa.',
  'plat.how.ftmo': 'El diario de trading de tu cuenta en el {area}, exportado como CSV.',
  'plat.how.metaTrader':
    'Pestaña {history}: haz clic derecho y guarda un informe. El informe de Excel de {mt5} se importa tal cual; el informe en página web de {mt4} se abre en Excel para guardarlo como CSV. El panel de una empresa de fondeo suele exportar CSV directamente.',
  'plat.how.exported': '{menu}, exportado como CSV.',
  'plat.how.downloaded': '{menu}, descargado como CSV.',
  'plat.how.ibkr': 'Un {statement} descargado como CSV, o una {flex} de operaciones en CSV.',
  'plat.how.thinkorswim': '{menu} de las fechas que quieras, exportado a un archivo.',
  'plat.how.schwab': 'El historial de transacciones de la cuenta, exportado como CSV.',
  'plat.how.fidelity': 'El historial de {menu}, descargado como CSV.',
  'plat.how.webull': 'El historial de órdenes, exportado como CSV.',
  'plat.how.robinhood': '{menu}: genera un informe de actividad de la cuenta.',
  'plat.how.tradeZero': 'Las operaciones de un rango de fechas, exportadas como CSV.',
  'plat.how.binance': '{menu} (spot o futuros) > {export}.',
  'plat.how.coinbase':
    '{statements}: el historial de transacciones como CSV; en {advanced}, la exportación de ejecuciones.',
  'plat.how.kraken': '{menu}, eligiendo {trades}.',
  'plat.how.tradeZella': 'Tus operaciones, exportadas como CSV.',

  'plat.instead.tradingView':
    'Esto es el {account} de {platform}: muestra los cambios del saldo, sin las entradas de las operaciones. Exporta mejor el {history}: en {paper}, abre {tab}, marca todas las columnas en {setup} y luego {download}.',
};
