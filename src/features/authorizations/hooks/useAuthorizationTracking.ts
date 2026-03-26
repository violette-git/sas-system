import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { Authorization } from '@/lib/supabase';

export interface AuthorizationUsage extends Authorization {
  usedUnits:        number;
  remainingUnits:   number;
  percentUsed:      number;
  isNearLimit:      boolean;  // > 80%
  isOverLimit:      boolean;  // > 100%
  service_type_name?: string;
}

// Shape returned by Supabase join
interface AuthQueryRow extends Omit<Authorization, 'id'> {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join result
  service_types: any;
}

export function useAuthorizationUsage(clientId: string | null) {
  const { profile } = useAuthStore();

  return useQuery<AuthorizationUsage[]>({
    queryKey: ['authorization_usage', clientId],
    enabled: !!clientId && !!profile?.company_id,
    queryFn: async () => {
      // 1. Fetch active authorizations for client
      const { data: auths, error: authErr } = await supabase
        .from('authorizations')
        .select('*, service_types(name)')
        .eq('client_id', clientId!)
        .eq('company_id', profile!.company_id!)
        .eq('is_active', true);
      if (authErr) throw authErr;

      const results: AuthorizationUsage[] = [];

      for (const rawAuth of (auths ?? [])) {
        const auth = rawAuth as unknown as AuthQueryRow;

        // 2. Sum billable_units from time_entries via schedules in auth date range
        const { data: schedules } = await supabase
          .from('schedules')
          .select('id')
          .eq('client_id', clientId!)
          .eq('service_type_id', auth.service_type_id)
          .gte('start_time', auth.start_date)
          .lte('start_time', auth.end_date + 'T23:59:59');

        let usedUnits = 0;
        const scheduleIds = (schedules ?? []).map(s => s.id);
        if (scheduleIds.length > 0) {
          const { data: entries } = await supabase
            .from('time_entries')
            .select('billable_units')
            .in('schedule_id', scheduleIds);
          usedUnits = (entries ?? []).reduce(
            (s, e) => s + (e.billable_units ?? 0),
            0,
          );
        }

        const authorized  = auth.authorized_units;
        const remaining   = Math.max(0, authorized - usedUnits);
        const pct         = authorized > 0 ? (usedUnits / authorized) * 100 : 0;

        results.push({
          id:               auth.id,
          company_id:       auth.company_id,
          client_id:        auth.client_id,
          service_type_id:  auth.service_type_id,
          auth_number:      auth.auth_number,
          authorized_units: auth.authorized_units,
          start_date:       auth.start_date,
          end_date:         auth.end_date,
          notes:            auth.notes,
          is_active:        auth.is_active,
          service_type_name: (auth.service_types?.name as string | undefined),
          usedUnits,
          remainingUnits: remaining,
          percentUsed:    pct,
          isNearLimit:    pct >= 80 && pct < 100,
          isOverLimit:    pct >= 100,
        });
      }

      return results;
    },
    staleTime: 60_000,
  });
}

export function useCompanyAuthorizationAlerts() {
  const { profile } = useAuthStore();
  const today = new Date().toISOString().slice(0, 10);
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  return useQuery<Array<{ auth_number: string; client_name: string; end_date: string }>>({
    queryKey: ['authorization_alerts', profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('authorizations')
        .select('auth_number, end_date, clients(name)')
        .eq('company_id', profile!.company_id!)
        .eq('is_active', true)
        .lte('end_date', in30Days.toISOString().slice(0, 10))
        .gte('end_date', today)
        .order('end_date');
      if (error) throw error;
      return (data ?? []).map(a => ({
        auth_number: a.auth_number,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join result
        client_name: ((a as any).clients?.name as string | undefined) ?? 'Unknown',
        end_date:    a.end_date,
      }));
    },
    staleTime: 300_000,
  });
}
