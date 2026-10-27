import type { resources as en } from '../en/resources';
import type { Translation } from '../types';

export const resources: Translation<typeof en> = {
  'res.description': 'قائمتك المختصرة من الأدوات ومصادر الأخبار والقراءة. لا يُضاف إليها شيء نيابةً عنك.',
  'res.add': 'إضافة مصدر',
  'res.edit': 'تعديل المصدر',
  'res.empty.title': 'لا مصادر محفوظة',
  'res.empty.text':
    'احفظ في مكان واحد الروابط القليلة التي تفتحها فعلًا في كل جلسة: منصة الرسوم البيانية، والتقويم الاقتصادي، وصفحة كشوف حساب الوسيط، وكتابًا تقرؤه حاليًا.',
  'res.empty.first': 'أضف مصدرك الأول',
  'res.removeNamed': 'إزالة {name}',
  'res.remove.title': 'إزالة «{name}»؟',
  'res.remove.message': 'يزيل هذا الرابط من قائمة مصادرك فقط.',
  'res.removed': 'أُزيل المصدر',
  'res.saved': 'حُفظ المصدر',

  'res.titleRequired': 'أعطه عنوانًا',
  'res.title': 'العنوان',
  'res.link': 'الرابط',
  'res.category': 'الفئة',
  'res.notesPlaceholder': 'فيمَ تستخدمه',

  'res.cat.Charting': 'الرسوم البيانية',
  'res.cat.News & data': 'الأخبار والبيانات',
  'res.cat.Education': 'التعليم',
  'res.cat.Broker': 'الوسيط',
  'res.cat.Tools': 'الأدوات',
  'res.cat.Reading': 'القراءة',
  'res.cat.Other': 'أخرى',
};
