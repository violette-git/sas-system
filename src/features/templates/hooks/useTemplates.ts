import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { Template, TemplateField } from '@/lib/supabase';

const KEYS = {
  list: (companyId: string) => ['templates', companyId] as const,
  single: (id: string) => ['templates', 'single', id] as const,
};

export function useTemplates() {
  const { profile } = useAuthStore();
  const companyId = profile?.company_id ?? '';

  return useQuery({
    queryKey: KEYS.list(companyId),
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return data as Template[];
    },
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: KEYS.single(id),
    enabled: !!id && id !== 'new',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Template;
    },
  });
}

export type TemplateInput = {
  name: string;
  description?: string | null;
  service_type_id?: string | null;
  fields: TemplateField[];
  is_active?: boolean;
};

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async (input: TemplateInput) => {
      const { data, error } = await supabase
        .from('templates')
        .insert({
          ...input,
          company_id: profile!.company_id!,
          created_by: profile!.id,
          is_active: input.is_active ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: TemplateInput & { id: string }) => {
      const { data, error } = await supabase
        .from('templates')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Template;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.setQueryData(KEYS.single(data.id), data);
    },
  });
}

export function useDeactivateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('templates')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}
