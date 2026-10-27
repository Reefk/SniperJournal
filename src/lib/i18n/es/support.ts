import type { support as en } from '../en/support';
import type { Translation } from '../types';

export const support: Translation<typeof en> = {
  'sup.description': 'Cómo funciona Sniper Journal y dónde se guardan tus datos.',

  'sup.file.title': 'El archivo de tu diario',
  'sup.file.errorLost.app':
    'El archivo del diario no se pudo leer al abrir la app, así que se deja exactamente como está en lugar de guardar encima. La app tampoco puede guardar tus cambios ({why}), así que lo que cambies ahora no se guarda en ningún sitio. Descarga una copia de seguridad antes de cerrar la app; luego ciérrala y vuelve a abrirla para intentarlo de nuevo.',
  'sup.file.errorLost.web':
    'El archivo del diario no se pudo leer al abrir la app, así que se deja exactamente como está en lugar de guardar encima. Este navegador tampoco puede guardar tus cambios ({why}), así que lo que cambies ahora no se guarda en ningún sitio. Descarga una copia de seguridad antes de cerrar la app; luego ciérrala y vuelve a abrirla para intentarlo de nuevo.',
  'sup.file.error.app':
    'El archivo del diario no se pudo leer al abrir la app, así que se deja exactamente como está en lugar de guardar encima. Por ahora tus cambios se guardan de forma temporal. Cierra la app y vuelve a abrirla para intentarlo de nuevo. Si sigue pasando, restaura tu última copia de seguridad en Ajustes.',
  'sup.file.error.web':
    'El archivo del diario no se pudo leer al abrir la app, así que se deja exactamente como está en lugar de guardar encima. Por ahora tus cambios se guardan en este navegador. Cierra la app y vuelve a abrirla para intentarlo de nuevo. Si sigue pasando, restaura tu última copia de seguridad en Ajustes.',
  'sup.file.conflict':
    'Otra pestaña, ventana o copia de la app guardó el diario después de que esta ventana lo abriera, así que esta ventana dejó de guardar para no escribir encima de ese trabajo. Su propia versión se guardó como copia en tus copias de seguridad. Recarga para continuar.',
  'sup.file.browser.app':
    'La app no puede escribir su archivo ahora mismo, así que los cambios se guardan de forma temporal. Se escribirán en cuanto pueda.',
  'sup.file.browser.web':
    'La app no puede llegar a su archivo ahora mismo, así que los cambios se guardan solo en este navegador. Se escribirán en el disco en cuanto vuelva a estar disponible.',
  'sup.file.unsaved.app':
    'La app no puede escribir su archivo ahora mismo ni guardar una copia temporal ({why}), así que tus últimos cambios todavía no están guardados en ningún sitio. Mantén la app abierta: se escribirán en cuanto pueda. Por si acaso, guarda una copia de seguridad.',
  'sup.file.unsaved.web':
    'La app no puede llegar a su archivo ahora mismo y este navegador tampoco puede guardar una copia ({why}), así que tus últimos cambios todavía no están guardados en ningún sitio. Mantén la app abierta: se escribirán en el disco en cuanto el archivo vuelva a estar disponible. Por si acaso, descarga una copia de seguridad.',
  'sup.file.saved': 'Se guarda automáticamente un momento después de cada cambio.',
  'sup.file.savedNoCopy':
    'Se guarda automáticamente un momento después de cada cambio. La copia de repuesto en este navegador está desactivada: {why}.',

  'sup.private.pc': 'Nada sale de este PC',
  'sup.private.phone': 'Nada sale de este teléfono',
  'sup.privateText.pc':
    'No hay cuenta, ni servidor, ni telemetría. La app solo se comunica con su propia carpeta en este equipo, y por eso sigue funcionando sin conexión.',
  'sup.privateText.phone':
    'No hay cuenta, ni servidor, ni telemetría. La app solo se comunica con su propia carpeta en este teléfono, y por eso sigue funcionando sin conexión.',

  'sup.shortcuts': 'Atajos',
  'sup.key.newTrade': 'Registrar una operación nueva',
  'sup.key.search': 'Ir a la búsqueda',
  'sup.key.saveForm': 'Guardar el formulario de la operación',
  'sup.key.closeDialog': 'Cerrar una ventana',
  'sup.key.either': '{first}  o  {second}',

  'sup.faq': 'Preguntas frecuentes',
  'sup.q.where': '¿Dónde se guardan exactamente mis datos?',
  'sup.a.where':
    'En un archivo JSON sencillo, data/journal.json, dentro de la carpeta de Sniper Journal en este PC. No se sube nada a ningún sitio y la app funciona sin conexión a internet. También se guarda una copia en este navegador, para que tu trabajo no se pierda si la app se cierra a mitad de un cambio, siempre que el diario quepa en el navegador (hasta unas {max} operaciones).',
  'sup.a.where.phone':
    'En el almacenamiento privado de la propia app, en este teléfono. No se sube nada a ningún sitio, no hay cuenta y la app funciona sin conexión. Las demás apps no pueden leerlo, y desinstalar la app lo borra, así que guarda de vez en cuando una copia de seguridad en otro sitio.',
  'sup.a.where.app':
    'En un archivo JSON sencillo, journal.json, en la carpeta Sniper Journal de tus Documentos. La app no sube nada y funciona sin conexión a internet (si OneDrive hace copia de tus Documentos, también la hace del diario). La carpeta se queda al desinstalar la app, así que al volver a instalarla recupera tu diario.',
  'sup.q.broken': '¿Qué pasa si rompo algo?',
  'sup.a.broken':
    'Cada día que haces un cambio, la versión anterior del archivo se copia en data/backups antes de escribir la nueva. Se guardan las últimas 30 copias diarias. También puedes descargar una copia de seguridad cuando quieras desde el menú de tu perfil, y restaurarla desde Ajustes.',
  'sup.a.broken.phone':
    'Cada día que haces un cambio, la versión anterior de tu diario se guarda aparte dentro de la app antes de escribir la nueva, y se guardan las últimas 30 copias diarias. También puedes guardar una copia de seguridad cuando quieras desde Más → Hacer copia de seguridad, y restaurarla desde Ajustes.',
  'sup.a.broken.app':
    'Cada día que haces un cambio, la versión anterior del archivo se copia en la carpeta backups, junto a él, antes de escribir la nueva. Se guardan las últimas 30 copias diarias. También puedes guardar una copia de seguridad cuando quieras desde el menú de tu perfil, y restaurarla desde Ajustes.',
  'sup.q.missing': '¿Por qué falta una operación en mis estadísticas?',
  'sup.a.missing':
    'Las estadísticas solo cuentan las operaciones cerradas, así que lo que no tenga precio de salida ni P&L manual queda fuera hasta que lo cierres. Las operaciones que marcaste con el icono del ojo también quedan fuera a propósito, aunque siguen en el diario.',
  'sup.q.futures': '¿Cómo registro bien futuros o forex?',
  'sup.a.futures':
    'Abre la sección «Futuros, forex y P&L manual» del formulario de la operación y pon el multiplicador del contrato: ES es 50, NQ es 20, MES es 5, y un lote estándar de forex son {lot} unidades. Si te resulta más fácil, cambia el P&L a Manual y pega la cifra de tu bróker.',
  'sup.q.rMultiple': '¿Qué cuenta como múltiplo R?',
  'sup.a.rMultiple':
    'Tu resultado dividido entre el dinero que arriesgabas entre la entrada y el stop loss. Las operaciones registradas sin stop no se pueden medir en R, y por eso las estadísticas de riesgo y de R:R te piden que lo anotes.',
  'sup.q.window': '¿Tengo que dejar una ventana abierta para que funcione?',
  'sup.a.window':
    'Sí, aquella en la que ejecutaste {start} (o {dev}): es el servidor, y la página lo necesita. Detenerlo no hace perder nada, porque tu diario se escribe en el disco menos de un tercio de segundo después de cada cambio.',
  'sup.a.window.app':
    'Solo mientras la usas. Cada cambio se escribe en el disco en menos de un tercio de segundo, y al cerrar la ventana se espera al último, así que al cerrarla no se pierde nada.',
  'sup.q.ownWindow': '¿Puedo abrirla en su propia ventana en lugar de en una pestaña del navegador?',
  'sup.a.ownWindow':
    'Sí. En Chrome, haz clic en los tres puntos de arriba a la derecha, elige Enviar, guardar y compartir y luego Instalar página como aplicación. Sniper Journal tendrá su propia ventana, sin barra de direcciones, y un icono en el menú Inicio y en la barra de tareas. Es la misma app de las dos formas, con el mismo archivo del diario.',
  'sup.q.computers': '¿Puedo usarla en más de un ordenador?',
  'sup.q.computers.phone': '¿Puedo usarla en más de un dispositivo?',
  'sup.a.computers':
    'Cada instalación tiene su propio archivo. Para llevarte el diario, descarga una copia de seguridad en un equipo y restáurala en el otro desde Ajustes.',
  'sup.a.computers.phone':
    'Cada teléfono y cada ordenador tiene su propio diario. Para llevarte el tuyo, guarda una copia de seguridad en un dispositivo y restáurala en el otro desde Ajustes.',
  'sup.a.computers.app':
    'Cada ordenador tiene su propio diario. Para llevarte el tuyo, guarda una copia de seguridad en un ordenador y restáurala en el otro desde Ajustes, y copia también la carpeta screenshots para las imágenes de los gráficos.',
  'sup.q.bringOver': 'Usaba la versión anterior. ¿Cómo traigo mi diario?',
  'sup.a.bringOver':
    'En Ajustes, en Copias de seguridad, elige Traer de la versión anterior y luego la carpeta en la que la instalaste (la que tiene INSTALLER.bat). Se copian tus operaciones y las imágenes de los gráficos, y la carpeta antigua queda exactamente como estaba.',

  'sup.import.title': 'Importar desde tu bróker',
  'sup.import.text':
    'Abre Operaciones y elige Importar. Las exportaciones de 30 plataformas, en CSV o Excel, se importan tal cual, y la ventana de importación indica qué archivo exportar en cada una. Para cualquier otra cosa, descarga la plantilla para ver los nombres de las columnas: los encabezados habituales de los brókers, como {qty}, {ticker}, {commission} y {pnl}, se reconocen automáticamente, y las filas que no se pueden leer aparecen antes de confirmar la importación.',
  'sup.open.title': 'Abrir la app',
  'sup.open.text':
    'Esta es la versión que se sirve desde la carpeta del proyecto: ejecuta {start} allí ({dev} mientras editas el código) y abre {url}. La app de Windows de Microsoft Store y la app de Android se abren como cualquier otra app.',
};
