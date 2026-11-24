import { defineCopy } from '../copy';

export const stockOnHandCopy = defineCopy({
  en: {
    loading: 'Loading stock',
    signInSuffix: 'to see stock.',
    intro:
      'What is in each location, what is running low, and the goods that came in. Goods come in two ways: from a supplier bill, or against a purchase order.',
    lowStockHelp:
      'At or below the reorder level set on the item. Buy these before taking large orders.',
    item: 'Item',
    inStock: 'In stock',
    reorderLevel: 'Reorder level',
    nothingInStock: 'Nothing is in stock yet.',
    location: 'Location',
    quantity: 'Quantity',
    goodsReceived: 'Goods received',
    noGoodsReceived: 'No goods received yet.',
    number: 'Number',
    purchase: 'Purchase',
    bill: 'Bill',
    received: 'Received',
    lines: 'Lines',
    view: 'View',
    receiptLine: '{item}: {quantity} {purchaseUnit} ({quantityBase} {unit} at {unitCost} SAR)',
  },
  ur: {
    loading: 'اسٹاک لوڈ ہو رہا ہے',
    signInSuffix: 'تاکہ اسٹاک دیکھ سکیں۔',
    intro:
      'ہر جگہ پر کیا موجود ہے، کیا کم ہو رہا ہے، اور کون سا مال آیا۔ مال دو طریقوں سے آتا ہے: سپلائر کے بل سے، یا خریداری آرڈر کے تحت۔',
    lowStockHelp:
      'آئٹم پر مقرر دوبارہ آرڈر کی حد کے برابر یا اس سے کم۔ بڑے آرڈر لینے سے پہلے یہ خرید لیں۔',
    item: 'آئٹم',
    inStock: 'اسٹاک میں',
    reorderLevel: 'دوبارہ آرڈر کی حد',
    nothingInStock: 'ابھی اسٹاک میں کچھ نہیں ہے۔',
    location: 'جگہ',
    quantity: 'مقدار',
    goodsReceived: 'وصول شدہ مال',
    noGoodsReceived: 'ابھی کوئی مال وصول نہیں ہوا۔',
    number: 'نمبر',
    purchase: 'خریداری',
    bill: 'بل',
    received: 'وصولی',
    lines: 'سطریں',
    view: 'دیکھیں',
    receiptLine:
      '{item}: {quantity} {purchaseUnit} ({quantityBase} {unit}، {unitCost} SAR فی یونٹ)',
  },
  ar: {
    loading: 'جارٍ تحميل المخزون',
    signInSuffix: 'لعرض المخزون.',
    intro:
      'ما يوجد في كل موقع، وما يوشك على النفاد، والبضائع الواردة. ترد البضائع بطريقتين: من فاتورة مورد، أو مقابل أمر شراء.',
    lowStockHelp:
      'عند حد إعادة الطلب المحدد للصنف أو أقل منه. اشترِ هذه الأصناف قبل قبول طلبات كبيرة.',
    item: 'الصنف',
    inStock: 'في المخزون',
    reorderLevel: 'حد إعادة الطلب',
    nothingInStock: 'لا يوجد شيء في المخزون بعد.',
    location: 'الموقع',
    quantity: 'الكمية',
    goodsReceived: 'البضائع المستلمة',
    noGoodsReceived: 'لم تُستلم أي بضائع بعد.',
    number: 'الرقم',
    purchase: 'الشراء',
    bill: 'الفاتورة',
    received: 'تاريخ الاستلام',
    lines: 'البنود',
    view: 'عرض',
    receiptLine: '{item}: {quantity} {purchaseUnit} ({quantityBase} {unit} بسعر {unitCost} SAR)',
  },
});
