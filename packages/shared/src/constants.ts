export const PRODUCT_NAME = 'Karam Restaurant Platform';

export const LOCALES = ['en', 'ur', 'ar'] as const;

export type Locale = (typeof LOCALES)[number];
