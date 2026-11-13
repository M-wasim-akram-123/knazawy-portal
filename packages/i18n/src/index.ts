import { en } from './locales/en';
import { ur } from './locales/ur';

export const LOCALES = ['en', 'ur'] as const;

export type Locale = (typeof LOCALES)[number];

export const messages = { en, ur } as const;

export { en, ur };
