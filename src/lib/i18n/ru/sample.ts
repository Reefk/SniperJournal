import type { sample as en } from '../en/sample';
import type { Translation } from '../types';

export const sample: Translation<typeof en> = {
  'sample.orb.name': 'Пробой диапазона открытия',
  'sample.orb.description': 'Пробой и удержание диапазона первых 15 минут, только по направлению дневного тренда.',
  'sample.orb.wait': 'Дождаться окончания первых 15 минут',
  'sample.orb.retest': 'Вход на ретесте, а не на первом импульсе',
  'sample.orb.stop': 'Стоп ниже середины диапазона',
  'sample.orb.target': 'Цель 2R или максимум предыдущего дня',

  'sample.vwap.name': 'Возврат выше VWAP',
  'sample.vwap.description': 'Цена уходит под VWAP, резко проваливается, затем возвращается выше него на объёме.',
  'sample.vwap.within': 'Возврат не позже 30 минут после потери уровня',
  'sample.vwap.volume': 'Объём на свече возврата выше среднего',
  'sample.vwap.stop': 'Стоп под минимумом провала',
  'sample.vwap.scale': 'Закрыть половину на 1R',

  'sample.pullback.name': 'Откат по тренду',
  'sample.pullback.description': 'Покупка первого спокойного отката к растущей скользящей средней.',
  'sample.pullback.trend': 'Повышающиеся максимумы и минимумы на 5-минутном графике',
  'sample.pullback.volume': 'Откат на снижающемся объёме',
  'sample.pullback.entry': 'Вход на закрытии разворотной свечи',
  'sample.pullback.late': 'Без входов в последний час',

  'sample.tag.planned': 'по плану',
  'sample.tag.breakout': 'пробой',
  'sample.tag.pullback': 'откат',
  'sample.tag.news': 'новости',
  'sample.tag.fomo': 'FOMO',
  'sample.tag.earlyEntry': 'ранний вход',
  'sample.tag.movedStop': 'перенос стопа',
  'sample.tag.aPlus': 'сетап A+',
  'sample.tag.tired': 'усталость',
  'sample.tag.oversized': 'большая позиция',

  'sample.note.won': 'Всё по плану, остаток позиции отработал своё.',
  'sample.note.lost': 'Вход до подтверждения, и за это пришлось заплатить.',
};
