import { defineCopy } from '../copy';

export const forecastCopy = defineCopy({
  en: {
    loading: 'Loading forecast',
    signInToSee: 'to see the forecast.',
    restricted: 'The forecast is for operations, the kitchen, and administrators.',
    intro:
      'Expected meals and snacks for today and the next six days, per airline and item. Each day uses the same weekday over the last four weeks. Booked is what airlines have already asked for and Karam has accepted.',
    noData: 'No accepted requests in the last four weeks or the next seven days.',
    byAirlineAndItem: 'By airline and item',
    totalByItem: 'Total by item, all airlines',
    airline: 'Airline',
    item: 'Item',
    kind: 'Kind',
    booked: '{count} booked',
  },
  ur: {
    loading: 'پیش گوئی لوڈ ہو رہی ہے',
    signInToSee: 'تاکہ پیش گوئی دیکھ سکیں۔',
    restricted: 'پیش گوئی آپریشنز، کچن اور ایڈمنسٹریٹرز کے لیے ہے۔',
    intro:
      'آج اور اگلے چھ دنوں کے متوقع کھانے اور اسنیکس، ہر ایئر لائن اور آئٹم کے حساب سے۔ ہر دن کا اندازہ پچھلے چار ہفتوں کے اسی دن سے لگایا جاتا ہے۔ بک شدہ سے مراد وہ ہے جو ایئر لائنز مانگ چکی ہیں اور کرم نے قبول کر لیا ہے۔',
    noData: 'پچھلے چار ہفتوں یا اگلے سات دنوں میں کوئی قبول شدہ درخواست نہیں۔',
    byAirlineAndItem: 'ایئر لائن اور آئٹم کے حساب سے',
    totalByItem: 'آئٹم کے حساب سے کل، تمام ایئر لائنز',
    airline: 'ایئر لائن',
    item: 'آئٹم',
    kind: 'قسم',
    booked: '{count} بک شدہ',
  },
  ar: {
    loading: 'جارٍ تحميل التوقعات',
    signInToSee: 'لعرض التوقعات.',
    restricted: 'التوقعات مخصصة لقسم العمليات والمطبخ والمسؤولين.',
    intro:
      'الوجبات والوجبات الخفيفة المتوقعة لليوم والأيام الستة التالية، لكل شركة طيران وصنف. يُحسب كل يوم من اليوم نفسه من الأسبوع خلال الأسابيع الأربعة الماضية. المحجوز هو ما طلبته شركات الطيران وقبله كرم.',
    noData: 'لا توجد طلبات مقبولة في الأسابيع الأربعة الماضية أو الأيام السبعة القادمة.',
    byAirlineAndItem: 'حسب شركة الطيران والصنف',
    totalByItem: 'الإجمالي حسب الصنف، جميع شركات الطيران',
    airline: 'شركة الطيران',
    item: 'الصنف',
    kind: 'النوع',
    booked: '{count} محجوز',
  },
});
