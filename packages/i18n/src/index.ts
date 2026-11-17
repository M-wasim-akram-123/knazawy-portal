import type { CopyOf, Locale } from './copy';
import { ar } from './locales/ar';
import { en } from './locales/en';
import { ur } from './locales/ur';

export { LANGUAGE_OPTIONS, LOCALES, defineCopy, fill } from './copy';
export type { CopyOf, Locale, ScreenCopy } from './copy';

export const messages = { en, ur, ar } as const;

export type CommonCopy = CopyOf<(typeof en)['common']>;

/** The shared copy (menus, common words) in every language. */
export const commonCopy: Readonly<Record<Locale, CommonCopy>> = {
  en: en.common,
  ur: ur.common,
  ar: ar.common,
};

export { ar, en, ur };
export { translateLabel } from './labels';
export * from './screens';
