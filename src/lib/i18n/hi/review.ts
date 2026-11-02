import type { review as en } from '../en/review';
import type { Translation } from '../types';

export const review: Translation<typeof en> = {
  'review.head.trade': 'समीक्षा के लिए मेरा एक ट्रेड: {symbol}, {date}।',
  'review.head.day': 'समीक्षा के लिए मेरा एक ट्रेडिंग दिन: {day}, {date}।',
  'review.head.week': 'समीक्षा के लिए मेरा एक ट्रेडिंग हफ़्ता: {from} – {to}।',
  'review.leftOut':
    'रकम हटा दी गई है: नतीजे R में हैं (ट्रेड का नतीजा, उसके स्टॉप से तय जोखिम के मुकाबले) और मेरे बैलेंस के % में।',
  'review.leftOutNoBalance':
    'रकम हटा दी गई है: नतीजे R में हैं, यानी ट्रेड का नतीजा उसके स्टॉप से तय जोखिम के मुकाबले।',

  'review.count': { one: '{count} ट्रेड: जीते {won}, हारे {lost}।', other: '{count} ट्रेड: जीते {won}, हारे {lost}।' },
  'review.net': 'नेट: {result}।',
  'review.rTotal': {
    one: 'R में: स्टॉप वाले {count} ट्रेड पर {r}।',
    other: 'R में: स्टॉप वाले {count} ट्रेडों पर {r}।',
  },
  'review.uncounted.day': {
    one: '{count} और ट्रेड नीचे है जो अभी खुला है या मेरे आँकड़ों से बाहर है, इसलिए ये आँकड़े उसे नहीं गिनते।',
    other: '{count} और ट्रेड नीचे हैं जो अभी खुले हैं या मेरे आँकड़ों से बाहर हैं, इसलिए ये आँकड़े उन्हें नहीं गिनते।',
  },
  'review.uncounted.week': {
    one: '{count} और ट्रेड अभी खुला है या मेरे आँकड़ों से बाहर है, इसलिए न ये आँकड़े उसे गिनते हैं, न दिनों की पंक्तियाँ।',
    other:
      '{count} और ट्रेड अभी खुले हैं या मेरे आँकड़ों से बाहर हैं, इसलिए न ये आँकड़े उन्हें गिनते हैं, न दिनों की पंक्तियाँ।',
  },
  'review.pct': 'मेरे बैलेंस का {pct}',
  'review.days': 'दिन-ब-दिन:',
  'review.dayLine': '{day}: {trades}, {result}',
  'review.wonLost': 'जीते {won}, हारे {lost}',
  'review.flagged': 'पूरे ब्योरे में, वे ट्रेड जिनमें कोई नियम टूटा या कोई गलती हुई:',
  'review.flagged.none': 'किसी ट्रेड में न कोई नियम टूटा, न कोई गलती हुई।',
  'review.flagged.rest': {
    one: 'बाकी {count} ट्रेड सिर्फ़ ऊपर दिनों की पंक्तियों में है।',
    other: 'बाकी {count} ट्रेड सिर्फ़ ऊपर दिनों की पंक्तियों में हैं।',
  },

  'review.trade': '{symbol}, {side}, {date}',
  'review.times': '{open} पर खुला, {close} पर बंद, {hold} तक रखा।',
  'review.stillOpen': '{open} पर खुला, अभी खुला है।',
  'review.sizePrices': 'साइज़ {size}; एंट्री {entry}; एग्ज़िट {exit}।',
  'review.prices': 'एंट्री {entry}; एग्ज़िट {exit}।',
  'review.sizeEntry': 'साइज़ {size}; एंट्री {entry}।',
  'review.entry': 'एंट्री {entry}।',
  'review.stop': 'स्टॉप {stop}।',
  'review.stopTarget': 'स्टॉप {stop}; टारगेट {target}।',
  'review.noStop': 'कोई स्टॉप नहीं।',
  'review.result': 'नतीजा: {result}।',
  'review.rAndAmount': '{r}, {amount}',
  'review.afterFees': '{result}, {fees} फ़ीस के बाद',
  'review.win': 'जीत',
  'review.loss': 'हार',
  'review.even': 'बराबर',
  'review.setup': 'सेटअप: {name}।',
  'review.ruleSep': '; ',
  'review.kept': 'पालन हुए नियम: {rules}।',
  'review.broken': 'टूटे नियम: {rules}।',
  'review.unticked': 'बिना निशान के नियम: {rules}।',
  'review.noTicks': 'इसके नियमों पर निशान नहीं लगाए गए।',
  'review.mistakes': 'गलतियाँ: {list}।',
  'review.tags': 'टैग: {list}।',
  'review.ratings': '5 में से मेरी रेटिंग: {list}।',
  'review.session': 'सेशन: {session}।',
  'review.notes': 'नोट्स: {notes}',
  'review.excluded': 'मैंने इसे अपने आँकड़ों से बाहर रखा।',

  'review.mine': 'मेरे अपने नियम, जिनके हिसाब से आँकना है:',
  'review.rules': '{name}: {rules}।',
  'review.noRules': '{name}: अभी कोई नियम नहीं लिखा।',
  'review.mistakeList': 'जिन गलतियों पर मेरी नज़र रहती है: {list}।',
  'review.goals': 'मेरे लक्ष्य: {list}।',
  'review.note':
    'मेरे ट्रेडिंग कोच की तरह इन ट्रेडों की समीक्षा करें। हर ट्रेड को उसके नतीजे पर नहीं, उसकी प्रक्रिया पर आँकें: हर ट्रेड के लिए एक पंक्ति, वजह के साथ, ऊपर दिए मेरे अपने नियमों और गलतियों के हिसाब से, ट्रेडिंग की आम सलाह के हिसाब से नहीं। फिर एक चीज़ बताएँ जो मुझे करते रहनी चाहिए और एक जो बदलनी चाहिए।',

  'review.copy': 'समीक्षा के लिए कॉपी करें',
  'review.copyTrade': 'यह ट्रेड समीक्षा के लिए कॉपी करें',
  'review.copyWeek': 'यह हफ़्ता समीक्षा के लिए कॉपी करें',
  'review.copyWeekOf': '{week} का हफ़्ता समीक्षा के लिए कॉपी करें',
  'review.copyDay': 'यह दिन समीक्षा के लिए कॉपी करें',
  'review.dialog':
    'इसे किसी भी एआई चैट में पेस्ट करें, या किसी मेंटर को भेजें। ऐप कुछ नहीं भेजता: टेक्स्ट सिर्फ़ वहीं जाता है जहाँ आप उसे पेस्ट करते हैं।',
  'review.leaveOut': 'रकम हटाएँ',
  'review.leaveOut.hint':
    'रकम, साइज़ और फ़ीस की जगह R और आपके बैलेंस का %, ताकि आपके खाते का आकार आपके पास ही रहे। आपके नोट्स वैसे ही जाते हैं जैसे आपने लिखे।',
  'review.leaveOut.hidden': 'रकम छिपी है (हेडर में आँख का निशान), इसलिए यहाँ भी हटा दी गई है।',
  'review.text': 'टेक्स्ट',
  'review.copied': 'कॉपी हो गया। जहाँ चाहें पेस्ट करें।',
  'review.failed':
    'इस डिवाइस ने ऐप को कॉपी नहीं करने दिया। टेक्स्ट चुना हुआ है: Ctrl+C से कॉपी करें, या फ़ोन पर उसे दबाकर रखें।',
};
