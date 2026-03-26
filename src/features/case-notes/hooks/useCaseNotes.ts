import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { VisitNote, VisitNoteStatus } from '@/lib/supabase';

// ── Query keys ────────────────────────────────────────────────
const KEYS = {
  bySchedule: (id: string) => ['visit_notes', id] as const,
  reviewQueue: (companyId: string) => ['visit_notes', 'review', companyId] as const,
};

// ── Read ──────────────────────────────────────────────────────

/** All notes for a schedule (employee view). */
export function useCaseNotesBySchedule(scheduleId: string) {
  return useQuery({
    queryKey: KEYS.bySchedule(scheduleId),
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

/** Admin review queue — submitted notes awaiting review. */
export function useCaseNoteReviewQueue() {
  const { profile } = useAuthStore();
  const companyId = profile?.company_id ?? '';

  return useQuery({
    queryKey: KEYS.reviewQueue(companyId),
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_notes')
        .select(`
          *,
          schedules (
            id, start_time, end_time, status,
            clients ( id, name ),
            users ( id, full_name )
          )
        `)
        .eq('company_id', companyId)
        .in('status', ['submitted', 'revision_requested'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Array<VisitNote & {
        schedules: {
          id: string;
          start_time: string;
          end_time: string;
          status: string;
          clients: { id: string; name: string } | null;
          users: { id: string; full_name: string } | null;
        } | null;
      }>;
    },
  });
}

// ── Write ─────────────────────────────────────────────────────

export type CaseNoteInput = {
  schedule_id: string;
  body: string;
  goals_addressed?: string | null;
  client_response?: string | null;
  next_steps?: string | null;
  supervisor_notified?: boolean;
  template_id?: string | null;
  template_data?: Record<string, unknown> | null;
  photo_urls?: string[];
};

export function useCreateCaseNote() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async (input: CaseNoteInput & { status: VisitNoteStatus }) => {
      const { data, error } = await supabase
        .from('visit_notes')
        .insert({
          ...input,
          author_id: profile!.id,
          company_id: profile!.company_id!,
          is_draft: input.status === 'draft',
          photo_urls: input.photo_urls ?? [],
        })
        .select()
        .single();
      if (error) throw error;
      return data as VisitNote;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: KEYS.bySchedule(vars.schedule_id) });
    },
  });
}

export function useUpdateCaseNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      schedule_id,
      ...input
    }: Partial<CaseNoteInput> & { id: string; schedule_id: string; status?: VisitNoteStatus }) => {
      const patch: Record<string, unknown> = { ...input };
      if (input.status !== undefined) {
        patch.is_draft = input.status === 'draft';
      }
      const { error } = await supabase
        .from('visit_notes')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: KEYS.bySchedule(vars.schedule_id) });
    },
  });
}

/** Admin: approve a submitted note. */
export function useApproveNote() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase
        .from('visit_notes')
        .update({
          status: 'approved',
          is_draft: false,
          reviewed_by: profile!.id,
          reviewed_at: new Date().toISOString(),
          review_comment: null,
        })
        .eq('id', id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => {
      queryClient.invalidateQueries({ queryKey: KEYS.reviewQueue(companyId) });
    },
  });
}

/** Admin: reject a note with a comment. */
export function useRejectNote() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async ({
      id,
      companyId,
      comment,
    }: { id: string; companyId: string; comment: string }) => {
      const { error } = await supabase
        .from('visit_notes')
        .update({
          status: 'rejected',
          reviewed_by: profile!.id,
          reviewed_at: new Date().toISOString(),
          review_comment: comment,
        })
        .eq('id', id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => {
      queryClient.invalidateQueries({ queryKey: KEYS.reviewQueue(companyId) });
    },
  });
}

/** Admin: request revision with a comment. */
export function useRequestRevision() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async ({
      id,
      companyId,
      comment,
    }: { id: string; companyId: string; comment: string }) => {
      const { error } = await supabase
        .from('visit_notes')
        .update({
          status: 'revision_requested',
          is_draft: true,
          reviewed_by: profile!.id,
          reviewed_at: new Date().toISOString(),
          review_comment: comment,
        })
        .eq('id', id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => {
      queryClient.invalidateQueries({ queryKey: KEYS.reviewQueue(companyId) });
    },
  });
}
