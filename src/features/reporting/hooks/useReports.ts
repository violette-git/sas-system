import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';

// ── Types ─────────────────────────────────────────────────────

export interface WeeklyHoursPoint {
  weekLabel:    string; // "Mar 3"
  weekStart:    string; // ISO date
  totalMinutes: number;
}

export interface EmployeePerformanceRow {
  employee_id:       string;
  full_name:         string;
  scheduledVisits:   number;
  completedVisits:   number;
  completionRate:    number; // 0–100
  totalHours:        number;
  notesSubmitted:    number;
  notesApproved:     number;
  approvalRate:      number; // 0–100
}

export interface ClientReportRow {
  client_id:        string;
  client_name:      string;
  scheduledVisits:  number;
  completedVisits:  number;
  totalHours:       number;
  billableUnits:    number;
  totalInvoiced:    number;
}

export interface DashboardStats {
  totalVisitsThisMonth:     number;
  completedVisitsThisMonth: number;
  completionRate:           number;
  totalHoursThisMonth:      number;
  totalInvoicedThisMonth:   number;
  activeClients:            number;
  activeEmployees:          number;
  pendingNotes:             number;
}

export interface CompanyMetrics {
  company_id:       string;
  company_name:     string;
  totalEmployees:   number;
  totalClients:     number;
  visitsThisMonth:  number;
  hoursThisMonth:   number;
  revenueThisMonth: number;
}

// ── Helpers ────────────────────────────────────────────────────

function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function getLast8Weeks(): Array<{ weekStart: string; weekEnd: string; label: string }> {
  const weeks = [];
  const today = new Date();
  const day = today.getDay();
  const thisSunday = new Date(today);
  thisSunday.setDate(today.getDate() - day);
  thisSunday.setHours(0, 0, 0, 0);

  for (let i = 7; i >= 0; i--) {
    const sun = new Date(thisSunday);
    sun.setDate(thisSunday.getDate() - i * 7);
    const sat = new Date(sun);
    sat.setDate(sun.getDate() + 6);
    weeks.push({
      weekStart: sun.toISOString().slice(0, 10),
      weekEnd:   sat.toISOString().slice(0, 10),
      label:     sun.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    });
  }
  return weeks;
}

// ── Hooks ──────────────────────────────────────────────────────

export function useDashboardStats() {
  const { profile } = useAuthStore();
  const ms = monthStart();

  return useQuery<DashboardStats>({
    queryKey: ['dashboard_stats', profile?.company_id, ms],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const cid = profile!.company_id!;

      const [
        { data: schedules },
        { data: timeEntries },
        { data: invoices },
        { count: activeClients },
        { count: activeEmployees },
        { count: pendingNotes },
      ] = await Promise.all([
        supabase.from('schedules').select('id, status').eq('company_id', cid).gte('start_time', ms),
        supabase.from('time_entries').select('duration_minutes').eq('company_id', cid).gte('clocked_in_at', ms),
        supabase.from('invoices').select('total_amount').eq('company_id', cid).gte('created_at', ms).neq('status', 'draft'),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', cid).eq('is_active', true),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('company_id', cid).eq('role', 'employee'),
        supabase.from('visit_notes').select('id', { count: 'exact', head: true }).eq('company_id', cid).eq('status', 'submitted'),
      ]);

      const total     = (schedules ?? []).length;
      const completed = (schedules ?? []).filter(s => s.status === 'completed').length;
      const mins      = (timeEntries ?? []).reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
      const invoiced  = (invoices ?? []).reduce((s, i) => s + (i.total_amount ?? 0), 0);

      return {
        totalVisitsThisMonth:     total,
        completedVisitsThisMonth: completed,
        completionRate:           total > 0 ? Math.round((completed / total) * 100) : 0,
        totalHoursThisMonth:      mins / 60,
        totalInvoicedThisMonth:   invoiced,
        activeClients:            activeClients ?? 0,
        activeEmployees:          activeEmployees ?? 0,
        pendingNotes:             pendingNotes ?? 0,
      };
    },
    staleTime: 60_000,
  });
}

export function useWeeklyHours() {
  const { profile } = useAuthStore();
  const weeks = getLast8Weeks();

  return useQuery<WeeklyHoursPoint[]>({
    queryKey: ['weekly_hours', profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('clocked_in_at, duration_minutes')
        .eq('company_id', profile!.company_id!)
        .gte('clocked_in_at', weeks[0].weekStart);
      if (error) throw error;

      return weeks.map(week => {
        const weekMins = (data ?? [])
          .filter(e => e.clocked_in_at >= week.weekStart && e.clocked_in_at <= week.weekEnd + 'T23:59:59')
          .reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
        return { weekLabel: week.label, weekStart: week.weekStart, totalMinutes: weekMins };
      });
    },
    staleTime: 60_000,
  });
}

