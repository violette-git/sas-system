/**
 * I18nProvider — initialises i18next and syncs the active language with
 * the authenticated company's default_language setting.
 *
 * Mount once in root _layout.tsx, inside OfflineProvider.
 */

import React, { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { type SupportedLanguage } from '@/i18n';
import { useAuthStore } from '@/features/auth/store/authStore';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { company } = useAuthStore();

  // When the company's default_language changes, update i18next
  useEffect(() => {
    const lang = (company as { default_language?: string } | null)?.default_language;
    if (lang && lang !== i18n.language) {
      i18n.changeLanguage(lang as SupportedLanguage);
    }
  }, [(company as { default_language?: string } | null)?.default_language]);

  return (
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  );
}
