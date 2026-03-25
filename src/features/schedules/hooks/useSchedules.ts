import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { Schedule, ScheduleStatus } from '@/lib/supabase';

export interface ScheduleWithRelations extends Schedule {
  users: { full_name: string } | null;
  clients: { name: string } | null;
  service_types: { name: string; short_code: string | null } | null;
  authorizations: { auth_number: string } | null;
}

export interface ScheduleInput {
  employee_id: string;
  client_id: string;
  authorization_id: string | null;
  service_type_id: string | null;
  start_time: string;
  end_time: string;
  notes: string | null;
}

export interface ScheduleFilters {
  employeeId?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: ScheduleStatus;
}

export function useSchedules(filters: ScheduleFilters = {}) {
  const { profile } = useAuthStore();

  return useQuery({
    queryKey: ['schedules', profile?.company_id, filters],
    enabled: !!profile?.company_id,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      let query = supabase
        .from('schedules')
        .select('*, users!schedules_employee_id_fkey(full_name), clients(name), service_types(name, short_code), authorizations(auth_number)')
        .eq('company_id', profile!.company_id!)
        .order('start_time', { ascending: true });

      if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
      if (filters.clientId)   query = query.eq('client_id', filters.clientId);
      if (filters.status)     query = query.eq('status', filters.status);
      if (filters.dateFrom)   query = query.gte('start_time', filters.dateFrom);
      if (filters.dateTo)     query = query.lte('start_time', filters.dateTo);

      const { data, error } = await query;
      if (error) throw error;
      return data as ScheduleWithRelations[];
    },
  });
}

export function useMySchedules() {
  const { profile } = useAuthStore();

  return useQuery({
    queryKey: ['schedules', 'mine', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekOut = new Date(today.getTime() + 7 * 86400000);

      const { data, error } = await supabase
        .from('schedules')
        .select('*, clients(name), service_types(name, short_code), authorizations(auth_number)')
        .eq('employee_id', profile!.id)
        .gte('start_time', today.toISOString())
        .lte('start_time', weekOut.toISOString())
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data as ScheduleWithRelations[];
    },
  });
}

export function useSchedule(id: string) {
  return useQuery({
    queryKey: ['schedule', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('*, users!schedules_employee_id_fkey(full_name), clients(name), service_types(name, short_code), authorizations(auth_number, authorized_units, start_date, end_date)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as ScheduleWithRelations;
    },
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async (input: ScheduleInput) => {
      const { data, error } = await supabase
        .from('schedules')
        .insert({
          ...input,
          company_id: profile!.company_id!,
          status: 'scheduled',
          created_by: profile!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Schedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ScheduleInput> & { id: string }) => {
      const { error } = await supabase
        .from('schedules')
        .update(input)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule', vars.id] });
    },
  });
}

export function useCancelSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('schedules')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule', id] });
    },
  });
}
