import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';

export interface AvailabilityRecord {
  id: string;
  company_id: string;
  employee_id: string;
  /** 0=Sun … 6=Sat */
  day_of_week: number;
  start_time: string | null;   // 'HH:MM:SS'
  end_time: string | null;
  is_available: boolean;
  effective_from: string | null;
  effective_to: string | null;
  note: string | null;
}

export interface TimeOffRecord {
  id: string;
  company_id: string;
  employee_id: string;
  /** null day_of_week means it's a specific date-range entry */
  day_of_week: number | null;
  is_available: false;
  effective_from: string;
  effective_to: string;
  note: string | null;
  start_time: null;
  end_time: null;
}

// ── Fetch all availability for an employee ────────────────────────────────────

export function useAvailability(employeeId?: string) {
  const { profile } = useAuthStore();
  const empId = employeeId ?? profile?.id;

  return useQuery({
    queryKey: ['availability', profile?.company_id, empId],
    enabled: !!profile?.company_id && !!empId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('availability')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .eq('employee_id', empId!)
        .order('day_of_week', { ascending: true });
      if (error) throw error;
      return data as AvailabilityRecord[];
    },
  });
}

// ── Fetch weekly schedule (day_of_week rows) ──────────────────────────────────

export function useWeeklyAvailability(employeeId?: string) {
  const { profile } = useAuthStore();
  const empId = employeeId ?? profile?.id;

  return useQuery({
    queryKey: ['availability', 'weekly', profile?.company_id, empId],
    enabled: !!profile?.company_id && !!empId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('availability')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .eq('employee_id', empId!)
        .not('day_of_week', 'is', null)
        .is('effective_from', null) // recurring schedule rows
        .order('day_of_week', { ascending: true });
      if (error) throw error;
      return data as AvailabilityRecord[];
    },
  });
}

// ── Fetch time-off requests ────────────────────────────────────────────────────

export function useTimeOffRequests(employeeId?: string) {
  const { profile } = useAuthStore();
  const empId = employeeId ?? profile?.id;

  return useQuery({
    queryKey: ['availability', 'timeoff', profile?.company_id, empId],
    enabled: !!profile?.company_id && !!empId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('availability')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .eq('employee_id', empId!)
        .eq('is_available', false)
        .not('effective_from', 'is', null)
        .order('effective_from', { ascending: true });
      if (error) throw error;
      return data as AvailabilityRecord[];
    },
  });
}

// ── Upsert a weekly availability slot ────────────────────────────────────────

export interface AvailabilityUpsert {
  day_of_week: number;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  note?: string | null;
}

export function useUpsertAvailability() {
  const qc = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async (input: AvailabilityUpsert) => {
      // Try update first (matching employee + day_of_week + no effective_from)
      const { data: existing } = await supabase
        .from('availability')
        .select('id')
        .eq('company_id', profile!.company_id!)
        .eq('employee_id', profile!.id)
        .eq('day_of_week', input.day_of_week)
        .is('effective_from', null)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('availability')
          .update({
            start_time:   input.start_time,
            end_time:     input.end_time,
            is_available: input.is_available,
            note:         input.note ?? null,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('availability')
          .insert({
            company_id:   profile!.company_id!,
            employee_id:  profile!.id,
            day_of_week:  input.day_of_week,
            start_time:   input.start_time,
            end_time:     input.end_time,
            is_available: input.is_available,
            note:         input.note ?? null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability'] }),
  });
}

// ── Create time-off request ───────────────────────────────────────────────────

export interface TimeOffInput {
  effective_from: string;  // YYYY-MM-DD
  effective_to: string;
  note: string | null;
}

export function useCreateTimeOff() {
  const qc = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async (input: TimeOffInput) => {
      const { error } = await supabase
        .from('availability')
        .insert({
          company_id:    profile!.company_id!,
          employee_id:   profile!.id,
          day_of_week:   null,
          is_available:  false,
          effective_from: input.effective_from,
          effective_to:  input.effective_to,
          note:          input.note,
        });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability'] }),
  });
}

// ── Delete availability / time-off row ────────────────────────────────────────

export function useDeleteAvailability() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('availability').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability'] }),
  });
}
