import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';

export interface Invoice {
  id: string;
  company_id: string;
  client_id: string;
  total_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  due_date: string | null;
  notes: string | null;
  created_at: string;
  clients?: { name: string } | null;
}

export interface GenerateInvoiceInput {
  clientId:  string;
  dateFrom:  string; // YYYY-MM-DD
  dateTo:    string;
}

// Shape of schedule rows returned by Supabase join
interface ScheduleQueryRow {
  id: string;
  service_type_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join result
  clients: any;
}

export function useInvoices(filters?: { clientId?: string; status?: string }) {
  const { profile } = useAuthStore();
  return useQuery<Invoice[]>({
    queryKey: ['invoices', profile?.company_id, filters],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      let q = supabase
        .from('invoices')
        .select('*, clients(name)')
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: false });
      if (filters?.clientId) q = q.eq('client_id', filters.clientId);
      if (filters?.status)   q = q.eq('status', filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  return useMutation({
    mutationFn: async (input: Partial<Invoice>) => {
      const { data, error } = await supabase
        .from('invoices')
        .insert({ ...input, company_id: profile!.company_id! })
        .select()
        .single();
      if (error) throw error;
      return data as Invoice;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Invoice['status'] }) => {
      const { error } = await supabase.from('invoices').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useGenerateInvoice() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async ({ clientId, dateFrom, dateTo }: GenerateInvoiceInput) => {
      // 1. Fetch completed schedules for client in range
      const { data: schedules, error: schErr } = await supabase
        .from('schedules')
        .select('id, service_type_id, clients(name)')
        .eq('client_id', clientId)
        .eq('company_id', profile!.company_id!)
        .eq('status', 'completed')
        .gte('start_time', dateFrom)
        .lte('start_time', dateTo + 'T23:59:59');
      if (schErr) throw schErr;

      const scheduleRows = (schedules ?? []) as unknown as ScheduleQueryRow[];
      const scheduleIds = scheduleRows.map(s => s.id);

      // 2. Sum billable units from time_entries
      let totalUnits = 0;
      if (scheduleIds.length > 0) {
        const { data: entries, error: entErr } = await supabase
          .from('time_entries')
          .select('billable_units')
          .in('schedule_id', scheduleIds);
        if (entErr) throw entErr;
        totalUnits = (entries ?? []).reduce(
          (sum, e) => sum + (e.billable_units ?? 0),
          0,
        );
      }

      // 3. Get billing rate from service_type (use first schedule's service type)
      let billingRate = 25;
      const firstSchedule = scheduleRows[0];
      if (firstSchedule?.service_type_id) {
        const { data: st } = await supabase
          .from('service_types')
          .select('billing_rate')
          .eq('id', firstSchedule.service_type_id)
          .maybeSingle();
        if (st?.billing_rate) billingRate = st.billing_rate as number;
      }

      // 4. Calculate total: units / 4 = hours, hours × billing_rate
      const totalHours  = totalUnits / 4;
      const totalAmount = totalHours * billingRate;

      const clientName = (firstSchedule?.clients?.name as string | undefined) ?? 'Client';
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      // 5. Insert invoice
      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert({
          client_id:    clientId,
          company_id:   profile!.company_id!,
          total_amount: totalAmount,
          status:       'draft',
          due_date:     dueDate.toISOString().slice(0, 10),
          notes:        `Auto-generated for ${clientName} ${dateFrom}–${dateTo}. ${totalUnits} units (${totalHours.toFixed(1)} hrs) @ $${billingRate}/hr`,
        })
        .select()
        .single();
      if (invErr) throw invErr;
      return invoice as Invoice;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}
