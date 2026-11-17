import { defineCopy } from '../copy';

export const portalLedgerCopy = defineCopy({
  en: {
    intro: 'What your airline has been charged, as it was posted. You only see your own airline.',
    loadFailed: 'The ledger could not load.',
    empty: 'Nothing has been posted yet.',
    account: 'Account',
    side: 'Side',
    amount: 'Amount',
  },
  ur: {
    intro:
      'آپ کی ایئر لائن سے جو رقم وصول کی گئی، جیسے درج ہوئی۔ آپ صرف اپنی ایئر لائن دیکھتے ہیں۔',
    loadFailed: 'کھاتہ نہیں کھل سکا۔',
    empty: 'ابھی تک کچھ درج نہیں ہوا۔',
    account: 'کھاتہ',
    side: 'جانب',
    amount: 'رقم',
  },
  ar: {
    intro: 'ما تم تحصيله من شركتكم كما قُيِّد. لا ترون إلا بيانات شركتكم.',
    loadFailed: 'تعذّر تحميل دفتر القيود.',
    empty: 'لم يُقيَّد أي شيء بعد.',
    account: 'الحساب',
    side: 'الجانب',
    amount: 'المبلغ',
  },
});
