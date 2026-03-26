import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import i18n, { type SupportedLanguage } from '@/i18n';

/**
 * useLanguage — returns the current language and a setter that persists
 * the choice to the company row (admin) or just updates i18n locally (employee).
 */
export function useLanguage() {
  const { profile, company, setCompany } = useAuthStore();
  const queryClient = useQueryClient();

  const currentLanguage = (i18n.language ?? 'en') as SupportedLanguage;

  const setLanguageMutation = useMutation({
    mutationFn: async (lang: SupportedLanguage) => {
      // Always update i18next immediately
      await i18n.changeLanguage(lang);

      // Admins/owners persist to company row
      if ((profile?.role === 'admin' || profile?.role === 'owner') && company?.id) {
        const { data, error } = await supabase
          .from('companies')
          .update({ default_language: lang } as Record<string, unknown>)
          .eq('id', company.id)
          .select()
          .single();
        if (error) throw error;
        setCompany(data as typeof company);
        queryClient.invalidateQueries({ queryKey: ['company', company.id] });
      }
    },
  });

  const setLanguage = useCallback(
    (lang: SupportedLanguage) => setLanguageMutation.mutateAsync(lang),
    [setLanguageMutation],
  );

  return {
    currentLanguage,
    setLanguage,
    isPending: setLanguageMutation.isPending,
  };
}
