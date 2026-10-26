import type { common as en } from '../en/common';
import type { Translation } from '../types';

export const common: Translation<typeof en> = {
  'common.cancel': 'Cancelar',
  'common.confirm': 'Confirmar',
  'common.ok': 'Aceptar',
  'common.close': 'Cerrar',
  'common.save': 'Guardar',
  'common.add': 'Añadir',
  'common.edit': 'Editar',
  'common.delete': 'Eliminar',
  'common.optional': 'opcional',
  'common.trades': { one: '{count} operación', many: '{count} operaciones', other: '{count} operaciones' },
  'common.keptHere': 'Tu diario está guardado aquí:',
  'common.downloadBackup': 'Descargar una copia de seguridad',
  'common.backUpJournal': 'Hacer copia de seguridad',
  'common.backupDownloaded': 'Copia de seguridad descargada',
  'common.yourName': 'Tu nombre',
  'common.namePlaceholder': 'Se muestra en la cabecera',
  'common.currency': 'Moneda',
  'common.language': 'Idioma',
  'common.accountName': 'Nombre de la cuenta',
  'common.startingBalance': 'Saldo inicial',
  'common.accountPlaceholder': 'p. ej., Desafío de prop firm',
  'common.accountCreated': 'Cuenta «{name}» creada',
  'common.removeTestData.title': '¿Quitar los datos de prueba?',
  'common.removeTestData.message': {
    one: 'Esto elimina la {count} operación de prueba generada, las imágenes de gráficos que le adjuntaste y los setups de prueba del Playbook. Las operaciones que introdujiste tú se conservan.',
    many: 'Esto elimina las {count} operaciones de prueba generadas, las imágenes de gráficos que les adjuntaste y los setups de prueba del Playbook. Las operaciones que introdujiste tú se conservan.',
    other:
      'Esto elimina las {count} operaciones de prueba generadas, las imágenes de gráficos que les adjuntaste y los setups de prueba del Playbook. Las operaciones que introdujiste tú se conservan.',
  },
  'common.removeTestData.confirm': 'Quitar datos de prueba',
  'common.testDataRemoved': 'Datos de prueba eliminados',
};
