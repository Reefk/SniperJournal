import type { review as en } from '../en/review';
import type { Translation } from '../types';

export const review: Translation<typeof en> = {
  'review.head.trade': 'صفقة لي للمراجعة: {symbol}، {date}.',
  'review.head.day': 'يوم تداول لي للمراجعة: {day}، {date}.',
  'review.head.week': 'أسبوع تداول لي للمراجعة: {from} – {to}.',
  'review.leftOut':
    'المبالغ محذوفة: النتائج بوحدات R (نتيجة الصفقة مقابل المخاطرة التي حدّدها وقف خسارتها) وكنسبة مئوية من رصيدي.',
  'review.leftOutNoBalance':
    'المبالغ محذوفة: النتائج بوحدات R، أي نتيجة الصفقة مقابل المخاطرة التي حدّدها وقف خسارتها.',

  'review.count': { other: 'الصفقات: {count}، الرابحة: {won}، الخاسرة: {lost}.' },
  'review.net': 'الصافي: {result}.',
  'review.rTotal': { other: 'بوحدات R: {r} على الصفقات التي لها وقف خسارة (عددها: {count}).' },
  'review.uncounted.day': {
    other: 'صفقات أخرى أدناه ما زالت مفتوحة أو مستبعدة من إحصائياتي، فلا تحسبها هذه الأرقام (عددها: {count}).',
  },
  'review.uncounted.week': {
    other:
      'صفقات أخرى ما زالت مفتوحة أو مستبعدة من إحصائياتي، فلا تحسبها هذه الأرقام ولا سطور الأيام (عددها: {count}).',
  },
  'review.pct': '{pct} من رصيدي',
  'review.days': 'يومًا بيوم:',
  'review.dayLine': '{day}: {trades}، {result}',
  'review.wonLost': 'الرابحة: {won}، الخاسرة: {lost}',
  'review.flagged': 'كاملةً، الصفقات التي خالفت قاعدة أو كان فيها خطأ:',
  'review.flagged.none': 'لم تخالف أي صفقة قاعدة، ولم يكن في أي منها خطأ.',
  'review.flagged.rest': { other: 'بقية الصفقات في سطور الأيام أعلاه فقط (عددها: {count}).' },

  'review.trade': '{symbol}، {side}، {date}',
  'review.times': 'فُتحت {open}، وأُغلقت {close}، ومدتها {hold}.',
  'review.stillOpen': 'فُتحت {open}، وما زالت مفتوحة.',
  'review.sizePrices': 'الحجم {size}؛ الدخول {entry}؛ الخروج {exit}.',
  'review.prices': 'الدخول {entry}؛ الخروج {exit}.',
  'review.sizeEntry': 'الحجم {size}؛ الدخول {entry}.',
  'review.entry': 'الدخول {entry}.',
  'review.stop': 'وقف الخسارة {stop}.',
  'review.stopTarget': 'وقف الخسارة {stop}؛ الهدف {target}.',
  'review.noStop': 'بلا وقف خسارة.',
  'review.result': 'النتيجة: {result}.',
  'review.rAndAmount': '{r}، {amount}',
  'review.afterFees': '{result}، بعد رسوم قدرها {fees}',
  'review.win': 'رابحة',
  'review.loss': 'خاسرة',
  'review.even': 'على التعادل',
  'review.setup': 'النموذج: {name}.',
  'review.ruleSep': '؛ ',
  'review.kept': 'قواعد التُزم بها: {rules}.',
  'review.broken': 'قواعد خولفت: {rules}.',
  'review.unticked': 'قواعد لم تُعلَّم: {rules}.',
  'review.noTicks': 'لم تُعلَّم قواعده.',
  'review.mistakes': 'الأخطاء: {list}.',
  'review.tags': 'الوسوم: {list}.',
  'review.ratings': 'تقييماتي من 5: {list}.',
  'review.session': 'الجلسة: {session}.',
  'review.notes': 'ملاحظات: {notes}',
  'review.excluded': 'استبعدتها من إحصائياتي.',

  'review.mine': 'قواعدي الخاصة، للتقييم على أساسها:',
  'review.rules': '{name}: {rules}.',
  'review.noRules': '{name}: لم تُكتب قواعده بعد.',
  'review.mistakeList': 'الأخطاء التي أراقبها: {list}.',
  'review.goals': 'أهدافي: {list}.',
  'review.note':
    'راجع هذه الصفقات بصفتك مدرّبي في التداول. قيّم كل صفقة على طريقة تنفيذها لا على نتيجتها: سطر واحد لكل صفقة مع السبب، على أساس قواعدي وأخطائي أعلاه، لا على نصائح التداول العامة. ثم اذكر شيئًا واحدًا أستمر فيه وشيئًا واحدًا أغيّره.',

  'review.copy': 'نسخ للمراجعة',
  'review.copyTrade': 'نسخ هذه الصفقة للمراجعة',
  'review.copyWeek': 'نسخ هذا الأسبوع للمراجعة',
  'review.copyDay': 'نسخ هذا اليوم للمراجعة',
  'review.dialog':
    'الصقه في أي محادثة مع الذكاء الاصطناعي، أو أرسله إلى مرشد. التطبيق لا يرسل شيئًا: يذهب النص فقط إلى حيث تلصقه.',
  'review.leaveOut': 'حذف المبالغ',
  'review.leaveOut.hint':
    'R ونسبة مئوية من رصيدك بدلًا من المبالغ والأحجام والرسوم، فيبقى حجم حسابك لك وحدك. ملاحظاتك تُنسخ كما كتبتها.',
  'review.leaveOut.hidden': 'المبالغ مخفية (العين في الشريط العلوي)، لذا تُحذف هنا أيضًا.',
  'review.text': 'النص',
  'review.copied': 'نُسخ النص. الصقه حيث تشاء.',
  'review.failed': 'لم يسمح هذا الجهاز للتطبيق بالنسخ. النص محدَّد: انسخه بـ Ctrl+C، أو اضغط عليه مطولًا في الهاتف.',
};
