import type { sample as en } from '../en/sample';
import type { Translation } from '../types';

export const sample: Translation<typeof en> = {
  'sample.orb.name': 'Ruptura del rango de apertura',
  'sample.orb.description':
    'Ruptura y mantenimiento del rango de los primeros 15 minutos, solo a favor de la tendencia diaria.',
  'sample.orb.wait': 'Esperar a que terminen los primeros 15 minutos',
  'sample.orb.retest': 'Entrar en el retesteo, no en el primer impulso',
  'sample.orb.stop': 'Stop bajo la mitad del rango',
  'sample.orb.target': 'Objetivo 2R o el máximo del día anterior',

  'sample.vwap.name': 'Recuperación del VWAP',
  'sample.vwap.description': 'El precio pierde el VWAP, cae con fuerza y luego lo recupera con volumen.',
  'sample.vwap.within': 'Recuperarlo antes de 30 minutos desde que se perdió',
  'sample.vwap.volume': 'Volumen superior a la media en la vela de recuperación',
  'sample.vwap.stop': 'Stop bajo el mínimo de la caída',
  'sample.vwap.scale': 'Cerrar la mitad en 1R',

  'sample.pullback.name': 'Retroceso en tendencia',
  'sample.pullback.description': 'Comprar el primer retroceso controlado hacia una media móvil ascendente.',
  'sample.pullback.trend': 'Máximos y mínimos crecientes en el gráfico de 5 minutos',
  'sample.pullback.volume': 'Retroceso con volumen decreciente',
  'sample.pullback.entry': 'Entrada al cierre de la vela de giro',
  'sample.pullback.late': 'Sin entradas en la última hora',

  'sample.tag.planned': 'según el plan',
  'sample.tag.breakout': 'ruptura',
  'sample.tag.pullback': 'retroceso',
  'sample.tag.news': 'noticias',
  'sample.tag.fomo': 'FOMO',
  'sample.tag.earlyEntry': 'entrada anticipada',
  'sample.tag.movedStop': 'stop movido',
  'sample.tag.aPlus': 'setup A+',
  'sample.tag.tired': 'cansancio',
  'sample.tag.oversized': 'tamaño excesivo',

  'sample.note.won': 'Seguí el plan y dejé correr el resto de la posición.',
  'sample.note.lost': 'Entré antes de la confirmación y lo pagué.',
};
