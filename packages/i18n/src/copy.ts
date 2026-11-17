/**
 * Copy for one screen in every language. English is the reference: the compiler makes Urdu and
 * Arabic carry exactly the same keys, so a screen can never show a missing line.
 */

export const LOCALES = ['en', 'ur', 'ar'] as const;

export type Locale = (typeof LOCALES)[number];

export const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'ur', name: 'اردو', dir: 'rtl' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
] as const satisfies ReadonlyArray<{ code: Locale; name: string; dir: 'ltr' | 'rtl' }>;

export type CopyOf<E> = { readonly [K in keyof E]: string };

export type ScreenCopy<E extends Record<string, string>> = {
  readonly en: E;
  readonly ur: CopyOf<E>;
  readonly ar: CopyOf<E>;
};

export function defineCopy<E extends Record<string, string>>(copy: ScreenCopy<E>): ScreenCopy<E> {
  return copy;
}

/** Fills {name} placeholders: fill('Hello {name}', { name: 'Ali' }). */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
