import type { sample as en } from '../en/sample';
import type { Translation } from '../types';

export const sample: Translation<typeof en> = {
  'sample.orb.name': 'ओपनिंग रेंज ब्रेकआउट',
  'sample.orb.description': 'पहले 15 मिनट की रेंज का ब्रेक और उसके बाहर टिके रहना, सिर्फ़ दैनिक ट्रेंड की दिशा में।',
  'sample.orb.wait': 'पहले 15 मिनट पूरे होने का इंतज़ार करें',
  'sample.orb.retest': 'रीटेस्ट पर एंट्री लें, पहले उछाल पर नहीं',
  'sample.orb.stop': 'स्टॉप रेंज के मध्य के नीचे',
  'sample.orb.target': 'लक्ष्य 2R या पिछले दिन का हाई',

  'sample.vwap.name': 'VWAP के ऊपर वापसी',
  'sample.vwap.description': 'कीमत VWAP से नीचे जाती है, तेज़ी से गिरती है, फिर वॉल्यूम के साथ उसके ऊपर लौट आती है।',
  'sample.vwap.within': 'नीचे जाने के 30 मिनट के भीतर ऊपर लौटना ज़रूरी',
  'sample.vwap.volume': 'वापसी वाली कैंडल पर वॉल्यूम औसत से ज़्यादा',
  'sample.vwap.stop': 'स्टॉप गिरावट के लो के नीचे',
  'sample.vwap.scale': '1R पर आधी पोज़िशन बुक करें',

  'sample.pullback.name': 'ट्रेंड पुलबैक',
  'sample.pullback.description': 'बढ़ते मूविंग एवरेज की ओर पहले शांत पुलबैक पर ख़रीदारी।',
  'sample.pullback.trend': '5 मिनट के चार्ट पर ऊँचे हाई और ऊँचे लो',
  'sample.pullback.volume': 'घटते वॉल्यूम पर पुलबैक',
  'sample.pullback.entry': 'रिवर्सल कैंडल के क्लोज़ पर एंट्री',
  'sample.pullback.late': 'आख़िरी घंटे में कोई एंट्री नहीं',

  'sample.tag.planned': 'योजना के अनुसार',
  'sample.tag.breakout': 'ब्रेकआउट',
  'sample.tag.pullback': 'पुलबैक',
  'sample.tag.news': 'ख़बर',
  'sample.tag.fomo': 'FOMO',
  'sample.tag.earlyEntry': 'जल्दी एंट्री',
  'sample.tag.movedStop': 'स्टॉप खिसकाया',
  'sample.tag.aPlus': 'A+ सेटअप',
  'sample.tag.tired': 'थकान',
  'sample.tag.oversized': 'बड़ी पोज़िशन',

  'sample.note.won': 'योजना का पालन किया और बाक़ी पोज़िशन को चलने दिया।',
  'sample.note.lost': 'पुष्टि से पहले एंट्री ली और उसकी क़ीमत चुकाई।',
};
