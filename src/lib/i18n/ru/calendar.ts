import type { calendar as en } from '../en/calendar';
import type { Translation } from '../types';

export const calendar: Translation<typeof en> = {
  'cal.title': 'Календарь результатов',
  'cal.hint': '<phone>нажмите</phone><pc>щёлкните</pc> на любой день, чтобы увидеть, из каких сделок сложилась сумма',
  'cal.previous': 'Предыдущий месяц',
  'cal.next': 'Следующий месяц',
  'cal.today': 'Сегодня',
  'cal.empty.title': 'Календарь сделок пока пуст',
  'cal.empty.text':
    'Когда вы начнёте записывать сделки, в каждом дне появятся его чистая прибыль или убыток и число сделок, так что серии и проблемные дни видны с первого взгляда.',
  'cal.net': 'Чистый P&L за месяц',
  'cal.stillOpen': { other: 'ещё открыто: {count}' },
  'cal.activeDays': 'Дни со сделками',
  'cal.greenRed': { other: 'зелёных: {count}, красных: {red}' },
  'cal.winRate': 'Винрейт за месяц',
  'cal.noneClosed': 'закрытых сделок пока нет',
  'cal.noneIn': '{month}: сделок нет.',
  'cal.dayNet': {
    one: '{count} сделка · итог {net}',
    few: '{count} сделки · итог {net}',
    many: '{count} сделок · итог {net}',
    other: '{count} сделки · итог {net}',
  },
};
