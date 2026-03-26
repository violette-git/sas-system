import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';

export interface PayRate {
  id: string;
  employee_id: string;
  company_id: string;
  hourly_rate: number;
  overtime_rate: number;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  // joined
  users?: { full_name: string; email: string } | null;
}

export interface PayRateInput {
  employee_id: string;
  hourly_rate: number;
  overtime_rate: number;
  effective_from: string;
  effective_to?: string | null;
  notes?: string | null;
}

export function usePayRates() {
  const { profile } = useAuthStore();
  return useQuery<PayRate[]>({
    queryKey: ['pay_rates', profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pay_rates')
        .select('*, users!employee_id(full_name, email)')
        .eq('company_id', profile!.company_id!)
        .order('effective_from', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PayRate[];
    },
  });
}

export function useUpsertPayRate() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  return useMutation({
    mutationFn: async (input: PayRateInput) => {
      const { error } = await supabase.from('pay_rates').insert({
        ...input,
        company_id: profile!.company_id!,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pay_rates'] }),
  });
}

export function useDeletePayRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pay_rates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pay_rates'] }),
  });
}

/** Get the active pay rate for a specific employee (effective today) */
export function useEmployeePayRate(employeeId: string | null) {
  const { profile } = useAuthStore();
  const today = new Date().toISOString().slice(0, 10);
  return useQuery<PayRate | null>({
    queryKey: ['pay_rate_active', employeeId, today],
    enabled: !!employeeId && !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pay_rates')
        .select('*')
        .eq('employee_id', employeeId!)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PayRate | null;
    },
  });
}
