/**
 * i18n setup — i18next with English + Spanish.
 *
 * Initialised once at app start; language can be changed at runtime
 * via i18n.changeLanguage('es').
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './locales/en';
import es from './locales/es';

export type SupportedLanguage = 'en' | 'es';

export const SUPPORTED_LANGUAGES: Array<{ code: SupportedLanguage; label: string; nativeLabel: string }> = [
  { code: 'en', label: 'English',  nativeLabel: 'English'  },
  { code: 'es', label: 'Spanish',  nativeLabel: 'Español'  },
];

// Detect device locale, fall back to 'en'
function detectLocale(): SupportedLanguage {
  const locale = Localization.getLocales()[0]?.languageCode ?? 'en';
  return locale.startsWith('es') ? 'es' : 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng:           detectLocale(),
    fallbackLng:   'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    compatibilityJSON: 'v4',
  });

export default i18n;

// ── Typed translation helper ─────────────────────────────────
// Re-export the useTranslation hook from react-i18next so consumers
// get type-safe string lookups.
export { useTranslation } from 'react-i18next';
