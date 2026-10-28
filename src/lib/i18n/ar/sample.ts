import type { sample as en } from '../en/sample';
import type { Translation } from '../types';

export const sample: Translation<typeof en> = {
  'sample.orb.name': 'اختراق نطاق الافتتاح',
  'sample.orb.description': 'اختراق نطاق أول 15 دقيقة والثبات بعده، ولا يُؤخذ إلا مع الاتجاه اليومي.',
  'sample.orb.wait': 'انتظر اكتمال أول 15 دقيقة',
  'sample.orb.retest': 'ادخل عند إعادة الاختبار، لا مع الاندفاعة الأولى',
  'sample.orb.stop': 'وقف الخسارة تحت منتصف النطاق',
  'sample.orb.target': 'الهدف 2R أو أعلى سعر في اليوم السابق',

  'sample.vwap.name': 'استعادة VWAP',
  'sample.vwap.description': 'يفقد السعر مستوى VWAP ويهبط بحدة، ثم يستعيده بحجم تداول قوي.',
  'sample.vwap.within': 'يستعيده خلال 30 دقيقة من فقدانه',
  'sample.vwap.volume': 'حجم التداول على شمعة الاستعادة أعلى من المتوسط',
  'sample.vwap.stop': 'وقف الخسارة تحت قاع الهبوط',
  'sample.vwap.scale': 'أغلق النصف عند 1R',

  'sample.pullback.name': 'تصحيح ضمن الاتجاه',
  'sample.pullback.description': 'شراء أول تصحيح هادئ نحو متوسط متحرك صاعد.',
  'sample.pullback.trend': 'قمم أعلى وقيعان أعلى على إطار 5 دقائق',
  'sample.pullback.volume': 'تصحيح مع تراجع حجم التداول',
  'sample.pullback.entry': 'الدخول عند إغلاق شمعة الانعكاس',
  'sample.pullback.late': 'لا دخول في الساعة الأخيرة',

  'sample.tag.planned': 'وفق الخطة',
  'sample.tag.breakout': 'اختراق',
  'sample.tag.pullback': 'تصحيح',
  'sample.tag.news': 'أخبار',
  'sample.tag.fomo': 'FOMO',
  'sample.tag.earlyEntry': 'دخول مبكر',
  'sample.tag.movedStop': 'تحريك الوقف',
  // not "A+": a "+" at the end of a tag that reads right to left lands on the wrong side of the A
  'sample.tag.aPlus': 'نموذج مثالي',
  'sample.tag.tired': 'تعب',
  'sample.tag.oversized': 'حجم مبالغ فيه',

  'sample.note.won': 'اتبعت الخطة وتركت بقية الصفقة تعمل.',
  'sample.note.lost': 'دخلت قبل التأكيد ودفعت الثمن.',
};
