import { defineCopy } from '../copy';

export const portalDeliveriesCopy = defineCopy({
  en: {
    intro:
      'What Karam has sent for your flights, and what was signed for on arrival. You only see your own airline.',
    loadFailed: 'Deliveries could not load.',
    empty: 'Nothing has gone into production yet.',
    summary: '{request}, flight {flight} {route}, {date}, {point}',
    item: 'Item',
    ordered: 'Ordered',
    sent: 'Sent',
    received: 'Received',
  },
  ur: {
    intro:
      'کرم نے آپ کی پروازوں کے لیے کیا بھیجا، اور پہنچنے پر کس چیز کی وصولی پر دستخط ہوئے۔ آپ صرف اپنی ایئر لائن دیکھتے ہیں۔',
    loadFailed: 'ترسیلات نہیں کھل سکیں۔',
    empty: 'ابھی تک کچھ تیاری میں نہیں گیا۔',
    summary: '{request}، پرواز {flight} {route}، {date}، {point}',
    item: 'آئٹم',
    ordered: 'آرڈر کیا',
    sent: 'بھیجا',
    received: 'وصول ہوا',
  },
  ar: {
    intro:
      'ما أرسلته كرم لرحلاتكم، وما تم التوقيع على استلامه عند الوصول. لا ترون إلا بيانات شركتكم.',
    loadFailed: 'تعذّر تحميل عمليات التسليم.',
    empty: 'لم يدخل أي طلب مرحلة التحضير بعد.',
    summary: '{request}، الرحلة {flight} {route}، {date}، {point}',
    item: 'الصنف',
    ordered: 'المطلوب',
    sent: 'المُرسَل',
    received: 'المُستلَم',
  },
});