export function useEmployeePerformance(dateFrom?: string, dateTo?: string) {
  const { profile } = useAuthStore();
  const ms = monthStart();
  const from = dateFrom ?? ms;
  const to   = dateTo   ?? new Date().toISOString();

  return useQuery<EmployeePerformanceRow[]>({
    queryKey: ['employee_performance', profile?.company_id, from, to],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const cid = profile!.company_id!;

      const [{ data: employees }, { data: schedules }, { data: notes }, { data: timeEntries }] = await Promise.all([
        supabase.from('users').select('id, full_name').eq('company_id', cid).eq('role', 'employee'),
        supabase.from('schedules').select('id, employee_id, status').eq('company_id', cid).gte('start_time', from).lte('start_time', to),
        supabase.from('visit_notes').select('id, author_id, status').eq('company_id', cid).gte('created_at', from).lte('created_at', to),
        supabase.from('time_entries').select('employee_id, duration_minutes').eq('company_id', cid).gte('clocked_in_at', from).lte('clocked_in_at', to),
      ]);

      return (employees ?? []).map(emp => {
        const empSchedules = (schedules ?? []).filter(s => s.employee_id === emp.id);
        const empNotes     = (notes ?? []).filter(n => n.author_id === emp.id);
        const empEntries   = (timeEntries ?? []).filter(e => e.employee_id === emp.id);
        const scheduled    = empSchedules.length;
        const completed    = empSchedules.filter(s => s.status === 'completed').length;
        const submitted    = empNotes.length;
        const approved     = empNotes.filter(n => n.status === 'approved').length;
        const totalMins    = empEntries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);

        return {
          employee_id:     emp.id,
          full_name:       emp.full_name,
          scheduledVisits: scheduled,
          completedVisits: completed,
          completionRate:  scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
          totalHours:      totalMins / 60,
          notesSubmitted:  submitted,
          notesApproved:   approved,
          approvalRate:    submitted > 0 ? Math.round((approved / submitted) * 100) : 0,
        };
      });
    },
    staleTime: 60_000,
  });
}

export function useClientReport(dateFrom?: string, dateTo?: string) {
  const { profile } = useAuthStore();
  const ms = monthStart();
  const from = dateFrom ?? ms;
  const to   = dateTo   ?? new Date().toISOString();

  return useQuery<ClientReportRow[]>({
    queryKey: ['client_report', profile?.company_id, from, to],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const cid = profile!.company_id!;

      const [{ data: clients }, { data: schedules }, { data: invoices }] = await Promise.all([
        supabase.from('clients').select('id, name').eq('company_id', cid).eq('is_active', true),
        supabase.from('schedules').select('id, client_id, status').eq('company_id', cid).gte('start_time', from).lte('start_time', to),
        supabase.from('invoices').select('client_id, total_amount').eq('company_id', cid).gte('created_at', from).lte('created_at', to).neq('status', 'draft'),
      ]);

      // Need time entries for billable hours — fetch via schedule ids
      const scheduleIds = (schedules ?? []).map(s => s.id);
      const entryMap = new Map<string, Array<{ duration_minutes: number; billable_units: number }>>();
      if (scheduleIds.length > 0) {
        const { data: entries } = await supabase
          .from('time_entries')
          .select('schedule_id, duration_minutes, billable_units')
          .in('schedule_id', scheduleIds);
        for (const e of (entries ?? [])) {
          if (!entryMap.has(e.schedule_id)) entryMap.set(e.schedule_id, []);
          entryMap.get(e.schedule_id)!.push(e);
        }
      }

      return (clients ?? []).map(client => {
        const cSchedules = (schedules ?? []).filter(s => s.client_id === client.id);
        const cInvoices  = (invoices ?? []).filter(i => i.client_id === client.id);
        let totalMins = 0, billableUnits = 0;
        for (const s of cSchedules) {
          const entries = entryMap.get(s.id) ?? [];
          totalMins     += entries.reduce((x, e) => x + (e.duration_minutes ?? 0), 0);
          billableUnits += entries.reduce((x, e) => x + (e.billable_units   ?? 0), 0);
        }
        return {
          client_id:       client.id,
          client_name:     client.name,
          scheduledVisits: cSchedules.length,
          completedVisits: cSchedules.filter(s => s.status === 'completed').length,
          totalHours:      totalMins / 60,
          billableUnits,
          totalInvoiced:   cInvoices.reduce((s, i) => s + (i.total_amount ?? 0), 0),
        };
      }).filter(r => r.scheduledVisits > 0 || r.totalInvoiced > 0);
    },
    staleTime: 60_000,
  });
}

export function useCrossCompanyMetrics() {
  const { profile } = useAuthStore();
  const ms = monthStart();

  return useQuery<CompanyMetrics[]>({
    queryKey: ['cross_company_metrics', ms],
    enabled: profile?.role === 'owner',
    queryFn: async () => {
      const { data: companies, error } = await supabase
        .from('companies')
        .select('id, name');
      if (error) throw error;

      const results: CompanyMetrics[] = [];
      for (const co of (companies ?? [])) {
        const [
          { count: empCount },
          { count: clientCount },
          { data: schedules },
          { data: entries },
          { data: invoices },
        ] = await Promise.all([
          supabase.from('users').select('id', { count: 'exact', head: true }).eq('company_id', co.id).eq('role', 'employee'),
          supabase.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', co.id).eq('is_active', true),
          supabase.from('schedules').select('id').eq('company_id', co.id).gte('start_time', ms),
          supabase.from('time_entries').select('duration_minutes').eq('company_id', co.id).gte('clocked_in_at', ms),
          supabase.from('invoices').select('total_amount').eq('company_id', co.id).gte('created_at', ms).neq('status', 'draft'),
        ]);

        results.push({
          company_id:       co.id,
          company_name:     co.name,
          totalEmployees:   empCount ?? 0,
          totalClients:     clientCount ?? 0,
          visitsThisMonth:  (schedules ?? []).length,
          hoursThisMonth:   (entries ?? []).reduce((s, e) => s + (e.duration_minutes ?? 0), 0) / 60,
          revenueThisMonth: (invoices ?? []).reduce((s, i) => s + (i.total_amount ?? 0), 0),
        });
      }
      return results;
    },
    staleTime: 300_000,
  });
}
