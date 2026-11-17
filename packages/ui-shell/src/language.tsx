'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * The page language, chosen by the person and remembered in this browser. Everything is in the
 * app itself: switching never calls the API. Urdu and Arabic read right to left inside the
 * content and the menu, while the frame stays where it is.
 */

export interface LanguageOption {
  code: string;
  /** The language's own name, such as اردو. */
  name: string;
  dir: 'ltr' | 'rtl';
}

interface LanguageState {
  locale: string;
  dir: 'ltr' | 'rtl';
  options: readonly LanguageOption[];
  setLocale: (code: string) => void;
}

const STORAGE_KEY = 'knazawy.locale';

const LanguageContext = createContext<LanguageState>({
  locale: 'en',
  dir: 'ltr',
  options: [{ code: 'en', name: 'English', dir: 'ltr' }],
  setLocale: () => undefined,
});

export function LanguageProvider({
  options,
  children,
}: {
  options: readonly LanguageOption[];
  children: ReactNode;
}) {
  const fallback = options[0]?.code ?? 'en';
  const [locale, setLocaleState] = useState(fallback);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && options.some((option) => option.code === saved)) setLocaleState(saved);
    } catch {
      // Storage can be blocked; the page stays in the default language.
    }
  }, [options]);

  const dir = options.find((option) => option.code === locale)?.dir ?? 'ltr';

  useEffect(() => {
    document.documentElement.lang = locale;
    // The frame (header, sidebar) keeps its place in every language: the page stays left to
    // right, and each app sets `dir` on its content and menu text instead.
    document.documentElement.dir = 'ltr';
  }, [locale]);

  const value = useMemo<LanguageState>(
    () => ({
      locale,
      dir,
      options,
      setLocale: (code) => {
        if (!options.some((option) => option.code === code)) return;
        setLocaleState(code);
        try {
          window.localStorage.setItem(STORAGE_KEY, code);
        } catch {
          // Remembering is a convenience only.
        }
      },
    }),
    [locale, dir, options],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageState {
  return useContext(LanguageContext);
}

/** The copy for the current language, falling back to the first language for a missing one. */
export function useCopy<T>(copy: Readonly<Record<string, T>>): T {
  const { locale, options } = useLanguage();
  const first = options[0]?.code ?? 'en';
  return (copy[locale] ?? copy[first]) as T;
}

/** A select that switches the page language. */
export function LanguageSwitcher({ label, className }: { label: string; className?: string }) {
  const { locale, options, setLocale } = useLanguage();
  return (
    <label className={`kz-language${className ? ` ${className}` : ''}`}>
      <span className="kz-language-label">{label}</span>
      <select value={locale} onChange={(event) => setLocale(event.target.value)} aria-label={label}>
        {options.map((option) => (
          <option key={option.code} value={option.code} lang={option.code}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
