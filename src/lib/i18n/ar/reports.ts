import type { reports as en } from '../en/reports';
import type { Translation } from '../types';

export const reports: Translation<typeof en> = {
  'rep.description': 'ملخصات لسجل تداولك جاهزة للطباعة.',
  'rep.empty.title': 'لا يوجد تقرير لإعداده بعد',
  'rep.empty.text':
    'تلخّص التقارير ما سجّلته: تفصيلًا شهرًا بشهر، والأداء حسب كل رمز وكل نموذج، والإحصاءات الرئيسية، وكلها جاهزة للطباعة أو التصدير.',
  'rep.closed': { other: '{label} · الصفقات المغلقة: {count}' },
  'rep.print': 'طباعة',

  'rep.results': 'النتائج',
  'rep.grossProfit': 'إجمالي الربح',
  'rep.grossLoss': 'إجمالي الخسارة',
  'rep.expectancy': 'التوقع لكل صفقة',

  'rep.consistency': 'الثبات',
  'rep.trades': 'الصفقات',
  'rep.winRate': 'نسبة الفوز',
  'rep.greenDays': 'الأيام الخضراء',
  'rep.greenDays.value': '{pct} ({green} من {days})',
  'rep.greenDays.info': 'نسبة أيام تداولك التي انتهت فوق الصفر بعد الرسوم. يُحسب اليوم مرة واحدة مهما كان عدد صفقاته.',
  'rep.bestShare': 'حصة أفضل يوم',
  'rep.bestShare.value': { other: '{pct} من ربح الأيام الخضراء (عددها\u00a0{count})' },
  'rep.bestShare.none': 'لا يوم أخضر',
  'rep.bestShare.info':
    'ربح أفضل أيامك كنسبة من مجموع أرباح كل الأيام الخضراء. النسبة العالية تعني أن يومًا واحدًا محظوظًا يحمل السجل كله، والمنخفضة تعني أن الربح موزّع على أيام كثيرة.',
  'rep.withoutBest': 'الصافي من دون أفضل يوم',
  'rep.withoutBest.info': 'صافي ربحك بعد استبعاد أفضل أيامك. اللون الأحمر هنا يعني أن ذلك اليوم وحده يحمل السجل.',
  'rep.avgWin': 'متوسط الربح',
  'rep.avgLoss': 'متوسط الخسارة',
  'rep.winStreak': 'أطول سلسلة أرباح',
  'rep.lossStreak': 'أطول سلسلة خسائر',

  'rep.risk': 'المخاطرة',
  'rep.fromPeak': 'التراجع من القمة',
  'rep.setBalance': 'حدّد رصيدًا افتتاحيًا',
  'rep.recovery': 'عامل التعافي',
  'rep.recovery.info':
    'صافي الربح مقسومًا على أقصى تراجع: كم مرة يغطي الربح أعمق هبوط. إذا كان أقل من 1 فالربح أقل مما خسرته مرةً من قبل، و∞ تعني أنه لا هبوط بعد.',
  'rep.sqn': 'جودة النظام (SQN)',
  'rep.hold': 'متوسط مدة الصفقة',

  'rep.form': 'الأداء الأخير',
  'rep.form.subtitle': 'صفقاتك الأخيرة مقابل سجلك كله، أيًّا كانت الفترة في الأعلى',
  'rep.form.last': {
    zero: 'آخر {count} صفقة',
    one: 'آخر صفقة',
    two: 'آخر صفقتين',
    few: 'آخر {count} صفقات',
    many: 'آخر {count} صفقة',
    other: 'آخر {count} صفقة',
  },
  'rep.form.all': { other: 'كل الصفقات ({count})' },
  'rep.form.needs': {
    zero: 'لا يلزم المزيد',
    one: 'تلزم صفقة أخرى',
    two: 'تلزم صفقتان أخريان',
    few: 'تلزم {count} صفقات أخرى',
    many: 'تلزم {count} صفقة أخرى',
    other: 'تلزم {count} صفقة أخرى',
  },
  'rep.form.above': 'أعلى من سجلك كله',
  'rep.form.below': 'أدنى من سجلك كله',
  'rep.form.rNote': 'متوسط R يحسب الصفقات التي لها وقف خسارة: {count} من {total}.',
  'rep.form.noR': 'لا صفقة لها وقف خسارة، فلا R لعرضه.',
  'rep.form.rThin': {
    other: 'لا سهم لمتوسط R إذا كانت الصفقات ذات وقف الخسارة أقل من {count}: عددها أقل من أن يُقارن.',
  },

  'rep.holdVs': 'مدة الاحتفاظ مقابل النتيجة',
  'rep.holdVs.subtitle': 'نقطة لكل صفقة في الفترة: كم احتفظت بها وكيف انتهت. اضغط عليها لفتحها.',
  'rep.holdVs.held': 'مدة الاحتفاظ {duration}',
  'rep.holdVs.split':
    'الاحتفاظ أكثر من {duration}: {longer} للصفقة ({longerTrades}). حتى {duration}: {shorter} للصفقة ({shorterTrades}).',
  'rep.holdVs.trades': { other: 'الصفقات: {count}' },
  'rep.holdVs.thin': { other: 'هل يربح الاحتفاظ الأطول؟ يظهر ذلك حين يبلغ كل نصف عدد الصفقات المطلوب ({count}).' },
  'rep.holdVs.noStop': { other: 'صفقات بلا وقف خسارة لم تُحتسب، فلا R لها: {count}.' },
  'rep.holdVs.noTime': { other: 'صفقات بلا وقت إغلاق لم تُحتسب: {count}.' },
  'rep.holdVs.same': 'صفقات كثيرة لها مدة الاحتفاظ نفسها، فلا يمكن قسمتها إلى نصفين.',
  'rep.holdVs.empty': 'لا صفقة في هذه الفترة لها مدة احتفاظ تُعرض.',
  'rep.holdVs.summary': { other: 'مدة الاحتفاظ مقابل النتيجة: الصفقات {count}، من {from} إلى {to}.' },

  'rep.heat': 'اليوم والساعة',
  'rep.heat.subtitle': 'صفقاتك حسب اليوم والساعة التي فتحتها فيها: الصافي وعددها.',
  'rep.heat.day': 'اليوم',
  'rep.heat.hour': 'الساعة',
  'rep.heat.none': 'لا صفقات',
  'rep.heat.noTime': { other: 'صفقات لها تاريخ فقط دون وقت الفتح لم تُحتسب: {count}.' },
  'rep.heat.empty': 'لا صفقة في هذه الفترة لها وقت فتح.',

  'rep.months': 'شهرًا بشهر',
  'rep.months.empty': 'لا صفقات مغلقة في هذه الفترة.',
  'rep.month': 'الشهر',
  'rep.net': 'الصافي',
  'rep.bySymbol': 'أفضل الرموز وأسوؤها',
  'rep.bySetup': 'نماذج دليل التداول',
  'rep.byWeekday': 'يوم الأسبوع',
  'rep.unknownSetup': 'غير معروف',
  'rep.bestWorst': 'أفضل يوم {best} بمبلغ {bestNet}، وأسوأ يوم {worst} بمبلغ {worstNet}.',

  'rep.tags.kind': 'مجموعة وسوم',
  'rep.tags.empty': 'لا صفقة في هذه الفترة تحمل وسوم هذه المجموعة.',
  'rep.tags.tag': 'الوسم',
  'rep.tags.avgR': 'يُحسب متوسط R على الصفقات التي لها وقف خسارة.',
  'rep.tags.few': 'الرمادي: أقل من 3 صفقات.',
  'rep.tags.thin': 'المنقّط: أقل من 10، وهو عدد قليل لا يُعتمد عليه بعد.',
  'rep.tags.shared': { other: 'صفقات تحمل وسمين من هذه الوسوم: {count}، وتُحسب في كل صف منهما.' },

  'rep.mis.clean': '{pct} نظيفة ({clean} من {count})',
  'rep.mis.thisMonth': 'هذا الشهر {share}.',
  'rep.mis.bothMonths': 'هذا الشهر {share}، والشهر الماضي {last}.',
  'rep.mis.lastMonth': 'لم تُغلق أي صفقة هذا الشهر بعد؛ الشهر الماضي {last}.',
  'rep.mis.cleanInRange': 'الصفقات النظيفة، بلا أي خطأ: <num>{pct}</num> ({clean} من {count}) في هذه الفترة.',
  'rep.mis.cleanSince': 'الصفقات النظيفة، بلا أي خطأ: <num>{pct}</num> ({clean} من {count}) منذ {date}.',
  'rep.mis.mistake': 'الخطأ',
  'rep.mis.times': 'المرات',
  'rep.mis.cost': 'الكلفة',
  'rep.mis.noCost': 'لا شيء حتى الآن',
  'rep.mis.gap': {
    other:
      'الصفقات التي فيها خطأ (عددها\u00a0{count}) ربحت {gap} أقل لكل صفقة من الصفقات النظيفة: نحو <loss>{cost}</loss> إجمالًا.',
  },
  'rep.mis.how':
    'كلفة الخطأ هي ما كانت صفقاته ستربحه زيادةً لو جاءت بمتوسط الصفقات النظيفة ({avg})، لذا تُحسب أيضًا الصفقة التي ربحت رغم الخطأ. تظهر الكلفة حين يتكرر الخطأ {min} مرات وتكون هناك {min} صفقات نظيفة. الصفقة التي فيها خطآن تُحسب لكليهما.',
  'rep.mis.howNoClean':
    'كلفة الخطأ هي ما كانت صفقاته ستربحه زيادةً لو جاءت بمتوسط الصفقات النظيفة، لذا تُحسب أيضًا الصفقة التي ربحت رغم الخطأ. تظهر الكلفة حين يتكرر الخطأ {min} مرات وتكون هناك {min} صفقات نظيفة. الصفقة التي فيها خطآن تُحسب لكليهما.',
  'rep.mis.before': 'لا تُحسب الصفقات التي قبل {date}، أول يوم سُجّل فيه خطأ لصفقة.',
  'rep.mis.noneInRange': 'لا صفقة في هذه الفترة فيها خطأ.',
  'rep.mis.noneYet':
    'لم تُسجَّل أخطاء بعد. انقر على أخطاء الصفقة في نموذجها، تحت «الأخطاء»، وسيحسب هذا ما يكلّفك كل خطأ.',
};
