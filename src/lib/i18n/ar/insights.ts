import type { insights as en } from '../en/insights';
import type { Translation } from '../types';

export const insights: Translation<typeof en> = {
  'ins.description': 'أنماط من صفقاتك أنت، لا نصائح عامة.',
  'ins.empty.none': 'لا شيء لتحليله بعد',
  'ins.empty.more': { other: 'يلزم المزيد من الصفقات المغلقة: {count}' },
  'ins.empty.text': {
    other:
      'تقرأ هذه الصفحة سجلك وتخبرك بما تجده: أي جلسة تربح فيها، وهل تتداول انتقامًا بعد الخسارة، وهل تُبقي الصفقات الخاسرة مفتوحة أطول من الرابحة. وتبقى صامتة حتى يبلغ عدد الصفقات المغلقة {count} على الأقل، لأن ما دون ذلك ضجيج لا نمط.',
  },
  'ins.readFrom': {
    other: 'عدد الصفقات المغلقة: {count}. كل استنتاج هنا يستند إلى رقم يمكنك التحقق منه في الجدول.',
  },
  'ins.live': 'إشارات مباشرة',
  'ins.says': 'ماذا يقول سجلك',
  'ins.money': 'من أين يأتي المال',
  'ins.bySymbol': 'حسب الرمز',
  'ins.bySession': 'حسب الجلسة',
  'ins.byWeekday': 'حسب يوم الأسبوع',
  'ins.byTag': 'حسب الوسم',
  'ins.score': 'تفصيل Sniper Score',
  'ins.notRated': 'بلا تقييم',
  'ins.unrated': {
    other: 'لم تُقيَّم بعد: {axes}. سجّل وقف الخسارة وقيّم انضباطك وتنفيذك وصبرك عند تسجيل كل صفقة.',
  },
  'ins.allScored': 'كل محور مُقيَّم من بيانات أدخلتها بنفسك.',

  'ins.cat.Edge': 'الأفضلية',
  'ins.cat.Timing': 'التوقيت',
  'ins.cat.Risk': 'المخاطرة',
  'ins.cat.Behaviour': 'السلوك',
  'ins.cat.Cost': 'التكلفة',
  'ins.vs': '{a} مقابل {b}',
  'ins.labelNet': '{label}: {net}',

  'sig.lossBreached.title': 'بلغت حد الخسارة اليومي',
  'sig.lossBreached.text': 'خسارة اليوم تجاوزت الحد الذي وضعته. قاعدتك أنت تقول: توقف هنا.',
  'sig.lossNear.title': 'اقتربت من حد الخسارة اليومي',
  'sig.lossNear.text': 'استهلكت {pct} من الخسارة التي تسمح بها لنفسك في اليوم.',
  'sig.tradeCount.title': { other: 'صفقات اليوم: {count}' },
  'sig.tradeCount.text': 'حدّك اليومي: {max}. الصفقات الزائدة عن الخطة هي عادةً الأغلى ثمنًا.',
  'sig.losing.title': { other: 'خسائر متتالية: {count}' },
  'sig.losing.text': 'قلّل حجم الصفقة أو ابتعد قليلًا حتى يظهر نموذج نظيف. في السلاسل بالذات ينفلت الانضباط.',
  'sig.winning.title': { other: 'أرباح متتالية: {count}' },
  'sig.winning.text': 'أداء جيد. حافظ على حجم المركز الذي بدأت به السلسلة.',
  'sig.better.title': 'أفضل من الأسبوع الماضي',
  'sig.better.text': 'الأيام السبعة الأخيرة تسير أفضل من الأيام السبعة التي قبلها.',
  'sig.behind.title': 'أسوأ من الأسبوع الماضي',
  'sig.behind.text': 'الأيام السبعة الأخيرة تسير أسوأ من الأيام السبعة التي قبلها.',

  'ins.expectancy.goodTitle': 'نظامك ذو توقع إيجابي',
  'ins.expectancy.badTitle': 'نظامك يخسر في المتوسط مع كل صفقة',
  'ins.expectancy.goodText': {
    other:
      'على مدى صفقاتك المغلقة ({count}) تحتفظ في المتوسط بهذا المبلغ عن كل صفقة. مزيد من الصفقات بالجودة نفسها كفيل بأن يضاعفه.',
  },
  'ins.expectancy.badText': {
    other:
      'على مدى صفقاتك المغلقة ({count}) النتيجة المتوسطة سالبة. التخلص من أسوأ نموذج أهم عادةً من إيجاد نموذج جديد.',
  },
  'ins.expectancy.metric': '{money} لكل صفقة',

  'ins.breakEven.title': 'تحتاج نسبة فوز {pct} لتبلغ نقطة التعادل',
  'ins.breakEven.above':
    'نسبة فوزك {pct}، ما يترك هامشًا قدره {points} نقطة. احمِ هذا الهامش قبل أن تلاحق نسبة فوز أعلى.',
  'ins.breakEven.below':
    'نسبة فوزك {pct}، وهي دون نقطة التعادل. إما أن تربح أكثر، أو تجعل صفقاتك الرابحة أكبر مقارنة بالخاسرة.',
  'ins.breakEven.metric': 'هامش {points} نقطة',

  'ins.session.title': 'أكثر جلساتك ربحًا: {session}',
  'ins.session.text':
    '{best}: {bestNet}، عدد الصفقات {bestTrades}، نسبة الفوز {bestRate}. {worst}: {worstNet}، عدد الصفقات {worstTrades}، نسبة الفوز {worstRate}. إن بقيت الفجوة شهرًا آخر، فالجلسة الضعيفة هي التي ينبغي التخلي عنها.',

  // day, worst, best: a weekday's name, as Intl writes it ("الجمعة")
  'ins.weekday.title': 'يوم {day} يكلّفك',
  'ins.weekday.text': {
    other:
      'يوم {worst}: خسارة {loss}، عدد الصفقات {count}، بينما أقوى أيامك {best} بصافي {bestNet}. يستحق أن تسأل نفسك ما الذي يختلف في ذلك اليوم.',
  },

  'ins.symbol.title': '{best} يحملك، بينما {worst} يجرّك إلى الخلف',
  'ins.symbol.text':
    '{best}: {bestNet}، عدد الصفقات {bestTrades}. {worst}: خسارة {worstLoss}، عدد الصفقات {worstTrades}. التخلي عن أسوأ أداة لديك هو عادةً أرخص تحسين متاح.',

  'ins.setup.unknown': 'نموذج غير معروف',
  'ins.setup.title': '«{name}» هو أفضل نموذج في دليل تداولك',
  'ins.setup.text': {
    other:
      'حقق {bestNet} بنسبة فوز {rate} (عدد الصفقات {count})، مقابل {worstNet} لنموذج «{worst}». امنح الأفضل حجمًا أكبر.',
  },

  'ins.tag.title': 'الصفقات الموسومة بـ«{tag}» خاسرة',
  'ins.tag.text': {
    other:
      'الصفقات التي تحمل هذا الوسم: {count}، ومجموعها خسارة {loss} بنسبة فوز {rate}. لقد سمّيت المشكلة بنفسك حين وضعت الوسم.',
  },
  'ins.tag.metric': { other: 'صفقات موسومة: {count}' },

  'ins.rules.costTitle': 'كسر قواعدك كلّفك نحو {money}',
  'ins.rules.costText': {
    other:
      'الصفقات التي كسرت قاعدة من قواعد نموذجها: {count}. في المتوسط حققت الصفقة منها {gap} أقل من صفقات النموذج نفسه التي التزمت بكل القواعد. لو أدّت بالقدر نفسه، لكنت أفضل حالًا بنحو هذا المبلغ.',
  },
  'ins.rules.noCostTitle': 'كسر قواعدك لم يكلّفك شيئًا حتى الآن',
  'ins.rules.noCostMore': {
    other:
      'الصفقات التي كسرت قاعدة من قواعد نموذجها: {count}. في المتوسط حققت الصفقة منها {gap} أكثر من صفقات النموذج نفسه التي التزمت بكل القواعد. إما أن هذه القواعد ليست ما يجعل نماذجك تنجح، أو أن الحكم ما زال مبكرًا. يستحق أن تقرأها من جديد.',
  },
  'ins.rules.noCostSame': {
    other:
      'الصفقات التي كسرت قاعدة من قواعد نموذجها: {count}. وقد حققت بقدر صفقات النموذج نفسه التي التزمت بكل القواعد. إما أن هذه القواعد ليست ما يجعل نماذجك تنجح، أو أن الحكم ما زال مبكرًا. يستحق أن تقرأها من جديد.',
  },
  'ins.rules.others': {
    other:
      'صفقات أخرى كسرت قاعدة: {count}، في نماذج تحتاج إلى {min} على الأقل من الصفقات التي التزمت بكل القواعد، و{min} على الأقل من التي كسرت إحداها، قبل أن تمكن المقارنة.',
  },
  'ins.rules.worst': {
    other: 'القاعدة الأغلى كسرًا: «{rule}»، بصافي {net} على الصفقات التي كسرتها ({count}).',
  },
  'ins.rules.worstIn': {
    other: 'القاعدة الأغلى كسرًا: «{rule}» ({setup})، بصافي {net} على الصفقات التي كسرتها ({count}).',
  },
  'ins.rules.metric': { other: 'كسرت قاعدة: {broken} من أصل {count}' },

  'ins.mistake.title': '«{mistake}» هو أغلى أخطائك',
  'ins.mistake.text': {
    other:
      'ارتكبته في صفقات عددها {count}، وكان متوسطها {avg} مقابل {cleanAvg} للصفقات النظيفة الخالية من الأخطاء (عددها {clean}). لو أدّت بالقدر نفسه، لكنت أفضل حالًا بنحو {cost}.',
  },
  'ins.mistake.metric': { other: 'نحو {cost} على {count} من الصفقات' },

  'ins.side.longsTitle': 'تقرأ صفقات الشراء أفضل من صفقات البيع',
  'ins.side.shortsTitle': 'تقرأ صفقات البيع أفضل من صفقات الشراء',
  'ins.side.longsText':
    'الشراء: {strongRate}، عدد الصفقات {strongTrades}. البيع: {weakRate}، عدد الصفقات {weakTrades}. الأفضلية في اتجاه واحد تبقى أفضلية.',
  'ins.side.shortsText':
    'البيع: {strongRate}، عدد الصفقات {strongTrades}. الشراء: {weakRate}، عدد الصفقات {weakTrades}. الأفضلية في اتجاه واحد تبقى أفضلية.',
  'ins.side.metric': 'فجوة {points} نقطة',

  'ins.busy.title': 'أيامك المزدحمة هي أسوأ أيامك',
  'ins.busy.text': 'الأيام التي تبلغ صفقاتها {min} أو أكثر متوسطها أقل من أيامك الأهدأ. الكثرة ليست مصدر أفضليتك.',
  'ins.busy.metric': { other: 'أيام مزدحمة مقيسة: {count}' },

  'ins.revenge.title': 'الصفقة التي تلي الخسارة مباشرة أداؤها أسوأ',
  'ins.revenge.text': {
    other:
      'الصفقات المفتوحة مباشرة بعد خسارة في اليوم نفسه: {count}، ومتوسطها أدنى من صفقتك المعتادة. استراحة قصيرة بعد الصفقة الخاسرة كانت ستوفّر المال.',
  },
  'ins.revenge.metric': '{after} مقابل {normal} عادةً',

  'ins.hold.title': 'تُبقي الصفقات الخاسرة أطول من الرابحة',
  'ins.hold.text':
    'الصفقات الخاسرة تبقى مفتوحة أطول بشكل ملحوظ من الرابحة. هذه إدارة للأمل لا للمخاطرة. وقف زمني صارم يعالج ذلك.',

  'ins.stops.title': '{pct} فقط من صفقاتك تسجّل وقف خسارة',
  'ins.stops.text':
    'من دون سعر وقف لا يستطيع السجل قياس مضاعفات R، والأهم أنك لا تستطيع إثبات أنك حددت المخاطرة أصلًا. أضف وقفًا لكل صفقة.',
  'ins.stops.metric': { other: '{n} من أصل {count}' },

  'ins.outlier.title': 'خسارة واحدة أكبر بكثير من البقية',
  'ins.outlier.text':
    'أكبر خسائرك تزيد على ضعفين ونصف متوسط خسارتك. صفقة واحدة كهذه تمحو أسبوعًا من الصفقات الجيدة. تحقّق مما إذا كان الوقف قد حُرّك.',
  'ins.outlier.metric': '{worst} مقابل متوسط {avg}',

  'ins.fees.flipTitle': 'العمولات حوّلت نظامًا رابحًا إلى خاسر',
  'ins.fees.flipText': 'قبل الرسوم أنت رابح، وبعدها لا. صفقات أقل وأكبر، أو وسيط أرخص، سيقلب ذلك.',
  'ins.fees.shareTitle': 'العمولات تلتهم جزءًا كبيرًا من ربحك',
  'ins.fees.shareText': 'تمثل الرسوم نحو {pct} من ربحك الإجمالي.',
  'ins.fees.metric': 'رسوم مدفوعة: {money}',

  // "4–5" would read as "5–4" right to left, so the ratings are joined by "أو" (or)
  'ins.discipline.title': 'تقييماتك لانضباطك تتنبأ بنتائجك',
  'ins.discipline.text':
    'الصفقات التي منحتها 4 أو 5 في الانضباط متوسطها أفضل من التي منحتها 1 أو 2. أنت تميّز الصفقة الجيدة من السيئة في لحظتها، أي أن الحل هو أن تتبع قراءتك أنت.',
  'ins.discipline.metric': 'منضبطة: {high}، متسرعة: {low}',
};
