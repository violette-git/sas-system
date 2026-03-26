import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { AuditLog } from '@/lib/supabase';

export interface AuditLogFilters {
  userId?: string;
  action?: string;       // prefix match, e.g. 'schedule'
  tableName?: string;
  dateFrom?: string;     // ISO date string
  dateTo?: string;
  search?: string;       // free-text search on action / table_name
  page?: number;
  pageSize?: number;
}

export interface AuditLogPage {
  logs: AuditLog[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 25;

export function useAuditLog(filters: AuditLogFilters = {}) {
  const { profile } = useAuthStore();
  const page     = filters.page     ?? 1;
  const pageSize = filters.pageSize ?? PAGE_SIZE;

  return useQuery<AuditLogPage>({
    queryKey: ['audit_log', profile?.company_id, filters],
    enabled: !!profile?.company_id && (profile.role === 'admin' || profile.role === 'owner'),
    queryFn: async () => {
      let query = supabase
        .from('audit_log')
        .select('*, users(full_name, email)', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Owner sees all companies; admin sees own company only
      if (profile!.role === 'admin') {
        query = query.eq('company_id', profile!.company_id!);
      }

      if (filters.userId)    query = query.eq('user_id', filters.userId);
      if (filters.tableName) query = query.eq('table_name', filters.tableName);
      if (filters.action)    query = query.ilike('action', `${filters.action}%`);
      if (filters.dateFrom)  query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) {
        // Include the full day by adding 1 day to dateTo
        const end = new Date(filters.dateTo);
        end.setDate(end.getDate() + 1);
        query = query.lt('created_at', end.toISOString());
      }
      if (filters.search) {
        query = query.or(`action.ilike.%${filters.search}%,table_name.ilike.%${filters.search}%`);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to   = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const totalCount = count ?? 0;
      return {
        logs: (data ?? []) as AuditLog[],
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    },
    staleTime: 30_000,
  });
}

/** Unique list of users who appear in audit logs (for the filter dropdown). */
export function useAuditLogUsers() {
  const { profile } = useAuthStore();

  return useQuery<Array<{ id: string; full_name: string; email: string }>>({
    queryKey: ['audit_log_users', profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('company_id', profile!.company_id!)
        .order('full_name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}
