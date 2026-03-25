import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { TimeEntry } from '@/lib/supabase';

export function useActiveTimeEntry() {
  const { profile } = useAuthStore();

  return useQuery({
    queryKey: ['time_entries', 'active', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', profile!.id)
        .is('clocked_out_at', null)
        .maybeSingle();
      if (error) throw error;
      return data as TimeEntry | null;
    },
  });
}

export function useTimeEntriesForSchedule(scheduleId: string) {
  return useQuery({
    queryKey: ['time_entries', 'schedule', scheduleId],
    enabled: !!scheduleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('clocked_in_at', { ascending: true });
      if (error) throw error;
      return data as TimeEntry[];
    },
  });
}

export interface ClockInInput {
  schedule_id: string;
  lat?: number | null;
  lon?: number | null;
}

export function useClockIn() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async ({ schedule_id, lat, lon }: ClockInInput) => {
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          schedule_id,
          employee_id: profile!.id,
          company_id: profile!.company_id!,
          clocked_in_at: new Date().toISOString(),
          clocked_in_lat: lat ?? null,
          clocked_in_lon: lon ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['time_entries', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['time_entries', 'schedule', vars.schedule_id] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export interface ClockOutInput {
  id: string;
  schedule_id: string;
  lat?: number | null;
  lon?: number | null;
}

export function useClockOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, lat, lon }: ClockOutInput) => {
      const { error } = await supabase
        .from('time_entries')
        .update({
          clocked_out_at: new Date().toISOString(),
          clocked_out_lat: lat ?? null,
          clocked_out_lon: lon ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['time_entries', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['time_entries', 'schedule', vars.schedule_id] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['authorization_utilization'] });
    },
  });
}
