import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';

export interface TimeEntryRow {
  id: string;
  schedule_id: string;
  employee_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  duration_minutes: number | null;
  billable_units: number | null;
  client_name?: string;
}

export interface TimesheetRow {
  employee_id: string;
  full_name: string;
  email: string;
  entries: TimeEntryRow[];
  totalMinutes: number;
  totalHours: number;
  regularHours: number;   // up to 40h/week
  overtimeHours: number;  // above 40h/week
  billableUnits: number;
}

export interface TimesheetFilters {
  weekStart: string; // YYYY-MM-DD (Sunday)
  weekEnd:   string; // YYYY-MM-DD (Saturday)
  employeeId?: string;
}

export interface PayPeriod {
  label: string;
  weekStart: string;
  weekEnd: string;
}

function getSundayWeeks(count = 13): PayPeriod[] {
  const weeks: PayPeriod[] = [];
  const today = new Date();
  // Find most recent Sunday
  const day = today.getDay(); // 0=Sun
  const thisSunday = new Date(today);
  thisSunday.setDate(today.getDate() - day);
  thisSunday.setHours(0, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    const sunday = new Date(thisSunday);
    sunday.setDate(thisSunday.getDate() - i * 7);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const labelFmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    weeks.push({
      label:     `${labelFmt(sunday)} – ${labelFmt(saturday)}`,
      weekStart: fmt(sunday),
      weekEnd:   fmt(saturday),
    });
  }
  return weeks;
}

export function usePayPeriods(): PayPeriod[] {
  return getSundayWeeks(13);
}

// Row shape returned by the Supabase join query
interface TimeEntryQueryRow {
  id: string;
  schedule_id: string;
  employee_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  duration_minutes: number | null;
  billable_units: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join result
  users: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join result
  schedules: any;
}

export function useTimesheetSummary(filters: TimesheetFilters) {
  const { profile } = useAuthStore();

  return useQuery<TimesheetRow[]>({
    queryKey: ['timesheets', profile?.company_id, filters],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      // Fetch time entries in the date range
      let q = supabase
        .from('time_entries')
        .select(`
          id, schedule_id, employee_id, clocked_in_at, clocked_out_at,
          duration_minutes, billable_units,
          users!employee_id(full_name, email),
          schedules!schedule_id(client_id, clients(name))
        `)
        .eq('company_id', profile!.company_id!)
        .gte('clocked_in_at', filters.weekStart)
        .lte('clocked_in_at', filters.weekEnd + 'T23:59:59');

      if (filters.employeeId) q = q.eq('employee_id', filters.employeeId);

      const { data, error } = await q;
      if (error) throw error;

      // Group by employee
      const map = new Map<string, TimesheetRow>();

      for (const rawEntry of (data ?? [])) {
        const entry = rawEntry as unknown as TimeEntryQueryRow;
        const user = entry.users;
        const eid = entry.employee_id;
        if (!map.has(eid)) {
          map.set(eid, {
            employee_id:   eid,
            full_name:     (user?.full_name as string | undefined) ?? 'Unknown',
            email:         (user?.email as string | undefined) ?? '',
            entries:       [],
            totalMinutes:  0,
            totalHours:    0,
            regularHours:  0,
            overtimeHours: 0,
            billableUnits: 0,
          });
        }
        const row = map.get(eid)!;
        const mins = entry.duration_minutes ?? 0;
        const clientName = (entry.schedules?.clients?.name as string | undefined) ?? undefined;
        row.entries.push({
          id:               entry.id,
          schedule_id:      entry.schedule_id,
          employee_id:      entry.employee_id,
          clocked_in_at:    entry.clocked_in_at,
          clocked_out_at:   entry.clocked_out_at,
          duration_minutes: entry.duration_minutes,
          billable_units:   entry.billable_units,
          client_name:      clientName,
        });
        row.totalMinutes  += mins;
        row.billableUnits += entry.billable_units ?? 0;
      }

      // Calculate regular vs OT (>40 hours in the week = overtime)
      for (const row of map.values()) {
        const hours = row.totalMinutes / 60;
        row.totalHours    = hours;
        row.regularHours  = Math.min(hours, 40);
        row.overtimeHours = Math.max(0, hours - 40);
      }

      return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    staleTime: 30_000,
  });
}
