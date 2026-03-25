import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { Authorization } from '@/lib/supabase';

export interface AuthorizationWithRelations extends Authorization {
  service_types: { name: string; short_code: string | null } | null;
  clients: { name: string } | null;
}

export interface AuthorizationUtilization {
  authorization_id: string;
  company_id: string;
  client_id: string;
  service_type_id: string;
  auth_number: string;
  authorized_units: number;
  authorized_hours: number;
  start_date: string;
  end_date: string;
  delivered_units: number;
  delivered_hours: number;
  remaining_units: number;
}

export type AuthorizationInput = Omit<Authorization, 'id' | 'company_id' | 'is_active'>;

export function useAuthorizations(clientId?: string) {
  const { profile } = useAuthStore();

  return useQuery({
    queryKey: ['authorizations', profile?.company_id, clientId],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      let query = supabase
        .from('authorizations')
        .select('*, service_types(name, short_code), clients(name)')
        .eq('company_id', profile!.company_id!)
        .order('end_date', { ascending: false });

      if (clientId) query = query.eq('client_id', clientId);

      const { data, error } = await query;
      if (error) throw error;
      return data as AuthorizationWithRelations[];
    },
  });
}

export function useAuthorizationUtilization(authorizationId: string) {
  return useQuery({
    queryKey: ['authorization_utilization', authorizationId],
    enabled: !!authorizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('authorization_utilization')
        .select('*')
        .eq('authorization_id', authorizationId)
        .single();
      if (error) throw error;
      return data as AuthorizationUtilization;
    },
  });
}

export function useCreateAuthorization() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async (input: AuthorizationInput) => {
      const { data, error } = await supabase
        .from('authorizations')
        .insert({ ...input, company_id: profile!.company_id! })
        .select()
        .single();
      if (error) throw error;
      return data as Authorization;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['authorizations'] }),
  });
}

export function useUpdateAuthorization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<AuthorizationInput> & { id: string }) => {
      const { error } = await supabase
        .from('authorizations')
        .update(input)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['authorizations'] }),
  });
}

export function useToggleAuthorization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('authorizations')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authorizations'] });
      queryClient.invalidateQueries({ queryKey: ['authorization_utilization'] });
    },
  });
}
