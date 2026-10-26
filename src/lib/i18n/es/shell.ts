import type { shell as en } from '../en/shell';
import type { Translation } from '../types';

export const shell: Translation<typeof en> = {
  'nav.main': 'Principal',
  'nav.dashboard': 'Panel',
  'nav.calendar': 'Calendario',
  'nav.playbook': 'El Playbook',
  'nav.trades': 'Operaciones',
  'nav.insights': 'Análisis y señales',
  'nav.insightsTab': 'Análisis',
  'nav.resources': 'Recursos',
  'nav.support': 'Ayuda',
  'nav.reports': 'Informes',
  'nav.settings': 'Ajustes',
  'nav.more': 'Más',

  'save.saving': 'Guardando…',
  'save.unsaved': 'Sin guardar',
  'save.error': 'Archivo del diario ilegible',
  'save.conflict': 'Cambiado en otro lugar',
  'save.savedDevice': 'Guardado en este dispositivo',
  'save.savedTemporarily': 'Guardado temporalmente',
  'save.savedDisk': 'Guardado en el disco',
  'save.savedBrowser': 'Guardado en el navegador',

  'shell.opening': 'Abriendo tu diario',
  'shell.allAccounts': 'Todas las cuentas',
  'shell.portfolio': 'Cartera',
  'shell.theme': 'Tema de color',
  'shell.theme.dark': 'oscuro',
  'shell.theme.light': 'claro',
  'shell.online': 'En línea',
  'shell.offline': 'Sin conexión',
  'shell.storedWhere': 'Dónde se guarda tu diario',
  'shell.testBanner': {
    one: 'Hay datos de prueba cargados ({count} operación generada).',
    many: 'Hay datos de prueba cargados ({count} operaciones generadas).',
    other: 'Hay datos de prueba cargados ({count} operaciones generadas).',
  },
  'shell.testBannerHint': ' Quítalos antes de empezar a registrar operaciones reales.',
  'shell.remove': 'Quitar',
  'shell.removeTail': ' datos de prueba',
  'shell.newer.title': 'Este diario necesita una versión más reciente de Sniper Journal',
  'shell.newer.body':
    'Lo guardó por última vez una versión más reciente de la app, que guarda cosas que esta no conoce. Abrirlo aquí podría hacer que se perdieran, así que se ha dejado tal cual: no se ha cambiado nada.',
  'shell.newer.update': 'Actualiza Sniper Journal y vuelve a abrirlo.',

  'header.logTradeTitle': 'Registrar una operación (N)',
  'header.logTradeLabel': 'Registrar una operación',
  'header.logTrade': 'Registrar',

  'search.open': 'Abrir búsqueda',
  'search.placeholder': 'Busca símbolos, etiquetas, notas, setups',
  'search.label': 'Buscar en todas las operaciones',
  'search.none': 'Ninguna operación coincide con esa búsqueda.',
  'search.showAll': 'Ver todos los resultados en Operaciones',

  'accounts.heading': 'Cuentas',
  'accounts.new': 'Nueva cuenta',
  'accounts.manage': 'Gestionar cuentas',
  'accounts.nameRequired': 'Ponle un nombre a la cuenta',
  'accounts.create': 'Crear cuenta',

  'profile.menu': 'Menú del perfil',
  'profile.trader': 'Trader',
  'profile.storedPhone': 'Diario guardado en este dispositivo',
  'profile.storedPc': 'Diario guardado en este PC',
  'profile.downloadBackup': 'Descargar copia de seguridad',
  'profile.help': 'Ayuda y atajos',

  'clock.heading': 'Zona horaria del reloj',
  'clock.local': 'Hora local',
  'clock.localShort': 'Local',
  'clock.newYork': 'Nueva York',
  'clock.london': 'Londres',
  'clock.tokyo': 'Tokio',

  'welcome.title': 'Configura tu diario',
  'welcome.savedPhone': 'Todo lo que introduzcas se guarda en este teléfono.',
  'welcome.savedPc': 'Todo lo que introduzcas se guarda en este equipo.',
  'welcome.phoneWarning':
    'Tu diario solo existe dentro de esta app. Desinstalarla borra tus operaciones, así que haz una copia de vez en cuando desde <b>Más → Hacer copia de seguridad</b>.',
  'welcome.bringOver':
    '¿Usaste Sniper Journal antes, desde su propia carpeta con INSTALLER.bat? <link>Trae tu diario</link> y sigue donde lo dejaste.',
  'welcome.defaultAccount': 'Cartera principal',
  'welcome.balanceHint': 'para la curva de capital y el drawdown',
  'welcome.explore': 'Explorar primero con datos de prueba',
  'welcome.start': 'Empezar el diario',
  'welcome.sampleLoaded': 'Datos de prueba cargados. Quítalos cuando quieras desde el aviso de arriba.',

  'conflict.title': 'Este diario se cambió en otra ventana',
  'conflict.download': 'Descargar la versión de esta ventana',
  'conflict.reload': 'Recargar',
  'conflict.body':
    'Otra pestaña, ventana o copia de Sniper Journal guardó el diario después de que esta ventana lo abriera. Para no sobrescribir su trabajo, esta ventana ha dejado de guardar.',
  'conflict.keeping': 'Guardando una copia de la versión de esta ventana…',
  'conflict.kept': 'La versión de esta ventana, con los cambios hechos aquí, se guardó como copia:',
  'conflict.keptOpen': 'Si es la que quieres, ábrela con <b>Ajustes → Restaurar desde una copia de seguridad</b>.',
  'conflict.notKept':
    'No se pudo guardar una copia de la versión de esta ventana. Descárgala antes de recargar o se perderán los cambios hechos en esta ventana.',
  'conflict.reloadHint': 'Recarga para seguir con el diario tal como está guardado ahora.',

  'copy.why.tooBig': 'el diario es demasiado grande para él',
  'copy.why.refused': 'su almacenamiento está lleno o desactivado',
  'copy.offTooBig':
    'Tu diario ya es demasiado grande para que este navegador guarde su copia de repuesto. Nada más cambia: se sigue guardando en el archivo del diario un momento después de cada cambio.',
  'copy.off':
    'Este navegador no guardará una copia de repuesto de tu diario ({why}). Nada más cambia: se sigue guardando en el archivo del diario un momento después de cada cambio.',
  'copy.lostErrorNative':
    'No se pudo leer el archivo del diario al iniciar la app, y la app tampoco puede guardar tus cambios ({why}), así que los cambios que hagas ahora no se guardan en ningún sitio. Descarga una copia de seguridad antes de cerrar la app.',
  'copy.lostErrorWeb':
    'No se pudo leer el archivo del diario al iniciar la app, y este navegador tampoco puede guardar tus cambios ({why}), así que los cambios que hagas ahora no se guardan en ningún sitio. Descarga una copia de seguridad antes de cerrar la app.',
  'copy.lostNative':
    'Tus últimos cambios aún no están guardados en ningún sitio: la app no puede escribir su archivo ahora mismo ni guardar una copia temporal ({why}). Se escribirán en cuanto se pueda. Por seguridad, descarga una copia de seguridad antes de cerrar la app.',
  'copy.lostWeb':
    'Tus últimos cambios aún no están guardados en ningún sitio: no se puede acceder al archivo del diario y este navegador no puede guardar una copia ({why}). Se escribirán en cuanto se pueda. Por seguridad, descarga una copia de seguridad antes de cerrar la app.',
  'recovered.body':
    'Unos cambios de otra ventana que nunca llegaron al archivo del diario se hicieron sobre una versión anterior, así que se guardaron como copia en lugar de abrirse: <path>{path}</path>',

  'error.title': 'No se pudo mostrar esta página',
  'error.body':
    'Algo falló al dibujarla. No se ha perdido nada: tu diario se guarda por su cuenta y solo ha fallado esta página. Vuelve a intentarlo o sigue en otra parte de la app.',
  'error.retry': 'Reintentar',
  'error.dashboard': 'Ir al panel',
  'error.details': 'Detalles para un informe de error',
  'error.noMessage': 'Sin mensaje',
  'error.app.title': 'Sniper Journal tuvo un problema',
  'error.app.body':
    'Algo falló y la app no pudo continuar. Tu diario sigue guardado donde estaba: nada en esta pantalla lo cambia. Vuelve a intentarlo o, por si acaso, descarga antes una copia de seguridad.',
  'error.app.reload': 'Recargar la app',
  'error.app.reading': 'Leyendo tu diario…',
  'error.app.holds': {
    one: 'La copia contiene {count} operación.',
    many: 'La copia contiene {count} operaciones.',
    other: 'La copia contiene {count} operaciones.',
  },
  'error.app.nothing': 'No se pudo leer ningún diario, así que no hay nada que descargar desde aquí.',
};
