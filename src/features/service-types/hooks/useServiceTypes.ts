import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { ServiceType } from '@/lib/supabase';

export type ServiceTypeInput = Pick<ServiceType, 'name' | 'short_code' | 'description'>;

export function useServiceTypes() {
  const { profile } = useAuthStore();

  return useQuery({
    queryKey: ['service_types', profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('name');
      if (error) throw error;
      return data as ServiceType[];
    },
  });
}

export function useCreateServiceType() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async (input: ServiceTypeInput) => {
      const { data, error } = await supabase
        .from('service_types')
        .insert({ ...input, company_id: profile!.company_id! })
        .select()
        .single();
      if (error) throw error;
      return data as ServiceType;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service_types'] }),
  });
}

export function useUpdateServiceType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ServiceTypeInput> & { id: string }) => {
      const { error } = await supabase
        .from('service_types')
        .update(input)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service_types'] }),
  });
}

export function useToggleServiceType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('service_types')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service_types'] }),
  });
}
