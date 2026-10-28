import type { files as en } from '../en/files';
import type { Translation } from '../types';

export const files: Translation<typeof en> = {
  'backup.notBackup': 'Ese archivo no es una copia de seguridad de Sniper Journal.',
  'backup.newer':
    'Esta copia de seguridad la hizo una versión más reciente de Sniper Journal. Actualiza la app y después restáurala.',
  'backup.noLists': 'Ese archivo no contiene una lista de operaciones y cuentas.',
  'backup.notJson': 'Ese archivo no es un JSON válido.',

  'bring.title': '¿Traer este diario?',
  'bring.message': {
    one: 'El diario de la versión anterior tiene {count} operación. Traerlo sustituye todo lo que hay ahora en tu diario. El diario sustituido se guarda en tus copias de seguridad, sin sus imágenes de gráficos.',
    many: 'El diario de la versión anterior tiene {count} operaciones. Traerlo sustituye todo lo que hay ahora en tu diario. El diario sustituido se guarda en tus copias de seguridad, sin sus imágenes de gráficos.',
    other:
      'El diario de la versión anterior tiene {count} operaciones. Traerlo sustituye todo lo que hay ahora en tu diario. El diario sustituido se guarda en tus copias de seguridad, sin sus imágenes de gráficos.',
  },
  'bring.done': {
    one: 'Se trajo {count} operación de la versión anterior. Su carpeta se dejó como estaba.',
    many: 'Se trajeron {count} operaciones de la versión anterior. Su carpeta se dejó como estaba.',
    other: 'Se trajeron {count} operaciones de la versión anterior. Su carpeta se dejó como estaba.',
  },
  'bring.imagesFailed':
    'No se pudieron copiar las imágenes de gráficos de la versión anterior, así que no se cambió nada.',
  'bring.unreadable': 'No se pudo leer ese diario.',
  'bring.folderUnreadable': 'No se pudo leer esa carpeta.',
  'bring.refused.noJournal':
    'No hay ningún diario en esa carpeta. Elige la carpeta de Sniper Journal que instalaste antes, la que contiene INSTALLER.bat.',
  'bring.refused.unreadable': 'No se pudo leer el diario de esa carpeta.',

  'img.notImage': 'Ese archivo no es una imagen.',
  'img.unsupported': 'Solo se pueden guardar imágenes PNG, JPEG, WebP y GIF.',
  'img.unreadable': 'No se pudo leer la imagen.',
  'img.unreachable': 'Las imágenes solo se pueden guardar mientras la app puede llegar a su carpeta de datos.',

  'sweep.shotsUnreadable': 'No se pudo leer la carpeta screenshots, así que no se borró ninguna imagen de gráfico.',
  'sweep.backupsUnreadable': 'No se pudo leer la carpeta backups, así que no se borró ninguna imagen de gráfico.',
  'sweep.journalUnreadable': 'No se pudo leer el archivo de tu diario, así que no se borró ninguna imagen de gráfico.',
  'sweep.journalDamaged':
    'El archivo de tu diario está dañado (no es un diario completo), así que no se borró ninguna imagen de gráfico.',
  'sweep.backupUnreadable':
    'No se pudo leer la copia de seguridad {file}, así que no se borró ninguna imagen de gráfico.',
  'sweep.backupDamaged':
    'La copia de seguridad {file} está dañada (no es un diario completo), así que no se borró ninguna imagen de gráfico.',

  'share.title': 'Guardar o enviar {file}',
  'recovered.backups': 'tus copias de seguridad',
  'merge.chartLinks': 'Enlaces de gráficos de las partes unidas:',
};
