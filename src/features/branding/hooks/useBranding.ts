import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { Company } from '@/lib/supabase';

export interface BrandingInput {
  primary_color?: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
  company_name_display?: string | null;
}

/** Updates branding fields on the company row and refreshes authStore. */
export function useUpdateBranding() {
  const queryClient = useQueryClient();
  const { company, setCompany } = useAuthStore();

  return useMutation({
    mutationFn: async (input: BrandingInput) => {
      if (!company?.id) throw new Error('No company');

      const { data, error } = await supabase
        .from('companies')
        .update(input)
        .eq('id', company.id)
        .select()
        .single();

      if (error) throw error;
      return data as Company;
    },
    onSuccess: (updated) => {
      setCompany(updated);
      queryClient.invalidateQueries({ queryKey: ['company', updated.id] });
    },
  });
}

/** Uploads a logo to Supabase Storage and returns the signed URL. */
export function useUploadLogo() {
  const { company } = useAuthStore();

  return useMutation({
    mutationFn: async (uri: string) => {
      if (!company?.id) throw new Error('No company');

      // Convert URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = blob.type.split('/')[1] ?? 'jpg';
      const path = `${company.id}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(path, blob, { upsert: true, contentType: blob.type });

      if (uploadError) throw uploadError;

      const { data } = await supabase.storage
        .from('logos')
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year

      return data?.signedUrl ?? null;
    },
  });
}
