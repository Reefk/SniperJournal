import type { calendar as en } from '../en/calendar';
import type { Translation } from '../types';

export const calendar: Translation<typeof en> = {
  'cal.title': 'Calendario de rendimiento',
  'cal.hint': '<phone>toca</phone><pc>haz clic en</pc> cualquier día para ver las operaciones detrás de la cifra',
  'cal.previous': 'Mes anterior',
  'cal.next': 'Mes siguiente',
  'cal.today': 'Hoy',
  'cal.empty.title': 'Tu calendario de operaciones está vacío',
  'cal.empty.text':
    'Cuando registres operaciones, cada día mostrará su beneficio o pérdida neta y el número de operaciones que hiciste, así las rachas y los días problemáticos se ven de un vistazo.',
  'cal.net': 'P&L neto del mes',
  'cal.stillOpen': { one: '{count} sigue abierta', many: '{count} siguen abiertas', other: '{count} siguen abiertas' },
  'cal.activeDays': 'Días activos',
  'cal.greenRed': { other: '{count} en verde, {red} en rojo' },
  'cal.winRate': 'Tasa de acierto del mes',
  'cal.noneClosed': 'aún no hay operaciones cerradas',
  'cal.noneIn': 'No hay operaciones en {month}.',
  'cal.dayNet': {
    one: '{count} operación · neto {net}',
    many: '{count} operaciones · neto {net}',
    other: '{count} operaciones · neto {net}',
  },
};
