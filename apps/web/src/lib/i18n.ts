'use client';

import { chromeCopy, commonCopy, translateLabel } from '@knazawy/i18n';
import { useCopy, useLanguage } from '@knazawy/ui-shell';

export { fill } from '@knazawy/i18n';
export { useCopy } from '@knazawy/ui-shell';

/** Menu words and other copy shared by every screen, in the chosen language. */
export function useCommon() {
  return useCopy(commonCopy);
}

/** Header, menus, and workspace copy. */
export function useChrome() {
  return useCopy(chromeCopy);
}

/** Translates a shared English label, such as REQUEST_STATUS_LABELS[status]. */
export function useLabel(): (english: string) => string {
  const { locale } = useLanguage();
  return (english) => translateLabel(english, locale);
}
