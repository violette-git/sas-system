import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { UserProfile, UserRole } from '@/lib/supabase';

export function useEmployees() {
  const { profile } = useAuthStore();

  return useQuery({
    queryKey: ['employees', profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('full_name');
      if (error) throw error;
      return data as UserProfile[];
    },
  });
}

// ── Invite a new employee via Edge Function ──────────────────
interface InviteEmployeeInput {
  full_name: string;
  email: string;
  role: Extract<UserRole, 'admin' | 'employee'>;
}

export function useInviteEmployee() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async (input: InviteEmployeeInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            ...input,
            company_id: profile!.company_id,
            redirect_to: `${process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:8081'}/(auth)/set-password`,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to send invite');
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}

// ── Toggle active/inactive ───────────────────────────────────
export function useToggleEmployee() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('users')
        .update({ is_active })
        .eq('id', id)
        .eq('company_id', profile!.company_id!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}
