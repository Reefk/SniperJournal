import type { common as en } from '../en/common';
import type { Translation } from '../types';

export const common: Translation<typeof en> = {
  'common.cancel': 'إلغاء',
  'common.confirm': 'تأكيد',
  'common.ok': 'حسنًا',
  'common.close': 'إغلاق',
  'common.save': 'حفظ',
  'common.add': 'إضافة',
  'common.edit': 'تعديل',
  'common.delete': 'حذف',
  'common.optional': 'اختياري',
  'common.trades': {
    zero: '{count} صفقة',
    one: 'صفقة واحدة',
    two: 'صفقتان',
    few: '{count} صفقات',
    many: '{count} صفقة',
    other: '{count} صفقة',
  },
  'common.keptHere': 'يُحفظ سجلك هنا:',
  'common.downloadBackup': 'تنزيل نسخة احتياطية',
  'common.backUpJournal': 'نسخ سجلك احتياطيًا',
  'common.backupDownloaded': 'تم تنزيل النسخة الاحتياطية',
  'common.yourName': 'اسمك',
  'common.namePlaceholder': 'يظهر في الشريط العلوي',
  'common.currency': 'العملة',
  'common.language': 'اللغة',
  'common.accountName': 'اسم الحساب',
  'common.startingBalance': 'الرصيد الافتتاحي',
  'common.accountPlaceholder': 'مثال: تحدي شركة التمويل',
  'common.accountCreated': 'تم إنشاء الحساب «{name}»',
  'common.removeTestData.title': 'إزالة البيانات التجريبية؟',
  'common.removeTestData.message': {
    other:
      'سيؤدي هذا إلى حذف الصفقات التجريبية المُولَّدة (عددها {count})، وأي صور رسوم بيانية أرفقتها بها، ونماذج دليل التداول التجريبية. تبقى الصفقات التي أدخلتها بنفسك كما هي.',
  },
  'common.removeTestData.confirm': 'إزالة البيانات التجريبية',
  'common.testDataRemoved': 'تمت إزالة البيانات التجريبية',
};
