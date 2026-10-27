import type { calendar as en } from '../en/calendar';
import type { Translation } from '../types';

export const calendar: Translation<typeof en> = {
  'cal.title': 'تقويم الأداء',
  'cal.hint': '<phone>اضغط</phone><pc>انقر</pc> على أي يوم لترى الصفقات وراء الرقم',
  'cal.previous': 'الشهر السابق',
  'cal.next': 'الشهر التالي',
  'cal.today': 'اليوم',
  'cal.empty.title': 'تقويم تداولك فارغ',
  'cal.empty.text':
    'حين تسجّل صفقاتك، يمتلئ كل يوم بصافي ربحه أو خسارته وعدد الصفقات التي أخذتها فيه، فتظهر السلاسل والأيام الصعبة من النظرة الأولى.',
  'cal.net': 'صافي الربح والخسارة للشهر',
  'cal.stillOpen': { other: 'ما زالت مفتوحة: {count}' },
  'cal.activeDays': 'أيام التداول',
  'cal.greenRed': { other: 'خضراء: {count}، حمراء: {red}' },
  'cal.winRate': 'نسبة الفوز هذا الشهر',
  'cal.noneClosed': 'لا صفقات مغلقة بعد',
  'cal.noneIn': 'لا صفقات في {month}.',
  'cal.dayNet': {
    zero: '{count} صفقة · الصافي {net}',
    one: 'صفقة واحدة · الصافي {net}',
    two: 'صفقتان · الصافي {net}',
    few: '{count} صفقات · الصافي {net}',
    many: '{count} صفقة · الصافي {net}',
    other: '{count} صفقة · الصافي {net}',
  },
};
