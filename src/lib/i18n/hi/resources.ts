import type { resources as en } from '../en/resources';
import type { Translation } from '../types';

export const resources: Translation<typeof en> = {
  'res.description': 'टूल्स, फ़ीड और पढ़ने की चीज़ों की आपकी अपनी छोटी सूची। आपकी जगह कुछ भी नहीं जोड़ा जाता।',
  'res.add': 'संसाधन जोड़ें',
  'res.edit': 'संसाधन बदलें',
  'res.empty.title': 'कोई संसाधन सहेजा नहीं गया',
  'res.empty.text':
    'जो गिने-चुने लिंक आप सच में हर सेशन में खोलते हैं, उन्हें एक जगह रखें: आपका चार्टिंग प्लेटफ़ॉर्म, आर्थिक कैलेंडर, ब्रोकर का स्टेटमेंट पेज, वह किताब जो आप अभी पढ़ रहे हैं।',
  'res.empty.first': 'अपना पहला संसाधन जोड़ें',
  'res.removeNamed': '{name} हटाएँ',
  'res.remove.title': '"{name}" हटाएँ?',
  'res.remove.message': 'इससे बस यह लिंक आपकी संसाधन सूची से हट जाएगा।',
  'res.removed': 'संसाधन हटा दिया गया',
  'res.saved': 'संसाधन सहेजा गया',

  'res.titleRequired': 'इसे एक शीर्षक दें',
  'res.title': 'शीर्षक',
  'res.link': 'लिंक',
  'res.category': 'श्रेणी',
  'res.notesPlaceholder': 'आप इसे किस काम में लेते हैं',

  'res.cat.Charting': 'चार्टिंग',
  'res.cat.News & data': 'ख़बरें और डेटा',
  'res.cat.Education': 'शिक्षा',
  'res.cat.Broker': 'ब्रोकर',
  'res.cat.Tools': 'टूल्स',
  'res.cat.Reading': 'पढ़ने के लिए',
  'res.cat.Other': 'अन्य',
};
