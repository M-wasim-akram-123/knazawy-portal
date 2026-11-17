import { defineCopy } from '../copy';

export const portalRatesCopy = defineCopy({
  en: {
    intro:
      'The prices Karam has agreed with your airline. A request is charged on the card that covers its service date, for at least the minimum portions.',
    loadFailed: 'Rates could not load.',
    empty: 'Karam has not agreed a rate card with your airline yet.',
    appliesToday: 'Applies today',
    validRange: '{from} to {to}',
    validOpen: 'From {from}, no end date',
    item: 'Item',
    type: 'Type',
    price: 'Price',
    minimumPortions: 'Minimum portions',
  },
  ur: {
    intro:
      'وہ نرخ جو کرم نے آپ کی ایئر لائن کے ساتھ طے کیے ہیں۔ ہر درخواست کا بل اس ریٹ کارڈ پر بنتا ہے جو اس کی سروس کی تاریخ پر لاگو ہو، اور کم از کم مقررہ حصوں کے مطابق۔',
    loadFailed: 'نرخ نہیں کھل سکے۔',
    empty: 'کرم نے ابھی تک آپ کی ایئر لائن کے ساتھ کوئی ریٹ کارڈ طے نہیں کیا۔',
    appliesToday: 'آج لاگو ہے',
    validRange: '{from} سے {to} تک',
    validOpen: '{from} سے، کوئی اختتامی تاریخ نہیں',
    item: 'آئٹم',
    type: 'قسم',
    price: 'قیمت',
    minimumPortions: 'کم از کم حصے',
  },
  ar: {
    intro:
      'الأسعار التي اتفقت عليها كرم مع شركتكم. يُحتسب كل طلب حسب بطاقة الأسعار السارية في تاريخ الخدمة، وبما لا يقل عن الحد الأدنى من الحصص.',
    loadFailed: 'تعذّر تحميل الأسعار.',
    empty: 'لم تتفق كرم بعد على بطاقة أسعار مع شركتكم.',
    appliesToday: 'سارية اليوم',
    validRange: 'من {from} إلى {to}',
    validOpen: 'من {from}، بدون تاريخ انتهاء',
    item: 'الصنف',
    type: 'النوع',
    price: 'السعر',
    minimumPortions: 'الحد الأدنى من الحصص',
  },
});
