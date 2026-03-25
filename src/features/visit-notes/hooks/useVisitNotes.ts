import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { VisitNote } from '@/lib/supabase';

export type VisitNoteInput = Omit<VisitNote, 'id' | 'author_id' | 'company_id' | 'is_draft'>;

export function useVisitNotes(scheduleId: string) {
  return useQuery({
    queryKey: ['visit_notes', scheduleId],
    enabled: !!scheduleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_notes')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as VisitNote[];
    },
  });
}

export function useCreateVisitNote() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async (input: VisitNoteInput & { is_draft: boolean }) => {
      const { data, error } = await supabase
        .from('visit_notes')
        .insert({
          ...input,
          author_id: profile!.id,
          company_id: profile!.company_id!,
        })
        .select()
        .single();
      if (error) throw error;
      return data as VisitNote;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['visit_notes', vars.schedule_id] });
    },
  });
}

export function useUpdateVisitNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, schedule_id, ...input }: Partial<VisitNoteInput> & { id: string; schedule_id: string }) => {
      const { error } = await supabase
        .from('visit_notes')
        .update(input)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['visit_notes', vars.schedule_id] });
    },
  });
}

export function useSubmitVisitNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; schedule_id: string }) => {
      const { error } = await supabase
        .from('visit_notes')
        .update({ is_draft: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['visit_notes', vars.schedule_id] });
    },
  });
}
