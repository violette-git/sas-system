import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl
  ?? process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey
  ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Three-way storage adapter:
//   native          → expo-secure-store  (encrypted device keychain)
//   web client      → localStorage       (browser)
//   SSR / Node.js   → no-op              (window doesn't exist; session not needed)
const isNative    = Platform.OS !== 'web';
const isWebClient = Platform.OS === 'web' && typeof window !== 'undefined';

const secureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (isNative)    return SecureStore.getItemAsync(key);
    if (isWebClient) return window.localStorage.getItem(key);
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isNative)    return SecureStore.setItemAsync(key, value);
    if (isWebClient) window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (isNative)    return SecureStore.deleteItemAsync(key);
    if (isWebClient) window.localStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  global: {
    fetch: (url, options = {}) =>
      fetch(url, { ...options, cache: 'no-store' }),
  },
});

// ── Types mirroring the DB schema ────────────────────────────
export type UserRole = 'owner' | 'admin' | 'employee';

export interface UserProfile {
  id: string;
  company_id: string | null;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  avatar_url: string | null;
  phone: string | null;
}

export interface Company {
  id: string;
  name: string;
  trade_name: string | null;
  access_code: string;
  is_active: boolean;
}

export interface ServiceType {
  id: string;
  company_id: string;
  name: string;
  short_code: string | null;
  description: string | null;
  is_active: boolean;
}

export interface Authorization {
  id: string;
  company_id: string;
  client_id: string;
  service_type_id: string;
  auth_number: string;
  authorized_units: number; // 1 unit = 15 min; hours = authorized_units / 4
  start_date: string;       // YYYY-MM-DD
  end_date: string;
  notes: string | null;
  is_active: boolean;
}

export type ScheduleStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Schedule {
  id: string;
  company_id: string;
  employee_id: string;
  client_id: string;
  authorization_id: string | null;
  service_type_id: string | null;
  title: string | null;
  notes: string | null;
  start_time: string;
  end_time: string;
  status: ScheduleStatus;
  created_by: string | null;
  /** JSON recurrence rule — see RecurrenceRule in recurrence.ts */
  recurrence_rule: Record<string, unknown> | null;
  /** UUID linking all instances of the same recurring series */
  recurring_series_id: string | null;
}

export interface TimeEntry {
  id: string;
  schedule_id: string;
  employee_id: string;
  company_id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  duration_minutes: number | null; // generated — never write
  billable_units: number | null;   // generated — floor(minutes/15), never write
  clocked_in_lat: number | null;
  clocked_in_lon: number | null;
  clocked_out_lat: number | null;
  clocked_out_lon: number | null;
}

export interface VisitNote {
  id: string;
  schedule_id: string;
  author_id: string;
  company_id: string;
  body: string;
  goals_addressed: string | null;
  client_response: string | null;
  next_steps: string | null;
  supervisor_notified: boolean;
  is_draft: boolean;
}
