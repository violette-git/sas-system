import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Company } from '@/lib/supabase';

// ── Fetch all companies (owner only) ────────────────────────
export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Company[];
    },
  });
}

// ── Create a new company ─────────────────────────────────────
interface CreateCompanyInput {
  name: string;
  trade_name?: string;
}

export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, trade_name }: CreateCompanyInput) => {
      // Generate access code via the DB function
      const { data: code, error: codeError } = await supabase
        .rpc('generate_access_code', { company_name: name });
      if (codeError) throw codeError;

      const { data, error } = await supabase
        .from('companies')
        .insert({ name, trade_name: trade_name || null, access_code: code })
        .select()
        .single();
      if (error) throw error;
      return data as Company;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  });
}

// ── Toggle a company active/inactive ────────────────────────
export function useToggleCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('companies')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  });
}
